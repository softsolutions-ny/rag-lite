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
import { PlusIcon, Loader2 } from "lucide-react";
import { MessageCache } from "@/lib/services/cache";
import { Skeleton } from "@/components/ui/skeleton";
import { useThreadLoading } from "@/lib/store/thread-loading-context";

export function ChatContainer() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef<number>(0);
  const isLoadingRef = useRef(false);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const lastThreadIdRef = useRef<string | undefined>();
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
  const [isWaitingForFirstToken, setIsWaitingForFirstToken] = useState(false);

  // Set model from first message if it exists
  const setModelFromMessages = useCallback((messages: Message[]) => {
    if (messages.length > 0 && messages[0].model) {
      setModel(messages[0].model as ModelType);
    }
  }, []);

  // Update currentThreadId when URL changes
  useEffect(() => {
    const param = searchParams.get("thread");

    // Prevent redundant updates
    if (param === lastThreadIdRef.current) {
      return;
    }

    console.log("[ChatContainer] [URL Change] Thread param changed:", {
      from: lastThreadIdRef.current,
      to: param,
      isLoadingThread,
    });

    // Clear loading state and messages immediately
    if (isLoadingThread) {
      setThreadLoading(false);
    }
    setInitialMessages([]);
    setLocalMessages([]);

    // Update refs and state
    lastThreadIdRef.current = param as string | undefined;
    setCurrentThreadId(param as string | undefined);

    // If no thread selected, we're done
    if (!param) {
      return;
    }

    // Check cache first before setting loading state
    const cachedMessages = MessageCache.getCachedMessages(param);
    if (cachedMessages) {
      console.log(
        "[ChatContainer] [URL Change] Using cached messages for thread:",
        param
      );
      // Remove any optimistic messages from cache before using it
      const cleanedMessages = cachedMessages.filter(
        (msg) => !MessageCache.isOptimisticId(msg.id)
      );
      setInitialMessages(cleanedMessages);
      setModelFromMessages(cleanedMessages);
      return;
    }

    // Set loading state for fetch
    console.log(
      "[ChatContainer] [URL Change] Setting loading state for thread:",
      param
    );
    setThreadLoading(true);
  }, [searchParams, setModelFromMessages, setThreadLoading, isLoadingThread]);

  // Create a new thread when requested
  const handleCreateThread = useCallback(async () => {
    if (!userId || isLoadingRef.current) return;

    try {
      console.log("[ChatContainer] [Create Thread] Starting thread creation");
      isLoadingRef.current = true;
      setThreadLoading(true);

      // Create thread with optimistic update and get the new thread
      const newThread = await createThread();
      console.log("[ChatContainer] [Create Thread] Thread created:", {
        id: newThread.id,
        previousThreadId: lastThreadIdRef.current,
      });

      // Clear messages and cache
      console.log("[ChatContainer] [Create Thread] Clearing messages");
      setInitialMessages([]);
      setLocalMessages([]);

      // Update URL and current thread ID
      console.log("[ChatContainer] [Create Thread] Updating current thread ID");
      lastThreadIdRef.current = newThread.id; // Update ref before state change
      setCurrentThreadId(newThread.id);

      // Use replace to avoid adding to history stack
      console.log("[ChatContainer] [Create Thread] Updating URL");
      window.history.replaceState(
        {},
        "",
        `/dashboard/chat?thread=${newThread.id}`
      );
      router.replace(`/dashboard/chat?thread=${newThread.id}`, {
        scroll: false,
      });

      // Focus the input immediately
      console.log("[ChatContainer] [Create Thread] Focusing input");
      chatInputRef.current?.focus();
    } catch (error) {
      console.error("[ChatContainer] [Create Thread] Error:", error);
      // On error, clear current thread
      lastThreadIdRef.current = undefined;
      setCurrentThreadId(undefined);
      setThreadLoading(false);
    } finally {
      console.log("[ChatContainer] [Create Thread] Cleanup");
      isLoadingRef.current = false;
    }
  }, [userId, createThread, router, setThreadLoading]);

  // Separate effect for fetching messages
  useEffect(() => {
    let isMounted = true;
    let controller: AbortController | null = null;

    const fetchMessages = async () => {
      if (!currentThreadId || !isLoadingThread) return;

      // Create new abort controller for this fetch
      controller = new AbortController();

      console.log("[ChatContainer] [Fetch] Starting message fetch:", {
        threadId: currentThreadId,
        isLoadingThread,
      });

      try {
        const messages = await messageActions.fetchMessages(currentThreadId);

        // Check if we're still mounted and this is still the current fetch
        if (!isMounted || controller.signal.aborted) {
          console.log(
            "[ChatContainer] [Fetch] Fetch aborted or component unmounted"
          );
          return;
        }

        console.log("[ChatContainer] [Fetch] Messages received:", {
          threadId: currentThreadId,
          count: messages.length,
        });

        // Remove any optimistic messages before setting state
        const cleanedMessages = messages.filter(
          (msg) => !MessageCache.isOptimisticId(msg.id)
        );

        // Check for any pending messages that need to be preserved
        const pendingMessages =
          MessageCache.getPendingMessages(currentThreadId);
        const allMessages = [...cleanedMessages, ...pendingMessages];

        if (isMounted && !controller.signal.aborted) {
          console.log("[ChatContainer] [Fetch] Updating messages:", {
            threadId: currentThreadId,
            messageCount: allMessages.length,
          });
          setInitialMessages(allMessages);
          setModelFromMessages(allMessages);

          // Cache the fetched messages
          if (cleanedMessages.length > 0) {
            MessageCache.cacheMessages(currentThreadId, cleanedMessages);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[ChatContainer] [Fetch] Error:", error);
        }
      } finally {
        if (isMounted && !controller.signal.aborted) {
          console.log("[ChatContainer] [Fetch] Finishing fetch:", {
            threadId: currentThreadId,
            isLoadingThread,
          });
          setThreadLoading(false);
        }
      }
    };

    fetchMessages();

    return () => {
      console.log("[ChatContainer] [Fetch] Cleanup effect:", {
        threadId: currentThreadId,
        isLoadingThread,
      });

      // Abort any in-flight fetch
      if (controller) {
        controller.abort();
      }

      isMounted = false;
    };
  }, [
    currentThreadId,
    isLoadingThread,
    setModelFromMessages,
    setThreadLoading,
  ]);

  const {
    messages: chatMessages,
    isLoading,
    append,
    stop,
  } = useChat({
    model,
    threadId: currentThreadId,
    initialMessages,
    onStream: useCallback((chunk: string, isLastChunk: boolean) => {
      // If we get any chunk, we've received the first token
      setIsWaitingForFirstToken(false);

      // Focus input immediately when we get the last chunk
      if (isLastChunk) {
        const timestamp = new Date().toISOString();
        console.log(
          `[ChatContainer] [${timestamp}] Last chunk received, focusing input...`
        );
        chatInputRef.current?.focus();
      }
    }, []),
    onFinish: useCallback(async () => {
      const timestamp = new Date().toISOString();
      console.log(`[ChatContainer] [${timestamp}] Message stream finished`);

      // Handle thread update in the background
      if (currentThreadId) {
        try {
          const currentThread = threads.find((t) => t.id === currentThreadId);
          if (currentThread && !currentThread.title?.startsWith("Untitled")) {
            console.log(
              `[ChatContainer] [${timestamp}] Updating thread timestamp...`
            );
            await updateThread(
              currentThreadId,
              {
                title: currentThread.title || undefined,
                updated_at: new Date().toISOString(),
              },
              true
            );
            const endTimestamp = new Date().toISOString();
            console.log(
              `[ChatContainer] [${endTimestamp}] Thread updated successfully`
            );
          }
        } catch (error) {
          console.error(
            `[ChatContainer] [${timestamp}] Error updating thread timestamp:`,
            error
          );
        }
      }
    }, [currentThreadId, updateThread, threads]),
    onError: (error) => {
      setIsWaitingForFirstToken(false);
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
          setIsWaitingForFirstToken(true);
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
              setIsWaitingForFirstToken(false);
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
        setIsWaitingForFirstToken(false);
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
          <div className="flex flex-col gap-4 px-4" key={currentThreadId}>
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
                ) : (
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
                    {isWaitingForFirstToken && (
                      <div className="mx-auto max-w-3xl w-full px-4">
                        <div className="flex w-full justify-start">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span className="text-xs">contemplating...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
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
