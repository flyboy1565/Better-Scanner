// frontend/src/store/scanStore.js
// 1. Fixed the deprecated warning: change 'import create from "zustand"' to named import:
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useScanStore = create(
  persist(
    (set) => ({
  // Scan state
  photos: [],
  historyPhotos: [],
  fullRawScan: null,
  scanInProgress: false,
  
  // UI state
  theme: 'default',
  scanMode: 'auto-detect', 
  selectedDevice: null,
  selectedSource: 'Platen',
  fileFormat: 'JPEG',
  
  // Album state
  albums: [],
  selectedAlbum: null,
  photoAlbumOverrides: {}, 

  // Photo metadata
  photoNames: {},
  photoSaves: {},
  photoDescriptions: {},
  photoStatuses: {},

  // Actions
  // Explicit setter to directly replace or clear the global photos array
  setPhotos: (photoObjects) => set((state) => {
    const newNames = { ...state.photoNames };
    const newSaves = { ...state.photoSaves };
    const newDescriptions = { ...state.photoDescriptions };
    const newStatuses = { ...state.photoStatuses };

    photoObjects.forEach((_, idx) => {
      if (newNames[idx] === undefined) newNames[idx] = '';
      if (newSaves[idx] === undefined) newSaves[idx] = true;
      if (newDescriptions[idx] === undefined) newDescriptions[idx] = '';
      if (newStatuses[idx] === undefined) newStatuses[idx] = 'pending';
    });

    return { 
      photos: photoObjects,
      photoNames: newNames,
      photoSaves: newSaves,
      photoDescriptions: newDescriptions,
      photoStatuses: newStatuses
    };
  }),

  // Explicit setter to assign fetched Immich albums
  setAlbums: (albumList) => set({ albums: albumList }),

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
  setTheme: (theme) => set({ theme }),
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
  
  setPhotoAlbumOverride: (index, albumId) => set((state) => ({
    photoAlbumOverrides: { ...state.photoAlbumOverrides, [index]: albumId }
  })),

  clearPhotoAlbumOverride: (index) => set((state) => {
    const newOverrides = { ...state.photoAlbumOverrides };
    delete newOverrides[index];
    return { photoAlbumOverrides: newOverrides };
  }),
  setSelectedAlbum: (album) => set({ selectedAlbum: album }),

  setHistoryPhotos: (photos) => set({ historyPhotos: photos }),

  clearSession: () => set({
    photos: [],
    fullRawScan: null,
  }),
}),
{
  name: 'better-scanner-storage',
  partialize: (state) => ({
    theme: state.theme,
  }),
},
));