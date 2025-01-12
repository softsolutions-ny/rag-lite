import { useAuth } from "@clerk/nextjs";
import { JobStatusResponse, APIResponse, Image } from "./types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useAPI() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  // Helper for authenticated fetch
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

  // Upload images mutation
  const uploadImagesMutation = useMutation({
    mutationFn: async (files: File[]): Promise<APIResponse> => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await authFetch("/api/images", {
        method: "POST",
        body: formData,
      });

      return response.json();
    },
    onSuccess: () => {
      // Invalidate user images query after successful upload
      queryClient.invalidateQueries({ queryKey: ["userImages"] });
    },
  });

  // Job status query hook
  const useJobStatus = (jobId: string) => {
    return useQuery({
      queryKey: ["jobStatus", jobId],
      queryFn: async (): Promise<JobStatusResponse> => {
        const response = await authFetch(`/api/jobs/${jobId}`);
        return response.json();
      },
      refetchInterval: (query) => {
        const data = query.state.data;
        return data?.status === "completed" || data?.status === "error" 
          ? false 
          : 2000;
      },
      enabled: !!jobId,
    });
  };

  // User images query
  const useUserImages = () => {
    return useQuery({
      queryKey: ["userImages"],
      queryFn: async (): Promise<Image[]> => {
        const response = await authFetch("/api/images");
        return response.json();
      },
    });
  };

  // Single image query
  const useImage = (imageId: string) => {
    return useQuery({
      queryKey: ["image", imageId],
      queryFn: async (): Promise<Image> => {
        const response = await authFetch(`/api/images/${imageId}`);
        return response.json();
      },
      enabled: !!imageId,
    });
  };

  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string): Promise<void> => {
      await authFetch(`/api/images/${imageId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      // Invalidate user images query after successful deletion
      queryClient.invalidateQueries({ queryKey: ["userImages"] });
    },
  });

  return {
    uploadImages: uploadImagesMutation.mutateAsync,
    useJobStatus,
    useUserImages,
    useImage,
    deleteImage: deleteImageMutation.mutateAsync,
    // For upload status
    isUploading: uploadImagesMutation.isPending,
    uploadError: uploadImagesMutation.error,
  };
} 