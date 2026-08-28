// frontend/src/store/scanStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import scannerApi from '../services/scannerApi';

export const useScanStore = create(
  persist(
    (set, get) => ({
  // Scan state
  photos: [],
  historyPhotos: [],
  fullRawScan: null,
  scanInProgress: false,
  scanStatusMessage: "",

  // UI state
  theme: 'default',
  scanMode: 'auto-detect',
  selectedDevice: null,
  selectedSource: 'Platen',
  fileFormat: 'JPEG',

  // Album state
  albums: [],
  selectedAlbum: null,

  // Scanner operation state
  devices: [],
  loading: false,
  error: null,
  success: null,
  immichEnabled: false,

  // Actions
  // Explicit setter to directly replace or clear the global photos array
  setPhotos: (photoObjects) => set({ photos: photoObjects }),

  // Explicit setter to assign fetched Immich albums
  setAlbums: (albumList) => set({ albums: albumList }),

  setDevices: (devices) => set({ devices }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSuccess: (success) => set({ success }),
  setImmichEnabled: (enabled) => set({ immichEnabled: enabled }),

  updatePhoto: (index, photo) => set((state) => {
    const newPhotos = [...state.photos];
    newPhotos[index] = photo;
    return { photos: newPhotos };
  }),

  deletePhoto: (index) => set((state) => ({
    photos: state.photos.filter((_, i) => i !== index),
  })),

  insertPhoto: (index, photo) => set((state) => {
    const newPhotos = [...state.photos];
    newPhotos.splice(index + 1, 0, photo);
    return { photos: newPhotos };
  }),

  setFullRawScan: (scan) => set({ fullRawScan: scan }),
  setScanInProgress: (inProgress) => set({ scanInProgress: inProgress }),
  setScanStatusMessage: (msg) => set({ scanStatusMessage: msg }),
  setScanMode: (mode) => set({ scanMode: mode }),
  setSelectedDevice: (device) => set({ selectedDevice: device }),
  setSelectedSource: (source) => set({ selectedSource: source }),
  setFileFormat: (format) => set({ fileFormat: format }),
  setTheme: (theme) => set({ theme }),
  setManualBoxes: (boxes) => set({ manualBoxes: boxes }),
  setCurrentClickStart: (click) => set({ currentClickStart: click }),
  setSelectedAlbum: (album) => set({ selectedAlbum: album }),
  setHistoryPhotos: (photos) => set({ historyPhotos: photos }),

  fetchDevices: async () => {
    try {
      const data = await scannerApi.getDevices();
      set({ devices: data.devices || [] });
      if (data.warning) {
        set({ error: data.warning });
      }
      if (data.devices && data.devices.length > 0) {
        const currentUri = get().selectedDevice?.uri;
        const stillExists = currentUri && data.devices.some((d) => d.uri === currentUri);
        if (!stillExists) {
          set({ selectedDevice: data.devices[0] });
        }
      }
    } catch (err) {
      set({ error: 'Failed to load scanner devices' });
      console.error(err);
    }
  },

  fetchAlbums: async () => {
    if (!get().immichEnabled) return;
    try {
      const data = await scannerApi.getImmichAlbums();
      if (data.albums && Array.isArray(data.albums)) {
        set({ albums: data.albums });
        if (data.albums.length > 0 && !get().selectedAlbum) {
          set({ selectedAlbum: data.albums[0] });
        }
      }
    } catch (err) {
      console.error('Failed to load albums:', err);
    }
  },

  handleScan: async () => {
    const state = get();
    if (!state.selectedDevice) {
      set({ error: 'Please select a scanner device' });
      return false;
    }

    set({ loading: true, error: null, scanInProgress: true });
    set({ scanStatusMessage: 'Connecting to scanner...' });

    try {
      const scanResponse = await scannerApi.scan(
        state.selectedDevice.uri,
        state.selectedSource
      );

      if (!scanResponse.success) {
        throw new Error(scanResponse.error || 'Scan failed');
      }

      set({ scanStatusMessage: 'Processing scanned image...' });
      set({ fullRawScan: scanResponse.image_base64 });

      if (state.scanMode === 'auto-detect') {
        set({ scanStatusMessage: 'Detecting photos...' });
        const detectionResponse = await scannerApi.autoDetect();
        if (detectionResponse.success && detectionResponse.photos) {
          const photoObjects = detectionResponse.photos.map((photo) => ({
            id: photo.id,
            base64: photo.image_base64,
            width: photo.width,
            height: photo.height,
          }));
          set({ photos: photoObjects });
          set({ success: `Successfully detected ${detectionResponse.photo_count} photos!` });
        }
      } else {
        set({ success: 'Scan completed! Ready for manual cropping.' });
        set({ photos: [] });
      }
      return true;
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Failed to scan';
      if (detail.startsWith('CONNECTION_ISSUE:')) {
        set({ error: '🔌 Cannot connect to scanner — check power and network connection' });
      } else if (detail.startsWith('SCAN_FAILED:')) {
        set({ error: '📄 Scan failed — try adjusting settings or restarting the scanner' });
      } else {
        set({ error: detail });
      }
      console.error(err);
      return false;
    } finally {
      set({ loading: false, scanInProgress: false });
      set({ scanStatusMessage: '' });
    }
  },

  handleSavePhotos: async () => {
    const state = get();
    if (state.photos.length === 0) {
      set({ error: 'No photos to save' });
      return false;
    }

    set({ loading: true, error: null });

    try {
      const photoIds = state.photos.map((_, i) => i);
      const response = await scannerApi.savePhotos(
        photoIds,
        state.fileFormat,
        state.immichEnabled,
        state.selectedAlbum?.id || null
      );

      if (response.success) {
        set({ success: `Saved ${response.saved_count} photos!` });
        set({ photos: [] });
        set({ fullRawScan: null });
        const historyData = await scannerApi.getHistory();
        if (historyData.photos) {
          set({ historyPhotos: historyData.photos });
        }
        return true;
      } else {
        set({ error: response.error || 'Failed to save photos' });
        return false;
      }
    } catch (err) {
      set({ error: err.message || 'Failed to save photos' });
      console.error(err);
      return false;
    } finally {
      set({ loading: false });
    }
  },

  handleSaveAndScan: async () => {
    const state = get();
    if (state.photos.length > 0) {
      const saveResult = await get().handleSavePhotos();
      if (!saveResult) return false;
    }
    return await get().handleScan();
  },
}),
{
  name: 'better-scanner-storage',
  partialize: (state) => ({
    theme: state.theme,
    selectedDevice: state.selectedDevice,
    selectedSource: state.selectedSource,
  }),
},
));