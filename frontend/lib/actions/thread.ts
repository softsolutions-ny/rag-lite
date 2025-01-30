'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { Thread, UpdateThreadData } from '../types';

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error('API_URL environment variable is not set');
}

export async function fetchThreads(): Promise<Thread[]> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const response = await fetch(
    `${API_URL}/api/v1/chat/threads?user_id=${userId}`,
    { cache: 'no-store' }
  );
  
  if (!response.ok) throw new Error('Failed to fetch threads');
  const threads = await response.json();
  
  return threads;
}

export async function createThread(): Promise<Thread> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const response = await fetch(
    `${API_URL}/api/v1/chat/threads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    }
  );

  if (!response.ok) throw new Error('Failed to create thread');
  const thread = await response.json();
  
  revalidatePath('/dashboard/chat');
  return thread;
}

export async function updateThread(
  threadId: string,
  data: UpdateThreadData
): Promise<Thread> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const response = await fetch(
    `${API_URL}/api/v1/chat/threads/${threadId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) throw new Error('Failed to update thread');
  const thread = await response.json();
  
  revalidatePath('/dashboard/chat');
  return thread;
}

export async function deleteThread(threadId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const response = await fetch(
    `${API_URL}/api/v1/chat/threads/${threadId}`,
    { method: 'DELETE' }
  );

  if (!response.ok) throw new Error('Failed to delete thread');
  
  revalidatePath('/dashboard/chat');
}

export async function moveThreadToFolder(
  threadId: string,
  folderId: string | undefined
): Promise<Thread> {
  return updateThread(threadId, {
    folder_id: folderId,
    updated_at: new Date().toISOString(),
  });
} 