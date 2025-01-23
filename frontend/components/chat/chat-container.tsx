"use client";

import { useChat } from "ai/react";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import { ScrollArea } from "../ui/scroll-area";
import { useEffect, useRef, useState } from "react";
import { ModelType } from "./model-selector";

export function ChatContainer() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState<ModelType>("gpt-4o-mini");

  const { messages, isLoading, append } = useChat({
    api: "/api/chat",
    body: {
      model,
    },
    onError: (error) => {
      console.error("Chat error:", error);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleMessageSubmit = async (content: string) => {
    try {
      await append({
        content,
        role: "user",
      });
    } catch (error) {
      console.error("Error submitting message:", error);
    }
  };

  return (
    <>
      {/* Main scrollable content */}
      <div className="absolute inset-0 bottom-[88px]">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-4 px-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={{
                  id: message.id,
                  content: message.content,
                  role: message.role as "user" | "assistant",
                }}
              />
            ))}
            {messages.length === 0 && (
              <div className="flex h-[50vh] items-center justify-center">
                <p className="text-muted-foreground">
                  Start a conversation by typing a message below.
                </p>
              </div>
            )}
            {/* Add padding at the bottom to ensure last message is visible */}
            <div className="h-12" />
            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Fixed input at viewport bottom */}
      <div className="absolute inset-x-0 bottom-0 backdrop-blur-sm pt-2">
        <div className="mx-auto max-w-4xl p-4">
          <ChatInput
            isLoading={isLoading}
            onSubmit={handleMessageSubmit}
            model={model}
            onModelChange={setModel}
          />
        </div>
      </div>
    </>
  );
}
