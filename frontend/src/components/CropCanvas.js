import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useScanStore } from '../store/scanStore';
import scannerApi from '../services/scannerApi';
import './CropCanvas.css';

function CropCanvas() {
  const {
    fullRawScan,
    manualBoxes,
    setManualBoxes,
    currentClickStart,
    setCurrentClickStart,
    addPhotos,
  } = useScanStore();

  const canvasRef = useRef(null);
  const [canvasImage, setCanvasImage] = useState(null);
  const [scaling, setScaling] = useState(1);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load image into canvas
  useEffect(() => {
    if (fullRawScan && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const maxWidth = canvas.parentElement.offsetWidth - 4; // Account for border
        const scaling = Math.min(1, maxWidth / img.width);
        
        canvas.width = img.width * scaling;
        canvas.height = img.height * scaling;
        setScaling(scaling);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setCanvasImage(img);
        redrawCanvas(img, [], scaling);
      };
      img.src = `data:image/png;base64,${fullRawScan}`;
    }
  }, [fullRawScan]);

  // Redraw canvas with boxes
  const redrawCanvas = useCallback((img, boxes, scaling) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear and redraw image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw finalized boxes
    boxes.forEach((box) => {
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 3;
      ctx.strokeRect(
        box[0][0] * scaling,
        box[0][1] * scaling,
        (box[1][0] - box[0][0]) * scaling,
        (box[1][1] - box[0][1]) * scaling
      );
    });

    // Draw temporary starting point
    if (currentClickStart) {
      ctx.fillStyle = '#0066cc';
      ctx.beginPath();
      ctx.arc(
        currentClickStart[0] * scaling,
        currentClickStart[1] * scaling,
        8,
        0,
        2 * Math.PI
      );
      ctx.fill();
    }
  }, [currentClickStart]);

  const handleCanvasClick = (event) => {
    if (!canvasRef.current || !canvasImage) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((event.clientX - rect.left) / scaling);
    const y = Math.round((event.clientY - rect.top) / scaling);

    if (currentClickStart === null) {
      // Set top-left corner
      setCurrentClickStart([x, y]);
    } else {
      // Set bottom-right corner and create crop
      const [x1, y1] = currentClickStart;
      const [x2, y2] = [x, y];

      // Ensure proper ordering
      const realX1 = Math.min(x1, x2);
      const realX2 = Math.max(x1, x2);
      const realY1 = Math.min(y1, y2);
      const realY2 = Math.max(y1, y2);

      if (realX2 - realX1 > 15 && realY2 - realY1 > 15) {
        setLoading(true);
        cropImage(realX1, realY1, realX2, realY2);
        setCurrentClickStart(null);
      }
    }
  };

  const cropImage = async (x1, y1, x2, y2) => {
    setError(null);
    try {
      const response = await scannerApi.crop([{ x1, y1, x2, y2 }]);
      if (response.success && response.photos) {
        const newPhotos = response.photos.map((photo) => ({
          id: photo.id,
          base64: photo.image_base64,
          width: photo.width,
          height: photo.height,
        }));
        addPhotos(newPhotos);

        // Add box to manual boxes
        setManualBoxes([...manualBoxes, [[x1, y1], [x2, y2]]]);
        
        // Redraw with new box
        if (canvasImage) {
          redrawCanvas(canvasImage, [...manualBoxes, [[x1, y1], [x2, y2]]], scaling);
        }
      }
    } catch (err) {
      setError('Failed to crop image');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUndoLastBox = () => {
    if (manualBoxes.length > 0) {
      const newBoxes = manualBoxes.slice(0, -1);
      setManualBoxes(newBoxes);
      if (canvasImage) {
        redrawCanvas(canvasImage, newBoxes, scaling);
      }
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all crop boxes?')) {
      setManualBoxes([]);
      setCurrentClickStart(null);
      if (canvasImage) {
        redrawCanvas(canvasImage, [], scaling);
      }
    }
  };

  const instructionStep = currentClickStart === null
    ? 'Click the TOP-LEFT corner of the area to crop'
    : 'Click the BOTTOM-RIGHT corner to complete the crop';

  return (
    <div className="crop-canvas-container card">
      <div className="crop-header">
        <h3>📐 Manual Click-to-Crop Canvas</h3>
        <div className="crop-buttons">
          <button
            className="btn-secondary btn-sm"
            onClick={handleUndoLastBox}
            disabled={manualBoxes.length === 0 || loading}
          >
            ↶ Undo
          </button>
          <button
            className="btn-danger btn-sm"
            onClick={handleClearAll}
            disabled={(manualBoxes.length === 0 && !currentClickStart) || loading}
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      <div className="instruction">
        <strong>{instructionStep}</strong>
        {manualBoxes.length > 0 && (
          <span className="box-count">({manualBoxes.length} boxes created)</span>
        )}
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="crop-canvas"
        />
      </div>

      {error && <div className="status status-error">{error}</div>}
      {loading && <div className="status status-loading">Processing crop...</div>}
    </div>
  );
}

export default CropCanvas;
