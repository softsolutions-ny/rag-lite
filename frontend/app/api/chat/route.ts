import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

// Set the runtime to edge
export const runtime = "edge";

interface ChatMessage {
  content: string;
  role: "user" | "assistant" | "system";
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    const { messages, model, threadId } = await req.json();

    // Route agent requests to agent endpoint
    if (model === "agent-gpt4o") {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages, model }),
      });
      return response;
    }

    // Add system prompt for image analysis messages
    const processedMessages = messages.map((message: ChatMessage) => {
      if (message.role === "system" && message.content.includes("The image depicts")) {
        return {
          role: "system",
          content: `${message.content}\n\nAssistant: What else would you like to know about this image?`,
        };
      }
      return message;
    });

    // Store the user's message in the database
    const lastMessage = messages[messages.length - 1];
    const messageData = {
      thread_id: threadId,
      role: lastMessage.role,
      content: lastMessage.content,
      model,
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageData),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to store message. Status:", response.status);
      console.error("Error details:", error);
      console.error("Request data:", messageData);
      throw new Error(`Failed to store message: ${JSON.stringify(error)}`);
    }

    const result = await streamText({
      model: openai((() => {
        switch (model) {
          case "gpt-4o":
            return "gpt-4o";
          case "gpt-4o-mini":
            return "gpt-4o-mini";
          default:
            return "gpt-4o-mini";
        }
      })()),
      messages: processedMessages.map((message: ChatMessage) => ({
        content: message.content,
        role: message.role,
      })),
      temperature: 0.7,
      maxTokens: model === "gpt-4o" ? 1000 : 500,
      onFinish: async ({ text }) => {
        // Store the complete response in the database
        const assistantMessageData = {
          thread_id: threadId,
          role: "assistant",
          content: text,
          model,
        };

        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(assistantMessageData),
          });

          if (!response.ok) {
            console.error("Failed to store assistant message");
          }
        } catch (error) {
          console.error("Error storing assistant message:", error);
        }
      },
    });

    // Convert the stream to a format compatible with useChat
    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response('Request aborted by user', { status: 499 });
    }
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
} 