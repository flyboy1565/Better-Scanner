# Better Scanner — Session Context

## Current Task: Server Deployment + Upload-Only Mode

### Branch
`server-deployment`

### Completed

#### A. Backend: SAVE_MODE config + upload-only logic

1. **`backend/app/core/config.py`** — Added `SAVE_MODE: str = "both"` ("local" | "immich_only" | "both"), fixed `TARGET_DIR` default to `./scans`
2. **`backend/.env.example`** — Added `SAVE_MODE` with documentation
3. **`backend/app/api/endpoints.py`** — `POST /api/save`: implemented `immich_only` path (skip disk save, upload from memory via `upload_image_bytes`). Exposed `save_mode` in `GET /config`.
4. **`backend/app/models/schemas.py`** — Added `save_mode: Optional[str] = None` to `SaveRequest`

### B. Server Docker Compose

5. **`docker-compose.server.yml`** — New file: production compose with nginx reverse proxy, no live code mounts
6. **`nginx.conf`** — New file: reverse proxy config

### C. Frontend: Disable manual crop on server + expose save mode

7. **`frontend/src/components/App.js`** — Reads `save_mode` from `/config`, passes to ControlPanel
8. **`frontend/src/components/ControlPanel.js`** — Hides work mode selector on server, hides export format in `immich_only` mode, updates status messages

### D. Other Cleanup

9. **`docker-compose.yml`** — Removed orphaned `volumes: scans:` block (was lines 36-37)

### To Deploy on Server

1. Set `SAVE_MODE=immich_only` in `backend/.env`
2. Build frontend: `cd frontend && npm run build`
3. Run: `docker compose -f docker-compose.server.yml up -d`

### Key Notes

- `SAVE_MODE` controls where scans go:
  - `"local"` — Save to disk only (TARGET_DIR)
  - `"immich_only"` — Upload to Immich only, no local copy
  - `"both"` — Save to disk AND upload to Immich
- When `SAVE_MODE=immich_only`, manual crop is hidden from UI, export format selector is hidden, history thumbnails still work (generated from in-memory images)
- nginx serves frontend static files at `/` and proxies `/api/`, `/health`, `/config` to backend
- The `photoSaves` checkbox (Include in Save) is still UI-only — not yet wired to filter `photo_ids`

## Docker Compose save path (for local development)

For local dev, create `/home/flyboy1565/projects/better-scanner/.env` with:

```
SAVE_PATH=/mnt/c/Users/flybo/OneDrive/Pictures/Scanner Images ( Nana&Mom )
```

## Other findings (not yet addressed)

- `backend/.env` contains a live Immich API key — sensitive, don't commit
- `backend/app/core/config.py:12` hardcodes WSL path as default — fixed to `./scans`
- `photoSaves` checkbox doesn't actually filter photos sent to save endpoint
