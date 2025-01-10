"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
      setIsUploading(true);
      const formData = new FormData();

      // Create object URLs for the images
      const filesWithUrls = acceptedFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));

      filesWithUrls.forEach(({ file }) => {
        formData.append("files", file);
      });

      try {
        const response = await fetch(
          "http://localhost:8000/api/process-images",
          {
            method: "POST",
            body: formData,
          }
        );

        const data: APIResponse = await response.json();
        const newResults = data.jobs.map((job, index) => ({
          jobId: job.job_id,
          filename: job.filename,
          status: "processing" as const,
          imageUrl: filesWithUrls[index].url,
        }));

        setResults((prev) => [...prev, ...newResults]);
        newResults.forEach((result) => pollForResult(result.jobId));
      } catch (error) {
        console.error("Upload failed:", error);
      } finally {
        setIsUploading(false);
      }
    },
  });

  const pollForResult = async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `http://localhost:8000/api/job-status/${jobId}`
        );
        const data = await response.json();

        if (data.status === "completed" || data.status === "error") {
          setResults((prev) =>
            prev.map((r) =>
              r.jobId === jobId
                ? {
                    ...r,
                    status: data.status,
                    result: data.result,
                    error: data.error,
                  }
                : r
            )
          );
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error("Polling failed:", error);
        clearInterval(pollInterval);
      }
    }, 1000);
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {results.map((result) => (
            <Card
              key={result.jobId}
              className="relative overflow-hidden cursor-pointer group"
              onClick={() =>
                result.status === "completed" && setSelectedImage(result)
              }
            >
              {result.imageUrl && (
                <div className="aspect-square relative">
                  <Image
                    src={result.imageUrl}
                    alt={result.filename}
                    fill
                    className="object-cover"
                    unoptimized // Since we're using object URLs
                  />
                  <div
                    className={`
                    absolute inset-0 bg-gradient-to-t from-black/60 to-transparent
                    opacity-0 group-hover:opacity-100 transition-opacity duration-200
                    flex flex-col justify-end p-3
                  `}
                  >
                    <p className="text-xs text-white truncate">
                      {result.filename}
                    </p>
                  </div>
                </div>
              )}
              <div className="absolute top-2 right-2">
                <span
                  className={`
                  px-2 py-1 text-xs rounded-full
                  ${
                    result.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : result.status === "error"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }
                `}
                >
                  {result.status}
                </span>
              </div>
              {result.status === "processing" && (
                <div className="absolute bottom-0 left-0 right-0">
                  <Progress value={33} className="h-1" />
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      <Dialog
        open={!!selectedImage}
        onOpenChange={() => setSelectedImage(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.filename}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-4">
            {selectedImage?.imageUrl && (
              <div className="relative aspect-square">
                <Image
                  src={selectedImage.imageUrl}
                  alt={selectedImage.filename}
                  fill
                  className="object-contain rounded-lg"
                  unoptimized // Since we're using object URLs
                />
              </div>
            )}
            <div className="space-y-4">
              <h3 className="font-medium">Analysis</h3>
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
