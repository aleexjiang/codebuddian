import { ItemView, WorkspaceLeaf, Notice, setIcon } from 'obsidian';
import { CHAT_VIEW_TYPE, CHAT_ICON, AVAILABLE_MODELS, EFFORT_OPTIONS } from './constants';
import { ChatStateManager } from './state/ChatState';
import { TabManager } from './tabs/TabManager';
import { TabBar } from './tabs/TabBar';
import { MessageRenderer } from './rendering/MessageRenderer';
import { ConversationController } from './controllers/ConversationController';
import { InputController } from './controllers/InputController';
import type { ChatRuntime } from '../../core/runtime/ChatRuntime';
import { t } from '../../i18n/i18n';

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
  private modelSelectEl!: HTMLSelectElement;
  private effortSelectEl!: HTMLSelectElement;
  private headerEl!: HTMLElement;
  private runtime: ChatRuntime | null = null;
  private modelsLoaded = false;

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

    // ===== Header / Toolbar =====
    this.headerEl = container.createDiv({ cls: 'codebuddian-header' });

    // Title slot: logo + brand
    const titleSlot = this.headerEl.createDiv({ cls: 'codebuddian-title-slot' });

    // Logo SVG (CodeBuddy brand icon)
    const logoEl = titleSlot.createSpan({ cls: 'codebuddian-logo' });
    logoEl.appendChild(this.createLogoSvg());

    // Brand text
    titleSlot.createEl('h4', { text: 'CodeBuddy', cls: 'codebuddian-title-text' });

    // Header actions (model + effort selectors, new tab, etc.)
    const actionsEl = this.headerEl.createDiv({ cls: 'codebuddian-header-actions' });

    // Model selector
    const modelWrap = actionsEl.createDiv({ cls: 'codebuddian-control-group' });
    modelWrap.createEl('label', { cls: 'codebuddian-control-label', text: t('chat.model') });
    this.modelSelectEl = modelWrap.createEl('select', { cls: 'codebuddian-select codebuddian-model-select' });
    this.renderModelOptions();
    this.modelSelectEl.addEventListener('change', () => {
      const tab = this.stateManager.getActiveTab();
      if (tab) {
        this.stateManager.updateTab(tab.id, { model: this.modelSelectEl.value });
      }
    });

    // Effort selector
    const effortWrap = actionsEl.createDiv({ cls: 'codebuddian-control-group' });
    effortWrap.createEl('label', { cls: 'codebuddian-control-label', text: t('chat.effort') });
    this.effortSelectEl = effortWrap.createEl('select', { cls: 'codebuddian-select codebuddian-effort-select' });
    EFFORT_OPTIONS.forEach(e => {
      const opt = this.effortSelectEl.createEl('option', { text: e.label });
      opt.value = e.id;
    });
    this.effortSelectEl.addEventListener('change', () => {
      const tab = this.stateManager.getActiveTab();
      if (tab) {
        this.stateManager.updateTab(tab.id, { effort: this.effortSelectEl.value });
      }
    });

    // New tab button ( Obsidian icon )
    const newTabBtn = actionsEl.createDiv({ cls: 'codebuddian-header-btn', attr: { 'aria-label': 'New tab' } });
    setIcon(newTabBtn, 'square-plus');
    newTabBtn.addEventListener('click', () => this.tabManager.createTab());

    // Tab bar
    const tabBarEl = container.createDiv({ cls: 'codebuddian-tab-bar-container' });
    this.tabBar = new TabBar(tabBarEl, {
      onTabClick: (id) => this.stateManager.setActiveTab(id),
      onTabClose: (id) => this.tabManager.closeTab(id),
      onNewTab: () => this.tabManager.createTab(),
    });

    // Messages area wrapper (for scroll-to-bottom positioning)
    const messagesWrapper = container.createDiv({ cls: 'codebuddian-messages-wrapper' });
    this.messagesContainer = messagesWrapper.createDiv({ cls: 'codebuddian-messages' });

    // Input area
    const inputContainer = container.createDiv({ cls: 'codebuddian-input-container' });

    // Input wrapper (bordered box like claudian)
    const inputWrapper = inputContainer.createDiv({ cls: 'codebuddian-input-wrapper' });

    // Toolbar inside input wrapper (top)
    const toolbar = inputWrapper.createDiv({ cls: 'codebuddian-input-toolbar' });

    const planModeBtn = toolbar.createEl('button', {
      cls: 'codebuddian-toolbar-btn',
      attr: { 'aria-label': 'Toggle plan mode' },
    });
    setIcon(planModeBtn, 'list-checks');
    planModeBtn.addEventListener('click', () => {
      this.conversationController.togglePlanMode();
    });

    const stopBtn = toolbar.createEl('button', {
      cls: 'codebuddian-toolbar-btn',
      attr: { 'aria-label': 'Stop generation' },
    });
    setIcon(stopBtn, 'square');
    stopBtn.addEventListener('click', () => {
      this.conversationController.cancel();
    });

    // Textarea
    this.textareaEl = inputWrapper.createEl('textarea', {
      cls: 'codebuddian-input',
      attr: {
        placeholder: 'Message CodeBuddy… (Enter to send, Shift+Enter for newline)',
        rows: '1',
      },
    });

    // Send button (circular, bottom-right)
    this.sendButtonEl = inputWrapper.createEl('button', {
      cls: 'codebuddian-send-btn',
      attr: { 'aria-label': 'Send message' },
    });
    setIcon(this.sendButtonEl, 'send');

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

    // Try to load real models from SDK once a session exists
    this.tryLoadModels();
  }

  async onClose(): Promise<void> {
    await this.conversationController.dispose();
  }

  private createLogoSvg(): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');

    // Simple bot/robot icon for CodeBuddy
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M12 2a2 2 0 0 1 2 2v2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4V4a2 2 0 0 1 2-2zm0 2v2h0V4zm-5 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z');
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);

    return svg;
  }

  private renderModelOptions(): void {
    this.modelSelectEl.empty();
    for (const m of AVAILABLE_MODELS) {
      const opt = this.modelSelectEl.createEl('option', { text: m.label });
      opt.value = m.id;
    }
  }

  /** Attempt to fetch real model list from the runtime once a session is active. */
  private async tryLoadModels(): Promise<void> {
    if (this.modelsLoaded) return;

    // Poll a few times — session may not be ready immediately
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 800));
      if (!this.runtime) continue;

      try {
        const models = await this.runtime.getAvailableModels();
        if (models.length > 0) {
          const { setAvailableModels } = await import('./constants');
          setAvailableModels(models.map(m => ({ id: m.id, label: m.name })));
          this.renderModelOptions();

          // Restore active tab's selection if it matches
          const activeTab = this.stateManager.getActiveTab();
          if (activeTab) {
            this.modelSelectEl.value = activeTab.model;
          }
          this.modelsLoaded = true;
          break;
        }
      } catch {
        // Ignore — will retry
      }
    }
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

    // Sync header controls with active tab
    const activeTab = this.stateManager.getActiveTab();
    if (activeTab) {
      this.modelSelectEl.value = activeTab.model;
      this.effortSelectEl.value = activeTab.effort;
    }

    // Render messages for active tab
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
