"use client";

import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import Image from "next/image";

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant" | "system" | "data";
  model?: string;
  image_url?: string;
}

interface ChatMessageProps {
  message: ChatMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  // Split content into sections if it contains "Reasoning:" and "Answer:"
  const sections = message.content.split(/(?=Reasoning:|Answer:)/);

  return (
    <div className="mx-auto max-w-3xl w-full px-4">
      {isSystem ? (
        <div className="flex w-full justify-center">
          <div className="prose max-w-[75%] space-y-2">
            {message.image_url && (
              <div className="mt-2 overflow-hidden rounded-lg">
                <img
                  src={message.image_url}
                  alt="Uploaded content"
                  className="max-h-96 w-auto object-contain"
                  loading="lazy"
                  crossOrigin="anonymous"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">{message.content}</p>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex w-full",
            isUser ? "justify-end" : "justify-start"
          )}
        >
          <div
            className={cn(
              "prose max-w-[75%] break-words dark:prose-invert",
              !isUser && "space-y-4 text-sm leading-relaxed"
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              sections.map((section, index) => {
                const isReasoning = section.startsWith("Reasoning:");
                const isAnswer = section.startsWith("Answer:");
                const content = section
                  .replace(/^(Reasoning:|Answer:)/, "")
                  .trim();

                return (
                  <div key={index} className="space-y-2">
                    {(isReasoning || isAnswer) && (
                      <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                        {isReasoning ? "Reasoning" : "Answer"}
                      </div>
                    )}
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => (
                          <p className="whitespace-pre-wrap">{children}</p>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                            {children}
                          </pre>
                        ),
                        code: ({ children }) => (
                          <code className="bg-muted px-1.5 py-0.5 rounded text-sm">
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
