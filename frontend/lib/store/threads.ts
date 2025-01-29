import { create } from 'zustand';
import { Thread, UpdateThreadData } from '../types';
import { StoreApi } from 'zustand';

interface ThreadsState {
  threads: Thread[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchThreads: (userId: string) => Promise<void>;
  createThread: (userId: string) => Promise<Thread>;
  updateThread: (threadId: string, data: UpdateThreadData) => Promise<Thread>;
  deleteThread: (threadId: string) => Promise<void>;
  moveThreadToFolder: (threadId: string, folderId: string | undefined) => Promise<Thread>;
}

type SetState = StoreApi<ThreadsState>['setState'];

// Common fetch options for all requests
const commonFetchOptions: RequestInit = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

export const useThreadsStore = create<ThreadsState>((set: SetState) => ({
  threads: [],
  isLoading: false,
  error: null,

  fetchThreads: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/threads?user_id=${userId}`,
        {
          ...commonFetchOptions,
          method: 'GET',
        }
      );
      if (!response.ok) throw new Error('Failed to fetch threads');
      const threads = await response.json();
      set({ threads, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch threads', isLoading: false });
    }
  },

  createThread: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/threads`,
        {
          ...commonFetchOptions,
          method: 'POST',
          body: JSON.stringify({ user_id: userId }),
        }
      );
      if (!response.ok) throw new Error('Failed to create thread');
      const newThread = await response.json();
      set((state: ThreadsState) => ({
        threads: [newThread, ...state.threads],
        isLoading: false,
      }));
      return newThread;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create thread', isLoading: false });
      throw error;
    }
  },

  updateThread: async (threadId: string, data: UpdateThreadData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/threads/${threadId}`,
        {
          ...commonFetchOptions,
          method: 'PATCH',
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) throw new Error('Failed to update thread');
      const updatedThread = await response.json();

      set((state: ThreadsState) => {
        const updatedThreads = state.threads.map((t: Thread) =>
          t.id === threadId
            ? {
                ...t,
                ...updatedThread,
                folder_id: data.folder_id !== undefined ? data.folder_id : t.folder_id,
                title: data.title !== undefined ? data.title : t.title,
              }
            : t
        );
        return {
          threads: updatedThreads,
          isLoading: false,
        };
      });

      return updatedThread;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update thread', isLoading: false });
      throw error;
    }
  },

  deleteThread: async (threadId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/threads/${threadId}`,
        {
          ...commonFetchOptions,
          method: 'DELETE',
        }
      );
      if (!response.ok) throw new Error('Failed to delete thread');
      set((state: ThreadsState) => ({
        threads: state.threads.filter((t: Thread) => t.id !== threadId),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete thread', isLoading: false });
      throw error;
    }
  },

  moveThreadToFolder: async (threadId: string, folderId: string | undefined): Promise<Thread> => {
    try {
      // Get the current thread to preserve its title
      const currentThread = useThreadsStore.getState().threads.find(t => t.id === threadId);
      if (!currentThread) throw new Error('Thread not found');

      // Use the existing updateThread function to handle both API call and state update
      const updatedThread = await useThreadsStore.getState().updateThread(threadId, {
        folder_id: folderId,
        title: currentThread.title || undefined,
        updated_at: new Date().toISOString(),
      });

      return updatedThread;
    } catch (error) {
      console.error('Error moving thread to folder:', error);
      throw error;
    }
  },
})); 