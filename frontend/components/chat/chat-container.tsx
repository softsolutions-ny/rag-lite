"use client";

import { useChat } from "ai/react";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import { ScrollArea } from "../ui/scroll-area";
import { useEffect, useRef, useState, useCallback } from "react";
import { ModelType } from "./model-selector";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useThreadsStore } from "@/lib/store";

export function ChatContainer() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userId } = useAuth();
  const [model, setModel] = useState<ModelType>("gpt-4o-mini");
  const threadId = searchParams.get("thread");
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const { threads, fetchThreads, updateThread } = useThreadsStore();

  // Fetch threads when user ID is available
  useEffect(() => {
    if (userId) {
      fetchThreads(userId);
    }
  }, [userId, fetchThreads]);

  // Fetch existing messages when thread is selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (!threadId) return;

      setIsLoadingThread(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/threads/${threadId}/messages`
        );

        if (response.ok) {
          const messages = await response.json();
          setInitialMessages(
            messages.map((msg: any) => ({
              id: msg.id,
              content: msg.content,
              role: msg.role,
            }))
          );
        } else {
          console.error("Failed to fetch messages");
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setIsLoadingThread(false);
      }
    };

    setInitialMessages([]); // Reset messages when thread changes
    fetchMessages();
  }, [threadId]);

  const { messages, isLoading, append, setMessages } = useChat({
    api: "/api/chat",
    body: {
      model,
      threadId,
    },
    id: threadId || "new", // Use threadId as chat identifier
    initialMessages: initialMessages,
    onFinish: async (message) => {
      // The assistant's message will be stored by the /api/chat route
      console.log("Chat completed:", message);

      // Update thread's updated_at timestamp
      if (threadId) {
        try {
          await updateThread(threadId, {});
        } catch (error) {
          console.error("Error updating thread timestamp:", error);
        }
      }
    },
  });

  // Reset messages when thread changes
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages, setMessages]);

  // Redirect to threads list if no thread ID is present
  useEffect(() => {
    if (!threadId && userId) {
      router.push("/dashboard/chat");
    }
  }, [threadId, userId, router]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleMessageSubmit = async (content: string) => {
    if (!threadId) {
      console.error("Cannot send message: no thread selected");
      return;
    }

    try {
      // Let the Vercel AI SDK handle message storage through /api/chat
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
            {messages.length === 0 && !isLoadingThread && (
              <div className="flex h-[50vh] items-center justify-center">
                <p className="text-muted-foreground">
                  {threadId
                    ? "Start a conversation by typing a message below."
                    : "No thread selected."}
                </p>
              </div>
            )}
            {/* Add padding at the bottom to ensure last message is visible */}
            <div className="h-16" />
            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Fixed input at viewport bottom */}
      <div className="absolute inset-x-0 bottom-0  pt-4">
        <div className="mx-auto max-w-4xl p-4">
          <ChatInput
            isLoading={isLoading || isLoadingThread}
            onSubmit={handleMessageSubmit}
            model={model}
            onModelChange={setModel}
          />
        </div>
      </div>
    </>
  );
}
