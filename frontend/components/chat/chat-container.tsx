"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import { ScrollArea } from "../ui/scroll-area";
import { ModelType } from "@/lib/ai-config";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useThreadsStore } from "@/lib/store";
import { useChat } from "@/lib/hooks/useChat";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  image_url?: string;
  model?: string;
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
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const { threads, fetchThreads, updateThread, createThread } =
    useThreadsStore();

  // Update currentThreadId when URL changes
  useEffect(() => {
    const param = searchParams.get("thread");
    setCurrentThreadId(param as string | undefined);
    if (!param) {
      // Clear messages when no thread is selected
      setInitialMessages([]);
      setLocalMessages([]);
    }
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
              model: msg.model,
              image_url: msg.image_url,
            }))
          );
          // Set model from first message if it exists
          if (messages.length > 0 && messages[0].model) {
            setModel(messages[0].model as ModelType);
          }
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

  const {
    messages: chatMessages,
    isLoading,
    append,
    stop,
  } = useChat({
    model,
    threadId: currentThreadId || "",
    initialMessages,
    onFinish: useCallback(async () => {
      console.log("[ChatContainer] Message stream finished");
      if (currentThreadId) {
        try {
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

  // Combine local and chat messages
  const allMessages = useMemo(
    () => [...localMessages, ...chatMessages],
    [localMessages, chatMessages]
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    console.log("[ChatContainer] Messages updated:", allMessages);
    scrollToBottom();
  }, [allMessages, scrollToBottom]);

  const handleMessageSubmit = async (
    content: string,
    image_url?: string,
    imageAnalysis?: string
  ) => {
    if (!userId) return;

    try {
      console.log("[ChatContainer] Submitting message:", {
        content,
        image_url,
        imageAnalysis,
        currentThreadId,
        model,
      });

      // Create a new thread first if we don't have one
      let threadId = currentThreadId;
      if (!threadId) {
        const newThread = await createThread(userId);
        console.log("[ChatContainer] Created new thread:", newThread.id);
        threadId = newThread.id;
        setCurrentThreadId(threadId);
        await router.push(`/dashboard/chat?thread=${threadId}`);
        // Wait for state to update
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // If we have an image and analysis, handle it locally and store in DB
      if (image_url && imageAnalysis) {
        // Create user message with image
        const userMessage: Message = {
          id: Date.now().toString(),
          content: content || "Analyzing image...",
          role: "user",
          image_url: image_url.trim(),
          model,
        };

        // Create assistant message with analysis
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: imageAnalysis,
          role: "assistant",
          model,
        };

        // Store messages in DB
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            thread_id: threadId,
            role: userMessage.role,
            content: userMessage.content,
            model: userMessage.model,
            image_url: userMessage.image_url,
          }),
        });

        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            thread_id: threadId,
            role: assistantMessage.role,
            content: assistantMessage.content,
            model: assistantMessage.model,
          }),
        });

        // Update UI
        setLocalMessages((prev) => [...prev, userMessage, assistantMessage]);

        // Update thread timestamp
        try {
          const currentThread = threads.find((t) => t.id === threadId);
          if (currentThread) {
            await updateThread(threadId, {
              title: currentThread.title || undefined,
              updated_at: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error(
            "[ChatContainer] Error updating thread timestamp:",
            error
          );
        }
      } else {
        // For regular messages, use the chat API
        if (content.trim()) {
          await append({
            content,
            role: "user",
          });
        }
      }

      console.log("[ChatContainer] All messages appended successfully");
    } catch (error) {
      console.error("[ChatContainer] Error submitting message:", error);
    }
  };

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  const memoizedMessages = useMemo(
    () =>
      allMessages
        .filter(
          (message) =>
            message.role === "user" ||
            message.role === "assistant" ||
            message.role === "system"
        )
        .map((message) => <ChatMessage key={message.id} message={message} />),
    [allMessages]
  );

  return (
    <>
      <div className="absolute inset-0 bottom-[88px]">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-4 px-4">
            {memoizedMessages}
            {allMessages.length === 0 && !isLoadingThread && (
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
        <div className="mx-auto max-w-3xl p-4">
          <ChatInput
            isLoading={isLoading || isLoadingThread}
            onSubmit={handleMessageSubmit}
            onStop={handleStop}
            model={model}
            onModelChange={setModel}
            disableModelChange={allMessages.length > 0}
          />
        </div>
      </div>
    </>
  );
}
