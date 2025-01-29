"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2, Folder } from "lucide-react";
import JSZip from "jszip";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { useImageStore } from "@/lib/store/images";
import { FileWithUrl, ImageAnalysis, JobStatus } from "@/lib/types";
import { JobStatusResponse } from "@/lib/store/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Helper functions to keep the component clean
const createFileWithUrl = (file: File): FileWithUrl => ({
  file,
  url: URL.createObjectURL(file),
});

const isImageFile = (file: File): boolean => {
  return (
    file.type.startsWith("image/") ||
    [".jpg", ".jpeg", ".png", ".gif"].some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    )
  );
};

const extractImagesFromZip = async (zipFile: File): Promise<File[]> => {
  const zip = new JSZip();
  const content = await zip.loadAsync(zipFile);
  const imageFiles: File[] = [];

  const entries = Object.entries(content.files);
  for (const [path, zipEntry] of entries) {
    if (!zipEntry.dir && path.match(/\.(jpg|jpeg|png|gif)$/i)) {
      const blob = await zipEntry.async("blob");
      const extension = path.split(".").pop()?.toLowerCase() || "";
      const mimeType = extension === "jpg" ? "jpeg" : extension;

      const imageFile = new File([blob], path.split("/").pop() || path, {
        type: `image/${mimeType}`,
      });
      imageFiles.push(imageFile);
    }
  }

  return imageFiles;
};

const processDroppedItems = async (items: File[]): Promise<File[]> => {
  const processedFiles: File[] = [];

  for (const item of items) {
    if (isImageFile(item)) {
      processedFiles.push(item);
    } else if (item.name.toLowerCase().endsWith(".zip")) {
      const extractedImages = await extractImagesFromZip(item);
      processedFiles.push(...extractedImages);
    }
  }

  return processedFiles;
};

const getStatusColor = (status: ImageResult["status"]) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "error":
      return "bg-red-100 text-red-800";
    default:
      return "bg-yellow-100 text-yellow-800";
  }
};

const ProcessingTime = ({ time }: { time: number }) => (
  <span className="text-[10px] text-muted-foreground/50 tabular-nums flex items-center gap-1">
    <span>{time.toFixed(1)}s</span>
  </span>
);

// Add this component above the main UploadPage component
const JobStatusMonitor = ({
  jobId,
  onStatusUpdate,
}: {
  jobId: string;
  onStatusUpdate: (jobId: string, status: JobStatusResponse) => void;
}) => {
  const imageStore = useImageStore();
  const { data: statusData } = imageStore.useJobStatus(jobId);

  useEffect(() => {
    if (statusData) {
      onStatusUpdate(jobId, statusData);
    }
  }, [statusData, jobId, onStatusUpdate]);

  return null;
};

interface ImageResult {
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

export default function UploadPage() {
  const [results, setResults] = useState<ImageResult[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageResult | null>(null);
  const [showThankYou, setShowThankYou] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string>("");
  const imageStore = useImageStore();

  const handleStatusUpdate = useCallback(
    (jobId: string, status: JobStatusResponse) => {
      setResults((prev) =>
        prev.map((s) => {
          if (s.jobId === jobId) {
            // Ensure analysis is properly typed
            const analysis = (status.analysis || status.image?.analysis) as
              | ImageAnalysis
              | undefined;
            const result = analysis
              ? {
                  text: analysis.description,
                  analysis: analysis,
                }
              : undefined;

            return {
              ...s,
              status: status.status as JobStatus,
              result,
              processing_time:
                status.stats?.duration_seconds || status.processing_time,
              error: status.error,
            };
          }
          return s;
        })
      );
    },
    []
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setProcessingMessage("Processing dropped items...");

      try {
        const processedFiles = await processDroppedItems(acceptedFiles);

        if (processedFiles.length === 0) {
          throw new Error("No valid images found in the dropped items");
        }

        setProcessingMessage(`Uploading ${processedFiles.length} images...`);
        const filesWithUrls = processedFiles.map(createFileWithUrl);

        const response: { jobs: Array<{ job_id: string; filename: string }> } =
          await imageStore.uploadImages(processedFiles);

        const newResults = response.jobs
          .map((job) => ({
            jobId: job.job_id,
            filename: job.filename,
            status: "pending" as JobStatus,
            imageUrl: filesWithUrls.find((f) => f.file.name === job.filename)
              ?.url,
          }))
          .filter((result) => result.imageUrl !== undefined);

        setResults((prev) => [...prev, ...newResults]);
        setShowThankYou(true);
        setTimeout(() => setShowThankYou(false), 1500);
      } catch (error) {
        console.error("[Upload] Upload failed:", error);
        setProcessingMessage(
          error instanceof Error ? error.message : "Upload failed"
        );
      } finally {
        setTimeout(() => setProcessingMessage(""), 3000);
      }
    },
    [imageStore]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
      "application/zip": [".zip"],
    },
    noClick: imageStore.isUploading,
  });

  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      {/* Add this before the main content */}
      {results.map((result) => (
        <JobStatusMonitor
          key={result.jobId}
          jobId={result.jobId}
          onStatusUpdate={handleStatusUpdate}
        />
      ))}

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Upload Images</h1>
        </div>

        <div
          {...getRootProps()}
          className="w-full border-2 border-dashed rounded-2xl transition-all cursor-pointer min-h-[120px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1b740f] focus-visible:ring-offset-2"
          style={{
            borderColor: isDragActive ? "#1b740f" : "hsl(var(--border))",
          }}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="flex items-center gap-3">
              {imageStore.isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="flex gap-2">
                  <Upload className="h-5 w-5" />
                  <Folder className="h-5 w-5" />
                </div>
              )}
              <p className="text-sm">
                {imageStore.isUploading
                  ? processingMessage || "Uploading..."
                  : showThankYou
                  ? "Thank you"
                  : "Drop images, folders, or ZIP files"}
              </p>
            </div>
            {!imageStore.isUploading && !showThankYou && (
              <p className="text-xs text-muted-foreground/60">
                Supports PNG, JPG, JPEG, GIF
              </p>
            )}
          </div>
        </div>

        {results.length > 0 && (
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
                  <div className="flex items-center gap-2">
                    <span
                      className={`
                      px-1.5 py-0.5 text-[10px] rounded-md flex items-center gap-1
                      ${getStatusColor(result.status)}
                    `}
                    >
                      {result.status === "processing" && (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      )}
                      {result.status}
                    </span>
                    {result.status === "completed" && (
                      <>
                        {result.processing_time && (
                          <ProcessingTime time={result.processing_time} />
                        )}
                        <span className="text-[10px] text-primary hover:text-primary/80 cursor-pointer transition-colors ml-auto">
                          View description →
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
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
                <h3 className="font-medium">Description</h3>
                {selectedImage?.status === "completed" &&
                  selectedImage?.processing_time && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground/50">
                        Processed in
                      </span>
                      <ProcessingTime time={selectedImage.processing_time} />
                    </div>
                  )}
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {selectedImage?.status === "completed"
                  ? selectedImage?.result?.text
                  : selectedImage?.status === "error"
                  ? selectedImage.error
                  : "Processing..."}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
