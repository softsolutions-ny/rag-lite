import { create } from 'zustand';
import { useAuthFetch } from './api';

interface ExtractionRequest {
  urls: string[];
  prompt?: string;
  extraction_schema?: Record<string, any>;
  enable_web_search?: boolean;
}

interface ExtractionResponse {
  job_id: string;
  status: string;
  message: string;
}

interface ExtractionStatusResponse {
  status: 'completed' | 'failed' | 'processing';
  data?: Record<string, any>;
  error?: string;
  progress?: any;
}

interface ExtractionData {
  status: 'completed' | 'failed' | 'processing' | 'pending';
  data?: Record<string, any>;
  error?: string;
  progress?: any;
  urls: string[];
}

interface ExtractionStore {
  // State
  activeExtractions: Map<string, ExtractionData>;
  isExtracting: boolean;
  error: string | null;

  // Actions
  startExtraction: (request: ExtractionRequest) => Promise<string>;
  checkExtractionStatus: (jobId: string) => Promise<ExtractionStatusResponse>;
  clearError: () => void;
  clearExtraction: (jobId: string) => void;
}

export const useExtractionStore = create<ExtractionStore>((set, get) => ({
  activeExtractions: new Map(),
  isExtracting: false,
  error: null,

  startExtraction: async (request) => {
    const authFetch = useAuthFetch();
    set({ isExtracting: true, error: null });

    try {
      const response = await authFetch('/api/v1/extraction/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to start extraction');
      }

      const data: ExtractionResponse = await response.json();
      
      // Initialize extraction status
      set(state => ({
        activeExtractions: new Map(state.activeExtractions).set(data.job_id, {
          status: 'pending',
          urls: request.urls,
        }),
      }));

      return data.job_id;
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
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to check extraction status');
      }

      const statusData: ExtractionStatusResponse = await response.json();

      // Update extraction status in store
      set(state => {
        const currentExtraction = state.activeExtractions.get(jobId);
        if (!currentExtraction) return state;

        return {
          activeExtractions: new Map(state.activeExtractions).set(jobId, {
            ...currentExtraction,
            ...statusData,
          }),
        };
      });

      return statusData;
    } catch (error: any) {
      const errorData: ExtractionStatusResponse = {
        status: 'failed',
        error: error.message,
      };
      
      set(state => {
        const currentExtraction = state.activeExtractions.get(jobId);
        if (!currentExtraction) return state;

        return {
          activeExtractions: new Map(state.activeExtractions).set(jobId, {
            ...currentExtraction,
            ...errorData,
          }),
        };
      });

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