import { Message } from '../types';

interface ThreadCache {
  messages: Message[];
  lastUpdated: number;
}

export class MessageCache {
  private static CACHE_PREFIX = 'elucide_chat_';
  private static MESSAGE_CACHE_DURATION = 1000 * 60 * 60; // 1 hour
  private static OPTIMISTIC_PREFIX = 'temp_';
  private static PENDING_MESSAGES = new Map<string, Message[]>();

  static getThreadKey(threadId: string): string {
    return `${this.CACHE_PREFIX}thread_${threadId}`;
  }

  static isOptimisticId(id: string): boolean {
    return id.startsWith(this.OPTIMISTIC_PREFIX);
  }

  static generateOptimisticId(): string {
    return `${this.OPTIMISTIC_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  static addPendingMessage(threadId: string, message: Message): void {
    const pending = this.PENDING_MESSAGES.get(threadId) || [];
    pending.push(message);
    this.PENDING_MESSAGES.set(threadId, pending);

    // Also add to cache immediately
    const cachedMessages = this.getCachedMessages(threadId) || [];
    this.cacheMessages(threadId, [...cachedMessages, message]);
  }

  static removePendingMessage(threadId: string, messageId: string): void {
    const pending = this.PENDING_MESSAGES.get(threadId) || [];
    const updatedPending = pending.filter(msg => msg.id !== messageId);
    
    if (updatedPending.length === 0) {
      this.PENDING_MESSAGES.delete(threadId);
    } else {
      this.PENDING_MESSAGES.set(threadId, updatedPending);
    }
  }

  static hasPendingMessages(threadId: string): boolean {
    return this.PENDING_MESSAGES.has(threadId) && this.PENDING_MESSAGES.get(threadId)!.length > 0;
  }

  static getPendingMessages(threadId: string): Message[] {
    return this.PENDING_MESSAGES.get(threadId) || [];
  }

  static cacheMessages(threadId: string, messages: Message[]): void {
    // Combine with any pending messages
    const pending = this.PENDING_MESSAGES.get(threadId) || [];
    const allMessages = [...messages, ...pending];
    
    const cache: ThreadCache = {
      messages: allMessages,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(this.getThreadKey(threadId), JSON.stringify(cache));
  }

  static getCachedMessages(threadId: string): Message[] | null {
    const cacheStr = localStorage.getItem(this.getThreadKey(threadId));
    if (!cacheStr) return null;

    try {
      const cache: ThreadCache = JSON.parse(cacheStr);
      const age = Date.now() - cache.lastUpdated;

      // Return null if cache is too old
      if (age > this.MESSAGE_CACHE_DURATION) {
        localStorage.removeItem(this.getThreadKey(threadId));
        return null;
      }

      // Combine cached messages with any pending messages
      const pending = this.PENDING_MESSAGES.get(threadId) || [];
      return [...cache.messages, ...pending];
    } catch (error) {
      console.error('Error parsing cached messages:', error);
      localStorage.removeItem(this.getThreadKey(threadId));
      return null;
    }
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

  static replaceOptimisticMessage(threadId: string, optimisticId: string, realMessage: Message): void {
    const messages = this.getCachedMessages(threadId);
    if (!messages) return;

    const updatedMessages = messages.map(msg => 
      msg.id === optimisticId ? realMessage : msg
    );

    this.cacheMessages(threadId, updatedMessages);
  }

  static removeOptimisticMessages(threadId: string): void {
    const messages = this.getCachedMessages(threadId);
    if (!messages) return;

    const updatedMessages = messages.filter(msg => !this.isOptimisticId(msg.id));
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
