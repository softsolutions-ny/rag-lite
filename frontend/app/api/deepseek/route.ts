import { streamText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';

// Set the runtime to edge
export const runtime = "edge";

interface ChatMessage {
  content: string;
  role: "user" | "assistant" | "system";
}

export async function POST(req: Request) {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DeepSeek API key not configured");
    }

    const { messages, threadId } = await req.json();
    console.log("[DeepSeek] Messages:", messages);

    // Store the user's message in the database
    const lastMessage = messages[messages.length - 1];
    const messageData = {
      thread_id: threadId,
      role: lastMessage.role,
      content: lastMessage.content,
      model: "deepseek-reasoner",
    };

    const storeResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageData),
    });

    if (!storeResponse.ok) {
      const error = await storeResponse.json();
      console.error("Failed to store message:", error);
      throw new Error(`Failed to store message: ${JSON.stringify(error)}`);
    }

    // Create stream using AI SDK
    const result = await streamText({
      model: deepseek("deepseek-reasoner"),
      messages: messages.map((message: ChatMessage) => ({
        content: message.content,
        role: message.role,
      })),
      temperature: 0.7,
      maxTokens: 1000,
      onFinish: async ({ text }) => {
        // Store the complete response in the database
        const assistantMessageData = {
          thread_id: threadId,
          role: "assistant",
          content: text,
          model: "deepseek-reasoner",
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
            console.error("Failed to store DeepSeek assistant message");
          }
        } catch (error) {
          console.error("Error storing DeepSeek assistant message:", error);
        }
      },
    });

    // Convert the stream to a format compatible with useChat
    return result.toDataStreamResponse();
  } catch (error) {
    console.error("[DeepSeek] Error:", error);
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response('Request aborted by user', { status: 499 });
    }
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
} 