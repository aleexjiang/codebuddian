import type { ChatMessage } from '../types';
import type { PluginStorage } from './storage';

export class SessionStorage {
  constructor(private storage: PluginStorage) {}

  async saveMessage(sessionId: string, message: ChatMessage): Promise<void> {
    await this.storage.appendSessionLine(sessionId, message);
  }

  async loadMessages(sessionId: string): Promise<ChatMessage[]> {
    const lines = await this.storage.readSessionLines(sessionId);
    return lines as ChatMessage[];
  }

  async listSessions(): Promise<string[]> {
    return this.storage.listSessions();
  }
}
