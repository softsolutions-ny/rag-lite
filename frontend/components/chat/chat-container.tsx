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
import { Skeleton } from "@/components/ui/skeleton";
import { useThreadLoading } from "@/lib/store/thread-loading-context";

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
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const { threads, updateThread, createThread } = useThreadsStore();
  const { isLoadingThread, setThreadLoading } = useThreadLoading();

  // Set model from first message if it exists
  const setModelFromMessages = useCallback((messages: Message[]) => {
    if (messages.length > 0 && messages[0].model) {
      setModel(messages[0].model as ModelType);
    }
  }, []);

  // Update currentThreadId when URL changes
  useEffect(() => {
    const param = searchParams.get("thread");
    console.log("[ChatContainer] URL thread param changed:", param);

    // Immediately update the current thread ID
    setCurrentThreadId(param as string | undefined);

    // Clear messages if no thread selected
    if (!param) {
      setInitialMessages([]);
      setLocalMessages([]);
      return;
    }

    // Check cache first before setting loading state
    const cachedMessages = MessageCache.getCachedMessages(param);
    if (cachedMessages) {
      console.log("[ChatContainer] Using cached messages");
      // Remove any optimistic messages from cache before using it
      const cleanedMessages = cachedMessages.filter(
        (msg) => !MessageCache.isOptimisticId(msg.id)
      );
      setInitialMessages(cleanedMessages);
      setLocalMessages([]);
      setModelFromMessages(cleanedMessages);
      return;
    }

    // Only set loading state if we need to fetch
    setThreadLoading(true);
  }, [searchParams, setModelFromMessages, setThreadLoading]);

  // Separate effect for fetching messages to avoid blocking UI
  useEffect(() => {
    let isMounted = true;

    const fetchMessages = async () => {
      if (!currentThreadId || !isLoadingThread) return;

      try {
        const messages = await messageActions.fetchMessages(currentThreadId);
        if (!isMounted) return;

        console.log("[ChatContainer] Fetched messages:", messages.length);

        // Remove any optimistic messages before setting state
        const cleanedMessages = messages.filter(
          (msg) => !MessageCache.isOptimisticId(msg.id)
        );

        // Check for any pending messages that need to be preserved
        const pendingMessages =
          MessageCache.getPendingMessages(currentThreadId);
        const allMessages = [...cleanedMessages, ...pendingMessages];

        setInitialMessages(allMessages);
        setLocalMessages([]);
        setModelFromMessages(allMessages);

        // Cache the fetched messages (pending messages will be added automatically)
        if (cleanedMessages.length > 0) {
          MessageCache.cacheMessages(currentThreadId, cleanedMessages);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        if (isMounted) {
          setThreadLoading(false);
        }
      }
    };

    fetchMessages();

    return () => {
      isMounted = false;
    };
  }, [
    currentThreadId,
    isLoadingThread,
    setModelFromMessages,
    setThreadLoading,
  ]);

  // Create a new thread when requested
  const handleCreateThread = useCallback(async () => {
    if (!userId || isLoadingRef.current) return;

    try {
      isLoadingRef.current = true;
      setThreadLoading(true);

      // Create thread with optimistic update and get the new thread
      const newThread = await createThread();
      console.log("[ChatContainer] Created new thread:", newThread.id);

      // Clear messages and cache
      setInitialMessages([]);
      setLocalMessages([]);

      // Update URL and current thread ID
      setCurrentThreadId(newThread.id);

      // Use replace to avoid adding to history stack
      window.history.replaceState(
        {},
        "",
        `/dashboard/chat?thread=${newThread.id}`
      );
      router.replace(`/dashboard/chat?thread=${newThread.id}`, {
        scroll: false,
      });

      // Focus the input immediately
      chatInputRef.current?.focus();
    } catch (error) {
      console.error("[ChatContainer] Error creating thread:", error);
      // On error, clear current thread
      setCurrentThreadId(undefined);
      setThreadLoading(false);
    } finally {
      isLoadingRef.current = false;
      // Note: We don't clear isLoadingThread here because it will be cleared by the URL change effect
    }
  }, [userId, createThread, router, setThreadLoading]);

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

      // Focus the input with a small delay to ensure DOM is ready
      console.log("[ChatContainer] Scheduling input focus...");
      setTimeout(() => {
        console.log("[ChatContainer] Attempting to focus input...");
        if (chatInputRef.current) {
          chatInputRef.current.focus();
          console.log("[ChatContainer] Input focused successfully");
        } else {
          console.log("[ChatContainer] Chat input ref is null");
        }
      }, 0);

      // Then handle thread update asynchronously
      if (currentThreadId) {
        try {
          const currentThread = threads.find((t) => t.id === currentThreadId);
          if (currentThread && !currentThread.title?.startsWith("Untitled")) {
            await updateThread(
              currentThreadId,
              {
                title: currentThread.title || undefined,
                updated_at: new Date().toISOString(),
              },
              true
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

  const handleMessageSubmit = useCallback(
    async (content: string, image_url?: string, imageAnalysis?: string) => {
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
          // Create optimistic message
          const optimisticMessage = {
            id: MessageCache.generateOptimisticId(),
            content: content.trim(),
            role: "user" as const,
            thread_id: currentThreadId,
            model,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          // Add to pending messages
          MessageCache.addPendingMessage(currentThreadId, optimisticMessage);

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
                true
              );
            }
          } catch (error) {
            console.error(
              "[ChatContainer] Error updating thread timestamp:",
              error
            );
          }

          console.log("[ChatContainer] Message submitted successfully");

          // Start the append operation without waiting
          append({
            content: content.trim(),
            role: "user",
          })
            .then(() => {
              // Remove from pending once complete
              MessageCache.removePendingMessage(
                currentThreadId,
                optimisticMessage.id
              );
            })
            .catch((error) => {
              console.error(
                "[ChatContainer] Error in append operation:",
                error
              );
              // Remove pending message on error
              MessageCache.removePendingMessage(
                currentThreadId,
                optimisticMessage.id
              );
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

          // Update UI and cache
          setLocalMessages((prev) => [...prev, userMessage, assistantMessage]);
          MessageCache.cacheMessages(currentThreadId, [
            userMessage,
            assistantMessage,
          ]);

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
                true
              );
            }
          } catch (error) {
            console.error(
              "[ChatContainer] Error updating thread timestamp:",
              error
            );
          }

          console.log("[ChatContainer] Message submitted successfully");
        }
      } catch (error) {
        console.error("[ChatContainer] Error submitting message:", error);
        // Remove pending message on error
        if (content.trim() && !image_url) {
          const pendingMessages =
            MessageCache.getPendingMessages(currentThreadId);
          const failedMessage = pendingMessages.find(
            (m) => m.content === content.trim()
          );
          if (failedMessage) {
            MessageCache.removePendingMessage(
              currentThreadId,
              failedMessage.id
            );
          }
        }
      }
    },
    [userId, currentThreadId, model, append, threads, updateThread]
  );

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
                {isLoadingThread ? (
                  <div className="space-y-4">
                    <div className="mx-auto max-w-3xl w-full px-4">
                      <div className="flex w-full justify-end">
                        <div className="max-w-[75%]">
                          <Skeleton className="h-12 w-64" />
                        </div>
                      </div>
                    </div>
                    <div className="mx-auto max-w-3xl w-full px-4">
                      <div className="flex w-full justify-start">
                        <div className="max-w-[75%] space-y-3">
                          <Skeleton className="h-4 w-72" />
                          <Skeleton className="h-4 w-80" />
                          <Skeleton className="h-4 w-64" />
                        </div>
                      </div>
                    </div>
                    <div className="mx-auto max-w-3xl w-full px-4">
                      <div className="flex w-full justify-end">
                        <div className="max-w-[75%]">
                          <Skeleton className="h-10 w-52" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : memoizedMessages.length > 0 ? (
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
