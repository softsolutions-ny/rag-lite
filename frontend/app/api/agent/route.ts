import { NextResponse } from 'next/server';
import { modelConfigs, AgentAction, agentActionSchema } from '@/lib/ai-config';
import { AGENT_ACTION_PROMPT } from '@/lib/prompts';
import { LangChainService } from '@/lib/services/langchain';

const langchain = new LangChainService();

export async function determineAction(message: string): Promise<AgentAction> {
  const modelType = 'agent-1';
  const config = modelConfigs[modelType];

  const messages = [
    {
      role: 'system',
      content: config.systemPrompt
    },
    {
      role: 'user',
      content: `${AGENT_ACTION_PROMPT}\n\nUser message: "${message}"`
    }
  ];

  const response = await langchain.sendMessage({
    messages,
    model: modelType,
  });

  try {
    const parsed = JSON.parse(response);
    return agentActionSchema.parse(parsed);
  } catch (error) {
    console.error('Failed to parse agent response:', error);
    return {
      type: 'CHAT',
      instruction: '',
      reasoning: 'Failed to parse response, falling back to chat'
    };
  }
}

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    
    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages provided' },
        { status: 400 }
      );
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      return NextResponse.json(
        { error: 'Last message must be from user' },
        { status: 400 }
      );
    }

    // Determine action based on user's message
    const action = await determineAction(lastMessage.content);

    // Handle different action types
    switch (action.type) {
      case 'CHAT':
      case 'SEARCH': {
        // Forward to regular chat endpoint with GPT-4
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages, model: 'gpt-4o' }),
        });

        return response;
      }

      default:
        return NextResponse.json({
          role: 'assistant',
          content: "I'm not sure how to handle that request."
        });
    }
  } catch (error) {
    console.error('Error in agent endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 