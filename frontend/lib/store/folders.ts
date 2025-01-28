import { create } from 'zustand';
import { Folder, CreateFolderData, UpdateFolderData } from '../types';
import { StoreApi } from 'zustand';

interface FoldersState {
  folders: Folder[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchFolders: (userId: string) => Promise<void>;
  createFolder: (data: CreateFolderData) => Promise<Folder>;
  updateFolder: (folderId: string, data: UpdateFolderData) => Promise<Folder>;
  deleteFolder: (folderId: string) => Promise<void>;
}

type SetState = StoreApi<FoldersState>['setState'];

export const useFoldersStore = create<FoldersState>((set: SetState) => ({
  folders: [],
  isLoading: false,
  error: null,

  fetchFolders: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/folders?user_id=${userId}`
      );
      if (!response.ok) throw new Error('Failed to fetch folders');
      const folders = await response.json();
      set({ folders, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch folders', isLoading: false });
    }
  },

  createFolder: async (data: CreateFolderData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/folders`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) throw new Error('Failed to create folder');
      const newFolder = await response.json();
      set((state: FoldersState) => ({ folders: [...state.folders, newFolder], isLoading: false }));
      return newFolder;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create folder', isLoading: false });
      throw error;
    }
  },

  updateFolder: async (folderId: string, data: UpdateFolderData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/folders/${folderId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) throw new Error('Failed to update folder');
      const updatedFolder = await response.json();
      set((state: FoldersState) => ({
        folders: state.folders.map((f: Folder) => (f.id === folderId ? updatedFolder : f)),
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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/folders/${folderId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to delete folder');
      set((state: FoldersState) => ({
        folders: state.folders.filter((f: Folder) => f.id !== folderId),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete folder', isLoading: false });
      throw error;
    }
  },
})); 