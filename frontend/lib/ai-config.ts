import { openai } from '@ai-sdk/openai';
import { deepseek } from '@ai-sdk/deepseek';
import { z } from 'zod';
import { CHAT_SYSTEM_PROMPT, AGENT_SYSTEM_PROMPT } from './prompts';

export type ModelType = 'gpt-4o' | 'gpt-4o-mini' | 'deepseek-reasoner' | 'agent-gpt4o';

export interface ModelConfig {
  provider: 'openai' | 'deepseek';
  model: any; // SDK model instance
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

export const modelConfigs: Record<ModelType, ModelConfig> = {
  'gpt-4o': {
    provider: 'openai',
    model: openai('gpt-4o'),
    maxTokens: 1000,
    temperature: 0.7,
    systemPrompt: CHAT_SYSTEM_PROMPT,
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: openai('gpt-4o-mini'),
    maxTokens: 500,
    temperature: 0.7,
    systemPrompt: CHAT_SYSTEM_PROMPT,
  },
  'deepseek-reasoner': {
    provider: 'deepseek',
    model: deepseek('deepseek-reasoner'),
    maxTokens: 1000,
    temperature: 0.7,
    systemPrompt: CHAT_SYSTEM_PROMPT,
  },
  'agent-1': {
    provider: 'openai',
    model: openai('gpt-4o'),
    maxTokens: 1000,
    temperature: 0.7,
    systemPrompt: AGENT_SYSTEM_PROMPT,
  },
};

export const agentActionSchema = z.object({
  type: z.enum(['EXTRACT', 'CHAT', 'SEARCH']),
  instruction: z.string(),
  reasoning: z.string(),
});

export type AgentAction = z.infer<typeof agentActionSchema>;

export interface ChatMessage {
  content: string;
  role: 'user' | 'assistant' | 'system';
}

export async function storeMessage(messageData: {
  thread_id: string;
  role: string;
  content: string;
  model: string;
}) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messageData),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to store message:', error);
    throw new Error(`Failed to store message: ${JSON.stringify(error)}`);
  }

  return response;
}

export function validateApiKey(provider: 'openai' | 'deepseek') {
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  if (provider === 'deepseek' && !process.env.DEEPSEEK_API_KEY) {
    throw new Error('DeepSeek API key not configured');
  }
} 