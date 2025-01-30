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
import * as messageActions from "@/lib/actions/message";
import { Message } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { MessageCache } from "@/lib/services/cache";

export function ChatContainer() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef<number>(0);
  const isLoadingRef = useRef(false);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
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
  const { threads, updateThread, createThread } = useThreadsStore();

  // Add a ref to track thread creation state
  const isCreatingThreadRef = useRef(false);

  // Update currentThreadId when URL changes
  useEffect(() => {
    const param = searchParams.get("thread");
    console.log("[ChatContainer] URL thread param changed:", param);

    // Don't update if we're in the middle of creating a thread
    if (isCreatingThreadRef.current) {
      console.log("[ChatContainer] Ignoring URL change during thread creation");
      return;
    }

    // Clear any ongoing operations
    if (isLoadingRef.current) {
      isLoadingRef.current = false;
    }

    // Immediately update the current thread ID
    setCurrentThreadId(param as string | undefined);

    // Clear messages when thread changes
    setInitialMessages([]);
    setLocalMessages([]);

    // Reset loading state
    setIsLoadingThread(false);
  }, [searchParams]);

  // Set model from first message if it exists
  const setModelFromMessages = useCallback((messages: Message[]) => {
    if (messages.length > 0 && messages[0].model) {
      setModel(messages[0].model as ModelType);
    }
  }, []);

  // Fetch messages when thread changes
  useEffect(() => {
    console.log("[ChatContainer] Thread ID changed:", currentThreadId);
    let isMounted = true;
    let abortController = new AbortController();

    const fetchMessages = async () => {
      if (!currentThreadId) {
        setInitialMessages([]);
        setLocalMessages([]);
        return;
      }

      if (isLoadingRef.current) {
        // Cancel previous fetch
        abortController.abort();
        abortController = new AbortController();
      }

      isLoadingRef.current = true;
      setIsLoadingThread(true);

      try {
        // Check cache first
        const cachedMessages = MessageCache.getCachedMessages(currentThreadId);
        if (cachedMessages) {
          console.log("[ChatContainer] Using cached messages");
          if (isMounted) {
            setInitialMessages(cachedMessages);
            setLocalMessages([]);
            setModelFromMessages(cachedMessages);
          }
        } else {
          // Fetch with abort signal
          const messages = await messageActions.fetchMessages(currentThreadId);
          if (!isMounted) return;

          console.log("[ChatContainer] Fetched messages:", messages.length);
          setInitialMessages(messages);
          setLocalMessages([]);
          setModelFromMessages(messages);

          // Cache the fetched messages
          if (messages.length > 0) {
            MessageCache.cacheMessages(currentThreadId, messages);
          }
        }
      } catch (error) {
        // Handle abort error
        if (error instanceof Error && error.name === "AbortError") {
          console.log("[ChatContainer] Fetch aborted");
          return;
        }
        console.error("Error fetching messages:", error);
      } finally {
        if (isMounted) {
          isLoadingRef.current = false;
          setIsLoadingThread(false);
        }
      }
    };

    // Start fetching immediately
    fetchMessages();

    return () => {
      isMounted = false;
      abortController.abort();
      isLoadingRef.current = false;
    };
  }, [currentThreadId, setModelFromMessages]);

  // Create a new thread when requested
  const handleCreateThread = useCallback(async () => {
    if (!userId || isLoadingRef.current || isCreatingThreadRef.current) {
      console.log("[ChatContainer] Preventing duplicate thread creation");
      return;
    }

    try {
      isCreatingThreadRef.current = true;
      isLoadingRef.current = true;

      // Create thread with optimistic update and get the new thread
      const newThread = await createThread();
      console.log("[ChatContainer] Created new thread:", newThread.id);

      // Clear messages and cache
      setInitialMessages([]);
      setLocalMessages([]);
      MessageCache.clearCache(newThread.id);

      // Update URL and current thread ID
      setCurrentThreadId(newThread.id);
      await router.replace(`/dashboard/chat?thread=${newThread.id}`, {
        scroll: false,
      });

      // Focus the input after a short delay to ensure the UI has updated
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 100);
    } catch (error) {
      console.error("[ChatContainer] Error creating thread:", error);
      // On error, clear current thread
      setCurrentThreadId(undefined);
    } finally {
      isLoadingRef.current = false;
      // Add a small delay before allowing new thread creation
      setTimeout(() => {
        isCreatingThreadRef.current = false;
      }, 500);
    }
  }, [userId, createThread, router]);

  const {
    messages: chatMessages,
    isLoading,
    append,
    stop,
  } = useChat({
    model,
    threadId: currentThreadId,
    initialMessages,
    onFinish: useCallback(async () => {
      console.log("[ChatContainer] Message stream finished");
      if (currentThreadId) {
        try {
          const currentThread = threads.find((t) => t.id === currentThreadId);
          if (currentThread) {
            // Use optimistic update
            await updateThread(
              currentThreadId,
              {
                title: currentThread.title || undefined,
                updated_at: new Date().toISOString(),
              },
              true // Enable optimistic updates
            );
            console.log("[ChatContainer] Thread updated successfully");
          }
        } catch (error) {
          console.error(
            "[ChatContainer] Error updating thread timestamp:",
            error
          );
        }
      }
      // Focus the input after response finishes
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 100);
    }, [currentThreadId, updateThread, threads]),
    onError: (error) => {
      console.error("[ChatContainer] Chat error:", error);
    },
  });

  // Combine local and chat messages with proper cleanup
  const allMessages = useMemo(() => {
    // Filter out any messages that don't belong to the current thread
    const filteredLocal = localMessages.filter(
      (m) => !currentThreadId || m.thread_id === currentThreadId
    );
    const filteredChat = chatMessages.filter(
      (m) => !currentThreadId || m.thread_id === currentThreadId
    );
    return [...filteredLocal, ...filteredChat];
  }, [localMessages, chatMessages, currentThreadId]);

  // Memoize message rendering
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

  // Optimize scroll behavior
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  useEffect(() => {
    if (allMessages.length > 0) {
      const isNewMessage = allMessages.length > prevMessagesLength.current;
      scrollToBottom(!isNewMessage);
      prevMessagesLength.current = allMessages.length;
    }
  }, [allMessages, scrollToBottom]);

  const handleMessageSubmit = async (
    content: string,
    image_url?: string,
    imageAnalysis?: string
  ) => {
    if (!userId || !currentThreadId) return;

    try {
      console.log("[ChatContainer] Submitting message:", {
        content,
        image_url,
        imageAnalysis,
        currentThreadId,
        model,
      });

      if (content.trim() && !image_url) {
        await append({
          content: content.trim(),
          role: "user",
        });
      } else if (image_url && imageAnalysis) {
        // Handle image messages
        const userMessage = await messageActions.createMessage(
          currentThreadId,
          content || "Analyzing image...",
          "user",
          model,
          image_url
        );

        const assistantMessage = await messageActions.createMessage(
          currentThreadId,
          imageAnalysis,
          "assistant",
          model
        );

        // Update UI
        setLocalMessages((prev) => [...prev, userMessage, assistantMessage]);

        // Update thread timestamp optimistically
        try {
          const currentThread = threads.find((t) => t.id === currentThreadId);
          if (currentThread) {
            await updateThread(
              currentThreadId,
              {
                title: currentThread.title || undefined,
                updated_at: new Date().toISOString(),
              },
              true // Enable optimistic updates
            );
          }
        } catch (error) {
          console.error(
            "[ChatContainer] Error updating thread timestamp:",
            error
          );
        }
      }

      console.log("[ChatContainer] Message submitted successfully");
    } catch (error) {
      console.error("[ChatContainer] Error submitting message:", error);
    }
  };

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  return (
    <>
      <div className="absolute inset-0 bottom-[88px]">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-4 px-4">
            {currentThreadId ? (
              <>
                {memoizedMessages.length > 0 ? (
                  memoizedMessages
                ) : (
                  <div className="flex h-[50vh] items-center justify-center text-center">
                    <div className="max-w-md space-y-4">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Start typing below to begin your conversation with
                          elucide.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          You can ask questions, share images, or request
                          assistance with any task.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="h-16" />
                <div ref={messagesEndRef} />
              </>
            ) : (
              <div className="flex h-[50vh] items-center justify-center text-center">
                <div className="max-w-md space-y-6">
                  <div className="space-y-2">
                    <h1 className="text-2xl font-bold">elucide</h1>
                    <p className="text-sm text-muted-foreground">
                      graphical user interface for robot intelligence
                    </p>
                  </div>
                  <Button
                    onClick={handleCreateThread}
                    disabled={isLoadingRef.current}
                    className="gap-2"
                  >
                    <PlusIcon className="h-4 w-4" />
                    New Thread
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {currentThreadId && (
        <div className="absolute inset-x-0 bottom-0 pt-4">
          <div className="mx-auto max-w-3xl p-4">
            <ChatInput
              inputRef={chatInputRef}
              isLoading={isLoading || isLoadingThread}
              onSubmit={handleMessageSubmit}
              onStop={handleStop}
              model={model}
              onModelChange={setModel}
              disableModelChange={allMessages.length > 0}
            />
          </div>
        </div>
      )}
    </>
  );
}
