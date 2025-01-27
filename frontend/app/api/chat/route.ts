import { modelConfigs, ModelType, storeMessage } from '@/lib/ai-config';
import { LangChainService } from '@/lib/services/langchain';
import { IMAGE_ANALYSIS_PROMPT } from '@/lib/prompts';

// Set the runtime to edge
export const runtime = "edge";

const langchain = new LangChainService();

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Extend Response type for Edge runtime
interface EdgeResponse extends Response {
  waitUntil?: (promise: Promise<unknown>) => void;
}

export async function POST(req: Request) {
  try {
    const { messages, model, threadId } = await req.json();
    const modelType = model as ModelType;
    const config = modelConfigs[modelType];

    // Route agent requests to agent endpoint
    if (modelType === "agent-1") {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages, model }),
      });
      return response;
    }

    // Add system prompt if not present
    const hasSystemPrompt = messages.some((msg: ChatMessage) => msg.role === 'system');
    const processedMessages = hasSystemPrompt ? messages : [
      { role: 'system', content: config.systemPrompt },
      ...messages
    ];

    // Process image analysis messages
    const finalMessages = processedMessages.map((message: ChatMessage) => {
      if (message.role === "system" && message.content.includes("The image depicts")) {
        const imageDescription = message.content.split("The image depicts ")[1];
        return {
          role: "system",
          content: IMAGE_ANALYSIS_PROMPT(imageDescription),
        };
      }
      return message;
    });

    // Store the user's message
    const lastMessage = messages[messages.length - 1];
    await storeMessage({
      thread_id: threadId,
      role: lastMessage.role,
      content: lastMessage.content,
      model: modelType,
    });

    // Create a TransformStream for the chat response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Create a promise that will resolve when the streaming is complete
    const streamComplete = new Promise(async (resolve, reject) => {
      let lastChunk = '';
      try {
        const chatStream = langchain.streamChat({
          messages: finalMessages,
          model: modelType,
        });

        for await (const chunk of chatStream) {
          lastChunk = chunk;
          await writer.write(encoder.encode(`data: ${chunk}\n\n`));
        }
        await writer.write(encoder.encode('data: [DONE]\n\n'));

        // Store the assistant's response
        await storeMessage({
          thread_id: threadId,
          role: "assistant",
          content: lastChunk,
          model: modelType,
        });

        resolve(undefined);
      } catch (error) {
        console.error('Error in stream:', error);
        reject(error);
      } finally {
        await writer.close();
      }
    });

    // Return the stream immediately while the background task continues
    const response = new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }) as EdgeResponse;

    // Attach the background task to the response
    response.waitUntil?.(streamComplete);

    return response;
  } catch (error) {
    console.error("Chat API error:", error);
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response('Request aborted by user', { status: 499 });
    }
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
} 