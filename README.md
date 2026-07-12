# Better Scanner

A multi-photo document scanner with Immich integration. Scans documents, auto-detects individual photos, and optionally uploads directly to Immich.

## Quick Start

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # edit with your settings
python main.py

# Frontend
cd frontend
npm install
npm start
```

Open http://localhost:3000

## Docker (Local Development)

```bash
# Create root .env with your save path
echo 'SAVE_PATH=/mnt/c/Users/flybo/OneDrive/Pictures/Scanner Images ( Nana&Mom )' > .env

docker compose up --build
```

Frontend at http://localhost:3000, backend at http://localhost:8000

## Docker (Server Deployment)

For running on a server alongside Immich:

```bash
# In backend/.env, set:
SAVE_MODE=immich_only

# Build frontend
cd frontend && npm run build && cd ..

# Start
docker compose -f docker-compose.server.yml up -d
```

nginx serves everything on port 80. Frontend is proxied from `/`, backend API from `/api/`.

## Configuration

All settings are in `backend/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | `0.0.0.0` | Backend bind address |
| `SERVER_PORT` | `8000` | Backend port |
| `DEBUG` | `True` | Hot reload + debug logging |
| `TARGET_DIR` | `./scans` | Where scanned files save to disk |
| `RAW_SCAN_PATH` | `raw_scan_temp.jpg` | Temp file for scan output |
| `SAVE_MODE` | `both` | Where scans go (see below) |
| `IMMICH_SERVER_URL` | - | Immich server URL |
| `IMMICH_API_KEY` | - | Immich API key |
| `IMMICH_ENABLED` | `True` | Enable Immich integration |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed CORS origins |

### Save Modes

| Mode | Behavior |
|------|----------|
| `local` | Save to disk only (`TARGET_DIR`) |
| `immich_only` | Upload to Immich only, no local copy |
| `both` | Save to disk AND upload to Immich |

When `SAVE_MODE=immich_only`:
- Manual crop mode is hidden (auto-detect only)
- Export format selector is hidden
- No files are written to disk
- History thumbnails still work (generated from in-memory images)

## How It Works

1. **Scan** — Select a scanner device (auto-discovered via SANE) and trigger a batch scan
2. **Detect** — Auto-detect mode uses OpenCV contour detection to split multiple photos from a single scan
3. **Edit** — Rotate, flip, rename, add descriptions, assign to Immich albums
4. **Save** — Save to disk, upload to Immich, or both

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/config` | Non-sensitive config (includes `save_mode`) |
| GET | `/api/devices` | List available SANE scanners |
| POST | `/api/scan` | Trigger a scan |
| POST | `/api/auto-detect` | Auto-detect photos from last scan |
| POST | `/api/crop` | Manually crop areas from scan |
| POST | `/api/transform/{id}` | Rotate/flip a photo |
| DELETE | `/api/photo/{id}` | Delete a photo |
| POST | `/api/save` | Save photos (to disk and/or Immich) |
| GET | `/api/immich/health` | Check Immich server |
| GET | `/api/immich/albums` | List Immich albums |
| GET | `/api/session` | Current session state |
| POST | `/api/session/clear` | Clear session |
| GET | `/api/history` | Recent scan thumbnails |
| POST | `/api/history/clear` | Clear history |

## Tech Stack

- **Backend**: Python 3.11, FastAPI, OpenCV, Pillow, SANE (scanimage)
- **Frontend**: React 18, Zustand, Axios
- **Deployment**: Docker, nginx reverse proxy
