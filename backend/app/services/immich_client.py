import requests
import logging
import mimetypes
import hashlib
from io import BytesIO
from datetime import datetime
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

    def _guess_mime_type(self, filename: str) -> str:
        mime_type, _ = mimetypes.guess_type(filename)
        return mime_type or 'application/octet-stream'

    def _try_upload(self, file_obj, filename: str, album_id: Optional[str] = None, description: Optional[str] = None) -> tuple[bool, Optional[str]]:
        file_obj.seek(0, os.SEEK_END)
        file_size = file_obj.tell()
        file_obj.seek(0)

        # Generate deduplication parameters required by modern Immich APIs
        device_id = "python-photo-scanner"
        seed_string = f"{filename}-{file_size}".encode('utf-8')
        device_asset_id = hashlib.md5(seed_string).hexdigest()
        
        # Format standardized UTC timestamps
        current_iso_time = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')

        # Modern Immich expects form parameters alongside the binary file field
        base_data = {
            "deviceAssetId": device_asset_id,
            "deviceId": device_id,
            "fileCreatedAt": current_iso_time,
            "fileModifiedAt": current_iso_time,
            "isFavorite": "false"
        }
        if description:
            base_data["description"] = description
            logger.debug(f"Adding description to upload payload: {description}")

        # Field permutations. 'assetData' is the correct key for modern v1.x instances
        field_names = ["assetData", "file", "file[]", "files", "asset", "assets", "image"]
        upload_paths = ["/api/assets", "/api/asset"]

        for upload_path in upload_paths:
            for field_name in field_names:
                file_obj.seek(0)
                logger.debug(f"Trying upload path {upload_path} with multipart key: {field_name}")
                
                try:
                    response = requests.post(
                        f"{self.server_url.rstrip('/')}{upload_path}",
                        files=[(field_name, (filename, file_obj, self._guess_mime_type(filename)))],
                        data=base_data,
                        headers=self._get_headers(),
                        timeout=60,
                    )

                    logger.debug(f"Upload attempt {upload_path} field '{field_name}' returned {response.status_code}")
                    
                    if response.status_code in [200, 201]:
                        try:
                            result = response.json()
                            asset_id = result.get("id") or result.get("asset", {}).get("id")
                            logger.info(f"Successfully uploaded image using {upload_path} field '{field_name}': {asset_id}")
                            return True, asset_id
                        except Exception as e:
                            logger.warning(f"Could not parse asset ID from valid JSON response: {e}")
                            return True, None

                    # If endpoint doesn't exist (404) or rejects field format (400), log warning and check next permutation
                    if response.status_code in [400, 404]:
                        logger.warning(f"Field '{field_name}' or path '{upload_path}' rejected by server (Status {response.status_code}). Advancing...")
                        continue

                    logger.error(f"Immich upload failed at {upload_path} with status: {response.status_code} - {response.text}")
                    return False, None

                except requests.exceptions.ConnectionError as e:
                    logger.error(f"Immich server unreachable: {e}")
                    break
                except requests.exceptions.Timeout as e:
                    logger.error(f"Immich request timed out: {e}")
                    break
                except Exception as loop_err:
                    logger.error(f"Network transport error inside upload block logic: {loop_err}")
                    continue
            else:
                continue
            break

        logger.error(f"All upload attempts failed for filename: {filename} - server may be offline")
        return False, None

    def add_asset_to_album(self, asset_id: str, album_id: str) -> bool:
        if not asset_id:
            logger.warning("No asset ID provided to add to album")
            return False

        logger.debug(f"Adding asset {asset_id} to album {album_id}")
        try:
            # Modern Immich uses PUT on /api/albums/{id}/assets to update album contents
            response = requests.put(
                f"{self.server_url.rstrip('/')}/api/albums/{album_id}/assets",
                json={"ids": [asset_id]},
                headers=self._get_headers(),
                timeout=30,
            )
            if response.status_code in [200, 201]:
                logger.info(f"Successfully added asset {asset_id} to album {album_id}")
                return True
            logger.warning(f"Failed to add asset to album: {response.status_code} - {response.text}")
            return False
        except requests.exceptions.Timeout:
            logger.error(f"Timeout adding asset {asset_id} to album {album_id}")
            return False
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error adding asset to album: {e}")
            return False
        except Exception as e:
            logger.error(f"Error adding asset to album: {e}", exc_info=True)
            return False

    def upload_image(self, file_path: str, album_id: Optional[str] = None, description: Optional[str] = None) -> tuple[bool, Optional[str]]:
        """
        Upload an image file from a local storage path to Immich.
        Returns: (success: bool, asset_id: Optional[str])
        """
        if not self.enabled:
            logger.debug("Immich is disabled, skipping upload")
            return False, None

        if not os.path.exists(file_path):
            logger.warning(f"File not found for upload: {file_path}")
            return False, None

        try:
            with open(file_path, "rb") as file_stream:
                success, asset_id = self._try_upload(file_stream, os.path.basename(file_path), album_id=None, description=description)
                if not success:
                    return False, None

                if album_id and asset_id:
                    self.add_asset_to_album(asset_id, album_id)
                return True, asset_id
        except Exception as e:
            logger.error(f"Error uploading to Immich: {e}", exc_info=True)
            return False, None

    def upload_image_bytes(self, file_bytes: bytes, filename: str, album_id: Optional[str] = None, description: Optional[str] = None) -> tuple[bool, Optional[str]]:
        """
        Upload an image directly from its memory buffer to Immich.
        """
        if not self.enabled:
            logger.debug("Immich is disabled, skipping upload")
            return False, None

        try:
            file_obj = BytesIO(file_bytes)
            success, asset_id = self._try_upload(file_obj, filename, album_id=None, description=description)
            if not success:
                return False, None

            if album_id and asset_id:
                self.add_asset_to_album(asset_id, album_id)
            return True, asset_id
        except Exception as e:
            logger.error(f"Error uploading bytes to Immich: {e}", exc_info=True)
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
                f"{self.server_url.rstrip('/')}/api/albums",
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
                f"{self.server_url.rstrip('/')}/api/albums",
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