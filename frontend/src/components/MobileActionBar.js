import React from 'react';
import { useScanStore } from '../store/scanStore';
import './MobileActionBar.css';

function MobileActionBar({ serverStatus }) {
  const {
    photos,
    loading,
    handleScan,
    handleSavePhotos,
    clearSession,
  } = useScanStore();

  const canScan = serverStatus === 'healthy';

  return (
    <div className="mobile-action-bar">
      <button
        className="btn-primary action-btn"
        onClick={handleScan}
        disabled={!canScan || loading}
      >
        {loading ? '⏳...' : '🚀 Scan'}
      </button>
      <button
        className="btn-success action-btn"
        onClick={handleSavePhotos}
        disabled={photos.length === 0 || loading}
      >
        💾 Save
      </button>
      <button
        className="btn-secondary action-btn"
        onClick={clearSession}
        disabled={loading}
      >
        🗑️ Clear
      </button>
    </div>
  );
}

export default MobileActionBar;