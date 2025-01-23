"use client";

import { SendIcon } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { Button } from "../ui/button";
import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  isLoading: boolean;
  onSubmit: (message: string) => void;
}

export function ChatInput({ isLoading, onSubmit }: ChatInputProps) {
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
    <div className="relative flex w-full max-w-4xl items-center self-center rounded-lg border bg-background p-2">
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
        disabled={isLoading || !input.trim()}
        onClick={handleSubmit}
      >
        <SendIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
