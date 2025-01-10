// Status types
export type JobStatus = "pending" | "processing" | "completed" | "error";

// API Response types
export interface ProcessedResult {
  text?: string;
  analysis?: {
    [key: string]: string | number | boolean;
  };
  error?: string;
  result?: string;
}

export interface APIJob {
  job_id: string;
  filename: string;
}

export interface APIResponse {
  jobs: APIJob[];
}

export interface JobStatusResponse {
  status: JobStatus;
  result?: ProcessedResult | string;
  processing_time?: number;
  error?: string;
  job_id?: string;
  filename?: string;
}

// UI State types
export interface UploadStatus {
  jobId: string;
  status: JobStatus;
  result?: ProcessedResult;
  processing_time?: number;
}

export interface ImageResult extends UploadStatus {
  filename: string;
  imageUrl?: string;
}

// File processing types
export interface FileWithUrl {
  file: File;
  url: string;
} 