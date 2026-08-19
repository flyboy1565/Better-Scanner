import React, { useEffect, useState } from 'react';
import { useScanStore } from '../store/scanStore';
import scannerApi from '../services/scannerApi';
import './ControlPanel.css';

function ControlPanel({ serverStatus, immichStatus, saveMode, showActions = true }) {
  const {
    selectedDevice,
    setSelectedDevice,
    selectedSource,
    setSelectedSource,
    fileFormat,
    setFileFormat,
    scanMode,
    setScanMode,
    photos,
    albums,
    setAlbums,
    selectedAlbum,
    setSelectedAlbum,
    devices,
    fetchDevices,
    fetchAlbums,
    handleScan,
    handleSavePhotos,
    loading,
    error,
    success,
    setSuccess,
  } = useScanStore();

  const [scannerWarning, setScannerWarning] = useState(null);

  useEffect(() => {
    if (serverStatus === 'healthy') {
      fetchDevices();
      if (immichStatus?.enabled) {
        setAlbums([]);
        fetchAlbums();
      }
      scannerApi.getScannerStatus().then((data) => {
        setScannerWarning(data.warning || null);
      }).catch(() => {});
    }
  }, [serverStatus, immichStatus?.enabled]);

  return (
    <div className="control-panel card">
      <div className="card-header">
        <h2>Control Panel</h2>
      </div>

      {scannerWarning && (
        <div className="status status-warning" style={{ marginBottom: '12px' }}>
          ⚠️ {scannerWarning}
        </div>
      )}

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
              {device.ip ? `${device.name} (${device.ip})` : device.name}
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

      {saveMode !== 'immich_only' && (
        <div className="control-section">
          <label className="control-label">Work Mode</label>
          <select
            value={scanMode}
            onChange={(e) => setScanMode(e.target.value)}
            disabled={loading}
            className="control-input"
          >
            <option value="auto-detect">⚡ Auto-Detect (Multi-Photo Slicer)</option>
            {saveMode === 'local' && (
              <option value="manual-crop">📐 Manual Click-to-Crop Canvas</option>
            )}
          </select>
        </div>
      )}

      {photos.length > 0 && (
        <>
          <div style={{ borderTop: '1px solid var(--border-light)', margin: '20px 0' }}></div>

          {saveMode !== 'immich_only' && (
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
          )}

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
        </>
      )}

      {showActions && (
        <>
          <button
            className="btn-primary btn-scan"
            onClick={handleScan}
            disabled={!selectedDevice || loading || serverStatus !== 'healthy'}
          >
            {loading ? '⏳ Scanning...' : '🚀 Trigger Batch Scan'}
          </button>

          {photos.length > 0 && (
            <>
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
                  {saveMode === 'immich_only'
                    ? `✓ Photos will be uploaded to Immich${selectedAlbum ? ` (album: "${selectedAlbum.name}")` : ''}`
                    : immichStatus.healthy
                      ? `✓ Photos will be saved locally${selectedAlbum ? ` and uploaded to "${selectedAlbum.name}"` : ''}`
                      : '⚠️ Immich is offline - photos will be saved locally only'}
                </p>
              )}
            </>
          )}
        </>
      )}

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