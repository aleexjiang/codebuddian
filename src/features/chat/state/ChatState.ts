import { ChatTab, ChatState, createEmptyTab } from './types';
import type { ChatMessage } from '../../../core/types';

export class ChatStateManager {
  private state: ChatState = {
    activeTabId: null,
    tabs: [],
    inputValue: '',
    isInputFocused: false,
  };

  private listeners = new Set<() => void>();

  getState(): ChatState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  addTab(): ChatTab {
    const id = `tab-${Date.now()}`;
    const tab = createEmptyTab(id);
    this.state.tabs.push(tab);
    this.state.activeTabId = id;
    this.notify();
    return tab;
  }

  removeTab(id: string): void {
    this.state.tabs = this.state.tabs.filter(t => t.id !== id);
    if (this.state.activeTabId === id) {
      this.state.activeTabId = this.state.tabs.length > 0 ? this.state.tabs[0].id : null;
    }
    this.notify();
  }

  setActiveTab(id: string): void {
    this.state.activeTabId = id;
    this.notify();
  }

  getActiveTab(): ChatTab | undefined {
    return this.state.tabs.find(t => t.id === this.state.activeTabId);
  }

  updateTab(id: string, update: Partial<ChatTab>): void {
    const tab = this.state.tabs.find(t => t.id === id);
    if (tab) {
      Object.assign(tab, update, { updatedAt: Date.now() });
      this.notify();
    }
  }

  addMessage(tabId: string, message: ChatMessage): void {
    const tab = this.state.tabs.find(t => t.id === tabId);
    if (tab) {
      tab.messages.push(message);
      tab.updatedAt = Date.now();
      this.notify();
    }
  }

  updateLastAssistantMessage(tabId: string, content: string): void {
    const tab = this.state.tabs.find(t => t.id === tabId);
    if (tab) {
      const lastAssistant = [...tab.messages].reverse().find(m => m.role === 'assistant');
      if (lastAssistant) {
        lastAssistant.content = content;
        lastAssistant.isStreaming = true;
        tab.updatedAt = Date.now();
        this.notify();
      }
    }
  }

  finalizeLastAssistantMessage(tabId: string): void {
    const tab = this.state.tabs.find(t => t.id === tabId);
    if (tab) {
      const lastAssistant = [...tab.messages].reverse().find(m => m.role === 'assistant');
      if (lastAssistant) {
        lastAssistant.isStreaming = false;
        tab.updatedAt = Date.now();
        tab.status = 'idle';
        this.notify();
      }
    }
  }

  setInputValue(value: string): void {
    this.state.inputValue = value;
  }

  clearTabs(): void {
    this.state.tabs = [];
    this.state.activeTabId = null;
    this.notify();
  }
}
