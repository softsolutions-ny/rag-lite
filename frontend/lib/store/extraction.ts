import { create } from 'zustand';
import { useAuthFetch } from './api';

interface ExtractionData {
  status: 'completed' | 'failed' | 'processing' | 'pending';
  data?: any;
  error?: string;
  progress?: any;
}

interface ExtractionStore {
  // State
  activeExtractions: Map<string, ExtractionData>;
  isExtracting: boolean;
  error: string | null;

  // Actions
  startExtraction: (urls: string[], prompt?: string, schema?: any, enableWebSearch?: boolean) => Promise<string>;
  checkExtractionStatus: (jobId: string) => Promise<ExtractionData>;
  clearError: () => void;
  clearExtraction: (jobId: string) => void;
}

export const useExtractionStore = create<ExtractionStore>((set, get) => ({
  activeExtractions: new Map(),
  isExtracting: false,
  error: null,

  startExtraction: async (urls, prompt, schema, enableWebSearch = false) => {
    const authFetch = useAuthFetch();
    set({ isExtracting: true, error: null });

    try {
      const response = await authFetch('/api/v1/extraction/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls,
          prompt,
          schema,
          enable_web_search: enableWebSearch,
        }),
      });

      const { job_id } = await response.json();
      
      // Initialize extraction status
      set(state => ({
        activeExtractions: new Map(state.activeExtractions).set(job_id, {
          status: 'pending',
        }),
      }));

      return job_id;
    } catch (error: any) {
      set({ error: error.message, isExtracting: false });
      throw error;
    } finally {
      set({ isExtracting: false });
    }
  },

  checkExtractionStatus: async (jobId) => {
    const authFetch = useAuthFetch();
    
    try {
      const response = await authFetch(`/api/v1/extraction/extract/${jobId}`);
      const extractionData: ExtractionData = await response.json();

      // Update extraction status in store
      set(state => ({
        activeExtractions: new Map(state.activeExtractions).set(jobId, extractionData),
      }));

      return extractionData;
    } catch (error: any) {
      const errorData: ExtractionData = {
        status: 'failed',
        error: error.message,
      };
      
      set(state => ({
        activeExtractions: new Map(state.activeExtractions).set(jobId, errorData),
      }));

      return errorData;
    }
  },

  clearError: () => set({ error: null }),

  clearExtraction: (jobId) => set(state => {
    const newExtractions = new Map(state.activeExtractions);
    newExtractions.delete(jobId);
    return { activeExtractions: newExtractions };
  }),
})); 