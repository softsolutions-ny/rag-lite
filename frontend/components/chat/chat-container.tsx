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
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(
    searchParams.get("thread")
  );
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const { threads, fetchThreads, updateThread, createThread } =
    useThreadsStore();

  // Update currentThreadId when URL changes
  useEffect(() => {
    setCurrentThreadId(searchParams.get("thread"));
  }, [searchParams]);

  // Fetch threads when user ID is available
  useEffect(() => {
    if (userId) {
      fetchThreads(userId);
    }
  }, [userId, fetchThreads]);

  // Fetch existing messages when thread is selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (!currentThreadId) return;

      setIsLoadingThread(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/threads/${currentThreadId}/messages`
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
  }, [currentThreadId]);

  const { messages, isLoading, append, setMessages } = useChat({
    api: "/api/chat",
    body: {
      model,
      threadId: currentThreadId,
    },
    id: currentThreadId || "new", // Use threadId as chat identifier
    initialMessages: initialMessages,
    onFinish: async (message) => {
      // The assistant's message will be stored by the /api/chat route
      console.log("Chat completed:", message);

      // Update thread's updated_at timestamp
      if (currentThreadId) {
        try {
          await updateThread(currentThreadId, {});
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleMessageSubmit = async (content: string) => {
    if (!userId) return;

    try {
      // If no thread is selected, create a new one
      if (!currentThreadId) {
        const newThread = await createThread(userId);
        // Update the current thread ID
        setCurrentThreadId(newThread.id);
        // Navigate to the new thread
        await router.push(`/dashboard/chat?thread=${newThread.id}`);
        // Wait a bit for the state to update
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

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
              <div className="flex h-[50vh] items-center justify-center text-center">
                <div className="max-w-md space-y-4">
                  <h2 className="text-2xl font-semibold">Welcome to Elucide</h2>
                  <p className="text-muted-foreground">
                    Start a new conversation by typing a message below. Your
                    message will automatically create a new thread.
                  </p>
                </div>
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
