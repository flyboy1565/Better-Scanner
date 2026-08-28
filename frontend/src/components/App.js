import React, { useState, useEffect } from 'react';
import { useScanStore } from '../store/scanStore';
import scannerApi from '../services/scannerApi';
import ControlPanel from './ControlPanel';
import ImageGallery from './ImageGallery';
import CropCanvas from './CropCanvas';
import ThemeSwitcher from './ThemeSwitcher';
import MobileActionBar from './MobileActionBar';
import { useMobile } from '../hooks/useMediaQuery';
import '../styles/index.css';
import './App.css';

function App() {
  const {
    photos,
    historyPhotos,
    fullRawScan,
    scanMode,
    clearSession,
    setHistoryPhotos,
    scanInProgress,
    scanStatusMessage,
    theme,
    setImmichEnabled,
    fetchDevices,
    fetchAlbums,
    handleScan,
    loading,
  } = useScanStore();

  const isMobile = useMobile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [serverStatus, setServerStatus] = useState('connecting');
  const [immichStatus, setImmichStatus] = useState(null);
  const [saveMode, setSaveMode] = useState('both');

  const fetchHistory = async () => {
    try {
      const data = await scannerApi.getHistory();
      if (data.photos) {
        setHistoryPhotos(data.photos);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  // Check server health on mount
  useEffect(() => {
    const checkServer = async () => {
      try {
        await scannerApi.healthCheck();
        setServerStatus('healthy');
        fetchHistory();

        // Fetch config
        try {
          const config = await scannerApi.getConfig();
          setSaveMode(config.save_mode || 'both');
        } catch (error) {
          console.warn('Failed to fetch config:', error);
        }

        // Check Immich status
        try {
          const status = await scannerApi.checkImmichHealth();
          setImmichStatus(status);
          setImmichEnabled(!!status.enabled);
        } catch (error) {
          console.warn('Immich health check failed:', error);
        }

        fetchDevices();
        fetchAlbums();
      } catch (error) {
        setServerStatus('error');
        console.error('Server health check failed:', error);
      }
    };

    checkServer();
  }, []);

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="container flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1>🐧 Better Scanner</h1>
            <div className={`server-status ${serverStatus}`}>
              {serverStatus === 'healthy' && '✓ Server Connected'}
              {serverStatus === 'connecting' && '⏳ Connecting...'}
              {serverStatus === 'error' && '✗ Server Offline'}
            </div>
            {immichStatus?.enabled && (
              <div className={`immich-status ${immichStatus.healthy ? 'healthy' : 'offline'}`}>
                {immichStatus.healthy ? '✓ Immich Ready' : '✗ Immich Offline'}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isMobile && (
              <button
                className="btn-primary nav-scan-btn"
                onClick={handleScan}
                disabled={loading || serverStatus !== 'healthy'}
              >
                {loading ? '⏳' : '🚀 Scan'}
              </button>
            )}
            {isMobile && (
              <button
                className="btn-secondary settings-btn"
                onClick={() => setSettingsOpen(true)}
              >
                ⚙️
              </button>
            )}
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className={`app-main${isMobile ? ' app-main-mobile' : ''}`}>
        <div className="container">
          {serverStatus === 'error' && (
            <div className="status status-error">
              <strong>Error:</strong> Cannot connect to API server. Make sure the FastAPI backend is running
              on {process.env.REACT_APP_API_URL || 'the server'}
            </div>
          )}

          {/* Main content grid */}
          <div className="content-grid">
            {/* Left panel - Control Panel (hidden on mobile, shown in modal) */}
            {!isMobile && (
              <aside className="control-sidebar">
                <ControlPanel
                  serverStatus={serverStatus}
                  immichStatus={immichStatus}
                  saveMode={saveMode}
                />
              </aside>
            )}

            {/* Right panel - Content Area */}
            <section className="content-area">
              {scanInProgress && scanStatusMessage && (
                <div className="status status-loading">
                  <div className="spinner"></div>
                  <p>{scanStatusMessage}</p>
                </div>
              )}

              {/* Show crop canvas if in manual mode and have a raw scan */}
              {scanMode === 'manual-crop' && fullRawScan && !scanInProgress && (
                <CropCanvas />
              )}

              {/* Show photo gallery */}
              {photos.length > 0 && (
                <>
                  <div className="gallery-header">
                    <h2>🖼️ Scanned Images ({photos.length})</h2>
                    <button className="btn-secondary btn-sm" onClick={clearSession}>
                      🗑️ Clear All
                    </button>
                  </div>
                  <ImageGallery />
                </>
              )}

              {/* History panel */}
              {historyPhotos.length > 0 && (
                <div className="gallery-header">
                  <h2>📜 Previously Scanned ({historyPhotos.length})</h2>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={async () => {
                      await scannerApi.clearHistory();
                      setHistoryPhotos([]);
                    }}
                  >
                    🗑️ Clear History
                  </button>
                </div>
              )}
              {historyPhotos.length > 0 && (
                <div className="image-gallery card">
                  <div className="gallery-grid">
                    {historyPhotos.map((photo, index) => (
                      <div className="photo-card history-card" key={index}>
                        <div className="photo-image-container">
                          <img src={`data:image/png;base64,${photo.base64}`} alt={`Previous scan ${index + 1}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {photos.length === 0 && !fullRawScan && historyPhotos.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">📸</div>
                  <p>No scans yet. Start by selecting a device and triggering a scan.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Mobile: settings modal */}
      {isMobile && settingsOpen && (
        <div className="modal-overlay mobile-settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="mobile-settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Settings</h3>
              <button className="modal-close-btn" onClick={() => setSettingsOpen(false)}>✕</button>
            </div>
            <div className="mobile-settings-body">
              <ControlPanel
                serverStatus={serverStatus}
                immichStatus={immichStatus}
                saveMode={saveMode}
                showActions={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile: fixed action bar */}
      {isMobile && <MobileActionBar serverStatus={serverStatus} />}
    </div>
  );
}

export default App;