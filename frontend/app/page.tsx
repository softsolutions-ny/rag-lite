"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import Image from "next/image";
import { Card } from "@/components/ui/card";

import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ImageResult {
  jobId: string;
  filename: string;
  status: "processing" | "completed" | "error";
  result?: string;
  error?: string;
  imageUrl?: string;
  processing_time?: number;
}

interface APIJob {
  job_id: string;
  filename: string;
}

interface APIResponse {
  jobs: APIJob[];
}

export default function Home() {
  const [results, setResults] = useState<ImageResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageResult | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
    },
    onDrop: async (acceptedFiles) => {
      console.log(`[Upload] Starting upload for ${acceptedFiles.length} files`);
      setIsUploading(true);
      const formData = new FormData();

      // Create object URLs for the images
      const filesWithUrls = acceptedFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));
      console.log(`[Upload] Created URLs for files:`, filesWithUrls);

      filesWithUrls.forEach(({ file }) => {
        formData.append("files", file);
      });

      try {
        console.log(`[Upload] Sending files to backend...`);
        const response = await fetch("/api/process-images", {
          method: "POST",
          body: formData,
        });

        const data: APIResponse = await response.json();
        console.log(`[Upload] Received response from backend:`, data);

        const newResults = data.jobs.map((job, index) => ({
          jobId: job.job_id,
          filename: job.filename,
          status: "processing" as const,
          imageUrl: filesWithUrls[index].url,
        }));
        console.log(`[Upload] Created new results:`, newResults);

        setResults((prev) => {
          const updated = [...prev, ...newResults];
          console.log(`[State] Updated results after upload:`, updated);
          return updated;
        });

        console.log(`[Upload] Starting polling for new jobs...`);
        newResults.forEach((result) => pollJobStatus(result.jobId));
      } catch (error) {
        console.error("[Upload] Upload failed:", error);
      } finally {
        setIsUploading(false);
        console.log(`[Upload] Upload process completed`);
      }
    },
  });

  const pollJobStatus = async (jobId: string) => {
    const POLL_INTERVAL = 1000;
    const MAX_ATTEMPTS = 60;
    let attempts = 0;

    const poll = async () => {
      attempts++;

      try {
        console.log(`[Poll] Polling status for job ${jobId}`);
        const response = await fetch(`/api/job-status/${jobId}`);
        const data = await response.json();
        console.log(`[Poll] Received status for job ${jobId}:`, data);

        setResults((prev) => {
          return prev.map((result) => {
            if (result.jobId === jobId) {
              return {
                ...result,
                status: data.status,
                result: data.result || result.result,
                error: data.error || result.error,
                processing_time: data.processing_time,
              };
            }
            return result;
          });
        });

        // Stop polling if we have a final state or max attempts reached
        if (
          data.status === "completed" ||
          data.status === "error" ||
          data.error ||
          attempts >= MAX_ATTEMPTS
        ) {
          console.log(
            `[Poll] Stopping poll for job ${jobId}. Final state:`,
            data
          );
          return;
        }

        // Continue polling
        setTimeout(poll, POLL_INTERVAL);
      } catch (error) {
        console.error(`[Poll] Error polling job ${jobId}:`, error);
        // Stop polling on error
        return;
      }
    };

    poll();
  };

  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">elucide</h1>
          <p className="text-sm text-muted-foreground">
            give your pictures meaning
          </p>
        </div>

        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
            transition-colors duration-200 ease-in-out
            ${
              isDragActive
                ? "border-primary bg-secondary/50"
                : "border-border hover:border-primary/50"
            }
          `}
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Uploading images...
              </p>
            </div>
          ) : isDragActive ? (
            <p className="text-sm text-muted-foreground">
              Drop the images here...
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Drag and drop images here, or click to select files
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {results.map((result) => (
            <Card
              key={result.jobId}
              className="overflow-hidden cursor-pointer flex flex-col shadow-none border-none bg-transparent"
              onClick={() =>
                result.status === "completed" && setSelectedImage(result)
              }
            >
              {result.imageUrl && (
                <div className="aspect-square relative border border-black/[0.08] rounded-lg">
                  <Image
                    src={result.imageUrl}
                    alt={result.filename}
                    fill
                    className="object-cover"
                    unoptimized // Since we're using object URLs
                  />
                </div>
              )}
              <div className="pt-2 space-y-1.5">
                <p className="text-xs text-muted-foreground truncate">
                  {result.filename}
                </p>
                <div className="flex items-center justify-between">
                  <span
                    className={`
                    px-1.5 py-0.5 text-[10px] rounded-md flex items-center gap-1
                    ${
                      result.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : result.status === "error"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }
                  `}
                  >
                    {result.status === "processing" && (
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    )}
                    {result.status}
                  </span>
                  {result.status === "completed" && (
                    <span className="text-[10px] text-muted-foreground/50 tabular-nums flex items-center gap-1">
                      <span>Described:</span>
                      <span>{result.processing_time?.toFixed(1)}s</span>
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedImage?.filename}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-4 min-h-0 flex-1 overflow-hidden">
            {selectedImage?.imageUrl && (
              <div className="relative aspect-square border border-black/[0.08] rounded-lg">
                <Image
                  src={selectedImage.imageUrl}
                  alt={selectedImage.filename}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
            <div className="space-y-4 overflow-y-auto pr-2">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Analysis</h3>
                {selectedImage?.processing_time && (
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums flex items-center gap-1">
                    <span>Described:</span>
                    <span>{selectedImage.processing_time.toFixed(1)}s</span>
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {selectedImage?.result}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
