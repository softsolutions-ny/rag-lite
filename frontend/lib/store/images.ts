import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "./api";
import { Image } from "../types";
import { APIResponse, JobStatusResponse } from "./api";

// API endpoints
const API_PATHS = {
  images: "/api/v1/images",
  jobs: "/api/v1/jobs"
};

export function useImageStore() {
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();

  // Upload images mutation
  const uploadImagesMutation = useMutation({
    mutationFn: async (files: File[]): Promise<APIResponse> => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await authFetch(API_PATHS.images, {
        method: "POST",
        body: formData,
      });

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userImages"] });
    },
  });

  // Job status query hook
  const useJobStatus = (jobId: string) => {
    return useQuery({
      queryKey: ["jobStatus", jobId],
      queryFn: async (): Promise<JobStatusResponse> => {
        const response = await authFetch(`${API_PATHS.jobs}/${jobId}`);
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
        const response = await authFetch(API_PATHS.images);
        return response.json();
      },
    });
  };

  // Single image query
  const useImage = (imageId: string) => {
    return useQuery({
      queryKey: ["image", imageId],
      queryFn: async (): Promise<Image> => {
        const response = await authFetch(`${API_PATHS.images}/${imageId}`);
        return response.json();
      },
      enabled: !!imageId,
    });
  };

  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string): Promise<void> => {
      await authFetch(`${API_PATHS.images}/${imageId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userImages"] });
    },
  });

  return {
    uploadImages: uploadImagesMutation.mutateAsync,
    useJobStatus,
    useUserImages,
    useImage,
    deleteImage: deleteImageMutation.mutateAsync,
    isUploading: uploadImagesMutation.isPending,
    uploadError: uploadImagesMutation.error,
  };
} 