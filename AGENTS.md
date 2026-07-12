# Better Scanner — Session Context

## Docker Compose save path

We need to create `/home/flyboy1565/projects/better-scanner/.env` with:

```
SAVE_PATH=/mnt/c/Users/flybo/OneDrive/Pictures/Scanner Images ( Nana&Mom )
```

This will make docker-compose bind-mount scans to that directory instead of `./scans/`.

## Other findings (not yet addressed)

- `docker-compose.yml` line 36-37 has an orphaned named volume `scans:` — unused, can be removed
- `backend/.env` contains a live Immich API key — sensitive, don't commit
- `backend/app/core/config.py:12` hardcodes WSL path as default — misleading but overridden at runtime
