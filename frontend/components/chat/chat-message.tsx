"use client";

import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  model?: string;
}

interface ChatMessageProps {
  message: ChatMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  // Split content into sections if it contains "Reasoning:" and "Answer:"
  const sections = message.content.split(/(?=Reasoning:|Answer:)/);

  return (
    <div className="mx-auto max-w-4xl w-full px-4">
      <div
        className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
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
    </div>
  );
}
