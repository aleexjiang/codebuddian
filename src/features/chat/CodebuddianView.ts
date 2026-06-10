import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { CHAT_VIEW_TYPE, CHAT_ICON } from './constants';
import { ChatStateManager } from './state/ChatState';
import { TabManager } from './tabs/TabManager';
import { TabBar } from './tabs/TabBar';
import { MessageRenderer } from './rendering/MessageRenderer';
import { ConversationController } from './controllers/ConversationController';
import { InputController } from './controllers/InputController';
import type { ChatRuntime } from '../../core/runtime/ChatRuntime';

export class CodebuddianChatView extends ItemView {
  private stateManager: ChatStateManager;
  private tabManager: TabManager;
  private conversationController: ConversationController;
  private messageRenderer!: MessageRenderer;
  private inputController!: InputController;
  private tabBar!: TabBar;
  private messagesContainer!: HTMLElement;
  private textareaEl!: HTMLTextAreaElement;
  private sendButtonEl!: HTMLButtonElement;
  private runtime: ChatRuntime | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.stateManager = new ChatStateManager();
    this.tabManager = new TabManager(this.stateManager);
    this.conversationController = new ConversationController(this.stateManager);
  }

  getViewType(): string {
    return CHAT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Codebuddian';
  }

  getIcon(): string {
    return CHAT_ICON;
  }

  setRuntime(runtime: ChatRuntime): void {
    this.runtime = runtime;
    this.conversationController.setRuntime(runtime);
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('codebuddian-chat-container');

    // Tab bar
    const tabBarEl = container.createDiv({ cls: 'codebuddian-tab-bar-container' });
    this.tabBar = new TabBar(tabBarEl, {
      onTabClick: (id) => this.stateManager.setActiveTab(id),
      onTabClose: (id) => this.tabManager.closeTab(id),
      onNewTab: () => this.tabManager.createTab(),
    });

    // Messages area
    this.messagesContainer = container.createDiv({ cls: 'codebuddian-messages' });

    // Input area
    const inputArea = container.createDiv({ cls: 'codebuddian-input-area' });

    // Toolbar
    const toolbar = inputArea.createDiv({ cls: 'codebuddian-input-toolbar' });
    const planModeBtn = toolbar.createEl('button', { text: '📋 Plan', cls: 'codebuddian-toolbar-btn' });
    planModeBtn.addEventListener('click', () => {
      this.conversationController.togglePlanMode();
    });

    const cancelBtn = toolbar.createEl('button', { text: '⏹ Stop', cls: 'codebuddian-toolbar-btn' });
    cancelBtn.addEventListener('click', () => {
      this.conversationController.cancel();
    });

    // Textarea
    this.textareaEl = inputArea.createEl('textarea', {
      cls: 'codebuddian-input',
      attr: {
        placeholder: 'Message CodeBuddy… (Enter to send, Shift+Enter for newline)\nUse @file to mention files, # for instructions, / for commands',
        rows: '1',
      },
    });

    // Send button
    this.sendButtonEl = inputArea.createEl('button', {
      text: '➤',
      cls: 'codebuddian-send-btn',
    });

    // Init sub-controllers
    this.messageRenderer = new MessageRenderer(this.messagesContainer, this, this.app);
    this.inputController = new InputController(
      this.textareaEl,
      this.sendButtonEl,
      this.conversationController,
      this.stateManager,
    );

    // Subscribe to state changes
    this.stateManager.subscribe(() => this.render());

    // Ensure at least one tab
    this.tabManager.ensureAtLeastOneTab();
  }

  async onClose(): Promise<void> {
    await this.conversationController.dispose();
  }

  private render(): void {
    const state = this.stateManager.getState();

    // Render tabs
    this.tabBar.render(
      state.tabs.map(t => ({
        id: t.id,
        title: t.title,
        isActive: t.id === state.activeTabId,
      }))
    );

    // Render messages for active tab
    const activeTab = this.stateManager.getActiveTab();
    if (activeTab) {
      this.messageRenderer.renderMessages(activeTab.messages);

      // Auto-scroll
      if (this.messagesContainer) {
        const { scrollTop, scrollHeight, clientHeight } = this.messagesContainer;
        if (scrollHeight - scrollTop - clientHeight < 100) {
          this.messagesContainer.scrollTop = scrollHeight;
        }
      }
    }
  }
}
