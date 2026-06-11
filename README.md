# Better Scanner

A modern multi-photo document scanner application built with FastAPI backend and React frontend, featuring Immich integration for automatic photo uploads.

## Features

- **Multi-Photo Detection**: Automatically detect and separate multiple photos from a single scan
- **Manual Cropping**: Click-to-crop canvas for precise manual image cropping
- **Image Transformations**: Rotate and flip scanned images
- **Immich Integration**: Automatically upload scanned photos to your Immich server
- **Local & Cloud Storage**: Save locally to disk and upload to Immich simultaneously
- **SANE Scanner Support**: Works with any SANE-compatible network scanner
- **Clean UI**: Modern React frontend with intuitive controls

## Project Structure

```
better-scanner/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── core/           # Configuration
│   │   ├── models/         # Pydantic schemas
│   │   └── services/       # Business logic (scanner, image processor, Immich client)
│   ├── main.py             # FastAPI app entry point
│   ├── requirements.txt
│   └── .env.example
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API client
│   │   ├── store/          # Zustand state management
│   │   └── styles/         # CSS styles
│   ├── package.json
│   └── .env.example
└── README.md
```

## Prerequisites

- Python 3.9+
- Node.js 16+
- SANE backend (for scanner support): `sudo apt-get install sane-utils`
- Access to a SANE-compatible scanner on your network

## Backend Setup

1. **Create virtual environment**:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

   Key variables:
   - `TARGET_DIR`: Directory to save scanned images (default: Windows OneDrive path)
   - `IMMICH_SERVER_URL`: Your Immich server URL
   - `IMMICH_API_KEY`: Your Immich API key (get from Immich > Settings > API Keys)

4. **Run the backend**:
   ```bash
   python main.py
   # Or with uvicorn directly:
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   The API will be available at `http://localhost:8000`
   API docs: `http://localhost:8000/docs`

## Frontend Setup

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env if needed (default API URL: http://localhost:8000)
   ```

3. **Run the development server**:
   ```bash
   npm start
   ```

   The app will open at `http://localhost:3000`

## Usage

### Auto-Detect Mode
1. Select your scanner device and paper feed source
2. Click "🚀 Trigger Batch Scan"
3. The system automatically detects and separates multiple photos
4. Review and edit photos (rotate, flip, rename)
5. Click "💾 Save Photos" to export

### Manual Crop Mode
1. Select your scanner device and trigger a scan
2. Use the click-to-crop canvas to manually define photo areas
3. Click top-left corner, then bottom-right corner to crop
4. Review and edit extracted photos
5. Save when ready

### Image Editing
- **Rotate**: Click "🔄 Left" or "🔄 Right" (90°, -90°)
- **Flip**: Use "↔️ Flip H" (horizontal) or "↕️ Flip V" (vertical)
- **Delete**: Remove unwanted photos
- **Rename**: Add custom file names (or use auto-generated timestamps)
- **Include/Exclude**: Checkbox to include/exclude photos from saving

### Immich Upload
- If Immich server is configured and healthy, photos are automatically uploaded after saving
- Check the control panel for Immich server status
- API key must be set in `.env` for uploads to work
- **Select a default album** from the dropdown - all photos will upload to that album by default
- **Per-photo control**: Uncheck "Upload to [Album Name]" on individual photos to skip uploading them to Immich (they'll still save locally)

## Configuration

### Scanner Devices

Edit `backend/app/services/scanner.py` to add your scanner:

```python
DEVICES = {
    "Your Scanner Name": "airscan:w3:Your Scanner URI",
}
```

To find your scanner URI:
```bash
scanimage -A
```

### Immich Configuration

1. Get your API key from Immich:
   - Log in to Immich
   - Go to Settings > API Keys > Create API Key

2. Add to `.env`:
   ```
   IMMICH_SERVER_URL=https://your-immich-server.com
   IMMICH_API_KEY=your_api_key_here
   IMMICH_ENABLED=True
   ```

3. Test connection:
   - Check Immich status indicator in app header
   - Or call `GET /api/immich/health`

## API Endpoints

### Scanner Operations
- `GET /api/devices` - List available scanners
- `POST /api/scan` - Trigger a scan
- `POST /api/auto-detect` - Auto-detect photos in current scan
- `POST /api/crop` - Manual crop from current scan

### Photo Management
- `POST /api/transform/{photo_id}` - Rotate/flip photos
- `DELETE /api/photo/{photo_id}` - Delete a photo
- `POST /api/save` - Save photos to disk and/or Immich
- `POST /api/session/clear` - Clear current session

### Immich Integration
- `GET /api/immich/health` - Check Immich server health
- `GET /api/immich/albums` - Get Immich albums

### System
- `GET /health` - Health check
- `GET /config` - Get configuration
- `GET /api/session` - Get current session state

## Troubleshooting

### Scanner not found
1. Check SANE installation: `sane-find-scanner`
2. Verify network connectivity to scanner
3. Try: `scanimage -A` to list available scanners
4. Update device URI in `backend/app/services/scanner.py`

### Immich upload fails
1. Check server URL and API key in `.env`
2. Verify Immich server is accessible: `curl https://your-server/api/server/info -H "x-api-key: your_key"`
3. Check backend logs for detailed error messages

### Frontend not loading images
1. Verify backend is running and accessible
2. Check CORS settings in `backend/app/core/config.py`
3. Open browser console for API errors

### Out of memory (large scans)
1. Reduce scan resolution in `backend/app/services/scanner.py`
2. Split large scans into multiple batches

## Development

### Backend Architecture
- **FastAPI**: Async web framework
- **Pydantic**: Data validation
- **Pillow**: Image processing
- **OpenCV**: Photo detection and analysis
- **Requests**: Immich API communication

### Frontend Architecture
- **React 18**: UI framework
- **Zustand**: State management
- **Axios**: HTTP client
- **CSS**: Modern styling with flexbox and grid

### Adding New Features

1. **New scanner**: Add to `DEVICES` in `backend/app/services/scanner.py`
2. **New transformation**: Add method to `ImageProcessor` class
3. **New API endpoint**: Add router to `backend/app/api/endpoints.py`
4. **New UI component**: Create in `frontend/src/components/`

## Deployment

### Production Backend
```bash
# Use production ASGI server
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 app.main:app
```

### Production Frontend
```bash
npm run build
# Serve static files from build/ directory
```

### Docker (Optional)
Create `Dockerfile` for containerized deployment.

## License

MIT License - Feel free to use and modify

## Contributing

Contributions welcome! Feel free to open issues or submit pull requests.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review API logs: `tail -f /path/to/backend/logs`
3. Check browser console for frontend errors
