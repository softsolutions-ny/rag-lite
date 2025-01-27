import { useAuth } from "@clerk/nextjs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || 'Failed to fetch');
  }

  return response.json();
}

export function createEndpoint(path: string) {
  return `/api/v1/chat${path}`;
}

export const endpoints = {
  folders: {
    list: (userId: string) => createEndpoint(`/folders?user_id=${userId}`),
    create: () => createEndpoint('/folders'),
    update: (id: string) => createEndpoint(`/folders/${id}`),
    delete: (id: string) => createEndpoint(`/folders/${id}`),
  },
  threads: {
    list: (userId: string) => createEndpoint(`/threads?user_id=${userId}`),
    get: (id: string) => createEndpoint(`/threads/${id}`),
    update: (id: string) => createEndpoint(`/threads/${id}`),
    delete: (id: string) => createEndpoint(`/threads/${id}`),
    messages: (id: string) => createEndpoint(`/threads/${id}/messages`),
  },
};

export function useAuthFetch() {
  const { getToken } = useAuth();

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response;
  };

  return authFetch;
}

// Common API response types
export interface JobStatusResponse {
  status: "pending" | "processing" | "completed" | "error";
  error?: string;
  analysis?: Record<string, unknown>;
  image?: {
    analysis: Record<string, unknown>;
  };
  stats?: {
    duration_seconds: number;
  };
  processing_time?: number;
} 