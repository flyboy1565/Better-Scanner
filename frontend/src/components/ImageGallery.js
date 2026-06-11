import React from 'react';
import { useScanStore } from '../store/scanStore';
import PhotoCard from './PhotoCard';
import './ImageGallery.css';

function ImageGallery() {
  const { photos } = useScanStore();

  if (photos.length === 0) {
    return null;
  }

  return (
    <div className="image-gallery card">
      <div className="gallery-grid">
        {photos.map((photo, index) => (
          <PhotoCard key={index} photo={photo} index={index} />
        ))}
      </div>
    </div>
  );
}

export default ImageGallery;
