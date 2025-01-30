import { useCallback, useEffect, useRef, useState } from 'react';
import { Message } from '../types';
import { ModelType } from '../ai-config';
import * as messageActions from '../actions/message';

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

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const append = useCallback(
    async (message: Pick<Message, 'content' | 'role'>) => {
      if (!threadId) return;

      setIsLoading(true);
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        // Add user message
        const userMessage = await messageActions.createMessage(
          threadId,
          message.content,
          message.role,
          model
        );
        setMessages((prev) => [...prev, userMessage]);

        // Start streaming assistant response
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/stream`,
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
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) throw new Error('Failed to stream response');
        if (!response.body) throw new Error('Response body is empty');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let content = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          content += chunk;

          // Update the assistant message as we receive chunks
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                { ...lastMessage, content: content },
              ];
            } else {
              return [
                ...prev,
                {
                  id: Date.now().toString(),
                  thread_id: threadId,
                  role: 'assistant',
                  content: content,
                  model,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ];
            }
          });
        }

        // Save the final assistant message
        await messageActions.createMessage(
          threadId,
          content,
          'assistant',
          model
        );

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