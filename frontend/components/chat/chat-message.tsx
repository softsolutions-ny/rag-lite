"use client";

import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
}

interface ChatMessageProps {
  message: ChatMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className="mx-auto max-w-4xl w-full px-4">
      <div
        className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
      >
        <div className={cn("prose max-w-[75%] break-words dark:prose-invert")}>
          {message.content}
        </div>
      </div>
    </div>
  );
}
