import React, { useState } from 'react';
import { useScanStore } from '../store/scanStore';
import scannerApi from '../services/scannerApi';
import './PhotoCard.css';

function PhotoCard({ photo, index }) {
  const {
    updatePhoto,
    deletePhoto,
    updatePhotoName,
    updatePhotoSave,
    photoNames,
    photoSaves,
    selectedAlbum,
    photoAlbumOverrides,
    setPhotoAlbumOverride,
    clearPhotoAlbumOverride,
  } = useScanStore();

  const [transforming, setTransforming] = useState(false);
  const [error, setError] = useState(null);

  const currentName = photoNames[index] || '';
  const isSaved = photoSaves[index] !== false; // Default to true
  
  // Check if this photo has a custom album override
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

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this photo?')) {
      try {
        await scannerApi.deletePhoto(index);
        deletePhoto(index);
      } catch (err) {
        setError('Delete failed');
        console.error(err);
      }
    }
  };

  const handleAlbumToggle = () => {
    if (isUploadingToAlbum) {
      // Turn off - set to null
      setPhotoAlbumOverride(index, null);
    } else {
      // Turn on - clear override to use default
      clearPhotoAlbumOverride(index);
    }
  };

  return (
    <div className="photo-card">
      <div className="photo-image-container">
        <img src={`data:image/png;base64,${photo.base64}`} alt={`Scanned extract ${index + 1}`} />
        <div className="photo-info">
          Extract #{index + 1} ({photo.width}x{photo.height}px)
        </div>
      </div>

      <div className="photo-controls">
        <div className="control-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isSaved}
              onChange={(e) => updatePhotoSave(index, e.target.checked)}
            />
            Include in Save
          </label>
        </div>

        <div className="control-group">
          <label className="input-label">File Name</label>
          <input
            type="text"
            value={currentName}
            onChange={(e) => updatePhotoName(index, e.target.value)}
            placeholder={`img_${index + 1}`}
            className="name-input"
          />
        </div>

        {selectedAlbum && (
          <div className="control-group">
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

        <button
          className="btn-sm btn-danger"
          onClick={handleDelete}
          disabled={transforming}
        >
          🗑️ Delete
        </button>

        {error && <div className="status status-error">{error}</div>}
      </div>
    </div>
  );
}

export default PhotoCard;
