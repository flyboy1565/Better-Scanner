# Better Scanner — Session Context

## Current Task: Server Deployment + Upload-Only Mode

### CI/CD Plan (Phase 1 = in progress)

**Decision:** GitHub Actions + self-hosted runner on `holfam`. Repo already lives on GitHub (public, default `main`, deploy branch `server-deployment`). Server is internet-connected, so the runner (which polls GitHub outbound) works fine; the scanner stays LAN-only because all deploy steps run on `holfam` itself.

- Deploy trigger: **auto-deploy on push to `server-deployment`**
- Secrets: **GitHub Actions secrets** → injected at deploy time (Immich key never lives in repo or a stale server `.env`)

#### Phase 1 (in progress) — Repo foundation
1. Record this plan in `AGENTS.md`
2. Commit + push current `server-deployment` work (scanner fields in config, nginx brace fix, frontend API-URL fix, compose rewrite)
3. Restructure env handling:
   - Non-secret values (scanner IPs, SAVE_MODE, URLs, ports) → inline in `docker-compose.server.yml` `environment:`
   - `IMMICH_API_KEY` → `${IMMICH_API_KEY:?}` in compose, provided by CI
   - Remove stale server `backend/.env` (gitignored) so the key isn't live outside the secret store

#### Phase 2 — Workflow file
- `.github/workflows/deploy.yml`: trigger `push` to `server-deployment` only, `runs-on: self-hosted` (label `holfam`)
- Steps (all run on holfam):
  1. `actions/checkout@v4`
  2. `docker compose -f docker-compose.server.yml config` (early validation)
  3. `cd frontend && npm ci && REACT_APP_API_URL= npm run build` (same-origin relative API)
  4. Inject secrets → compose environment
  5. `docker compose -f docker-compose.server.yml up -d --build`
  6. Smoke test: curl `/health`, `/config`, `/api/devices` on `127.0.0.1:8082`; fail job if unhealthy

#### Phase 3 — Self-hosted runner on `holfam`
- Register runner (label `holfam`) in repo Settings → Actions → Runners, run as `flyboy1565`
- systemd service (`./svc.sh install && ./svc.sh start`) for persistence
- Restrict: no `pull_request` triggers (fork PRs = arbitrary code on server). Use GH "approve workflow runs from outside collaborators" for self-hosted.

#### Phase 4 — Cutover
- Remove legacy rsync/scp deploy path and stale server `backend/.env`
- Rollback = push/revert a commit to `server-deployment`
- Optional future: migrate to Gitea if de-GitHubing (workflow YAML nearly portable)

### Open Decisions (needed before Phases 2-4)
- Checkout dir: current `~/projects/better-scanner` (stable project name/network) vs clean `~/deploy/better-scanner`
- Whether repo stays public on GitHub
- Remove legacy manual deploy path after CI proves out

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
15. **`.env`** — Added `SCANNER_IPS=192.168.68.61 192.168.68.64` for local EPSON scanners
16. **`AGENTS.md`** — Updated with nmap discovery instructions and scanner details

### To Deploy on Server (current, pre-CI)

1. From the repo root, run with the secret in the environment:
   `IMMICH_API_KEY=... docker compose -f docker-compose.server.yml up -d --build`
2. `docker-compose.server.yml` has all non-secret config inline in `environment:`; only the key comes from the env var (`${IMMICH_API_KEY:?}`)
3. Access on LAN: `http://192.168.68.62:8082` (nginx bound to host port 8082; 80/443 owned by nginx-proxy-manager)
4. Servers alive on `holfam`:
   - `better-scanner-backend` / `better-scanner-nginx` (containers)
   - Both on `webproxy` (external) + `better-scanner_default` networks so npm can route to them by container name
   - Backend reaches Immich at internal `http://immich_server:2283` (same webproxy network)
   - nginx upstream → `better-scanner-backend:8000`

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
docker compose exec backend nmap -sT -p 80,443 -T5 192.168.68.0/22

# Look for `open http` on port 80 — that's your router/gateway.
# Then scan that subnet for open printer ports to find the scanner:

docker compose exec backend nmap -sT -p 443,80,515,631,9100 --open -T5 192.168.68.0/22
```

The scanner (EPSON) eSCL endpoint runs on **port 443 (HTTPS)**, not port 9095.

Add to `.env`:
```
# Single scanner:
SCANNER_IP=192.168.68.61
# Or multiple scanners (space-separated):
SCANNER_IPS=192.168.68.61 192.168.68.64
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
- **`.env`** — Added `SCANNER_IPS=192.168.68.67 192.168.68.61` for local EPSON scanners
- **`AGENTS.md`** — Updated with nmap discovery instructions and scanner details

## Other findings (not yet addressed)

- `backend/.env` contains a live Immich API key — sensitive, don't commit
- `backend/app/core/config.py:12` hardcodes WSL path as default — fixed to `./scans`
- `photoSaves` checkbox doesn't actually filter photos sent to save endpoint

## Scanner discovery notes

### EPSON ET-2800 Series (`192.168.68.61`)
- eSCL scanning endpoint: `https://192.168.68.61/eSCL/ScannerCapabilities`
- S/N: `58384B4A3333343951`

### EPSON WF-4720 Series (`192.168.68.64`)
- eSCL scanning endpoint: `https://192.168.68.64/eSCL/ScannerCapabilities`
- S/N: `583254533139383117`

### Both scanners
- Both use HTTPS on port 443 for eSCL (not port 9095)
- Both detected by `sane-airscan` with `https://<ip>/eSCL` URLs in `airscan.conf`
- Identified via nmap TCP scan for common printer ports (80, 443, 515, 631, 9100) on `192.168.68.0/22`

### Other LAN hosts
- `192.168.68.1` — Router (open: 80, 443)
- `192.168.68.51` — Unknown device
- `192.168.68.52` — Unknown device
- `192.168.68.59` — Unknown device
- `192.168.71.250` — Unknown device (open: 80, 443)
