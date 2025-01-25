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
import { ModelType, ModelSelector } from "./model-selector";
import { useImageStore } from "@/lib/store/images";
import { useAuthFetch } from "@/lib/store/api";

interface ChatInputProps {
  isLoading: boolean;
  onSubmit: (
    message: string,
    imageUrl?: string,
    imageAnalysis?: string
  ) => void;
  onStop?: () => void;
  model: ModelType;
  onModelChange: (model: ModelType) => void;
  disableModelChange?: boolean;
}

export function ChatInput({
  isLoading,
  onSubmit,
  onStop,
  model,
  onModelChange,
  disableModelChange = false,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageStore = useImageStore();
  const authFetch = useAuthFetch();

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    setIsAnalyzing(true);
    try {
      const response = await imageStore.uploadImages([file]);
      const jobId = response.jobs[0].job_id;
      const imageUrl = URL.createObjectURL(file);

      // Wait for analysis to complete before sending any messages
      const interval = setInterval(async () => {
        try {
          const response = await authFetch(`/api/v1/jobs/${jobId}`);
          const data = await response.json();
          if (data.status === "completed" || data.status === "error") {
            clearInterval(interval);
            if (data.status === "completed" && data.analysis) {
              // Send both image and analysis together
              onSubmit("", imageUrl, data.analysis.description);
            }
            setIsAnalyzing(false);
          }
        } catch (error) {
          console.error("Failed to get image analysis:", error);
          clearInterval(interval);
          setIsAnalyzing(false);
        }
      }, 1000);
    } catch (error) {
      console.error("Failed to upload image:", error);
      setIsAnalyzing(false);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;
    onSubmit(input);
    setInput("");
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
  }, []);

  return (
    <div className="relative flex w-full max-w-3xl flex-col self-center rounded-lg border bg-background p-2">
      {isAnalyzing && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-background/50 backdrop-blur-[1px]">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
              model === "agent-gpt4o"
                ? "Chat with Agent GPT-4o..."
                : "Type a message..."
            }
            className="flex-1 resize-none bg-transparent px-2 py-1.5 outline-none"
            disabled={isLoading || isAnalyzing}
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={isLoading ? onStop : handleSubmit}
            disabled={isLoading ? false : !input.trim() || isAnalyzing}
            className={`text-muted-foreground transition-all duration-200 ${
              isLoading ? "hover:text-destructive" : "hover:text-foreground"
            }`}
          >
            {isLoading ? (
              <StopCircle className="h-4 w-4" />
            ) : (
              <CornerDownLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="absolute left-2 top-[calc(100%-22px)] flex items-center gap-2">
          <ModelSelector
            model={model}
            onChange={onModelChange}
            disabled={disableModelChange}
          />
          {model === "agent-gpt4o" && (
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
          disabled={isLoading || isUploading || isAnalyzing}
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
