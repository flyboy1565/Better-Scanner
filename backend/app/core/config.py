from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Server
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = 8000
    DEBUG: bool = True

    # Scanner
    TARGET_DIR: str = "./scans"
    RAW_SCAN_PATH: str = "raw_scan_temp.jpg"

    # Save Mode: "local" | "immich_only" | "both"
    SAVE_MODE: str = "both"

    # Immich
    IMMICH_SERVER_URL: str = "https://photos-holfam.duckdns.org"
    IMMICH_API_KEY: str = ""
    IMMICH_ENABLED: bool = True

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
