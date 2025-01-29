import { z } from 'zod';
import { CHAT_SYSTEM_PROMPT, AGENT_SYSTEM_PROMPT } from './prompts';

export type ModelType = 
  | 'gpt-4o' 
  | 'gpt-4o-mini' 
  | 'agent-1' 
  | 'mixtral-8x7b-32768'
  | 'llama-3.3-70b-versatile'
  | 'deepseek-r1-distill-llama-70b';

export interface ModelConfig {
  provider: 'openai' | 'groq';
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

export const modelConfigs: Record<ModelType, ModelConfig> = {
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 1000,
    temperature: 0.7,
    systemPrompt: CHAT_SYSTEM_PROMPT,
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    maxTokens: 500,
    temperature: 0.7,
    systemPrompt: CHAT_SYSTEM_PROMPT,
  },
  'agent-1': {
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 1000,
    temperature: 0.7,
    systemPrompt: AGENT_SYSTEM_PROMPT,
  },
  'mixtral-8x7b-32768': {
    provider: 'groq',
    model: 'mixtral-8x7b-32768',
    maxTokens: 32768,
    temperature: 0.7,
    systemPrompt: CHAT_SYSTEM_PROMPT,
  },
  'llama-3.3-70b-versatile': {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    maxTokens: 8192,
    temperature: 0.7,
    systemPrompt: CHAT_SYSTEM_PROMPT,
  },
  'deepseek-r1-distill-llama-70b': {
    provider: 'groq',
    model: 'deepseek-r1-distill-llama-70b',
    maxTokens: 8192,
    temperature: 0.7,
    systemPrompt: CHAT_SYSTEM_PROMPT,
  }
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