"use client";

import { useChat } from "ai/react";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import { ScrollArea } from "../ui/scroll-area";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { ModelType } from "./model-selector";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useThreadsStore } from "@/lib/store";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
}

export function ChatContainer() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userId } = useAuth();
  const [model, setModel] = useState<ModelType>("gpt-4o-mini");
  const threadParam = searchParams.get("thread");
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(
    threadParam as string | undefined
  );
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const { threads, fetchThreads, updateThread, createThread } =
    useThreadsStore();

  // Update currentThreadId when URL changes
  useEffect(() => {
    const param = searchParams.get("thread");
    setCurrentThreadId(param as string | undefined);
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
      if (!currentThreadId) {
        setInitialMessages([]);
        return;
      }

      setIsLoadingThread(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/threads/${currentThreadId}/messages`
        );

        if (response.ok) {
          const messages = await response.json();
          setInitialMessages(
            messages.map((msg: Message) => ({
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

    fetchMessages();
  }, [currentThreadId]);

  const { messages, isLoading, append, stop } = useChat({
    api:
      model === "agent-gpt4o"
        ? "/api/agent"
        : model === "deepseek-reasoner"
        ? "/api/deepseek"
        : "/api/chat",
    body: {
      model,
      threadId: currentThreadId,
    },
    id: currentThreadId ?? "new",
    initialMessages,
    onFinish: useCallback(async () => {
      console.log("[ChatContainer] Message stream finished");
      if (currentThreadId) {
        try {
          // Find the current thread to preserve its title
          const currentThread = threads.find((t) => t.id === currentThreadId);
          if (currentThread) {
            await updateThread(currentThreadId, {
              title: currentThread.title || undefined,
              updated_at: new Date().toISOString(),
            });
            console.log("[ChatContainer] Thread updated successfully");
          }
        } catch (error) {
          console.error(
            "[ChatContainer] Error updating thread timestamp:",
            error
          );
        }
      }
    }, [currentThreadId, updateThread, threads]),
    onError: (error) => {
      console.error("[ChatContainer] Chat error:", error);
    },
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    console.log("[ChatContainer] Messages updated:", messages);
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleMessageSubmit = async (content: string) => {
    if (!userId) return;

    try {
      console.log("[ChatContainer] Submitting message:", content);
      if (!currentThreadId) {
        const newThread = await createThread(userId);
        console.log("[ChatContainer] Created new thread:", newThread.id);
        setCurrentThreadId(newThread.id);
        await router.push(`/dashboard/chat?thread=${newThread.id}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await append({
        content,
        role: "user",
      });
      console.log("[ChatContainer] Message appended successfully");
    } catch (error) {
      console.error("[ChatContainer] Error submitting message:", error);
    }
  };

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  const memoizedMessages = useMemo(
    () =>
      messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={{
            id: message.id,
            content: message.content,
            role: message.role as "user" | "assistant",
          }}
        />
      )),
    [messages]
  );

  return (
    <>
      <div className="absolute inset-0 bottom-[88px]">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-4 px-4">
            {memoizedMessages}
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
            <div className="h-16" />
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="absolute inset-x-0 bottom-0 pt-4">
        <div className="mx-auto max-w-4xl p-4">
          <ChatInput
            isLoading={isLoading || isLoadingThread}
            onSubmit={handleMessageSubmit}
            onStop={handleStop}
            model={model}
            onModelChange={setModel}
          />
        </div>
      </div>
    </>
  );
}
