// Status types
export type JobStatus = "pending" | "processing" | "completed" | "error";

// API Response types
export interface ImageAnalysis {
  id: string;
  description: string;
  processing_time: number;
  created_at: string;
  model_version?: string;
}

export interface Image {
  id: string;
  filename: string;
  gcs_key: string;
  gcs_bucket: string;
  gcs_url: string;
  mime_type?: string;
  file_size?: number;
  uploaded_at: string;
  user_id?: string;
  analysis?: ImageAnalysis;
}

export interface JobStats {
  job_id: string;
  status: JobStatus;
  user_id?: string;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  api_start_time?: string;
  api_end_time?: string;
  api_duration_seconds?: number;
  image_id?: string;
}

export interface APIJob {
  job_id: string;
  filename: string;
}

export interface APIResponse {
  jobs: Array<{
    job_id: string;
    filename: string;
  }>;
}

export interface JobStatusResponse {
  status: JobStatus;
  job_id: string;
  error?: string;
  image?: Image;
  stats?: JobStats;
  analysis?: ImageAnalysis;
  processing_time?: number;
  filename?: string;
  gcs_url?: string;
  uploaded_at?: string;
}

// UI State types
export interface ImageResult {
  jobId: string;
  filename: string;
  status: JobStatus;
  imageUrl?: string;
  result?: {
    text: string;
    analysis?: ImageAnalysis;
  };
  processing_time?: number;
  error?: string;
}

// File processing types
export interface FileWithUrl {
  file: File;
  url: string;
}

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Thread {
  id: string;
  user_id: string;
  title: string | null;
  label: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFolderData {
  user_id: string;
  name: string;
  parent_id?: string;
}

export interface UpdateFolderData {
  name?: string;
  parent_id?: string;
}

export interface UpdateThreadData {
  title?: string;
  label?: string;
  folder_id?: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
} 