import type { ChatStateManager } from '../state/ChatState';
import { Tab } from './Tab';

export class TabManager {
  private tabs = new Map<string, Tab>();

  constructor(private stateManager: ChatStateManager) {}

  createTab(): Tab {
    const data = this.stateManager.addTab();
    const tab = new Tab(data.id, this.stateManager);
    this.tabs.set(data.id, tab);
    return tab;
  }

  getTab(id: string): Tab | undefined {
    return this.tabs.get(id);
  }

  getActiveTab(): Tab | undefined {
    const activeId = this.stateManager.getState().activeTabId;
    return activeId ? this.tabs.get(activeId) : undefined;
  }

  closeTab(id: string): void {
    this.tabs.delete(id);
    this.stateManager.removeTab(id);
  }

  getAllTabs(): Tab[] {
    return Array.from(this.tabs.values());
  }

  ensureAtLeastOneTab(): Tab {
    if (this.tabs.size === 0) {
      return this.createTab();
    }
    return this.getActiveTab() || this.createTab();
  }
}
