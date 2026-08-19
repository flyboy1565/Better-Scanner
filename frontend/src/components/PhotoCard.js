import React, { useState } from 'react';
import { useScanStore } from '../store/scanStore';
import scannerApi from '../services/scannerApi';
import './PhotoCard.css';

// Modal for Delete Confirmation
function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel, confirmClass }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ margin: '12px 0', fontSize: '14px', lineHeight: '1.5' }}>{message}</p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button className="btn-sm btn-secondary" onClick={onClose}>Cancel</button>
            <button className={`btn-sm ${confirmClass || 'btn-danger'}`} onClick={onConfirm}>
              {confirmLabel || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal for Image Expansion (Lightbox)
function LightboxModal({ isOpen, onClose, imgSrc, altText }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn lightbox-close" onClick={onClose}>✕</button>
        <img src={imgSrc} alt={altText} className="lightbox-image" />
      </div>
    </div>
  );
}

// Modal showing original vs fixed version (choose one to keep)
function FixModal({ isOpen, onClose, beforeSrc, afterSrc, onKeepOriginal, onKeepBoth, onKeepFixed, working }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={!working ? onClose : undefined}>
      <div className="modal-content fix-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>✨ Fix Photo</h3>
          <button className="modal-close-btn" onClick={onClose} disabled={working}>✕</button>
        </div>
        <div className="modal-body">
          <div className="fix-compare">
            <div className="fix-panel">
              <div className="fix-label">Original</div>
              <img src={beforeSrc} alt="Original" />
            </div>
            <div className="fix-panel">
              <div className="fix-label">Fixed</div>
              <img src={afterSrc} alt="Fixed" className="fix-after-image" />
            </div>
          </div>
          <div className="fix-actions">
            <button
              className="btn-sm btn-secondary"
              onClick={onKeepOriginal}
              disabled={working}
            >
              Keep Original
            </button>
            {onKeepBoth && (
              <button
                className="btn-sm btn-secondary"
                onClick={onKeepBoth}
                disabled={working}
              >
                {working ? 'Applying...' : 'Keep Both'}
              </button>
            )}
            <button
              className="btn-sm btn-fix modal"
              onClick={onKeepFixed}
              disabled={working}
            >
              {working ? 'Applying...' : 'Keep Fixed'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoCard({ photo, index }) {
  const { updatePhoto, deletePhoto, insertPhoto } = useScanStore();

  // Modal Visibility States
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const [isFixOpen, setIsFixOpen] = useState(false);
  const [fixBeforeSrc, setFixBeforeSrc] = useState(null);
  const [fixAfterSrc, setFixAfterSrc] = useState(null);
  const [fixWorking, setFixWorking] = useState(false);

  const [transforming, setTransforming] = useState(false);
  const [error, setError] = useState(null);

  const handleTransform = async (rotation) => {
    setTransforming(true);
    setError(null);
    try {
      const response = await scannerApi.transform(index, rotation);
      if (response.success && response.photo) {
        updatePhoto(index, {
          ...photo,
          base64: response.photo.image_base64,
          width: response.photo.width,
          height: response.photo.height,
        });
      }
    } catch (err) {
      setError('Transform failed');
      console.error(err);
    } finally {
      setTransforming(false);
    }
  };

  const handleFix = async () => {
    setTransforming(true);
    setError(null);
    try {
      const response = await scannerApi.fix(index, 'auto');
      if (response.success && response.photo) {
        setFixBeforeSrc(photo.base64);
        setFixAfterSrc(response.photo.image_base64);
        setIsFixOpen(true);
      }
    } catch (err) {
      setError('Fix failed');
      console.error(err);
    } finally {
      setTransforming(false);
    }
  };

  const handleKeepOriginal = () => {
    setIsFixOpen(false);
    setFixBeforeSrc(null);
    setFixAfterSrc(null);
  };

  const handleKeepFixed = async () => {
    if (!fixAfterSrc) return;
    setFixWorking(true);
    setError(null);
    try {
      await scannerApi.applyPhoto(index, fixAfterSrc);
      updatePhoto(index, {
        ...photo,
        base64: fixAfterSrc,
      });
      setIsFixOpen(false);
      setFixBeforeSrc(null);
      setFixAfterSrc(null);
    } catch (err) {
      setError('Apply failed');
      console.error(err);
    } finally {
      setFixWorking(false);
    }
  };

  const handleKeepBoth = async () => {
    if (!fixAfterSrc) return;
    setFixWorking(true);
    setError(null);
    try {
      await scannerApi.insertPhotoAfter(index, fixAfterSrc);
      insertPhoto(index, {
        id: index + 1,
        base64: fixAfterSrc,
        width: photo.width,
        height: photo.height,
      });
      setIsFixOpen(false);
      setFixBeforeSrc(null);
      setFixAfterSrc(null);
    } catch (err) {
      setError('Insert failed');
      console.error(err);
    } finally {
      setFixWorking(false);
    }
  };

  const handleDelete = () => {
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setIsDeleteConfirmOpen(false);
    try {
      await scannerApi.deletePhoto(index);
      deletePhoto(index);
    } catch (err) {
      setError('Delete failed');
      console.error(err);
    }
  };

  const imageSrc = `data:image/png;base64,${photo.base64}`;

  return (
    <div className="photo-card">
      {/* Image Preview & Utility Triggers */}
      <div className={`photo-image-container${transforming ? ' shimmering' : ''}`}>
        <img src={imageSrc} alt={`Scanned extract ${index + 1}`} />
        <button
          className="btn-expand-overlay"
          onClick={() => setIsLightboxOpen(true)}
          title="Expand View"
        >
          🔍 Expand
        </button>
        <div className="photo-info">
          Extract #{index + 1} ({photo.width}x{photo.height}px)
        </div>
        {transforming && <div className="shimmer-overlay" />}
      </div>

      <div className="photo-controls">
        {/* Row 1: Transformations + Fix */}
        <div className="control-group">
          <label className="label">Transformations:</label>
          <div className="button-grid">
            <button
              className="btn-sm btn-secondary"
              onClick={() => handleTransform(90)}
              disabled={transforming}
              title="Rotate left 90°"
            >
              🔄 Left
            </button>
            <button
              className="btn-sm btn-secondary"
              onClick={() => handleTransform(-90)}
              disabled={transforming}
              title="Rotate right 90°"
            >
              🔄 Right
            </button>
            <button
              className="btn-sm btn-fix"
              onClick={handleFix}
              disabled={transforming}
              title="Auto-restore: remove scratches, sharpen, correct color"
            >
              ✨ Fix
            </button>
          </div>
        </div>

        {/* Row 2: Destructive Action Block */}
        <button
          className="btn-sm btn-danger"
          onClick={handleDelete}
          disabled={transforming}
        >
          🗑️ Delete
        </button>

        {error && <div className="status status-error">{error}</div>}
      </div>

      {/* --- MODALS --- */}

      {/* Full Resolution Lightbox Viewer */}
      <LightboxModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        imgSrc={imageSrc}
        altText={`Full size extract ${index + 1}`}
      />

      {/* Fix: before/after comparison */}
      <FixModal
        isOpen={isFixOpen}
        onClose={handleKeepOriginal}
        beforeSrc={fixBeforeSrc ? `data:image/png;base64,${fixBeforeSrc}` : ''}
        afterSrc={fixAfterSrc ? `data:image/png;base64,${fixAfterSrc}` : ''}
        onKeepOriginal={handleKeepOriginal}
        onKeepBoth={handleKeepBoth}
        onKeepFixed={handleKeepFixed}
        working={fixWorking}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Photo"
        message="Are you sure you want to delete this photo? This action cannot be undone."
        confirmLabel="Delete"
        confirmClass="btn-danger"
      />
    </div>
  );
}

export default PhotoCard;
