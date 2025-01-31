import { useCallback, useEffect, useRef, useState } from 'react';
import { Message } from '../types';
import { ModelType } from '../ai-config';
import * as messageActions from '../actions/message';
import { MessageCache } from '../services/cache';

interface UseChatOptions {
  model: ModelType;
  threadId?: string;
  initialMessages?: Message[];
  onFinish?: () => void;
  onError?: (error: Error) => void;
  onStream?: (chunk: string, isLastChunk: boolean) => void;
}

export function useChat({
  model,
  threadId,
  initialMessages = [],
  onFinish,
  onError,
  onStream,
}: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingMessagesRef = useRef<Map<string, Message>>(new Map());

  // Reset state when thread changes
  useEffect(() => {
    setMessages(initialMessages);
    pendingMessagesRef.current.clear();
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, [threadId, initialMessages]);

  // Background sync for pending messages
  const syncPendingMessages = useCallback(async () => {
    if (!threadId) return;
    const pending = Array.from(pendingMessagesRef.current.values());
    if (pending.length === 0) return;

    try {
      await Promise.all(
        pending.map(async (message) => {
          await messageActions.createMessage(
            threadId,
            message.content,
            message.role,
            model
          );
          pendingMessagesRef.current.delete(message.id);
        })
      );
    } catch (error) {
      console.error('Error syncing pending messages:', error);
    }
  }, [threadId, model]);

  // Sync pending messages periodically
  useEffect(() => {
    const interval = setInterval(syncPendingMessages, 5000);
    return () => {
      clearInterval(interval);
      abortControllerRef.current?.abort();
    };
  }, [syncPendingMessages]);

  const append = useCallback(
    async (message: Pick<Message, 'content' | 'role'>) => {
      if (!threadId) return;

      setIsLoading(true);
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        // Create optimistic user message with a temporary ID
        const tempId = MessageCache.generateOptimisticId();
        const userMessage: Message = {
          id: tempId,
          thread_id: threadId,
          role: message.role,
          content: message.content,
          model,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Update UI immediately with optimistic message
        setMessages((prev) => {
          const updated = [...prev, userMessage];
          MessageCache.cacheMessages(threadId, updated);
          return updated;
        });

        // Store message in background
        pendingMessagesRef.current.set(tempId, userMessage);

        // Start streaming assistant response
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/chat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              thread_id: threadId,
              model,
              messages: [...messages, userMessage].map((msg) => ({
                role: msg.role,
                content: msg.content,
              })),
              temperature: 0.7,
              max_tokens: 1000,
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) throw new Error('Failed to stream response');
        if (!response.body) throw new Error('Response body is empty');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let content = '';

        // Create optimistic assistant message
        const assistantTempId = MessageCache.generateOptimisticId();
        const assistantMessage: Message = {
          id: assistantTempId,
          thread_id: threadId,
          role: 'assistant',
          content: '',
          model,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Add optimistic assistant message
        setMessages((prev) => {
          const updated = [...prev, assistantMessage];
          MessageCache.cacheMessages(threadId, updated);
          return updated;
        });

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            // Signal this is the last chunk BEFORE starting background operations
            const timestamp = new Date().toISOString();
            console.log(`[useChat] [${timestamp}] Stream done, sending last chunk signal`);
            onStream?.("", true);

            // Start background operations AFTER signaling completion
            setTimeout(async () => {
              try {
                const bgTimestamp = new Date().toISOString();
                console.log(`[useChat] [${bgTimestamp}] Starting background message creation`);
                
                const [finalUserMessage, finalAssistantMessage] = await Promise.all([
                  messageActions.createMessage(
                    threadId,
                    userMessage.content,
                    'user',
                    model
                  ),
                  messageActions.createMessage(
                    threadId,
                    content,
                    'assistant',
                    model
                  )
                ]);

                const endTimestamp = new Date().toISOString();
                console.log(`[useChat] [${endTimestamp}] Final messages created successfully`);

                // Replace optimistic messages with real ones
                setMessages((prev) => {
                  const updated = prev.map((msg) => {
                    if (msg.id === tempId) return finalUserMessage;
                    if (msg.id === assistantTempId) return finalAssistantMessage;
                    return msg;
                  });
                  MessageCache.cacheMessages(threadId, updated);
                  return updated;
                });

                // Clean up pending messages
                pendingMessagesRef.current.delete(tempId);
                pendingMessagesRef.current.delete(assistantTempId);

                onFinish?.();
              } catch (error) {
                console.error('[useChat] Error in background operations:', error);
                onError?.(error as Error);
              }
            }, 0);

            break;
          }

          const chunk = decoder.decode(value);
          content += chunk;

          // Call onStream callback with the chunk
          onStream?.(chunk, false);

          // Update the assistant message as we receive chunks
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === assistantTempId
                ? { ...msg, content }
                : msg
            );
            MessageCache.cacheMessages(threadId, updated);
            return updated;
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Chat error:', error);
          onError?.(error);
          
          // Clean up optimistic messages on error
          MessageCache.removeOptimisticMessages(threadId);
          setMessages((prev) => prev.filter(msg => !MessageCache.isOptimisticId(msg.id)));
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [threadId, model, messages, onFinish, onError, onStream]
  );

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    append,
    stop,
  };
} 