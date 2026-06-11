import subprocess
import os
import time
from typing import Tuple, Optional
from app.core.config import settings


class ScannerService:
    """Handles SANE scanner operations"""

    # Scanner devices configuration
    DEVICES = {
        "Epson WF-4720 (WorkForce)": "airscan:w1:Epson WF-4720 (WorkForce)",
        "Epson ET-2800 (EcoTank)": "airscan:w2:Epson ET-2800 (EcoTank)",
    }

    @staticmethod
    def get_available_devices() -> dict:
        """Return list of available scanner devices"""
        return ScannerService.DEVICES

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
            "--resolution=600",
            f"--output-file={raw_scan_path}",
        ]

        max_retries = 6
        retry_delay = 4.0

        for attempt in range(1, max_retries + 1):
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=120)

                # Check if file was created and has content
                if os.path.exists(raw_scan_path) and os.path.getsize(raw_scan_path) > 0:
                    return True, raw_scan_path, None

                if attempt < max_retries:
                    time.sleep(retry_delay)
                else:
                    return False, None, "Scan succeeded but output file is empty or missing"

            except subprocess.CalledProcessError as e:
                error_msg = e.stderr if e.stderr else "SANE backend error"
                if attempt < max_retries:
                    time.sleep(retry_delay)
                else:
                    return False, None, f"Scan failed after {max_retries} attempts: {error_msg}"

            except subprocess.TimeoutExpired:
                error_msg = "Scan operation timed out"
                if attempt < max_retries:
                    time.sleep(retry_delay)
                else:
                    return False, None, error_msg

            except Exception as e:
                error_msg = str(e)
                if attempt < max_retries:
                    time.sleep(retry_delay)
                else:
                    return False, None, f"Unexpected error: {error_msg}"

        return False, None, "Scan failed: maximum retries exceeded"
