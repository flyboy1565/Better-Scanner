import React, { useState, useEffect } from 'react';
import { useScanStore } from '../store/scanStore';
import scannerApi from '../services/scannerApi';
import './ControlPanel.css';

function ControlPanel({ serverStatus, immichStatus }) {
  const {
    selectedDevice,
    setSelectedDevice,
    selectedSource,
    setSelectedSource,
    fileFormat,
    setFileFormat,
    setScanInProgress,
    setFullRawScan,
    setPhotos,
    setHistoryPhotos,
    setScanMode,
    scanMode,
    photos,
    albums,
    setAlbums,
    selectedAlbum,
    setSelectedAlbum,
  } = useScanStore();

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch available devices and albums
  useEffect(() => {
    if (serverStatus === 'healthy') {
      fetchDevices();
      if (immichStatus?.enabled) fetchAlbums();
    }
  }, [serverStatus, immichStatus]);

  const fetchDevices = async () => {
    try {
      const data = await scannerApi.getDevices();
      setDevices(data.devices || []);
      if (data.warning) {
        setError(data.warning);
      }
      if (data.devices && data.devices.length > 0) {
        setSelectedDevice(data.devices[0]);
      }
    } catch (err) {
      setError('Failed to load scanner devices');
      console.error(err);
    }
  };

  const fetchAlbums = async () => {
    if (!immichStatus?.enabled) return;
    try {
      const data = await scannerApi.getImmichAlbums();
      if (data.albums && Array.isArray(data.albums)) {
        setAlbums(data.albums);
        if (data.albums.length > 0) {
          setSelectedAlbum(data.albums[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load albums:', err);
    }
  };

  const handleScan = async () => {
    if (!selectedDevice) {
      setError('Please select a scanner device');
      return;
    }

    setLoading(true);
    setError(null);
    setScanInProgress(true);

    try {
      // Trigger scan
      const scanResponse = await scannerApi.scan(
        selectedDevice.uri,
        selectedSource
      );

      if (!scanResponse.success) {
        throw new Error(scanResponse.error || 'Scan failed');
      }

      // Set full raw scan image
      setFullRawScan(scanResponse.image_base64);

      // Auto-detect photos if in auto-detect mode
      if (scanMode === 'auto-detect') {
        const detectionResponse = await scannerApi.autoDetect();
        if (detectionResponse.success && detectionResponse.photos) {
          // Convert base64 images to photo objects for the gallery
          const photoObjects = detectionResponse.photos.map((photo) => ({
            id: photo.id,
            base64: photo.image_base64,
            width: photo.width,
            height: photo.height,
          }));
          setPhotos(photoObjects);
          setSuccess(`Successfully detected ${detectionResponse.photo_count} photos!`);
        }
      } else {
        setSuccess('Scan completed! Ready for manual cropping.');
        setPhotos([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to scan');
      console.error(err);
    } finally {
      setLoading(false);
      setScanInProgress(false);
    }
  };

  const handleSavePhotos = async () => {
    if (photos.length === 0) {
      setError('No photos to save');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const {
        photoAlbumOverrides,
      } = useScanStore.getState();

      const photoIds = photos.map((_, i) => i);
      const response = await scannerApi.savePhotos(
        photoIds,
        fileFormat,
        null,
        immichStatus?.enabled || false,
        selectedAlbum?.id || null,
        photoAlbumOverrides
      );

      if (response.success) {
        setSuccess(`Saved ${response.saved_count} photos!`);
        setPhotos([]);
        setFullRawScan(null);
        const historyData = await scannerApi.getHistory();
        if (historyData.photos) {
          setHistoryPhotos(historyData.photos);
        }
      } else {
        setError(response.error || 'Failed to save photos');
      }
    } catch (err) {
      setError(err.message || 'Failed to save photos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="control-panel card">
      <div className="card-header">
        <h2>Control Panel</h2>
      </div>

      <div className="control-section">
        <label className="control-label">Scanner Device</label>
        <select
          value={selectedDevice?.uri || ''}
          onChange={(e) => {
            const device = devices.find((d) => d.uri === e.target.value);
            setSelectedDevice(device);
          }}
          disabled={devices.length === 0 || loading}
          className="control-input"
        >
          <option value="">-- Select Scanner --</option>
          {devices.map((device) => (
            <option key={device.uri} value={device.uri}>
              {device.name}
            </option>
          ))}
        </select>
      </div>

      <div className="control-section">
        <label className="control-label">Paper Feed Source</label>
        <div className="source-options">
          <label className="radio-label">
            <input
              type="radio"
              value="Platen"
              checked={selectedSource === 'Platen'}
              onChange={(e) => setSelectedSource(e.target.value)}
              disabled={loading}
            />
            📄 Platen (Flatbed Glass)
          </label>
          <label className="radio-label">
            <input
              type="radio"
              value="Adf"
              checked={selectedSource === 'Adf'}
              onChange={(e) => setSelectedSource(e.target.value)}
              disabled={loading}
            />
            📚 ADF (Auto Feeder Stack)
          </label>
        </div>
      </div>

      <div className="control-section">
        <label className="control-label">Work Mode</label>
        <select
          value={scanMode}
          onChange={(e) => setScanMode(e.target.value)}
          disabled={loading}
          className="control-input"
        >
          <option value="auto-detect">⚡ Auto-Detect (Multi-Photo Slicer)</option>
          <option value="manual-crop">📐 Manual Click-to-Crop Canvas</option>
        </select>
      </div>

      <button
        className="btn-primary btn-scan"
        onClick={handleScan}
        disabled={!selectedDevice || loading || serverStatus !== 'healthy'}
      >
        {loading ? '⏳ Scanning...' : '🚀 Trigger Batch Scan'}
      </button>

      {/* Save section */}
      {photos.length > 0 && (
        <>
          <div style={{ borderTop: '1px solid var(--border-light)', margin: '20px 0' }}></div>

          <div className="control-section">
            <label className="control-label">Export Format</label>
            <select
              value={fileFormat}
              onChange={(e) => setFileFormat(e.target.value)}
              className="control-input"
            >
              <option value="JPEG">JPEG</option>
              <option value="PNG">PNG</option>
            </select>
          </div>

          {immichStatus?.enabled && albums.length > 0 && (
            <div className="control-section">
              <label className="control-label">Default Immich Album</label>
              <select
                value={selectedAlbum?.id || ''}
                onChange={(e) => {
                  const album = albums.find((a) => a.id === e.target.value);
                  setSelectedAlbum(album || null);
                }}
                className="control-input"
              >
                <option value="">-- No Album (Local Only) --</option>
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.name} ({album.assetCount || 0} photos)
                  </option>
                ))}
              </select>
              <p className="album-note">
                ✓ All photos will upload to this album unless you uncheck individual photos
              </p>
            </div>
          )}

          <div className="photo-stats">
            <span className="stat-label">Photos Ready:</span>
            <span className="stat-value">{photos.length}</span>
          </div>

          <button
            className="btn-success btn-save"
            onClick={handleSavePhotos}
            disabled={loading}
          >
            {loading ? '💾 Saving...' : '💾 Save Photos'}
          </button>

          {immichStatus?.enabled && (
            <p className="immich-note">
              {immichStatus.healthy
                ? `✓ Photos will be saved locally${selectedAlbum ? ` and uploaded to "${selectedAlbum.name}"` : ''}`
                : '⚠️ Immich is offline - photos will be saved locally only'}
            </p>
          )}
        </>
      )}

      {/* Status messages */}
      {error && <div className="status status-error">{error}</div>}
      {success && (
        <div className="status status-success">
          {success}
          <button
            className="status-close"
            onClick={() => setSuccess(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default ControlPanel;
