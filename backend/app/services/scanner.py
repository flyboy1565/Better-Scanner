import re
import subprocess
import os
import time
import socket
import logging
from typing import Tuple, Optional
from urllib.parse import urlparse
from app.core.config import settings

logger = logging.getLogger(__name__)


class ScannerService:
    """Handles SANE scanner operations"""

    @staticmethod
    def discover_devices() -> list[dict[str, str]]:
        """Dynamically discover available SANE scanner devices on the network"""
        try:
            logger.info("Discovering SANE devices via scanimage -L")
            result = subprocess.run(
                ["scanimage", "-L"],
                capture_output=True, text=True, check=True, timeout=30
            )

            devices = []
            for line in result.stdout.strip().split('\n'):
                line = line.strip()
                if not line or not line.startswith('device `'):
                    continue

                try:
                    uri = line.split("`")[1].split("'")[0]
                    description = line.split("' is a ")[-1] if "' is a " in line else uri
                    ip = ""
                    ip_match = re.search(r'ip=([0-9.]+)', description)
                    if ip_match:
                        ip = ip_match.group(1)

                    label = uri.split(":", 2)[-1] if uri.startswith("airscan:") else description
                    name = label

                    devices.append({"name": name, "uri": uri, "ip": ip})
                except (IndexError, ValueError):
                    logger.warning(f"Could not parse scanimage output line: {line}")
                    continue

            if not devices:
                logger.warning("No SANE devices discovered on the network")
            else:
                logger.info(f"Discovered {len(devices)} device(s): {[d['name'] for d in devices]}")

            return devices

        except FileNotFoundError:
            logger.error("scanimage command not found. Is SANE (sane-utils) installed?")
            return []
        except subprocess.CalledProcessError as e:
            logger.error(f"scanimage -L failed (rc={e.returncode}): {e.stderr}")
            return []
        except subprocess.TimeoutExpired:
            logger.error("scanimage -L timed out after 30s")
            return []
        except Exception as e:
            logger.error(f"Unexpected error discovering devices: {str(e)}", exc_info=True)
            return []

    @staticmethod
    def get_available_devices() -> list[dict[str, str]]:
        """Return list of available scanner devices (dynamic discovery)"""
        return ScannerService.discover_devices()

    @staticmethod
    def _extract_ip_from_uri(device_uri: str) -> Optional[str]:
        """Extract IP address from a scanner device URI."""
        ip_match = re.search(r'(\d+\.\d+\.\d+\.\d+)', device_uri)
        return ip_match.group(1) if ip_match else None

    @staticmethod
    def _kill_stale_scanimage():
        """Kill any leftover scanimage process that may still hold the device."""
        # Use Python to scan /proc since slim images may lack pkill/pgrep/ps
        import signal
        try:
            killed = 0
            for pid in os.listdir('/proc'):
                if not pid.isdigit():
                    continue
                try:
                    with open(f"/proc/{pid}/comm", "r") as f:
                        comm = f.read().strip()
                    if comm == "scanimage":
                        os.kill(int(pid), signal.SIGKILL)
                        killed += 1
                except (FileNotFoundError, ProcessLookupError, PermissionError):
                    continue
                except (IsADirectoryError, OSError):
                    continue
            if killed:
                logger.info(f"Killed {killed} stale scanimage process(es) holding the scanner")
            else:
                logger.debug("No stale scanimage processes to kill")
        except Exception as e:
            logger.warning(f"Failed to kill stale scanimage processes: {e}")

    @staticmethod
    def check_connection(device_uri: str, timeout: int = 5) -> bool:
        """Quick connectivity check: try TCP connect to scanner's HTTPS port."""
        ip = ScannerService._extract_ip_from_uri(device_uri)
        if not ip:
            logger.warning(f"Could not extract IP from URI: {device_uri}")
            return False
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((ip, 443))
            sock.close()
            if result == 0:
                logger.info(f"Connection check OK for {ip}:443")
                return True
            logger.warning(f"Connection check FAILED for {ip}:443 (error {result})")
            return False
        except Exception as e:
            logger.warning(f"Connection check exception for {ip}: {e}")
            return False

    @staticmethod
    def trigger_sane_scan(device_uri: str, source_input: str = "Platen") -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Trigger a SANE scan from the specified device.
        Returns: (success: bool, file_path: Optional[str], error: Optional[str])
        """
        sane_source = "Flatbed" if source_input == "Platen" else "ADF"
        raw_scan_path = settings.RAW_SCAN_PATH

        source_arg = f"--source={sane_source}"
        cmd = [
            "scanimage",
            "-d",
            device_uri,
            "--format=jpeg",
            "--mode=Color",
            f"--resolution={settings.SCAN_RESOLUTION}",
            f"--output-file={raw_scan_path}",
        ]

        logger.info(f"Starting scan - device: {device_uri}, source: {sane_source}, output: {raw_scan_path}")

        # Kill any stale scanimage process left holding the device by a
        # previous aborted/timeout scan. Otherwise the eSCL backend reports
        # "Device busy" and every attempt fails.
        ScannerService._kill_stale_scanimage()
        max_retries = 2
        retry_delay = 2.0

        # Errors that indicate the device is locked or the eSCL session is stuck.
        # Retrying immediately won't help, so bail out fast instead of burning time.
        non_retryable_errors = [
            "device busy",
            "device has another task running",
            "sane_start: device busy",
        ]

        for attempt in range(1, max_retries + 1):
            logger.info(f"Scan attempt {attempt}/{max_retries}")

            effective_cmd = cmd[:]
            effective_cmd.insert(3, source_arg)

            logger.debug(f"Command: {' '.join(effective_cmd)}")

            try:
                result = subprocess.run(effective_cmd, capture_output=True, text=True, check=True, timeout=120)

                if os.path.exists(raw_scan_path) and os.path.getsize(raw_scan_path) > 0:
                    file_size = os.path.getsize(raw_scan_path)
                    logger.info(f"Scan successful on attempt {attempt} - file: {raw_scan_path}, size: {file_size} bytes")
                    return True, raw_scan_path, None

                logger.warning(f"Attempt {attempt}: scanimage exited cleanly but output file is missing or empty")
                if attempt < max_retries:
                    logger.info(f"Retrying in {retry_delay}s...")
                    time.sleep(retry_delay)
                else:
                    logger.error("Scan failed after all retries: output file missing or empty")
                    return False, None, "Scan succeeded but output file is empty or missing"

            except subprocess.CalledProcessError as e:
                error_msg = e.stderr.strip() if e.stderr else "SANE backend error"
                logger.error(f"Attempt {attempt} failed (rc={e.returncode}): {error_msg}")

                # Fail fast if the device is locked/stuck - retrying won't help
                lower_error = error_msg.lower()
                if any(err in lower_error for err in non_retryable_errors):
                    logger.error(f"Non-retryable error ({error_msg}), aborting")
                    return False, None, ScannerService._classify_error(error_msg, device_uri)

                # Retry without --source if backend rejected it
                if "Invalid argument" in error_msg and source_arg in effective_cmd and attempt == 1:
                    logger.info(f"Backend rejected --source, retrying without it...")
                    effective_cmd = [a for a in effective_cmd if a != source_arg]
                    try:
                        result = subprocess.run(effective_cmd, capture_output=True, text=True, check=True, timeout=120)
                        if os.path.exists(raw_scan_path) and os.path.getsize(raw_scan_path) > 0:
                            file_size = os.path.getsize(raw_scan_path)
                            logger.info(f"Scan successful without --source - file: {raw_scan_path}, size: {file_size} bytes")
                            return True, raw_scan_path, None
                        logger.warning(f"Attempt {attempt} (no --source): scanimage exited cleanly but output file is missing or empty")
                    except subprocess.CalledProcessError as e2:
                        logger.error(f"Retry without --source also failed (rc={e2.returncode}): {e2.stderr.strip()}")
                    except subprocess.TimeoutExpired:
                        logger.error(f"Retry without --source timed out (120s)")

                if attempt < max_retries:
                    logger.info(f"Retrying in {retry_delay}s...")
                    time.sleep(retry_delay)
                else:
                    logger.error(f"Scan failed after {max_retries} attempts: {error_msg}")
                    return False, None, ScannerService._classify_error(error_msg, device_uri)

            except subprocess.TimeoutExpired:
                logger.error(f"Attempt {attempt} timed out (120s)")
                if attempt < max_retries:
                    logger.info(f"Retrying in {retry_delay}s...")
                    time.sleep(retry_delay)
                else:
                    logger.error("Scan timed out after all retries")
                    return False, None, "Scan operation timed out"

            except Exception as e:
                logger.error(f"Attempt {attempt} failed with unexpected error: {str(e)}", exc_info=True)
                if attempt < max_retries:
                    logger.info(f"Retrying in {retry_delay}s...")
                    time.sleep(retry_delay)
                else:
                    logger.error(f"Unexpected error after {max_retries} attempts: {str(e)}")
                    return False, None, f"Unexpected error: {str(e)}"

        return False, None, "Scan failed: maximum retries exceeded"

    @staticmethod
    def _classify_error(error_msg: str, device_uri: str) -> str:
        """Classify scan error as connection issue vs scan failure."""
        connection_keywords = [
            "Connection refused", "Connection timed out", "No route to host",
            "Network is unreachable", "Host is down", "Broken pipe",
            "reset by peer", "connection closed", "cannot connect",
            "failed to connect", "unreachable", "timeout",
        ]
        lower = error_msg.lower()
        if any(kw in lower for kw in connection_keywords):
            return f"CONNECTION_ISSUE:Could not connect to scanner at {device_uri}"

        # Last resort: do a live connection check
        if not ScannerService.check_connection(device_uri, timeout=5):
            return f"CONNECTION_ISSUE:Could not connect to scanner at {device_uri}"

        return f"SCAN_FAILED:{error_msg}"
