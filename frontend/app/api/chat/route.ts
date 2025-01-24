import { OpenAIStream, StreamingTextResponse } from "ai";
import OpenAI from "openai";

// Create clients for each API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseURL: "https://api.deepseek.com/v1",
});

// Set the runtime to edge
export const runtime = "edge";

interface ChatMessage {
  content: string;
  role: "user" | "assistant" | "system";
}

interface DeepSeekDelta {
  content?: string;
  reasoning_content?: string;
}

interface DeepSeekChunk {
  choices: [{
    delta: DeepSeekDelta;
  }];
}

async function getDeepSeekResponse(messages: ChatMessage[], threadId: string, model: string) {
  const response = await deepseek.chat.completions.create({
    model: "deepseek-reasoner",
    messages,
    temperature: 0.7,
    max_tokens: 1000,
    stream: true,
  }) as AsyncIterable<DeepSeekChunk>;

  // Create a readable stream from the response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let hasStartedReasoning = false;
      let hasStartedAnswer = false;
      let fullContent = "";

      try {
        for await (const chunk of response) {
          const delta = chunk.choices[0].delta;

          // Handle reasoning content
          if (delta.reasoning_content) {
            if (!hasStartedReasoning) {
              controller.enqueue(encoder.encode("Reasoning:\n"));
              hasStartedReasoning = true;
            }
            controller.enqueue(encoder.encode(delta.reasoning_content));
            fullContent += delta.reasoning_content;
          }
          // Handle regular content
          else if (delta.content) {
            if (!hasStartedAnswer && hasStartedReasoning) {
              controller.enqueue(encoder.encode("\n\nAnswer:\n"));
              hasStartedAnswer = true;
              fullContent += "\n\nAnswer:\n";
            }
            controller.enqueue(encoder.encode(delta.content));
            fullContent += delta.content;
          }
        }

        // Store the complete response in the database
        const assistantMessageData = {
          thread_id: threadId,
          role: "assistant",
          content: fullContent,
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
            console.error("Failed to store DeepSeek assistant message");
          }
        } catch (error) {
          console.error("Error storing DeepSeek assistant message:", error);
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return stream;
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY || !process.env.DEEPSEEK_API_KEY) {
      throw new Error("API keys not configured");
    }

    const { messages, model, threadId } = await req.json();

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

    // Get the AI response
    let stream;
    if (model === "deepseek-reasoner") {
      stream = await getDeepSeekResponse(messages, threadId, model);
    } else {
      const response = await openai.chat.completions.create({
        model: model === "gpt-4o" ? "gpt-4" : "gpt-4o-mini",
        stream: true,
        messages: messages.map((message: ChatMessage) => ({
          content: message.content,
          role: message.role,
        })),
        temperature: 0.7,
        max_tokens: model === "gpt-4o" ? 1000 : 500,
      });
      stream = OpenAIStream(response, {
        onCompletion: async (completion: string) => {
          // Store the assistant's message
          const assistantMessageData = {
            thread_id: threadId,
            role: "assistant",
            content: completion,
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
    }

    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error("Chat API error:", error);
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