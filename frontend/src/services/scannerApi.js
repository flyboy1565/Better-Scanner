import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  timeout: 300000, // 5 minutes: 600 DPI flatbed scans can take a while
});

export const scannerApi = {
  // Get available scanner devices
  getDevices: async () => {
    const response = await api.get('/api/devices');
    return response.data;
  },

  // Trigger a scan
  scan: async (deviceUri, source = 'Platen') => {
    const response = await api.post('/api/scan', {
      device_uri: deviceUri,
      source: source,
    });
    return response.data;
  },

  // Auto-detect photos in current scan
  autoDetect: async () => {
    const response = await api.post('/api/auto-detect');
    return response.data;
  },

  // Crop areas from the full scan
  crop: async (areas) => {
    const response = await api.post('/api/crop', {
      areas: areas,
    });
    return response.data;
  },

  // Transform a photo (rotate, flip)
  transform: async (photoId, rotation = 0, flipH = false, flipV = false) => {
    const response = await api.post(`/api/transform/${photoId}`, null, {
      params: {
        rotation,
        flip_h: flipH,
        flip_v: flipV,
      },
    });
    return response.data;
  },

  // Apply classical restoration (non-destructive preview; returns the fixed image)
  fix: async (photoId, mode = 'auto') => {
    const response = await api.post(`/api/fix/${photoId}`, { mode });
    return response.data;
  },

  // Commit a given image (base64) as the session photo for photoId
  applyPhoto: async (photoId, imageBase64) => {
    const response = await api.post(`/api/photo/${photoId}/apply`, {
      image_base64: imageBase64,
    });
    return response.data;
  },

  // Delete a photo
  deletePhoto: async (photoId) => {
    const response = await api.delete(`/api/photo/${photoId}`);
    return response.data;
  },

  // Save photos to disk and optionally upload to Immich
  savePhotos: async (
    photoIds,
    fileFormat,
    uploadToImmich = false,
    defaultAlbumId = null
  ) => {
    const response = await fetch(`${API_URL}/api/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        photo_ids: photoIds,
        file_format: fileFormat,
        upload_to_immich: uploadToImmich,
        default_album_id: defaultAlbumId,
      }),
    });
    return response.json();
  },
  
  // Check Immich server health
  checkImmichHealth: async () => {
    const response = await api.get('/api/immich/health');
    return response.data;
  },

  // Get Immich albums
  getImmichAlbums: async () => {
    const response = await api.get('/api/immich/albums');
    return response.data;
  },

  // Get current session state
  getSessionState: async () => {
    const response = await api.get('/api/session');
    return response.data;
  },

  // Clear session
  clearSession: async () => {
    const response = await api.post('/api/session/clear');
    return response.data;
  },

  // Get scan history
  getHistory: async () => {
    const response = await api.get('/api/history');
    return response.data;
  },

  // Clear scan history
  clearHistory: async () => {
    const response = await api.post('/api/history/clear');
    return response.data;
  },

  // Health check
  healthCheck: async () => {
    const response = await api.get('/health');
    return response.data;
  },

  // Get config
  getConfig: async () => {
    const response = await api.get('/config');
    return response.data;
  },
};

export default scannerApi;
