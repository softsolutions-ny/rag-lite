import { streamText } from 'ai';
import { modelConfigs, ChatMessage, storeMessage, validateApiKey } from '@/lib/ai-config';

// Set the runtime to edge
export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { messages, threadId } = await req.json();
    const modelType = 'deepseek-reasoner';
    console.log("[DeepSeek] Messages:", messages);

    const config = modelConfigs[modelType];
    validateApiKey(config.provider);

    // Store the user's message
    const lastMessage = messages[messages.length - 1];
    await storeMessage({
      thread_id: threadId,
      role: lastMessage.role,
      content: lastMessage.content,
      model: modelType,
    });

    // Create stream using AI SDK
    const result = await streamText({
      model: config.model,
      messages: messages.map((message: ChatMessage) => ({
        content: message.content,
        role: message.role,
      })),
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      onFinish: async ({ text }) => {
        await storeMessage({
          thread_id: threadId,
          role: "assistant",
          content: text,
          model: modelType,
        });
      },
    });

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
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
} 