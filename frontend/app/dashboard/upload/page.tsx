"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2, Folder } from "lucide-react";
import JSZip from "jszip";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { uploadImages, pollJobStatus } from "@/lib/api";
import {
  ImageResult,
  FileWithUrl,
  APIResponse,
  JobStatusResponse,
} from "@/lib/types";
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

export default function UploadPage() {
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageResult | null>(null);
  const [showThankYou, setShowThankYou] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string>("");

  const handleUploadSuccess = (
    apiResponse: APIResponse,
    filesWithUrls: FileWithUrl[]
  ) => {
    // Create a map of filenames to their URLs
    const fileUrlMap = new Map(filesWithUrls.map((f) => [f.file.name, f.url]));

    const newResults = apiResponse.jobs
      .map((job) => {
        const imageUrl = fileUrlMap.get(job.filename);
        if (!imageUrl) {
          console.log(`[Upload] No URL found for file: ${job.filename}`);
        }
        return {
          jobId: job.job_id,
          filename: job.filename,
          status: "pending" as const,
          imageUrl: imageUrl, // Will be undefined if not found
        };
      })
      .filter((result) => result.imageUrl !== undefined);

    console.log(
      `[Upload] Created ${newResults.length} results from ${apiResponse.jobs.length} jobs`
    );
    setResults((prev) => [...prev, ...newResults]);
    return newResults;
  };

  const handleStatusUpdate = (jobId: string, status: JobStatusResponse) => {
    setResults((prev) =>
      prev.map((s) => {
        if (s.jobId === jobId) {
          const result =
            typeof status.result === "string"
              ? { text: status.result }
              : status.result;

          return {
            ...s,
            status: status.status,
            result,
            processing_time: status.processing_time,
          };
        }
        return s;
      })
    );
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    console.log(
      `[Upload] Starting upload for ${acceptedFiles.length} files/folders`
    );
    setUploading(true);
    setProcessingMessage("Processing dropped items...");

    try {
      const processedFiles = await processDroppedItems(acceptedFiles);
      console.log(`[Upload] Extracted ${processedFiles.length} images`);

      if (processedFiles.length === 0) {
        throw new Error("No valid images found in the dropped items");
      }

      setProcessingMessage(`Uploading ${processedFiles.length} images...`);
      const filesWithUrls = processedFiles.map(createFileWithUrl);

      const response = await uploadImages(processedFiles);
      console.log(`[Upload] Received response from backend:`, response);

      handleUploadSuccess(response, filesWithUrls);

      // Start polling for status
      response.jobs.forEach((job) => {
        pollJobStatus(
          job.job_id,
          (status) => {
            handleStatusUpdate(job.job_id, status);
          },
          (error) => {
            console.error("Polling error:", error);
            handleStatusUpdate(job.job_id, {
              status: "error",
              result: { error: error.message },
            });
          }
        );
      });

      setShowThankYou(true);
      setTimeout(() => {
        setShowThankYou(false);
      }, 1500);
    } catch (error) {
      console.error("[Upload] Upload failed:", error);
      setProcessingMessage(
        error instanceof Error ? error.message : "Upload failed"
      );
    } finally {
      setUploading(false);
      setTimeout(() => setProcessingMessage(""), 3000);
      console.log(`[Upload] Upload process completed`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
      "application/zip": [".zip"],
    },
    noClick: uploading,
  });

  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Upload Images</h1>
          <p className="text-sm text-muted-foreground">
            Drop images, folders, or ZIP files for processing
          </p>
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
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="flex gap-2">
                  <Upload className="h-5 w-5" />
                  <Folder className="h-5 w-5" />
                </div>
              )}
              <p className="text-sm">
                {uploading
                  ? processingMessage || "Uploading..."
                  : showThankYou
                  ? "Thank you"
                  : "Drop images, folders, or ZIP files"}
              </p>
            </div>
            {!uploading && !showThankYou && (
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
                        <span className="text-[10px] text-primary hover:text-primary/80 cursor-pointer transition-colors">
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
                <h3 className="font-medium">Analysis</h3>
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
                {selectedImage?.result?.text || selectedImage?.result?.result}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
