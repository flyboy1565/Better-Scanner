import subprocess
import os
import time
import logging
from typing import Tuple, Optional
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
                    name = line.split("' is a ")[-1] if "' is a " in line else uri
                    devices.append({"name": name, "uri": uri})
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
    def trigger_sane_scan(device_uri: str, source_input: str = "Platen") -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Trigger a SANE scan from the specified device.
        Returns: (success: bool, file_path: Optional[str], error: Optional[str])
        """
        sane_source = "Flatbed" if source_input == "Platen" else "ADF"
        raw_scan_path = settings.RAW_SCAN_PATH

        cmd = [
            "scanimage",
            "-d",
            device_uri,
            f"--source={sane_source}",
            "--format=jpeg",
            "--mode=Color",
            "--resolution=600",
            f"--output-file={raw_scan_path}",
        ]

        logger.info(f"Starting scan - device: {device_uri}, source: {sane_source}, output: {raw_scan_path}")
        logger.debug(f"Command: {' '.join(cmd)}")

        max_retries = 6
        retry_delay = 4.0

        for attempt in range(1, max_retries + 1):
            logger.info(f"Scan attempt {attempt}/{max_retries}")
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=120)

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
                if attempt < max_retries:
                    logger.info(f"Retrying in {retry_delay}s...")
                    time.sleep(retry_delay)
                else:
                    logger.error(f"Scan failed after {max_retries} attempts: {error_msg}")
                    return False, None, f"Scan failed after {max_retries} attempts: {error_msg}"

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
