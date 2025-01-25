import { streamText } from "ai";
import { modelConfigs, ChatMessage, storeMessage, validateApiKey, ModelType } from '@/lib/ai-config';
import { IMAGE_ANALYSIS_PROMPT } from '@/lib/prompts';

// Set the runtime to edge
export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { messages, model, threadId } = await req.json();
    const modelType = model as ModelType;

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

    const config = modelConfigs[modelType];
    validateApiKey(config.provider);

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

    const result = await streamText({
      model: config.model,
      messages: finalMessages.map((message: ChatMessage) => ({
        content: message.content,
        role: message.role,
      })),
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      onFinish: async ({ text }) => {
        // Store the assistant's response
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