import { Message } from '../types';

interface ThreadCache {
  messages: Message[];
  lastUpdated: number;
}

export class MessageCache {
  private static CACHE_PREFIX = 'elucide_chat_';
  private static MESSAGE_CACHE_DURATION = 1000 * 60 * 60; // 1 hour

  static getThreadKey(threadId: string): string {
    return `${this.CACHE_PREFIX}thread_${threadId}`;
  }

  static cacheMessages(threadId: string, messages: Message[]): void {
    const cache: ThreadCache = {
      messages,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(this.getThreadKey(threadId), JSON.stringify(cache));
  }

  static getCachedMessages(threadId: string): Message[] | null {
    const cacheStr = localStorage.getItem(this.getThreadKey(threadId));
    if (!cacheStr) return null;

    const cache: ThreadCache = JSON.parse(cacheStr);
    const age = Date.now() - cache.lastUpdated;

    // Return null if cache is too old
    if (age > this.MESSAGE_CACHE_DURATION) {
      localStorage.removeItem(this.getThreadKey(threadId));
      return null;
    }

    return cache.messages;
  }

  static updateMessageInCache(threadId: string, message: Message): void {
    const messages = this.getCachedMessages(threadId);
    if (!messages) return;

    const updatedMessages = [...messages];
    const index = updatedMessages.findIndex(m => m.id === message.id);
    
    if (index !== -1) {
      updatedMessages[index] = message;
    } else {
      updatedMessages.push(message);
    }

    this.cacheMessages(threadId, updatedMessages);
  }

  static clearCache(threadId?: string): void {
    if (threadId) {
      localStorage.removeItem(this.getThreadKey(threadId));
    } else {
      // Clear all chat caches
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    }
  }
} 
