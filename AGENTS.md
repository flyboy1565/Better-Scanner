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

#### E. Docker Networking + Scanner Discovery

10. **`backend.Dockerfile`** — Added `sane-airscan`, `avahi-daemon`, `avahi-utils`, `dbus`, `nmap`, `libgl1`
11. **`backend/docker-start.sh`** — New entrypoint script that starts dbus + avahi, configures `airscan.conf` from `SCANNER_IP`/`SCANNER_IPS` env vars
12. **`docker-compose.yml`** — Added `SCANNER_IP`/`SCANNER_IPS` env vars, reverted port mapping (host networking broke WSL2 port forwarding)
13. **`backend/requirements.txt`** — Bumped `pydantic==2.5.0` → `2.7.0` to fix dependency conflict
14. **`docker-start.sh`** — Supports `SCANNER_IPS` (space-separated) for multiple scanners, falls back to `SCANNER_IP`
15. **`.env`** — Added `SCANNER_IPS=192.168.0.55 192.168.0.25` for local EPSON scanners
16. **`AGENTS.md`** — Updated with nmap discovery instructions and scanner details

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

## WSL2 + Docker (Scanner Discovery)

WiFi scanners use mDNS (multicast DNS) for discovery. On WSL2, Docker containers run inside the WSL2 VM, which is behind a NAT — mDNS packets can't reach the Windows host's LAN.

**Two options to fix scanner access:**

### A. Configure scanner IP statically (quickest/working)
Find your scanner's LAN IP via nmap TCP scan from inside the container:

```bash
# First find the LAN subnet by scanning for open port 80 on gateway IPs:
docker compose exec backend nmap -sT -p 80,443 -T5 192.168.1.1/30 192.168.0.1/30 10.0.0.1/30

# Look for `open http` on port 80 — that's your router/gateway (e.g. 192.168.0.1).
# Then scan that subnet for open port 80 or 443 to find the scanner:

docker compose exec backend nmap -sT -p 443,80 --open -T5 192.168.0.0/24
```

The scanner (EPSON) eSCL endpoint runs on **port 443 (HTTPS)**, not port 9095.

Add to `.env`:
```
# Single scanner:
SCANNER_IP=192.168.0.55
# Or multiple scanners (space-separated):
SCANNER_IPS=192.168.0.55 192.168.0.25
```

The `docker-start.sh` writes them to `/etc/sane.d/airscan.conf` as `https://$IP/eSCL` entries.

### B. WSL2 Mirrored Networking (mDNS auto-discovery)
Add to `%USERPROFILE%\.wslconfig` on Windows:
```ini
[wsl2]
networkingMode=mirrored
```
Then restart WSL: `wsl --shutdown` and reopen your terminal. This makes WSL2 share the host's network interfaces directly.

## Changes made during Docker networking session

- **`backend.Dockerfile`** — Added `sane-airscan`, `avahi-daemon`, `avahi-utils`, `dbus`, `nmap`, `libgl1`
- **`backend/docker-start.sh`** — New entrypoint script that starts dbus + avahi, configures `airscan.conf` from `SCANNER_IP`/`SCANNER_IPS` env vars (URL format: `https://$IP/eSCL`)
- **`docker-compose.yml`** — Added `SCANNER_IP`/`SCANNER_IPS` env vars, reverted port mapping (host networking broke WSL2 port forwarding)
- **`backend/requirements.txt`** — Bumped `pydantic==2.5.0` → `2.7.0` to fix dependency conflict
- **`.env`** — Added `SCANNER_IPS=192.168.0.55 192.168.0.25` for local EPSON scanners
- **`AGENTS.md`** — Updated with nmap discovery instructions and scanner details

## Other findings (not yet addressed)

- `backend/.env` contains a live Immich API key — sensitive, don't commit
- `backend/app/core/config.py:12` hardcodes WSL path as default — fixed to `./scans`
- `photoSaves` checkbox doesn't actually filter photos sent to save endpoint

## Scanner discovery notes

### EPSON ET-2800 Series (`192.168.0.55`)
- eSCL scanning endpoint: `https://192.168.0.55/eSCL/ScannerCapabilities`
- S/N: `58384B4A3333343951`

### EPSON WF-4720 Series (`192.168.0.25`)
- eSCL scanning endpoint: `https://192.168.0.25/eSCL/ScannerCapabilities`
- S/N: `583254533139383117`

### Both scanners
- Both use HTTPS on port 443 for eSCL (not port 9095)
- Both detected by `sane-airscan` with `https://<ip>/eSCL` URLs in `airscan.conf`
- Identified via nmap TCP scan for common printer ports (80, 443, 515, 631, 9100) on `192.168.0.0/24`

### Other LAN hosts
- `192.168.0.1` — Router (open: 80, 443)
- `192.168.0.6` — Unknown device (open: 22, 80, 443)
- `192.168.0.90` — Unknown device (open: 8080)
- `192.168.0.102` — Linux server (open: 22, 80, 443, 8080)
