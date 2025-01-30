'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { Folder, CreateFolderData, UpdateFolderData } from '../types';

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error('API_URL environment variable is not set');
}

export async function fetchFolders(): Promise<Folder[]> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const response = await fetch(
    `${API_URL}/api/v1/chat/folders?user_id=${userId}`,
    { cache: 'no-store' }
  );
  
  if (!response.ok) throw new Error('Failed to fetch folders');
  const folders = await response.json();
  
  return folders;
}

export async function createFolder(data: Omit<CreateFolderData, 'user_id'>): Promise<Folder> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const response = await fetch(
    `${API_URL}/api/v1/chat/folders`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, user_id: userId }),
    }
  );

  if (!response.ok) throw new Error('Failed to create folder');
  const folder = await response.json();
  
  revalidatePath('/dashboard/chat');
  return folder;
}

export async function updateFolder(
  folderId: string,
  data: UpdateFolderData
): Promise<Folder> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const response = await fetch(
    `${API_URL}/api/v1/chat/folders/${folderId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) throw new Error('Failed to update folder');
  const folder = await response.json();
  
  revalidatePath('/dashboard/chat');
  return folder;
}

export async function deleteFolder(folderId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const response = await fetch(
    `${API_URL}/api/v1/chat/folders/${folderId}`,
    { method: 'DELETE' }
  );

  if (!response.ok) throw new Error('Failed to delete folder');
  
  revalidatePath('/dashboard/chat');
} 