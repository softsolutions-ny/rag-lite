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

async function getDeepSeekResponse(messages: ChatMessage[]) {
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
          }
          // Handle regular content
          else if (delta.content) {
            if (!hasStartedAnswer && hasStartedReasoning) {
              controller.enqueue(encoder.encode("\n\nAnswer:\n"));
              hasStartedAnswer = true;
            }
            controller.enqueue(encoder.encode(delta.content));
          }
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

    const { messages, model } = await req.json();

    if (model === "deepseek-reasoner") {
      const stream = await getDeepSeekResponse(messages);
      return new StreamingTextResponse(stream);
    } else {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        stream: true,
        messages: messages.map((message: ChatMessage) => ({
          content: message.content,
          role: message.role,
        })),
        temperature: 0.7,
        max_tokens: 500,
      });

      const stream = OpenAIStream(response);
      return new StreamingTextResponse(stream);
    }
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