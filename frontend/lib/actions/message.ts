'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { Message } from '../types';

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error('API_URL environment variable is not set');
}

export async function fetchMessages(threadId: string): Promise<Message[]> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const response = await fetch(
    `${API_URL}/api/v1/chat/threads/${threadId}/messages`,
    { cache: 'no-store' }
  );
  
  if (!response.ok) throw new Error('Failed to fetch messages');
  const messages = await response.json();
  
  return messages;
}

export async function createMessage(
  threadId: string,
  content: string,
  role: 'user' | 'assistant' | 'system',
  model?: string,
  image_url?: string
): Promise<Message> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const response = await fetch(
    `${API_URL}/api/v1/chat/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread_id: threadId,
        content,
        role,
        model,
        image_url,
      }),
    }
  );

  if (!response.ok) throw new Error('Failed to create message');
  const message = await response.json();
  
  revalidatePath('/dashboard/chat');
  return message;
} 