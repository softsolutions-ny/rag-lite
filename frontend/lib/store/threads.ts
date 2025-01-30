import { create } from 'zustand';
import { Thread, UpdateThreadData } from '../types';

interface ThreadsState {
  threads: Thread[];
  isLoading: boolean;
  error: string | null;
  lastSyncTime: number;
  pendingUpdates: Map<string, UpdateThreadData>;
  
  // Actions
  fetchThreads: (userId: string) => Promise<void>;
  createThread: (userId: string) => Promise<Thread>;
  updateThread: (threadId: string, data: UpdateThreadData, optimistic?: boolean) => Promise<Thread>;
  deleteThread: (threadId: string) => Promise<void>;
  moveThreadToFolder: (threadId: string, folderId: string | undefined) => Promise<Thread>;
  syncPendingUpdates: () => Promise<void>;
}

// Common fetch options for all requests
const commonFetchOptions: RequestInit = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

// Debounce time for syncing updates (5 seconds)
const SYNC_DEBOUNCE = 5000;

export const useThreadsStore = create<ThreadsState>((set, get) => ({
  threads: [],
  isLoading: false,
  error: null,
  lastSyncTime: 0,
  pendingUpdates: new Map(),

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
      set({ threads, isLoading: false, lastSyncTime: Date.now() });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch threads', isLoading: false });
    }
  },

  createThread: async (userId: string) => {
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
      set((state) => ({
        threads: [newThread, ...state.threads],
      }));
      return newThread;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create thread' });
      throw error;
    }
  },

  updateThread: async (threadId: string, data: UpdateThreadData, optimistic = true) => {
    const state = get();
    const currentThread = state.threads.find(t => t.id === threadId);
    if (!currentThread) throw new Error('Thread not found');

    if (optimistic) {
      // Optimistically update the thread in state
      set((state) => ({
        threads: state.threads.map((t) =>
          t.id === threadId
            ? {
                ...t,
                ...data,
                title: data.title !== undefined ? data.title : t.title,
                folder_id: data.folder_id !== undefined ? data.folder_id : t.folder_id,
                updated_at: data.updated_at || new Date().toISOString(),
              }
            : t
        ),
        pendingUpdates: new Map(state.pendingUpdates).set(threadId, {
          ...data,
          updated_at: data.updated_at || new Date().toISOString(),
        }),
      }));

      // Schedule a sync if it's been more than SYNC_DEBOUNCE since last sync
      const now = Date.now();
      if (now - state.lastSyncTime > SYNC_DEBOUNCE) {
        setTimeout(() => {
          get().syncPendingUpdates();
        }, SYNC_DEBOUNCE);
      }

      return currentThread;
    } else {
      // Immediate update to the backend
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
        
        set((state) => ({
          threads: state.threads.map((t) =>
            t.id === threadId ? updatedThread : t
          ),
        }));

        return updatedThread;
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to update thread' });
        throw error;
      }
    }
  },

  syncPendingUpdates: async () => {
    const state = get();
    const updates = Array.from(state.pendingUpdates.entries());
    if (updates.length === 0) return;

    try {
      // Process all pending updates
      await Promise.all(
        updates.map(async ([threadId, data]) => {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/threads/${threadId}`,
            {
              ...commonFetchOptions,
              method: 'PATCH',
              body: JSON.stringify(data),
            }
          );
          if (!response.ok) throw new Error(`Failed to update thread ${threadId}`);
          return response.json();
        })
      );

      // Clear pending updates and update last sync time
      set(() => ({
        pendingUpdates: new Map(),
        lastSyncTime: Date.now(),
      }));
    } catch (error) {
      console.error('Error syncing pending updates:', error);
      // Keep the pending updates in case of failure
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