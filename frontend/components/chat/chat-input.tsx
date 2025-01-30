"use client";

import {
  CornerDownLeft,
  StopCircle,
  Bot,
  ImagePlus,
  Loader2,
} from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { Button } from "../ui/button";
import { useState, useRef, useEffect } from "react";
import { ModelType } from "@/lib/ai-config";
import { ModelSelector } from "./model-selector";
import { useAuthFetch } from "@/lib/store/api";
import Image from "next/image";

interface ChatInputProps {
  isLoading: boolean;
  onSubmit: (message: string, image_url?: string, analysis?: string) => void;
  onStop?: () => void;
  model: ModelType;
  onModelChange: (model: ModelType) => void;
  disableModelChange?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

export function ChatInput({
  isLoading,
  onSubmit,
  onStop,
  model,
  onModelChange,
  disableModelChange = false,
  inputRef: externalRef,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    url: string;
    file: File;
  } | null>(null);
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const authFetch = useAuthFetch();

  const inputRef = externalRef || internalInputRef;

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    try {
      console.log("[ChatInput] Starting image upload");
      const formData = new FormData();
      formData.append("files", file);

      const response = await authFetch("/api/v1/images", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      console.log("[ChatInput] Image upload response:", data);

      if (data.images?.[0]?.url) {
        console.log(
          "[ChatInput] Setting image preview with URL:",
          data.images[0].url
        );
        setPendingImage({
          url: data.images[0].url,
          file,
        });
      }
    } catch (error) {
      console.error("[ChatInput] Failed to upload image:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() && !pendingImage) return;

    if (pendingImage) {
      try {
        // Only analyze if there's a prompt
        if (input.trim()) {
          console.log("[ChatInput] Sending image for analysis");
          setIsAnalyzing(true);
          const response = await authFetch("/api/v1/images/analyze", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: pendingImage.url,
              prompt: input,
            }),
          });

          const data = await response.json();
          console.log("[ChatInput] Analysis response:", data);

          // Send both the image and its analysis
          onSubmit(input, pendingImage.url, data.analysis);
        } else {
          // Just send the image without analysis if no prompt
          onSubmit("", pendingImage.url);
        }
      } catch (error) {
        console.error("[ChatInput] Failed to analyze image:", error);
        // Still send the message with image but without analysis
        onSubmit(input, pendingImage.url);
      } finally {
        setIsAnalyzing(false);
      }
    } else {
      onSubmit(input);
    }

    setInput("");
    setPendingImage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isLoading && onStop) {
        onStop();
      } else {
        handleSubmit();
      }
    }
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputRef]);

  return (
    <div className="relative flex w-full max-w-3xl flex-col self-center rounded-lg border bg-background p-2">
      {pendingImage && (
        <div className="absolute left-2 bottom-[calc(100%+0.5rem)] flex items-center gap-2 p-2 rounded-lg bg-background border">
          <div className="relative w-16 h-16 overflow-hidden rounded-md">
            <Image
              src={pendingImage.url}
              alt="Upload preview"
              className="object-cover"
              fill
              sizes="64px"
            />
          </div>
          <button
            onClick={() => setPendingImage(null)}
            className="absolute -top-2 -right-2 p-1 rounded-full bg-background border hover:bg-muted"
            disabled={isLoading}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
      <div className="relative flex flex-col pb-7">
        <div className="flex items-center">
          <TextareaAutosize
            ref={inputRef}
            rows={1}
            maxRows={5}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              pendingImage
                ? "Describe what you'd like to know about this image..."
                : model === "agent-1"
                ? "Chat with Agent GPT-4..."
                : "Type a message..."
            }
            className="flex-1 resize-none bg-transparent px-2 py-1.5 outline-none"
            disabled={isLoading}
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={isLoading ? onStop : handleSubmit}
            disabled={isLoading ? false : !input.trim() && !pendingImage}
            className={`text-muted-foreground transition-all duration-200 ${
              isLoading ? "hover:text-destructive" : "hover:text-foreground"
            }`}
          >
            {isLoading || isAnalyzing ? (
              isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <StopCircle className="h-4 w-4" />
              )
            ) : (
              <CornerDownLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="absolute left-2 top-[calc(100%-22px)] flex items-center gap-2">
          <ModelSelector
            model={model}
            onChange={onModelChange}
            disabled={disableModelChange || isLoading}
          />
          {model === "agent-1" && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Bot className="h-3 w-3" />
              Agent Mode
            </span>
          )}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageUpload(file);
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-[calc(100%-22px)] h-5 w-5 text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isUploading || !!pendingImage}
        >
          {isUploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ImagePlus className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
}
