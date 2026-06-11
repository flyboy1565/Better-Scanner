from fastapi import APIRouter, File, UploadFile, HTTPException, Form, BackgroundTasks
from fastapi.responses import JSONResponse
import base64
import os
import datetime
from PIL import Image
from io import BytesIO
from typing import List, Optional

from app.models.schemas import (
    ScanRequest,
    ScanResponse,
    SaveRequest,
    SaveResponse,
    CropRequest,
    PhotoExtract,
)
from app.services.scanner import ScannerService
from app.services.image_processor import ImageProcessor
from app.services.immich_client import ImmichClient
from app.core.config import settings

router = APIRouter(prefix="/api", tags=["scanner"])

# Global state for current scan session
current_session = {
    "photos": [],
    "full_raw_scan_path": None,
}


def image_to_base64(image: Image.Image) -> str:
    """Convert PIL Image to base64 string"""
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def base64_to_image(data: str) -> Image.Image:
    """Convert base64 string to PIL Image"""
    image_data = base64.b64decode(data)
    return Image.open(BytesIO(image_data))


@router.get("/devices")
def get_scanner_devices():
    """Get list of available scanner devices"""
    devices = ScannerService.get_available_devices()
    return {
        "devices": [
            {"name": name, "uri": uri} for name, uri in devices.items()
        ]
    }


@router.post("/scan", response_model=ScanResponse)
async def scan_document(request: ScanRequest):
    """Trigger a document scan"""
    success, file_path, error = ScannerService.trigger_sane_scan(
        device_uri=request.device_uri,
        source_input=request.source.value,
    )

    if not success:
        raise HTTPException(status_code=400, detail=error or "Scan failed")

    try:
        # Load the scanned image
        raw_image = Image.open(file_path)
        current_session["full_raw_scan_path"] = file_path

        # Return base64 encoded image
        image_base64 = image_to_base64(raw_image)

        return ScanResponse(
            success=True,
            message="Scan completed successfully",
            image_base64=image_base64,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing scan: {str(e)}")


@router.post("/auto-detect")
async def auto_detect_photos():
    """Auto-detect and split multiple photos from current scan"""
    if not current_session["full_raw_scan_path"]:
        raise HTTPException(status_code=400, detail="No scan in session. Trigger a scan first.")

    try:
        photos = ImageProcessor.split_multi_photo_scan(current_session["full_raw_scan_path"])
        current_session["photos"] = photos

        return {
            "success": True,
            "photo_count": len(photos),
            "photos": [
                {
                    "id": i,
                    "width": photo.width,
                    "height": photo.height,
                    "image_base64": image_to_base64(photo),
                }
                for i, photo in enumerate(photos)
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auto-detect failed: {str(e)}")


@router.post("/crop")
async def crop_from_scan(request: CropRequest):
    """Manually crop areas from the current scan"""
    if not current_session["full_raw_scan_path"]:
        raise HTTPException(status_code=400, detail="No scan in session. Trigger a scan first.")

    try:
        full_image = Image.open(current_session["full_raw_scan_path"])
        cropped_photos = []

        for i, area in enumerate(request.areas):
            cropped = ImageProcessor.crop_image(
                full_image,
                area.x1,
                area.y1,
                area.x2,
                area.y2,
            )
            cropped_photos.append(cropped)
            current_session["photos"].append(cropped)

        return {
            "success": True,
            "photos": [
                {
                    "id": len(current_session["photos"]) - len(cropped_photos) + i,
                    "width": photo.width,
                    "height": photo.height,
                    "image_base64": image_to_base64(photo),
                }
                for i, photo in enumerate(cropped_photos)
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Crop failed: {str(e)}")


@router.post("/transform/{photo_id}")
async def transform_photo(photo_id: int, rotation: int = 0, flip_h: bool = False, flip_v: bool = False):
    """Apply transformations (rotate, flip) to a photo"""
    if photo_id >= len(current_session["photos"]):
        raise HTTPException(status_code=404, detail="Photo not found")

    try:
        photo = current_session["photos"][photo_id]
        transformed = ImageProcessor.apply_transform(photo, rotation, flip_h, flip_v)
        current_session["photos"][photo_id] = transformed

        return {
            "success": True,
            "photo": {
                "id": photo_id,
                "width": transformed.width,
                "height": transformed.height,
                "image_base64": image_to_base64(transformed),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transform failed: {str(e)}")


@router.delete("/photo/{photo_id}")
async def delete_photo(photo_id: int):
    """Delete a photo from the current session"""
    if photo_id >= len(current_session["photos"]):
        raise HTTPException(status_code=404, detail="Photo not found")

    try:
        current_session["photos"].pop(photo_id)
        return {
            "success": True,
            "remaining_photos": len(current_session["photos"]),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@router.post("/save", response_model=SaveResponse)
async def save_photos(request: SaveRequest, background_tasks: BackgroundTasks):
    """Save selected photos to disk and optionally upload to Immich"""
    try:
        # Ensure target directory exists
        os.makedirs(settings.TARGET_DIR, exist_ok=True)

        saved_count = 0
        upload_count = 0
        now = datetime.datetime.now()
        timestamp_base = now.strftime("img%Y%m%d_%H%M%S%f")[:-4]
        saved_files = []
        photo_to_album = {}  # Track which album each file should go to

        # Save selected photos
        for photo_id in request.photo_ids:
            if photo_id >= len(current_session["photos"]):
                continue

            photo = current_session["photos"][photo_id]
            custom_name = (request.custom_names or {}).get(str(photo_id), "").strip()
            filename = (
                f"{custom_name}.{request.file_format.lower()}"
                if custom_name
                else f"{timestamp_base}_{photo_id + 1}.{request.file_format.lower()}"
            )
            full_path = os.path.join(settings.TARGET_DIR, filename)

            # Convert RGBA to RGB if saving as JPEG
            if request.file_format.upper() == "JPEG" and photo.mode == "RGBA":
                photo = photo.convert("RGB")

            photo.save(full_path, format=request.file_format.upper())
            saved_files.append(full_path)
            
            # Determine album for this photo
            photo_id_str = str(photo_id)
            if request.photo_album_overrides and photo_id_str in request.photo_album_overrides:
                # Use photo-specific override (can be None to skip upload)
                album_id = request.photo_album_overrides[photo_id_str]
            else:
                # Use default album
                album_id = request.default_album_id
            
            if album_id:  # Only track if album is set
                photo_to_album[full_path] = album_id
            
            saved_count += 1

        # Upload to Immich if requested
        immich_status = None
        if request.upload_to_immich and settings.IMMICH_ENABLED:
            immich_client = ImmichClient()
            if immich_client.enabled:
                # Create upload tasks for each file with its album
                for file_path in saved_files:
                    album_id = photo_to_album.get(file_path)
                    background_tasks.add_task(
                        immich_client.upload_image,
                        file_path,
                        album_id
                    )
                upload_count = len(saved_files)
                immich_status = f"Uploading {upload_count} photos to Immich in background..."

        # Clear session after saving
        current_session["photos"] = []
        current_session["full_raw_scan_path"] = None

        return SaveResponse(
            success=True,
            saved_count=saved_count,
            upload_count=upload_count,
            message=f"Successfully saved {saved_count} photos to {settings.TARGET_DIR}. {immich_status or ''}",
        )
    except Exception as e:
        return SaveResponse(
            success=False,
            saved_count=0,
            upload_count=0,
            message="Save operation failed",
            error=str(e),
        )


@router.get("/immich/health")
async def immich_health():
    """Check Immich server health"""
    immich_client = ImmichClient()
    is_healthy = immich_client.health_check()

    return {
        "enabled": immich_client.enabled,
        "healthy": is_healthy,
        "server_url": settings.IMMICH_SERVER_URL if is_healthy else None,
    }


@router.get("/immich/albums")
async def get_immich_albums():
    """Get list of Immich albums"""
    immich_client = ImmichClient()
    albums = immich_client.get_albums()

    return {
        "albums": albums,
    }


@router.get("/session")
async def get_session_state():
    """Get current session state"""
    return {
        "photo_count": len(current_session["photos"]),
        "has_full_scan": current_session["full_raw_scan_path"] is not None,
        "photos": [
            {
                "id": i,
                "width": photo.width,
                "height": photo.height,
            }
            for i, photo in enumerate(current_session["photos"])
        ],
    }


@router.post("/session/clear")
async def clear_session():
    """Clear current session"""
    current_session["photos"] = []
    current_session["full_raw_scan_path"] = None

    return {
        "success": True,
        "message": "Session cleared",
    }
