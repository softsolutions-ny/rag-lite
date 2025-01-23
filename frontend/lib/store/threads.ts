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

export const useThreadsStore = create<ThreadsState>((set: SetState) => ({
  threads: [],
  isLoading: false,
  error: null,

  fetchThreads: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/threads?user_id=${userId}`
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
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) throw new Error('Failed to update thread');
      const updatedThread = await response.json();
      set((state: ThreadsState) => ({
        threads: state.threads.map((t: Thread) => (t.id === threadId ? updatedThread : t)),
        isLoading: false,
      }));
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
        { method: 'DELETE' }
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
    return await useThreadsStore.getState().updateThread(threadId, { folder_id: folderId });
  },
})); 