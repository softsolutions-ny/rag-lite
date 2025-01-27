import { useState, useCallback, useRef, useEffect } from 'react';
import { ModelType } from '../ai-config';
import { useAuthFetch } from '../store/api';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface UseChatOptions {
  initialMessages?: Message[];
  model: ModelType;
  threadId: string;
  onFinish?: (message: Message) => void;
  onError?: (error: Error) => void;
}

export function useChat({
  initialMessages = [],
  model,
  threadId,
  onFinish,
  onError,
}: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const authFetch = useAuthFetch();

  // Update messages when initialMessages changes
  useEffect(() => {
    console.log("[useChat] Updating messages with:", initialMessages);
    setMessages(initialMessages);
  }, [initialMessages]);

  const append = useCallback(
    async (message: { content: string; role?: 'user' | 'assistant' | 'system' }) => {
      try {
        setIsLoading(true);
        const userMessage: Message = {
          id: Date.now().toString(),
          role: message.role || 'user',
          content: message.content,
        };

        setMessages((prev) => [...prev, userMessage]);

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        // Create assistant message placeholder
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Start streaming from the backend API
        const response = await authFetch('/api/v1/chat/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...initialMessages, userMessage],
            model,
            thread_id: threadId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response stream available');
        }

        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done || abortControllerRef.current?.signal.aborted) break;

          // Convert the chunk to text
          const chunk = new TextDecoder().decode(value);
          accumulatedContent += chunk;

          setMessages((prev) => {
            const updated = [...prev];
            const lastMessage = updated[updated.length - 1];
            if (lastMessage.role === 'assistant') {
              lastMessage.content = accumulatedContent;
            }
            return updated;
          });
        }

        if (!abortControllerRef.current?.signal.aborted && onFinish) {
          onFinish({
            ...assistantMessage,
            content: accumulatedContent,
          });
        }
      } catch (error) {
        console.error('Error in chat:', error);
        if (onError && error instanceof Error) {
          onError(error);
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [initialMessages, model, threadId, onFinish, onError, authFetch]
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  return {
    messages,
    append,
    stop,
    isLoading,
  };
} 