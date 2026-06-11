import requests
import logging
from pathlib import Path
from typing import Optional, List
from app.core.config import settings
import os

# Configure logger for this module
logger = logging.getLogger(__name__)


class ImmichClient:
    """Handles Immich API interactions"""

    def __init__(self):
        self.server_url = settings.IMMICH_SERVER_URL
        self.api_key = settings.IMMICH_API_KEY
        self.enabled = settings.IMMICH_ENABLED and bool(self.api_key)
        logger.info(f"ImmichClient initialized: enabled={self.enabled}, server={self.server_url}")

    def _get_headers(self) -> dict:
        """Get authorization headers for Immich API"""
        return {
            "x-api-key": self.api_key,
            "Accept": "application/json",
        }

    def health_check(self) -> bool:
        """Check if Immich server is reachable and API key is valid"""
        if not self.enabled:
            logger.debug("Immich is disabled, skipping health check")
            return False

        try:
            # Try /api/albums endpoint (known to work), fall back to other endpoints if needed
            logger.debug(f"Checking Immich health at {self.server_url}/api/albums")
            response = requests.get(f"{self.server_url}/api/albums", headers=self._get_headers(), timeout=10)
            if response.status_code == 200:
                logger.info("Immich health check passed")
                return True
            else:
                logger.warning(f"Immich health check failed: status {response.status_code}")
                return False
        except requests.exceptions.Timeout as e:
            logger.error(f"Immich health check timeout: {e}")
            return False
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Immich connection error: {e}")
            return False
        except Exception as e:
            logger.error(f"Immich health check failed: {e}", exc_info=True)
            return False

    def upload_image(self, file_path: str, album_id: Optional[str] = None) -> tuple[bool, Optional[str]]:
        """
        Upload an image to Immich.
        Returns: (success: bool, asset_id: Optional[str])
        """
        if not self.enabled:
            logger.debug("Immich is disabled, skipping upload")
            return False, None

        if not os.path.exists(file_path):
            logger.warning(f"File not found for upload: {file_path}")
            return False, None

        try:
            logger.debug(f"Uploading image to Immich: {file_path}")
            data = {}
            if album_id:
                data["albumId"] = album_id
                logger.debug(f"Adding to album: {album_id}")

            field_names = ["file", "files", "asset", "assets", "image"]
            response = None
            asset_id = None

            with open(file_path, "rb") as file_stream:
                for field_name in field_names:
                    logger.debug(f"Trying upload field name: {field_name}")
                    response = requests.post(
                        f"{self.server_url}/api/assets",
                        files={field_name: file_stream},
                        data=data,
                        headers=self._get_headers(),
                        timeout=60,
                    )

                    logger.debug(f"Upload attempt using '{field_name}' returned {response.status_code}")
                    if response.status_code in [200, 201]:
                        try:
                            result = response.json()
                            asset_id = result.get("id") or result.get("asset", {}).get("id")
                            logger.info(f"Successfully uploaded image using field '{field_name}': {asset_id}")
                            return True, asset_id
                        except Exception as e:
                            logger.warning(f"Could not parse asset ID from response: {e}")
                            return True, None

                    if response.status_code == 400 and "Unexpected field" in response.text:
                        logger.warning(f"Field '{field_name}' not accepted by Immich, trying next field")
                        file_stream.seek(0)
                        continue
                    
                    logger.error(f"Immich upload failed with field '{field_name}': {response.status_code} - {response.text}")
                    return False, None

            logger.error(f"All upload field names failed for {file_path}")
            return False, None

        except requests.exceptions.Timeout:
            logger.error(f"Upload timeout for {file_path}")
            return False, None
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error uploading to Immich: {e}")
            return False, None
        except Exception as e:
            logger.error(f"Error uploading to Immich: {e}", exc_info=True)
            return False, None

    def upload_images(self, file_paths: List[str], album_id: Optional[str] = None) -> tuple[int, int]:
        """
        Upload multiple images to Immich.
        Returns: (successful_count, failed_count)
        """
        if not self.enabled:
            logger.warning(f"Immich disabled, skipping upload of {len(file_paths)} images")
            return 0, len(file_paths)

        logger.info(f"Starting batch upload of {len(file_paths)} images to Immich")
        successful = 0
        failed = 0

        for idx, file_path in enumerate(file_paths, 1):
            logger.debug(f"Uploading image {idx}/{len(file_paths)}: {file_path}")
            success, asset_id = self.upload_image(file_path, album_id)
            if success:
                successful += 1
            else:
                failed += 1

        logger.info(f"Batch upload complete: {successful} successful, {failed} failed")
        return successful, failed

    def get_albums(self) -> List[dict]:
        """Get list of Immich albums"""
        if not self.enabled:
            logger.debug("Immich is disabled, returning empty album list")
            return []

        try:
            logger.debug(f"Fetching albums from {self.server_url}/api/albums")
            response = requests.get(
                f"{self.server_url}/api/albums",
                headers=self._get_headers(),
                timeout=10,
            )

            if response.status_code == 200:
                albums = response.json()
                logger.info(f"Successfully fetched {len(albums)} albums from Immich")
                return albums
            else:
                logger.warning(f"Failed to fetch albums: status {response.status_code}")
                return []
        except requests.exceptions.Timeout:
            logger.error("Timeout fetching albums from Immich")
            return []
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error fetching albums: {e}")
            return []
        except Exception as e:
            logger.error(f"Error fetching Immich albums: {e}", exc_info=True)
            return []

    def create_album(self, album_name: str) -> Optional[str]:
        """Create a new album in Immich. Returns album ID if successful."""
        if not self.enabled:
            logger.warning(f"Immich disabled, cannot create album: {album_name}")
            return None

        try:
            logger.info(f"Creating album in Immich: {album_name}")
            response = requests.post(
                f"{self.server_url}/api/albums",
                json={"albumName": album_name},
                headers=self._get_headers(),
                timeout=10,
            )

            logger.debug(f"Create album response status: {response.status_code}")
            
            if response.status_code in [200, 201]:
                result = response.json()
                album_id = result.get("id")
                logger.info(f"Successfully created album: {album_name} (ID: {album_id})")
                return album_id
            else:
                logger.error(f"Failed to create album: {response.status_code} - {response.text}")
                return None
        except requests.exceptions.Timeout:
            logger.error(f"Timeout creating album: {album_name}")
            return None
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error creating album: {e}")
            return None
        except Exception as e:
            logger.error(f"Error creating Immich album: {e}", exc_info=True)
            return None
