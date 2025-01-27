import { modelConfigs, ModelType } from '@/lib/ai-config';
import { IMAGE_ANALYSIS_PROMPT } from '@/lib/prompts';

// Set the runtime to edge
export const runtime = "edge";

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

    console.log('[ChatAPI] Processing request:', { threadId, model: modelType });

    // Route agent requests to agent endpoint
    if (modelType === "agent-1") {
      console.log('[ChatAPI] Routing to agent endpoint');
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

    // Create a TransformStream for the chat response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Create a promise that will resolve when the streaming is complete
    const streamComplete = new Promise(async (resolve, reject) => {
      try {
        console.log('[ChatAPI] Starting chat stream');
        
        // Make request to backend chat endpoint
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: finalMessages,
            model: modelType,
            thread_id: threadId,
            temperature: 0.7,
            max_tokens: 1000,
          }),
        });

        if (!response.ok) {
          throw new Error(`Backend chat error: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response stream available');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }

        console.log('[ChatAPI] Chat stream completed');
        resolve(undefined);
      } catch (error) {
        console.error('[ChatAPI] Error in stream:', error);
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
    console.error("[ChatAPI] Error:", error);
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