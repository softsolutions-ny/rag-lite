"use client";

import { CornerDownLeft } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { Button } from "../ui/button";
import { useState, useRef, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelType } from "./model-selector";

interface ChatInputProps {
  isLoading: boolean;
  onSubmit: (message: string) => void;
  model: ModelType;
  onModelChange: (model: ModelType) => void;
}

export function ChatInput({
  isLoading,
  onSubmit,
  model,
  onModelChange,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSubmit(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className="relative flex w-full max-w-4xl flex-col self-center rounded-lg border bg-background p-2">
      <div className="relative flex flex-col pb-7">
        <div className="flex items-center">
          <TextareaAutosize
            ref={inputRef}
            rows={1}
            maxRows={5}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 resize-none bg-transparent px-2 py-1.5 outline-none"
            disabled={isLoading}
          />
          <Button
            size="icon"
            variant="ghost"
            disabled={isLoading || !input.trim()}
            onClick={handleSubmit}
            className="text-muted-foreground hover:text-foreground"
          >
            <CornerDownLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="absolute left-2 top-[calc(100%-22px)]">
          <Select value={model} onValueChange={onModelChange}>
            <SelectTrigger className="h-5 w-[120px] border-none bg-transparent pl-0 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o-mini" className="text-xs">
                gpt-4o-mini
              </SelectItem>
              <SelectItem value="deepseek-reasoner" className="text-xs">
                deepseek-reasoner
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
