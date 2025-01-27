import { modelConfigs, ModelType } from '@/lib/ai-config';
import { LangChainService } from '@/lib/services/langchain';

export const runtime = 'edge';

const langchain = new LangChainService();

export async function POST(req: Request) {
  try {
    const { messages, model } = await req.json();
    const config = modelConfigs[model as ModelType];

    if (!config || config.provider !== 'groq') {
      return new Response(
        JSON.stringify({ error: 'Invalid model for Groq endpoint' }),
        { status: 400 }
      );
    }

    // Create a TransformStream
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start streaming in the background
    (async () => {
      try {
        const chatStream = langchain.streamChat({
          messages,
          model: model as ModelType,
        });

        for await (const chunk of chatStream) {
          await writer.write(encoder.encode(`data: ${chunk}\n\n`));
        }
        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (error) {
        console.error('Error in stream:', error);
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Groq API error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      { status: 500 }
    );
  }
} 
