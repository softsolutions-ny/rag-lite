import { create } from 'zustand';
import { Thread, UpdateThreadData } from '../types';
import * as threadActions from '../actions/thread';

interface ThreadsState {
  threads: Thread[];
  isLoading: boolean;
  error: string | null;
  lastSyncTime: number;
  pendingUpdates: Map<string, UpdateThreadData>;
  
  // Actions
  fetchThreads: () => Promise<void>;
  createThread: () => Promise<Thread>;
  updateThread: (threadId: string, data: UpdateThreadData, optimistic?: boolean) => Promise<Thread>;
  deleteThread: (threadId: string) => Promise<void>;
  moveThreadToFolder: (threadId: string, folderId: string | undefined) => Promise<Thread>;
  syncPendingUpdates: () => Promise<void>;
}

export const useThreadsStore = create<ThreadsState>((set, get) => ({
  threads: [],
  isLoading: false,
  error: null,
  lastSyncTime: 0,
  pendingUpdates: new Map(),

  fetchThreads: async () => {
    set({ isLoading: true, error: null });
    try {
      const threads = await threadActions.fetchThreads();
      set({ threads, isLoading: false, lastSyncTime: Date.now() });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch threads', isLoading: false });
    }
  },

  createThread: async () => {
    try {
      const state = get();
      
      // Calculate next untitled number
      const untitledThreads = state.threads.filter(t => t.title?.startsWith('Untitled ') || !t.title);
      const nextNumber = untitledThreads.length + 1;
      const tempTitle = `Untitled ${nextNumber}`;
      
      // Create optimistic thread
      const optimisticThread: Thread = {
        id: `temp-${Date.now()}`,
        user_id: 'temp',
        title: tempTitle,
        label: null,
        folder_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Update state optimistically
      set((state) => ({
        threads: [optimisticThread, ...state.threads],
        isLoading: true,
      }));

      // Create thread in backend
      const newThread = await threadActions.createThread();

      // Update state with real thread but preserve the title
      set((state) => ({
        threads: state.threads.map((t) =>
          t.id === optimisticThread.id ? { ...newThread, title: tempTitle } : t
        ),
        isLoading: false,
      }));

      // Update the title in the backend
      await threadActions.updateThread(newThread.id, { title: tempTitle });

      return { ...newThread, title: tempTitle };
    } catch (error) {
      // Revert optimistic update on error
      set((state) => ({
        threads: state.threads.filter(t => !t.id.startsWith('temp-')),
        error: error instanceof Error ? error.message : 'Failed to create thread',
        isLoading: false,
      }));
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

      // Schedule a sync if it's been more than 5 seconds since last sync
      const now = Date.now();
      if (now - state.lastSyncTime > 5000) {
        setTimeout(() => {
          get().syncPendingUpdates();
        }, 5000);
      }

      return currentThread;
    } else {
      // Immediate update to the backend
      try {
        const updatedThread = await threadActions.updateThread(threadId, data);
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
          return threadActions.updateThread(threadId, data);
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
      await threadActions.deleteThread(threadId);
      
      // Clean up state and pending updates
      set((state) => {
        const newPendingUpdates = new Map(state.pendingUpdates);
        newPendingUpdates.delete(threadId);
        
        return {
          threads: state.threads.filter((t) => t.id !== threadId),
          pendingUpdates: newPendingUpdates,
          isLoading: false,
        };
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete thread', isLoading: false });
      throw error;
    }
  },

  moveThreadToFolder: async (threadId: string, folderId: string | undefined) => {
    try {
      // Find the current thread to preserve its title
      const currentThread = get().threads.find(t => t.id === threadId);
      if (!currentThread) throw new Error('Thread not found');

      // Apply optimistic update
      set((state) => ({
        ...state,
        threads: state.threads.map((t) =>
          t.id === threadId ? { ...t, folder_id: folderId || null } : t
        ),
      }));

      const updatedThread = await threadActions.updateThread(threadId, {
        folder_id: folderId,
        title: currentThread.title || undefined,
        updated_at: new Date().toISOString(),
      });
      
      set((state) => ({
        ...state,
        threads: state.threads.map((t) =>
          t.id === threadId ? updatedThread : t
        ),
      }));
      return updatedThread;
    } catch (error) {
      // Revert optimistic update on error
      set((state) => ({
        ...state,
        threads: state.threads.map((t) =>
          t.id === threadId ? { ...t, folder_id: null } : t
        ),
      }));
      console.error('Error moving thread to folder:', error);
      throw error;
    }
  },
})); 