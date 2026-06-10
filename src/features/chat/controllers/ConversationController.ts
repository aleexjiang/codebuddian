import type { ChatStateManager } from '../state/ChatState';
import type { ChatRuntime } from '../../../core/runtime/ChatRuntime';
import type { SessionHandle } from '../../../core/runtime/types';
import type { UserInput, ChatMessage, PermissionMode } from '../../../core/types';
import { StreamController } from './StreamController';

export class ConversationController {
  private sessionHandle: SessionHandle | null = null;
  private streamController: StreamController;
  private runtime: ChatRuntime | null = null;

  constructor(private stateManager: ChatStateManager) {
    this.streamController = new StreamController(stateManager);
  }

  setRuntime(runtime: ChatRuntime): void {
    this.runtime = runtime;
  }

  async sendMessage(text: string, mentions?: UserInput['mentions'], instruction?: string): Promise<void> {
    const tab = this.stateManager.getActiveTab();
    if (!tab) return;

    // Add user message to UI
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      mentions,
      instruction,
    };
    this.stateManager.addMessage(tab.id, userMsg);

    // Add placeholder assistant message
    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now() + 1,
      isStreaming: true,
    };
    this.stateManager.addMessage(tab.id, assistantMsg);
    this.stateManager.updateTab(tab.id, { status: 'streaming' });

    // Start session if needed
    if (!this.sessionHandle && this.runtime) {
      try {
        this.sessionHandle = await this.runtime.start({
          cwd: '', // Will be set by main.ts
          model: tab.model || undefined,
          effort: tab.effort || undefined,
          permissionMode: tab.permissionMode,
        });
        this.setupEventListeners(tab.id);
      } catch (err) {
        this.stateManager.updateTab(tab.id, { status: 'error' });
        const errorMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'system',
          content: `❌ Failed to start session: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        };
        this.stateManager.addMessage(tab.id, errorMsg);
        return;
      }
    }

    // Send the message
    const input: UserInput = { text, mentions, instruction };
    this.streamController.startNewTurn();

    try {
      await this.sessionHandle?.send(input);
    } catch (err) {
      this.stateManager.updateTab(tab.id, { status: 'error' });
    }
  }

  async cancel(): Promise<void> {
    const tab = this.stateManager.getActiveTab();
    if (!tab) return;

    try {
      await this.sessionHandle?.cancel();
    } catch (e) {
      // Ignore interrupt errors
    }

    // Finalize any streaming assistant message
    this.streamController.finalizeOnCancel(tab.id);

    // Add interrupted system message
    const interruptedMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'system',
      content: '⏹ Interrupted · What should CodeBuddy do instead?',
      timestamp: Date.now(),
    };
    this.stateManager.addMessage(tab.id, interruptedMsg);
    this.stateManager.updateTab(tab.id, { status: 'idle' });
  }

  async togglePlanMode(): Promise<boolean> {
    const tab = this.stateManager.getActiveTab();
    if (!tab) return false;

    const newPlanMode = !tab.isPlanMode;
    const newPermissionMode: PermissionMode = newPlanMode ? 'plan' : 'default';

    this.stateManager.updateTab(tab.id, {
      isPlanMode: newPlanMode,
      permissionMode: newPermissionMode,
    });

    // If we have an active SDK session, update its permission mode
    if (this.sessionHandle && this.runtime) {
      try {
        const sdkSession = this.runtime.getSdkSession();
        if (sdkSession) {
          await sdkSession.setPermissionMode(newPermissionMode as 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions');
        }
      } catch (e) {
        // Session might not be connected yet — settings will apply on next start
      }
    }

    return newPlanMode;
  }

  private setupEventListeners(tabId: string): void {
    if (!this.sessionHandle) return;

    this.sessionHandle.on('*', (event) => {
      this.streamController.handleEvent(tabId, event);
    });
  }

  getSession(): SessionHandle | null {
    return this.sessionHandle;
  }

  async dispose(): Promise<void> {
    await this.sessionHandle?.close();
    this.sessionHandle = null;
  }
}
