import type { ChatTab } from '../state/types';
import type { ChatStateManager } from '../state/ChatState';

export class Tab {
  constructor(
    public readonly id: string,
    private stateManager: ChatStateManager,
  ) {}

  get data(): ChatTab | undefined {
    return this.stateManager.getState().tabs.find(t => t.id === this.id);
  }

  isActive(): boolean {
    return this.stateManager.getState().activeTabId === this.id;
  }

  activate(): void {
    this.stateManager.setActiveTab(this.id);
  }

  close(): void {
    this.stateManager.removeTab(this.id);
  }
}
