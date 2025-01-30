import { create } from 'zustand';
import { Folder, CreateFolderData, UpdateFolderData } from '../types';
import * as folderActions from '../actions/folder';

interface FoldersState {
  folders: Folder[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchFolders: () => Promise<void>;
  createFolder: (data: Omit<CreateFolderData, 'user_id'>) => Promise<Folder>;
  updateFolder: (folderId: string, data: UpdateFolderData) => Promise<Folder>;
  deleteFolder: (folderId: string) => Promise<void>;
}

export const useFoldersStore = create<FoldersState>((set) => ({
  folders: [],
  isLoading: false,
  error: null,

  fetchFolders: async () => {
    set({ isLoading: true, error: null });
    try {
      const folders = await folderActions.fetchFolders();
      set({ folders, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch folders', isLoading: false });
    }
  },

  createFolder: async (data: Omit<CreateFolderData, 'user_id'>) => {
    set({ isLoading: true, error: null });
    try {
      const newFolder = await folderActions.createFolder(data);
      set((state) => ({ folders: [...state.folders, newFolder], isLoading: false }));
      return newFolder;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create folder', isLoading: false });
      throw error;
    }
  },

  updateFolder: async (folderId: string, data: UpdateFolderData) => {
    set({ isLoading: true, error: null });
    try {
      const updatedFolder = await folderActions.updateFolder(folderId, data);
      set((state) => ({
        folders: state.folders.map((f) => (f.id === folderId ? updatedFolder : f)),
        isLoading: false,
      }));
      return updatedFolder;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update folder', isLoading: false });
      throw error;
    }
  },

  deleteFolder: async (folderId: string) => {
    set({ isLoading: true, error: null });
    try {
      await folderActions.deleteFolder(folderId);
      set((state) => ({
        folders: state.folders.filter((f) => f.id !== folderId),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete folder', isLoading: false });
      throw error;
    }
  },
})); 