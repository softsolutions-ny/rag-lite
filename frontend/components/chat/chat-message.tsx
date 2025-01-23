"use client";

import { cn } from "@/lib/utils";
import { UserCircle, Bot } from "lucide-react";

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
    <div
      className={cn(
        "flex w-full items-start gap-4 p-4",
        isUser ? "bg-muted/50" : "bg-background"
      )}
    >
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-background shadow">
        {isUser ? (
          <UserCircle className="h-5 w-5" />
        ) : (
          <Bot className="h-5 w-5" />
        )}
      </div>
      <div className="flex-1 space-y-2">
        <div className="prose break-words dark:prose-invert">
          {message.content}
        </div>
      </div>
    </div>
  );
}
