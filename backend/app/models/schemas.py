from pydantic import BaseModel
from typing import Dict, List, Optional
from enum import Enum


class ScannerDevice(BaseModel):
    name: str
    uri: str
    ip: str = ""


class ImmichAlbum(BaseModel):
    id: str
    name: str
    assetCount: int = 0


class ScanSource(str, Enum):
    PLATEN = "Platen"
    ADF = "Adf"


class ScanRequest(BaseModel):
    device_uri: str
    source: ScanSource = ScanSource.PLATEN


class ScanResponse(BaseModel):
    success: bool
    message: str
    image_base64: Optional[str] = None
    error: Optional[str] = None


class PhotoExtract(BaseModel):
    id: int
    width: int
    height: int
    image_base64: str


class CropArea(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int


class CropRequest(BaseModel):
    areas: List[CropArea]


class SaveRequest(BaseModel):
    photo_ids: List[int]
    file_format: str = "JPEG"
    upload_to_immich: bool = False
    default_album_id: Optional[str] = None
    custom_names: Optional[Dict[str, str]] = None          # e.g., {"0": "Grandpa_1955"}
    photo_descriptions: Optional[Dict[str, str]] = None    # e.g., {"0": "Taken at the old house"}
    photo_album_overrides: Optional[Dict[str, str]] = None # e.g., {"0": "album-uuid-1"}
    save_mode: Optional[str] = None                        # Override server SAVE_MODE per-request


class SaveResponse(BaseModel):
    success: bool
    saved_count: int
    message: str
    photo_statuses: Optional[dict] = None
    error: Optional[str] = None
    upload_count: Optional[int] = None


class ImageTransform(BaseModel):
    rotation: int = 0  # 0, 90, -90, 180
    flip_h: bool = False
    flip_v: bool = False
