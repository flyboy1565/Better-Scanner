import React from 'react';
import { useScanStore } from '../store/scanStore';
import './MobileActionBar.css';

function MobileActionBar({ serverStatus }) {
  const {
    photos,
    loading,
    handleSaveAndScan,
    clearSession,
  } = useScanStore();

  const canScan = serverStatus === 'healthy';

  return (
    <div className="mobile-action-bar">
      <button
        className="btn-primary action-btn"
        onClick={handleSaveAndScan}
        disabled={!canScan || loading}
      >
        {loading ? '⏳...' : photos.length > 0 ? '💾 Save & Scan' : '🚀 Scan'}
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
