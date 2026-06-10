import { ItemView, WorkspaceLeaf, Notice, setIcon } from 'obsidian';
import { CHAT_VIEW_TYPE, CHAT_ICON, AVAILABLE_MODELS, EFFORT_OPTIONS } from './constants';
import { ChatStateManager } from './state/ChatState';
import { TabManager } from './tabs/TabManager';
import { TabBar } from './tabs/TabBar';
import { MessageRenderer } from './rendering/MessageRenderer';
import { ConversationController } from './controllers/ConversationController';
import { InputController } from './controllers/InputController';
import type { ChatRuntime } from '../../core/runtime/ChatRuntime';
import type { ChatMode } from './state/types';
import { t } from '../../i18n/i18n';

const MODE_CONFIG: { id: ChatMode; label: string; icon: string; desc: string }[] = [
  { id: 'ask', label: 'Ask', icon: 'message-circle', desc: 'Chat normally' },
  { id: 'plan', label: 'Plan', icon: 'list-checks', desc: 'Plan only, no edits' },
  { id: 'craft', label: 'Craft', icon: 'wand-2', desc: 'Auto-accept edits' },
];

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
  private stopBtnEl!: HTMLButtonElement;
  private modeBtnEl!: HTMLButtonElement;
  private modeBtnLabelEl!: HTMLSpanElement;
  private modeMenuEl!: HTMLDivElement;
  private inputWrapperEl!: HTMLElement;
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

    // ===== Header (simplified) =====
    const headerEl = container.createDiv({ cls: 'codebuddian-header' });

    // Title slot: logo + brand
    const titleSlot = headerEl.createDiv({ cls: 'codebuddian-title-slot' });
    const logoEl = titleSlot.createSpan({ cls: 'codebuddian-logo' });
    logoEl.appendChild(this.createLogoSvg());
    titleSlot.createEl('h4', { text: 'CodeBuddy', cls: 'codebuddian-title-text' });

    // Header actions: new tab button only
    const actionsEl = headerEl.createDiv({ cls: 'codebuddian-header-actions' });
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

    // Messages area
    const messagesWrapper = container.createDiv({ cls: 'codebuddian-messages-wrapper' });
    this.messagesContainer = messagesWrapper.createDiv({ cls: 'codebuddian-messages' });

    // ===== Input Area =====
    const inputContainer = container.createDiv({ cls: 'codebuddian-input-container' });

    // -- Input toolbar (model + mode + effort) --
    const inputToolbar = inputContainer.createDiv({ cls: 'codebuddian-input-toolbar-row' });

    // Model selector
    const modelGroup = inputToolbar.createDiv({ cls: 'codebuddian-toolbar-group' });
    setIcon(modelGroup.createSpan({ cls: 'codebuddian-toolbar-group-icon' }), 'cpu');
    this.modelSelectEl = modelGroup.createEl('select', { cls: 'codebuddian-select codebuddian-toolbar-select' });
    this.renderModelOptions();
    this.modelSelectEl.addEventListener('change', () => {
      const tab = this.stateManager.getActiveTab();
      if (tab) {
        this.stateManager.updateTab(tab.id, { model: this.modelSelectEl.value });
        this.applyModelToSession(this.modelSelectEl.value);
      }
    });

    // Mode dropdown (Ask / Plan / Craft)
    const modeGroup = inputToolbar.createDiv({ cls: 'codebuddian-toolbar-group codebuddian-mode-group' });

    this.modeBtnEl = modeGroup.createEl('button', {
      cls: 'codebuddian-mode-dropdown-btn',
      attr: { 'aria-label': 'Mode', 'aria-haspopup': 'true' },
    });
    const modeIconEl = this.modeBtnEl.createSpan({ cls: 'codebuddian-mode-dropdown-icon' });
    setIcon(modeIconEl, 'message-circle');
    this.modeBtnLabelEl = this.modeBtnEl.createSpan({ cls: 'codebuddian-mode-dropdown-label', text: 'Ask' });
    const caretEl = this.modeBtnEl.createSpan({ cls: 'codebuddian-mode-dropdown-caret' });
    setIcon(caretEl, 'chevron-down');

    // Dropdown menu
    this.modeMenuEl = modeGroup.createDiv({ cls: 'codebuddian-mode-menu' });
    for (const modeCfg of MODE_CONFIG) {
      const item = this.modeMenuEl.createEl('button', {
        cls: 'codebuddian-mode-menu-item',
        attr: { 'data-mode': modeCfg.id, title: modeCfg.desc },
      });
      const itemIcon = item.createSpan({ cls: 'codebuddian-mode-menu-item-icon' });
      setIcon(itemIcon, modeCfg.icon);
      const textWrap = item.createDiv({ cls: 'codebuddian-mode-menu-item-text' });
      textWrap.createDiv({ cls: 'codebuddian-mode-menu-item-label', text: modeCfg.label });
      textWrap.createDiv({ cls: 'codebuddian-mode-menu-item-desc', text: modeCfg.desc });
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleSetMode(modeCfg.id);
        this.closeModeMenu();
      });
    }

    // Toggle dropdown
    this.modeBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      modeGroup.toggleClass('is-open', !modeGroup.hasClass('is-open'));
    });

    // Close dropdown on outside click
    this.registerDomEvent(this.containerEl.ownerDocument, 'click', () => {
      this.closeModeMenu();
    });

    // Effort selector
    const effortGroup = inputToolbar.createDiv({ cls: 'codebuddian-toolbar-group' });
    setIcon(effortGroup.createSpan({ cls: 'codebuddian-toolbar-group-icon' }), 'gauge');
    this.effortSelectEl = effortGroup.createEl('select', { cls: 'codebuddian-select codebuddian-toolbar-select' });
    EFFORT_OPTIONS.forEach(e => {
      const opt = this.effortSelectEl.createEl('option', { text: e.label });
      opt.value = e.id;
    });
    this.effortSelectEl.addEventListener('change', () => {
      const tab = this.stateManager.getActiveTab();
      if (tab) {
        this.stateManager.updateTab(tab.id, { effort: this.effortSelectEl.value });
        this.applyEffortToSession(this.effortSelectEl.value);
      }
    });

    // Stop button (inline, only visible during streaming)
    this.stopBtnEl = inputToolbar.createEl('button', {
      cls: 'codebuddian-toolbar-btn codebuddian-stop-btn',
      attr: { 'aria-label': 'Stop generation (Esc)' },
    });
    setIcon(this.stopBtnEl, 'square');
    this.stopBtnEl.addEventListener('click', () => {
      this.conversationController.cancel();
    });

    // -- Input wrapper (textarea + send) --
    this.inputWrapperEl = inputContainer.createDiv({ cls: 'codebuddian-input-wrapper' });

    this.textareaEl = this.inputWrapperEl.createEl('textarea', {
      cls: 'codebuddian-input',
      attr: {
        placeholder: 'Message CodeBuddy… (Enter to send, Shift+Enter for newline)',
        rows: '1',
      },
    });

    this.sendButtonEl = this.inputWrapperEl.createEl('button', {
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

    // Subscribe to state changes — debounce via rAF to prevent flicker
    // when streaming tokens fire dozens of updates per second.
    this.stateManager.subscribe(() => this.scheduleRender());

    // Keyboard shortcuts
    this.scope.register([], 'Escape', (e: KeyboardEvent) => {
      if (e.isComposing) return false;
      const tab = this.stateManager.getActiveTab();
      if (tab && tab.status === 'streaming') {
        this.conversationController.cancel();
      }
      return false;
    });

    // Ensure at least one tab
    this.tabManager.ensureAtLeastOneTab();

    // Try to load real models from SDK once a session exists
    this.tryLoadModels();
  }

  async onClose(): Promise<void> {
    await this.conversationController.dispose();
  }

  private closeModeMenu(): void {
    const grp = this.modeBtnEl?.parentElement;
    if (grp) grp.removeClass('is-open');
  }

  private async handleSetMode(mode: ChatMode): Promise<void> {
    await this.conversationController.setMode(mode);
    const label = MODE_CONFIG.find(m => m.id === mode)?.label ?? mode;
    new Notice(`${label} mode`, 1500);
  }

  /** Apply model change to the live SDK session. */
  private async applyModelToSession(model: string): Promise<void> {
    if (!this.runtime || !model) return;
    try {
      const sdkSession = this.runtime.getSdkSession() as { setModel?(m: string): Promise<void> } | null;
      if (sdkSession?.setModel) {
        await sdkSession.setModel(model);
      }
    } catch {
      // Session may not be connected
    }
  }

  /** Apply effort change via SDK session's setConfig. */
  private async applyEffortToSession(effort: string): Promise<void> {
    if (!this.runtime || !effort) return;
    try {
      const sdkSession = this.runtime.getSdkSession() as { setConfig?(c: Record<string, unknown>): Promise<void> } | null;
      if (sdkSession?.setConfig) {
        await sdkSession.setConfig({ effort });
      }
    } catch {
      // Session may not be connected
    }
  }

  private createLogoSvg(): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');

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

    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 800));
      if (!this.runtime) continue;

      try {
        const models = await this.runtime.getAvailableModels();
        if (models.length > 0) {
          const { setAvailableModels } = await import('./constants');
          setAvailableModels(models.map(m => ({ id: m.id, label: m.name })));
          this.renderModelOptions();

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

  private renderRafId: number | null = null;
  private lastRenderedTabId: string | null = null;

  private scheduleRender(): void {
    if (this.renderRafId !== null) return;
    this.renderRafId = window.requestAnimationFrame(() => {
      this.renderRafId = null;
      this.render();
    });
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

    // Sync controls with active tab
    const activeTab = this.stateManager.getActiveTab();
    if (activeTab) {
      this.modelSelectEl.value = activeTab.model;
      this.effortSelectEl.value = activeTab.effort;

      // Mode dropdown — update button label/icon and active item
      const activeModeCfg = MODE_CONFIG.find(m => m.id === activeTab.mode) ?? MODE_CONFIG[0];
      const iconEl = this.modeBtnEl.querySelector('.codebuddian-mode-dropdown-icon') as HTMLElement | null;
      if (iconEl) {
        iconEl.empty();
        setIcon(iconEl, activeModeCfg.icon);
      }
      this.modeBtnLabelEl.setText(activeModeCfg.label);
      this.modeBtnEl.setAttribute('data-mode', activeModeCfg.id);

      // Highlight active item in menu
      this.modeMenuEl.querySelectorAll('.codebuddian-mode-menu-item').forEach((el) => {
        const isSelected = el.getAttribute('data-mode') === activeTab.mode;
        el.toggleClass('is-active', isSelected);
      });

      // Apply mode-specific wrapper class
      this.inputWrapperEl.removeClass('codebuddian-mode-ask', 'codebuddian-mode-plan', 'codebuddian-mode-craft');
      this.inputWrapperEl.addClass(`codebuddian-mode-${activeTab.mode}`);

      // Stop button visibility
      const isStreaming = activeTab.status === 'streaming';
      this.stopBtnEl.toggleClass('is-visible', isStreaming);

      // Send button state
      this.sendButtonEl.toggleClass('is-disabled', isStreaming);
    }

    // Render messages for active tab
    if (activeTab) {
      // Reset renderer cache when switching tabs (each tab has its own message DOM)
      if (this.lastRenderedTabId !== activeTab.id) {
        this.messageRenderer.reset();
        this.lastRenderedTabId = activeTab.id;
      }
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
