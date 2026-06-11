# Quick Start Guide - Better Scanner

## First Time Setup

### Option 1: Automated Setup (Recommended)

```bash
# Make the setup script executable
chmod +x setup.sh

# Run the setup script
./setup.sh
```

This will:
- Install Python dependencies
- Install Node.js dependencies
- Create `.env` files from templates
- Guide you through configuration

### Option 2: Manual Setup

#### Backend Setup
```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings
```

#### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure environment (optional)
cp .env.example .env
```

## Running the Application

### Development Mode (Recommended)

**Terminal 1 - Start Backend:**
```bash
cd backend
source .venv/bin/activate
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**Terminal 2 - Start Frontend:**
```bash
cd frontend
npm start
```

You should see:
```
webpack compiled successfully
Compiled successfully!
```

Then open: **http://localhost:3000**

### Production Mode with Docker

```bash
# Make sure Docker and Docker Compose are installed

# Set environment variables
export IMMICH_SERVER_URL=https://your-immich-server.com
export IMMICH_API_KEY=your_api_key_here

# Build and run
docker-compose up -d

# Check status
docker-compose logs -f

# Stop
docker-compose down
```

## Configuration

### Essential Settings (in `backend/.env`)

```env
# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
DEBUG=True

# Storage
TARGET_DIR=/mnt/c/Users/flybo/OneDrive/Pictures/Scanner Images ( Nana&Mom )

# Immich (Optional but recommended)
IMMICH_SERVER_URL=https://photos-holfam.duckdns.org
IMMICH_API_KEY=your_key_here
IMMICH_ENABLED=True
```

### Getting Your Immich API Key

1. Open your Immich server in a browser
2. Go to **Settings** (gear icon, top right)
3. Click **API Keys**
4. Click **Create API Key**
5. Copy the generated key
6. Paste into `backend/.env` as `IMMICH_API_KEY`

## Testing the Setup

### Check Backend Health
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{"status": "healthy", "service": "Better Scanner API"}
```

### Check Immich Connection
```bash
curl http://localhost:8000/api/immich/health
```

### View API Documentation
Open: **http://localhost:8000/docs**

## Common Issues

### Scanner Not Detected

```bash
# List available scanners
sane-find-scanner

# Check detailed scanner info
scanimage -A
```

Update the device URI in `backend/app/services/scanner.py`

### Immich Upload Fails

1. Verify API key is correct:
   ```bash
   curl https://your-immich-server/api/server/info \
     -H "x-api-key: your_api_key"
   ```

2. Check server is reachable:
   ```bash
   ping your-immich-server.com
   ```

### Frontend Can't Connect to Backend

1. Verify backend is running: `curl http://localhost:8000/health`
2. Check `frontend/.env` has correct API URL
3. Check browser console for CORS errors
4. Reload browser (Ctrl+Shift+R / Cmd+Shift+R)

### Out of Memory

Large scans can use a lot of memory. You can:
- Reduce scan resolution in scanner settings
- Split large scans into multiple smaller scans
- Increase available memory

## Next Steps

1. **Add your scanner**: 
   - Find your scanner's URI with `scanimage -A`
   - Update `DEVICES` in `backend/app/services/scanner.py`

2. **Configure Immich** (optional but recommended):
   - Get API key from your Immich server
   - Add to `backend/.env`

3. **Test a scan**:
   - Click "🚀 Trigger Batch Scan"
   - Select your device
   - Click the button and wait

4. **Customize as needed**:
   - Adjust scan resolution
   - Configure auto-crop thresholds
   - Customize file naming patterns

## Useful Commands

```bash
# Backend
cd backend
source .venv/bin/activate      # Activate virtual env
python main.py                  # Run server
deactivate                      # Exit virtual env

# Frontend
cd frontend
npm start                        # Development server
npm run build                    # Production build
npm test                         # Run tests

# Docker
docker-compose up -d             # Start services
docker-compose logs -f           # View logs
docker-compose down              # Stop services
docker-compose restart           # Restart services
```

## File Structure for Reference

```
better-scanner/
├── backend/
│   ├── app/
│   │   ├── api/endpoints.py      ← API routes
│   │   ├── services/
│   │   │   ├── scanner.py        ← SANE integration
│   │   │   ├── image_processor.py ← Image processing
│   │   │   └── immich_client.py  ← Immich integration
│   │   └── models/schemas.py     ← Data models
│   ├── main.py                   ← Start here
│   ├── requirements.txt
│   └── .env                      ← Your config
├── frontend/
│   ├── src/
│   │   ├── components/           ← React components
│   │   ├── services/scannerApi.js ← API client
│   │   └── store/scanStore.js    ← State management
│   ├── package.json
│   └── .env                      ← Your config
└── README.md                     ← Full documentation
```

## Usage with Immich Albums

When saving photos, you can automatically upload them to your Immich photo library:

1. **Select a Default Album**: In the Control Panel, choose an Immich album from the "Default Immich Album" dropdown
   - All photos will upload to this album by default when you save

2. **Per-Photo Control**: In each photo card, you'll see a checkbox "Upload to [Album Name]"
   - ✓ Checked: Photo will save locally AND upload to Immich album
   - ☐ Unchecked: Photo will save locally ONLY (no Immich upload)

3. **Local Backup**: Regardless of Immich status, all photos are always saved to your local drive

### Album Management
- Create albums directly in your Immich server
- The dropdown automatically loads all available albums
- Choose "No Album (Local Only)" to save without uploading to Immich

1. Check the [README.md](./README.md) for detailed documentation
2. Review backend API docs at http://localhost:8000/docs
3. Check browser console (F12) for frontend errors
4. Check backend logs for API errors

---

Happy scanning! 📸
