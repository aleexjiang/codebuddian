import { Notice, Plugin } from 'obsidian';
import type { CodebuddianSettings } from './core/types/settings';
import { DEFAULT_SETTINGS } from './app/settings/defaultSettings';
import { CodebuddianChatView } from './features/chat/CodebuddianView';
import { CHAT_VIEW_TYPE } from './features/chat/constants';
import { CodebuddianSettingsTab } from './features/settings/CodebuddianSettingsTab';
import { ProviderRegistry } from './core/providers/ProviderRegistry';
import { ApprovalManager } from './core/security/ApprovalManager';
import { registerIcons } from './shared/icons';
import { setLocale } from './i18n/i18n';
import { logger, LogLevel } from './utils/logger';
import { createCodebuddyRegistration } from './providers/codebuddy/registration';
import { BUILT_IN_COMMANDS } from './core/commands/builtInCommands';

export class CodebuddianPlugin extends Plugin {
  settings: CodebuddianSettings = DEFAULT_SETTINGS;
  private providerRegistry: ProviderRegistry;
  private approvalManager: ApprovalManager;
  private chatView: CodebuddianChatView | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Setup logging
    logger.setLevel(this.settings.debugMode ? LogLevel.DEBUG : LogLevel.INFO);

    // Setup i18n
    const locale = window.navigator.language || 'en';
    setLocale(locale.startsWith('zh') ? 'zh-CN' : 'en');

    // Register icons
    registerIcons();

    // Init provider registry
    this.providerRegistry = new ProviderRegistry();
    this.approvalManager = new ApprovalManager();

    // Register CodeBuddy provider
    const vaultPath = (this.app.vault.adapter as any).getBasePath?.() ?? '';
    const codebuddyRegistration = createCodebuddyRegistration(
      () => this.settings,
      this.approvalManager,
      vaultPath,
    );
    this.providerRegistry.register(
      codebuddyRegistration.descriptor,
      () => codebuddyRegistration.factory(this.settings),
    );

    // Register chat view
    this.registerView(CHAT_VIEW_TYPE, (leaf) => {
      this.chatView = new CodebuddianChatView(leaf);
      const runtime = this.providerRegistry.getActive();
      if (runtime) {
        this.chatView.setRuntime(runtime);
      }
      return this.chatView;
    });

    // Register ribbon icon
    this.addRibbonIcon('message-circle', 'Codebuddian', () => {
      this.activateChatView();
    });

    // Register commands
    this.addCommand({
      id: 'codebuddian.open-chat',
      name: 'Open chat',
      callback: () => this.activateChatView(),
    });

    this.addCommand({
      id: 'codebuddian.new-chat',
      name: 'New chat tab',
      callback: () => {
        this.activateChatView();
        // Tab creation handled by TabManager
      },
    });

    this.addCommand({
      id: 'codebuddian.inline-edit',
      name: 'Inline edit selection',
      callback: () => this.handleInlineEdit(),
    });

    this.addCommand({
      id: 'codebuddian.toggle-plan-mode',
      name: 'Toggle plan mode',
      callback: () => {
        // Will be wired to ConversationController
        new Notice('Plan mode toggled');
      },
    });

    this.addCommand({
      id: 'codebuddian.cancel-current-turn',
      name: 'Cancel current turn',
      callback: () => {
        new Notice('Current turn cancelled');
      },
    });

    // Settings tab
    this.addSettingTab(new CodebuddianSettingsTab(this.app, this));

    logger.info('Codebuddian plugin loaded');
  }

  async onunload(): Promise<void> {
    await this.providerRegistry.disposeAll();
    this.chatView = null;
    logger.info('Codebuddian plugin unloaded');
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async activateChatView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({ type: CHAT_VIEW_TYPE, active: true });
        leaf = rightLeaf;
      }
    } else {
      workspace.revealLeaf(leaf);
    }
  }

  private async handleInlineEdit(): Promise<void> {
    const activeView = this.app.workspace.getActiveViewOfType(
      (await import('obsidian')).MarkdownView,
    );
    if (!activeView) {
      new Notice('No active markdown view');
      return;
    }

    const selection = activeView.editor.getSelection();
    if (!selection) {
      new Notice('No text selected');
      return;
    }

    // For now, use a simple prompt modal
    // TODO: Implement a proper prompt input modal
    const prompt = 'Improve this text';

    const { InlineEditModal } = await import('./features/inline-edit/ui/InlineEditModal');
    const vaultPath = (this.app.vault.adapter as any).getBasePath?.() ?? '';
    const cliPath = this.settings.cliPath || 'codebuddy';

    const modal = new InlineEditModal(this.app, {
      originalText: selection,
      prompt,
      settings: this.settings,
      cliPath,
      vaultPath,
      onApply: (newText: string) => {
        activeView.editor.replaceSelection(newText);
        new Notice('Changes applied');
      },
    });

    modal.open();
  }
}

export default CodebuddianPlugin;
