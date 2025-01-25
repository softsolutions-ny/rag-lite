import { NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from "zod";
import { useExtractionStore } from '@/lib/store/extraction';

const model = openai('gpt-4o');

type AgentAction = {
  type: "EXTRACT" | "CHAT" | "SEARCH";
  instruction: string;
  reasoning: string;
};

async function determineAction(message: string): Promise<AgentAction> {
  const messages = [{
    role: "user" as const,
    content: [{
      type: "text" as const,
      text: `Given the user message: "${message}", determine the most appropriate action to take.
Choose from:
1. EXTRACT - If the user wants to extract data from URLs
2. CHAT - If this is a regular chat message
3. SEARCH - If we need to search for information

Return the appropriate action type and reasoning.`
    }]
  }];

  const {result} = await generateObject({
    model,
    schema: z.object({
      type: z.enum(["EXTRACT", "CHAT", "SEARCH"]),
      instruction: z.string(),
      reasoning: z.string()
    }),
    messages
  });

  return result.object;
}

export async function POST(request: Request) {
  try {
    const { messages, model } = await request.json();
    
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
      case 'EXTRACT': {
        // Extract URLs from the message using regex
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = lastMessage.content.match(urlRegex) || [];
        
        if (urls.length === 0) {
          return NextResponse.json({
            role: 'assistant',
            content: "I couldn't find any URLs in your message. Please provide URLs to extract data from."
          });
        }

        // Start extraction using the store
        const extractionStore = useExtractionStore.getState();
        const jobId = await extractionStore.startExtraction({
          urls,
          prompt: action.instruction,
          extraction_schema: undefined
        });

        // Poll for status
        let status;
        do {
          await new Promise(resolve => setTimeout(resolve, 1000));
          status = await extractionStore.checkExtractionStatus(jobId);
        } while (status.status === 'processing');

        if (status.status === 'failed') {
          return NextResponse.json({
            role: 'assistant',
            content: `Failed to extract data: ${status.error}`
          });
        }

        return NextResponse.json({
          role: 'assistant',
          content: `Successfully extracted data:\n\n${JSON.stringify(status.data, null, 2)}`
        });
      }

      case 'CHAT': {
        // Forward to regular chat endpoint
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages, model: 'gpt-4o' }),
        });

        return response;
      }

      case 'SEARCH': {
        // Implement search functionality
        // For now, just respond with chat
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