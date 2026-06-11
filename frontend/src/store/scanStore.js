import create from 'zustand';

export const useScanStore = create((set) => ({
  // Scan state
  photos: [],
  fullRawScan: null,
  scanInProgress: false,
  
  // UI state
  scanMode: 'auto-detect', // 'auto-detect' or 'manual-crop'
  selectedDevice: null,
  selectedSource: 'Platen',
  fileFormat: 'JPEG',
  
  // Album state
  albums: [],
  selectedAlbum: null,
  photoAlbumOverrides: {}, // {photo_id: album_id or null}
  
  // Manual crop state
  manualBoxes: [],
  currentClickStart: null,
  
  // Photo metadata
  photoNames: {},
  photoSaves: {},
  photoDescriptions: {},
  photoStatuses: {},

  // Actions
  addPhotos: (newPhotos) => set((state) => {
    const nextIndex = state.photos.length;
    const newNames = { ...state.photoNames };
    const newSaves = { ...state.photoSaves };
    const newDescriptions = { ...state.photoDescriptions };
    const newStatuses = { ...state.photoStatuses };

    newPhotos.forEach((_, idx) => {
      const index = nextIndex + idx;
      newNames[index] = '';
      newSaves[index] = true;
      newDescriptions[index] = '';
      newStatuses[index] = 'pending';
    });

    return {
      photos: [...state.photos, ...newPhotos],
      photoNames: newNames,
      photoSaves: newSaves,
      photoDescriptions: newDescriptions,
      photoStatuses: newStatuses,
    };
  }),
  updatePhoto: (index, photo) => set((state) => {
    const newPhotos = [...state.photos];
    newPhotos[index] = photo;
    return { photos: newPhotos };
  }),
  
  deletePhoto: (index) => set((state) => {
    const newPhotos = state.photos.filter((_, i) => i !== index);
    const newNames = {};
    const newSaves = {};
    const newDescriptions = {};
    const newStatuses = {};
    const newOverrides = {};

    newPhotos.forEach((photo, idx) => {
      newNames[idx] = state.photoNames[idx >= index ? idx + 1 : idx] || '';
      newSaves[idx] = state.photoSaves[idx >= index ? idx + 1 : idx] !== false;
      newDescriptions[idx] = state.photoDescriptions[idx >= index ? idx + 1 : idx] || '';
      newStatuses[idx] = state.photoStatuses[idx >= index ? idx + 1 : idx] || 'pending';
      if (state.photoAlbumOverrides[idx >= index ? idx + 1 : idx] !== undefined) {
        newOverrides[idx] = state.photoAlbumOverrides[idx >= index ? idx + 1 : idx];
      }
    });

    return {
      photos: newPhotos,
      photoNames: newNames,
      photoSaves: newSaves,
      photoDescriptions: newDescriptions,
      photoStatuses: newStatuses,
      photoAlbumOverrides: newOverrides,
    };
  }),
  
  setFullRawScan: (scan) => set({ fullRawScan: scan }),
  
  setScanInProgress: (inProgress) => set({ scanInProgress: inProgress }),
  
  setScanMode: (mode) => set({ scanMode: mode }),
  
  setSelectedDevice: (device) => set({ selectedDevice: device }),
  
  setSelectedSource: (source) => set({ selectedSource: source }),
  
  setFileFormat: (format) => set({ fileFormat: format }),
  
  setManualBoxes: (boxes) => set({ manualBoxes: boxes }),
  
  setCurrentClickStart: (click) => set({ currentClickStart: click }),
  
  updatePhotoName: (index, name) => set((state) => ({
    photoNames: { ...state.photoNames, [index]: name },
  })),
  
  updatePhotoSave: (index, shouldSave) => set((state) => ({
    photoSaves: { ...state.photoSaves, [index]: shouldSave },
  })),

  updatePhotoDescription: (index, description) => set((state) => ({
    photoDescriptions: { ...state.photoDescriptions, [index]: description },
  })),

  updatePhotoStatus: (index, status) => set((state) => ({
    photoStatuses: { ...state.photoStatuses, [index]: status },
  })),
  
  setPhotoStatuses: (statuses) => set({ photoStatuses: statuses }),


}));
