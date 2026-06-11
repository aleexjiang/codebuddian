import { ItemView, WorkspaceLeaf, Notice, setIcon } from 'obsidian';
import { CHAT_VIEW_TYPE, CHAT_ICON, EFFORT_OPTIONS } from './constants';
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
  private modeBtnEl!: HTMLButtonElement;
  private modeBtnLabelEl!: HTMLSpanElement;
  private modeMenuEl!: HTMLDivElement;
  private inputWrapperEl!: HTMLElement;
  private thinkBtnEl!: HTMLButtonElement;
  private runtime: ChatRuntime | null = null;

  /**
   * Local model list — populated from runtime.getCachedModels() (reads
   * plugin settings synchronously) or runtime.getAvailableModels() (live
   * SDK query after session established).
   *
   * No global state (AVAILABLE_MODELS), no plugin reference (getPlugin()).
   * The runtime is the single source of truth.
   */
  private models: Array<{ id: string; label: string }> = [{ id: '', label: 'Default' }];

  // Pill dropdown groups
  private modeMenuGroupEl!: HTMLDivElement;
  private modelMenuGroupEl!: HTMLDivElement;
  private modelBtnEl!: HTMLButtonElement;
  private modelBtnLabelEl!: HTMLSpanElement;
  private modelMenuEl!: HTMLDivElement;
  private effortMenuGroupEl!: HTMLDivElement;
  private effortBtnEl!: HTMLButtonElement;
  private effortBtnLabelEl!: HTMLSpanElement;
  private effortMenuEl!: HTMLDivElement;

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

    // -- Input wrapper: textarea + floating toolbar + send button --
    this.inputWrapperEl = inputContainer.createDiv({ cls: 'codebuddian-input-wrapper' });

    this.textareaEl = this.inputWrapperEl.createEl('textarea', {
      cls: 'codebuddian-input',
      attr: {
        placeholder: 'Message CodeBuddy… (Enter to send, Shift+Enter for newline)',
      },
    });

    // Floating toolbar inside the input box (bottom-left)
    const inputToolbar = this.inputWrapperEl.createDiv({ cls: 'codebuddian-input-toolbar-row' });

    // Model pill
    this.modelMenuGroupEl = inputToolbar.createDiv({ cls: 'codebuddian-pill-group' });
    this.modelBtnEl = this.modelMenuGroupEl.createEl('button', {
      cls: 'codebuddian-pill-btn',
      attr: { type: 'button', 'aria-label': 'Model', 'aria-haspopup': 'true' },
    });
    setIcon(this.modelBtnEl.createSpan({ cls: 'codebuddian-pill-icon' }), 'at-sign');
    this.modelBtnLabelEl = this.modelBtnEl.createSpan({ cls: 'codebuddian-pill-label' });
    setIcon(this.modelBtnEl.createSpan({ cls: 'codebuddian-pill-caret' }), 'chevron-down');
    this.modelMenuEl = this.modelMenuGroupEl.createDiv({ cls: 'codebuddian-pill-menu' });

    this.modelBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllMenus();
      // Always refresh models from runtime cache before opening the menu,
      // so changes made in Settings → Detect models are immediately visible.
      this.refreshModels();
      this.modelMenuGroupEl.toggleClass('is-open', !this.modelMenuGroupEl.hasClass('is-open'));
    });

    // Mode dropdown (Ask / Plan / Craft)
    this.modeMenuGroupEl = inputToolbar.createDiv({ cls: 'codebuddian-pill-group codebuddian-mode-group' });
    this.modeBtnEl = this.modeMenuGroupEl.createEl('button', {
      cls: 'codebuddian-mode-dropdown-btn',
      attr: { 'aria-label': 'Mode', 'aria-haspopup': 'true', type: 'button' },
    });
    const modeIconEl = this.modeBtnEl.createSpan({ cls: 'codebuddian-mode-dropdown-icon' });
    setIcon(modeIconEl, 'message-circle');
    this.modeBtnLabelEl = this.modeBtnEl.createSpan({ cls: 'codebuddian-mode-dropdown-label', text: 'Ask' });
    const caretEl = this.modeBtnEl.createSpan({ cls: 'codebuddian-mode-dropdown-caret' });
    setIcon(caretEl, 'chevron-down');

    this.modeMenuEl = this.modeMenuGroupEl.createDiv({ cls: 'codebuddian-mode-menu' });
    for (const modeCfg of MODE_CONFIG) {
      const item = this.modeMenuEl.createEl('button', {
        cls: 'codebuddian-mode-menu-item',
        attr: { 'data-mode': modeCfg.id, title: modeCfg.desc, type: 'button' },
      });
      const itemIcon = item.createSpan({ cls: 'codebuddian-mode-menu-item-icon' });
      setIcon(itemIcon, modeCfg.icon);
      const textWrap = item.createDiv({ cls: 'codebuddian-mode-menu-item-text' });
      textWrap.createDiv({ cls: 'codebuddian-mode-menu-item-label', text: modeCfg.label });
      textWrap.createDiv({ cls: 'codebuddian-mode-menu-item-desc', text: modeCfg.desc });
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleSetMode(modeCfg.id);
        this.closeAllMenus();
      });
    }

    this.modeBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllMenus();
      this.modeMenuGroupEl.toggleClass('is-open', !this.modeMenuGroupEl.hasClass('is-open'));
    });

    // Effort pill
    this.effortMenuGroupEl = inputToolbar.createDiv({ cls: 'codebuddian-pill-group' });
    this.effortBtnEl = this.effortMenuGroupEl.createEl('button', {
      cls: 'codebuddian-pill-btn',
      attr: { type: 'button', 'aria-label': 'Effort', 'aria-haspopup': 'true' },
    });
    this.effortBtnLabelEl = this.effortBtnEl.createSpan({ cls: 'codebuddian-pill-label' });
    setIcon(this.effortBtnEl.createSpan({ cls: 'codebuddian-pill-caret' }), 'chevron-down');
    this.effortMenuEl = this.effortMenuGroupEl.createDiv({ cls: 'codebuddian-pill-menu' });
    this.renderEffortMenu();

    this.effortBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllMenus();
      this.effortMenuGroupEl.toggleClass('is-open', !this.effortMenuGroupEl.hasClass('is-open'));
    });

    // Thinking toggle (small icon button)
    this.thinkBtnEl = inputToolbar.createEl('button', {
      cls: 'codebuddian-toolbar-btn codebuddian-think-btn',
      attr: { 'aria-label': 'Toggle thinking mode', title: 'Thinking (shows reasoning)' },
    });
    setIcon(this.thinkBtnEl, 'brain');
    this.thinkBtnEl.addEventListener('click', () => {
      const tab = this.stateManager.getActiveTab();
      if (!tab) return;
      const newVal = !tab.thinkingEnabled;
      this.stateManager.updateTab(tab.id, { thinkingEnabled: newVal });
      this.applyThinkingToSession(newVal);
    });

    // Close dropdowns on outside click
    this.registerDomEvent(this.containerEl.ownerDocument, 'click', () => {
      this.closeAllMenus();
    });

    // Send button (bottom-right of input box)
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
    this.inputController.setOnCancel(() => this.conversationController.cancel());

    // Subscribe to state changes — debounce via rAF to prevent flicker
    this.stateManager.subscribe(() => this.scheduleRender());

    // Keyboard shortcuts — use registerDomEvent (this.scope may not be ready in onOpen)
    this.registerDomEvent(document, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) {
        const tab = this.stateManager.getActiveTab();
        if (tab && tab.status === 'streaming') {
          this.conversationController.cancel();
        }
      }
    });

    // Ensure at least one tab
    this.tabManager.ensureAtLeastOneTab();

    // Load cached model list from runtime (reads plugin settings synchronously)
    this.refreshModels();
    this.renderModelMenu();

    // Also refresh from SDK once a session is established
    this.conversationController.onSessionCreated = () => {
      this.refreshModelsFromSDK();
    };
  }

  async onClose(): Promise<void> {
    await this.conversationController.dispose();
  }

  private closeAllMenus(): void {
    this.modelMenuGroupEl?.removeClass('is-open');
    this.modeMenuGroupEl?.removeClass('is-open');
    this.effortMenuGroupEl?.removeClass('is-open');
  }

  private async handleSetMode(mode: ChatMode): Promise<void> {
    await this.conversationController.setMode(mode);
    const label = MODE_CONFIG.find(m => m.id === mode)?.label ?? mode;
    new Notice(`${label} mode`, 1500);
  }

  /** Apply model change — delegates to ConversationController which hot-switches via SDK. */
  private async applyModelToSession(model: string): Promise<void> {
    if (!model) return;
    const success = await this.conversationController.switchModel(model);
    if (!success) {
      // Hot-switch failed — notify user that the change will take effect in a new tab
      new Notice('模型热切换未生效，变更将在新对话中生效');
    }
  }

  /** Apply effort change via SDK session's setConfig. */
  private async applyEffortToSession(effort: string): Promise<void> {
    if (!this.runtime || !effort) return;
    try {
      const sdkSession = this.runtime.getSdkSession() as { setConfig?(c: Record<string, unknown>): Promise<void> } | null;
      if (sdkSession?.setConfig) {
        await sdkSession.setConfig({ effort });
        console.log('[codebuddian] applyEffortToSession — setConfig succeeded:', effort);
      } else {
        console.warn('[codebuddian] applyEffortToSession — SDK session has no setConfig method');
      }
    } catch (e) {
      console.error('[codebuddian] applyEffortToSession — setConfig failed:', e);
    }
  }

  /** Apply thinking toggle via SDK session's setConfig. */
  private async applyThinkingToSession(enabled: boolean): Promise<void> {
    if (!this.runtime) return;
    try {
      const sdkSession = this.runtime.getSdkSession() as { setConfig?(c: Record<string, unknown>): Promise<void> } | null;
      if (sdkSession?.setConfig) {
        await sdkSession.setConfig({
          thinking: enabled
            ? { type: 'adaptive' }
            : { type: 'disabled' },
        });
        console.log('[codebuddian] applyThinkingToSession — setConfig succeeded:', enabled);
      } else {
        console.warn('[codebuddian] applyThinkingToSession — SDK session has no setConfig method');
      }
    } catch (e) {
      console.error('[codebuddian] applyThinkingToSession — setConfig failed:', e);
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

  // =========================================================================
  // Model list management — reads directly from runtime, no plugin reference
  // =========================================================================

  /**
   * Refresh model list from runtime's cached models (synchronous).
   *
   * The runtime's `getCachedModels()` reads `this.settings.availableModels`
   * which is the SAME object reference as the plugin's `this.settings`,
   * so changes made in the Settings tab (Detect models) are immediately
   * visible here — no need to access the plugin at all.
   */
  private refreshModels(): void {
    if (!this.runtime) {
      console.log('[codebuddian] refreshModels — no runtime yet');
      return;
    }
    const cached = this.runtime.getCachedModels();
    console.log('[codebuddian] refreshModels — cached models from runtime:', cached.length);
    if (cached.length > 0) {
      this.models = [
        { id: '', label: 'Default' },
        ...cached.map(m => ({ id: m.id, label: m.name || m.id })),
      ];
      this.renderModelMenu();

      // Update model pill label if a model is selected
      const activeTab = this.stateManager.getActiveTab();
      if (activeTab?.model) {
        const modelLabel = this.models.find(m => m.id === activeTab.model)?.label ?? activeTab.model;
        this.modelBtnLabelEl.setText(modelLabel);
      }
    }
  }

  /**
   * Fetch live model list from the SDK session and update the selector.
   * Called after a session is established.
   */
  private async refreshModelsFromSDK(): Promise<void> {
    if (!this.runtime) return;

    try {
      const models = await this.runtime.getAvailableModels();
      if (models.length > 0) {
        this.models = [
          { id: '', label: 'Default' },
          ...models.map(m => ({ id: m.id, label: m.name || m.id })),
        ];
        this.renderModelMenu();

        const activeTab = this.stateManager.getActiveTab();
        if (activeTab?.model) {
          const modelLabel = this.models.find(m => m.id === activeTab.model)?.label ?? activeTab.model;
          this.modelBtnLabelEl.setText(modelLabel);
        }
        console.log(`[codebuddian] Loaded ${models.length} models from SDK:`,
          models.map(m => m.name).join(', '));
      }
    } catch (e) {
      console.warn('[codebuddian] refreshModelsFromSDK failed:', e);
    }
  }

  private renderModelMenu(): void {
    this.modelMenuEl.empty();
    console.log('[codebuddian] renderModelMenu — models count:', this.models.length);
    for (const m of this.models) {
      const item = this.modelMenuEl.createEl('button', {
        cls: 'codebuddian-pill-menu-item',
        attr: { 'data-value': m.id, type: 'button' },
      });
      item.setText(m.label);
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const tab = this.stateManager.getActiveTab();
        if (tab) {
          this.stateManager.updateTab(tab.id, { model: m.id });
          this.applyModelToSession(m.id);
          console.log('[codebuddian] Model selected:', m.id, m.label);
        }
        this.closeAllMenus();
      });
    }
  }

  private renderEffortMenu(): void {
    this.effortMenuEl.empty();
    for (const e of EFFORT_OPTIONS) {
      const item = this.effortMenuEl.createEl('button', {
        cls: 'codebuddian-pill-menu-item',
        attr: { 'data-value': e.id, type: 'button' },
      });
      item.setText(e.label);
      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const tab = this.stateManager.getActiveTab();
        if (tab) {
          this.stateManager.updateTab(tab.id, { effort: e.id });
          this.applyEffortToSession(e.id);
        }
        this.closeAllMenus();
      });
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
      // Model pill — use local this.models instead of global AVAILABLE_MODELS
      const modelLabel = this.models.find(m => m.id === activeTab.model)?.label ?? activeTab.model;
      this.modelBtnLabelEl.setText(modelLabel);

      // Effort pill
      const effortLabel = EFFORT_OPTIONS.find(e => e.id === activeTab.effort)?.label ?? activeTab.effort;
      this.effortBtnLabelEl.setText(effortLabel);

      // Mode dropdown — update button label/icon and active item
      const activeModeCfg = MODE_CONFIG.find(m => m.id === activeTab.mode) ?? MODE_CONFIG[0];
      const iconEl = this.modeBtnEl.querySelector('.codebuddian-mode-dropdown-icon') as HTMLElement | null;
      if (iconEl) {
        iconEl.empty();
        setIcon(iconEl, activeModeCfg.icon);
      }
      this.modeBtnLabelEl.setText(activeModeCfg.label);
      this.modeBtnEl.setAttribute('data-mode', activeModeCfg.id);

      // Highlight active item in mode menu
      this.modeMenuEl.querySelectorAll('.codebuddian-mode-menu-item').forEach((el) => {
        const isSelected = el.getAttribute('data-mode') === activeTab.mode;
        el.toggleClass('is-active', isSelected);
      });

      // Highlight active model item
      this.modelMenuEl.querySelectorAll('.codebuddian-pill-menu-item').forEach((el) => {
        const isSelected = el.getAttribute('data-value') === activeTab.model;
        el.toggleClass('is-active', isSelected);
      });

      // Highlight active effort item
      this.effortMenuEl.querySelectorAll('.codebuddian-pill-menu-item').forEach((el) => {
        const isSelected = el.getAttribute('data-value') === activeTab.effort;
        el.toggleClass('is-active', isSelected);
      });

      // Apply mode-specific wrapper class
      this.inputWrapperEl.removeClass('codebuddian-mode-ask', 'codebuddian-mode-plan', 'codebuddian-mode-craft');
      this.inputWrapperEl.addClass(`codebuddian-mode-${activeTab.mode}`);

      // Streaming state — update input controller, textarea, and send/stop button
      const isStreaming = activeTab.status === 'streaming';
      this.inputController.setStreaming(isStreaming);
      this.textareaEl.disabled = isStreaming;

      // Toggle send button between "send" (paper plane) and "stop" (square)
      this.sendButtonEl.toggleClass('is-stop', isStreaming);
      this.sendButtonEl.empty();
      setIcon(this.sendButtonEl, isStreaming ? 'square' : 'send');

      // Thinking button state
      this.thinkBtnEl?.toggleClass('is-active', activeTab.thinkingEnabled);
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
