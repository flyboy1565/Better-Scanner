import React, { useState, useEffect } from 'react';
import { useScanStore } from '../store/scanStore';
import scannerApi from '../services/scannerApi';
import ControlPanel from './ControlPanel';
import ImageGallery from './ImageGallery';
import CropCanvas from './CropCanvas';
import '../styles/index.css';
import './App.css';

function App() {
  const {
    photos,
    fullRawScan,
    scanMode,
    setScanMode,
    clearSession,
    scanInProgress,
    
  } = useScanStore();

  const [serverStatus, setServerStatus] = useState('connecting');
  const [immichStatus, setImmichStatus] = useState(null);

  // Check server health on mount
  useEffect(() => {
    const checkServer = async () => {
      try {
        await scannerApi.healthCheck();
        setServerStatus('healthy');

        // Check Immich status
        try {
          const status = await scannerApi.checkImmichHealth();
          setImmichStatus(status);
        } catch (error) {
          console.warn('Immich health check failed:', error);
        }
      } catch (error) {
        setServerStatus('error');
        console.error('Server health check failed:', error);
      }
    };

    checkServer();
  }, []);

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
        </div>
      </header>

      {/* Main content */}
      <main className="app-main">
        <div className="container">
          {serverStatus === 'error' && (
            <div className="status status-error">
              <strong>Error:</strong> Cannot connect to API server. Make sure the FastAPI backend is running
              on {process.env.REACT_APP_API_URL || 'http://localhost:8000'}
            </div>
          )}

          {/* Scan mode selector */}
          <div className="mode-selector">
            <label>Work Mode:</label>
            <div className="mode-buttons">
              <button
                className={`mode-btn ${scanMode === 'auto-detect' ? 'active' : ''}`}
                onClick={() => setScanMode('auto-detect')}
              >
                ⚡ Auto-Detect (Multi-Photo Slicer)
              </button>
              <button
                className={`mode-btn ${scanMode === 'manual-crop' ? 'active' : ''}`}
                onClick={() => setScanMode('manual-crop')}
              >
                📐 Manual Click-to-Crop Canvas
              </button>
            </div>
          </div>

          {/* Main content grid */}
          <div className="content-grid">
            {/* Left panel - Control Panel */}
            <aside className="control-sidebar">
              <ControlPanel
                serverStatus={serverStatus}
                immichStatus={immichStatus}
              />
            </aside>

            {/* Right panel - Content Area */}
            <section className="content-area">
              {scanInProgress && (
                <div className="status status-loading">
                  <div className="spinner"></div>
                  <p>Scanning in progress... Please wait</p>
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

              {/* Empty state */}
              {photos.length === 0 && !fullRawScan && (
                <div className="empty-state">
                  <div className="empty-icon">📸</div>
                  <p>No scans yet. Start by selecting a device and triggering a scan.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
