import { JobStatusResponse, APIResponse } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function uploadImages(files: File[]): Promise<APIResponse> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch(`${API_BASE_URL}/api/process-images`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload images: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.jobs) {
    throw new Error("Invalid response format from server");
  }

  return data;
}

export async function checkJobStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/job-status/${jobId}`);

  if (!response.ok) {
    throw new Error(`Failed to check job status: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.status) {
    throw new Error("Invalid status response format from server");
  }

  return data;
}

export function pollJobStatus(
  jobId: string,
  onUpdate: (status: JobStatusResponse) => void,
  onError: (error: Error) => void
): () => void {
  const intervalId = setInterval(async () => {
    try {
      const status = await checkJobStatus(jobId);
      onUpdate(status);

      if (["completed", "error"].includes(status.status)) {
        clearInterval(intervalId);
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error("Unknown error"));
      clearInterval(intervalId);
    }
  }, 2000);

  return () => clearInterval(intervalId);
} 