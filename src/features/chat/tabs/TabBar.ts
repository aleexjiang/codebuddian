import { Notice } from 'obsidian';

export class TabBar {
  private containerEl: HTMLElement;
  private onTabClick: (id: string) => void;
  private onTabClose: (id: string) => void;
  private onNewTab: () => void;

  constructor(
    containerEl: HTMLElement,
    callbacks: {
      onTabClick: (id: string) => void;
      onTabClose: (id: string) => void;
      onNewTab: () => void;
    }
  ) {
    this.containerEl = containerEl;
    this.onTabClick = callbacks.onTabClick;
    this.onTabClose = callbacks.onTabClose;
    this.onNewTab = callbacks.onNewTab;
  }

  render(tabs: { id: string; title: string; isActive: boolean }[]): void {
    this.containerEl.empty();
    this.containerEl.addClass('codebuddian-tab-bar');

    for (const tab of tabs) {
      const tabEl = this.containerEl.createDiv({
        cls: `codebuddian-tab ${tab.isActive ? 'active' : ''}`,
      });
      tabEl.createSpan({ text: tab.title, cls: 'codebuddian-tab-title' });
      tabEl.addEventListener('click', () => this.onTabClick(tab.id));

      const closeBtn = tabEl.createSpan({ cls: 'codebuddian-tab-close', text: '×' });
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onTabClose(tab.id);
      });
    }

    const newTabBtn = this.containerEl.createDiv({ cls: 'codebuddian-tab-new' });
    newTabBtn.setText('+');
    newTabBtn.addEventListener('click', () => this.onNewTab());
  }
}
