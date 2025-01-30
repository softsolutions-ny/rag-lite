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
}

export function useChat({
  model,
  threadId,
  initialMessages = [],
  onFinish,
  onError,
}: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingMessagesRef = useRef<Map<string, Message>>(new Map());

  // Load messages from cache or initialize with provided messages
  useEffect(() => {
    if (threadId) {
      const cachedMessages = MessageCache.getCachedMessages(threadId);
      if (cachedMessages) {
        setMessages(cachedMessages);
      } else {
        setMessages(initialMessages);
        if (initialMessages.length > 0) {
          MessageCache.cacheMessages(threadId, initialMessages);
        }
      }
    } else {
      setMessages([]);
    }
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
    return () => clearInterval(interval);
  }, [syncPendingMessages]);

  const append = useCallback(
    async (message: Pick<Message, 'content' | 'role'>) => {
      if (!threadId) return;

      setIsLoading(true);
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        // Create optimistic user message
        const tempId = Date.now().toString();
        const userMessage: Message = {
          id: tempId,
          thread_id: threadId,
          role: message.role,
          content: message.content,
          model,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Update UI immediately
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
        const assistantMessage: Message = {
          id: `temp-${Date.now()}`,
          thread_id: threadId,
          role: 'assistant',
          content: '',
          model,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setMessages((prev) => {
          const updated = [...prev, assistantMessage];
          MessageCache.cacheMessages(threadId, updated);
          return updated;
        });

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          content += chunk;

          // Update the assistant message as we receive chunks
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === assistantMessage.id
                ? { ...msg, content }
                : msg
            );
            MessageCache.cacheMessages(threadId, updated);
            return updated;
          });
        }

        // Store final assistant message in background
        const finalAssistantMessage = {
          ...assistantMessage,
          content,
        };
        pendingMessagesRef.current.set(assistantMessage.id, finalAssistantMessage);

        onFinish?.();
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Chat error:', error);
          onError?.(error);
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [threadId, model, messages, onFinish, onError]
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