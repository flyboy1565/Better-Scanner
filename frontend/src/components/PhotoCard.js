import React, { useState } from 'react';
import { useScanStore } from '../store/scanStore';
import scannerApi from '../services/scannerApi';
import './PhotoCard.css';

// Modal for Editing Metadata
function EditModal({ isOpen, onClose, children }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure Photo Metadata</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

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

function PhotoCard({ photo, index }) {
  const {
    updatePhoto,
    deletePhoto,
    updatePhotoName,
    updatePhotoSave,
    updatePhotoDescription,
    photoNames,
    photoSaves,
    photoDescriptions,
    selectedAlbum,
    photoAlbumOverrides,
    setPhotoAlbumOverride,
    clearPhotoAlbumOverride,
  } = useScanStore();

  // Modal Visibility States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  const [transforming, setTransforming] = useState(false);
  const [error, setError] = useState(null);

  const currentName = photoNames[index] || '';
  const currentDescription = photoDescriptions[index] || '';
  const isSaved = photoSaves[index] !== false; 
  
  const hasAlbumOverride = photoAlbumOverrides && index in photoAlbumOverrides;
  const isUploadingToAlbum = !hasAlbumOverride || photoAlbumOverrides[index] !== null;

  const handleTransform = async (rotation, flipH = false, flipV = false) => {
    setTransforming(true);
    setError(null);
    try {
      const response = await scannerApi.transform(index, rotation, flipH, flipV);
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

  const handleAlbumToggle = () => {
    if (isUploadingToAlbum) {
      setPhotoAlbumOverride(index, null);
    } else {
      clearPhotoAlbumOverride(index);
    }
  };

  const imageSrc = `data:image/png;base64,${photo.base64}`;

  return (
    <div className="photo-card">
      {/* Image Preview & Utility Triggers */}
      <div className="photo-image-container">
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
      </div>

      <div className="photo-controls">
        {/* Row 1: Modal Edit Trigger */}
        <button 
          className="btn-sm btn-primary edit-meta-btn"
          onClick={() => setIsEditOpen(true)}
        >
          ⚙️ Edit Metadata {!isSaved && '(Excluded)'}
        </button>

        {/* Row 2: Always Visible Transformations */}
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
              className="btn-sm btn-secondary"
              onClick={() => handleTransform(0, true)}
              disabled={transforming}
              title="Flip horizontally"
            >
              ↔️ Flip H
            </button>
            <button
              className="btn-sm btn-secondary"
              onClick={() => handleTransform(0, false, true)}
              disabled={transforming}
              title="Flip vertically"
            >
              ↕️ Flip V
            </button>
          </div>
        </div>

        {/* Row 3: Destructive Action Block */}
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
      
      {/* Metadata Configuration Drawer/Modal */}
      <EditModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)}>
        <div className="control-group text-left">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isSaved}
              onChange={(e) => updatePhotoSave(index, e.target.checked)}
            />
            Include in Save
          </label>
        </div>

        <div className="control-group text-left">
          <label className="input-label">File Name</label>
          <input
            type="text"
            value={currentName}
            onChange={(e) => updatePhotoName(index, e.target.value)}
            placeholder={`img_${index + 1}`}
            className="name-input"
          />
        </div>

        <div className="control-group text-left">
          <label className="input-label">Archival Description</label>
          <textarea
            value={currentDescription}
            onChange={(e) => updatePhotoDescription(index, e.target.value)}
            placeholder="Details, locations, dates, or family names..."
            className="description-input"
            rows={3}
          />
        </div>

        {selectedAlbum && (
          <div className="control-group text-left">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isUploadingToAlbum}
                onChange={handleAlbumToggle}
              />
              Upload to "{selectedAlbum.name}"
            </label>
          </div>
        )}
        
        <button 
          className="btn-sm btn-success modal-save-close"
          onClick={() => setIsEditOpen(false)}
        >
          Done
        </button>
      </EditModal>

      {/* Full Resolution Lightbox Viewer */}
      <LightboxModal 
        isOpen={isLightboxOpen} 
        onClose={() => setIsLightboxOpen(false)} 
        imgSrc={imageSrc}
        altText={`Full size extract ${index + 1}`}
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