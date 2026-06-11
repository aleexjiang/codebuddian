import type { ChatStateManager } from '../state/ChatState';
import type { ChatRuntime } from '../../../core/runtime/ChatRuntime';
import type { SessionHandle } from '../../../core/runtime/types';
import type { UserInput, ChatMessage, PermissionMode } from '../../../core/types';
import type { ChatMode } from '../state/types';
import { StreamController } from './StreamController';

const MODE_TO_PERMISSION: Record<ChatMode, PermissionMode> = {
  ask: 'default',
  plan: 'plan',
  craft: 'acceptEdits',
};

export class ConversationController {
  private sessionHandle: SessionHandle | null = null;
  private streamController: StreamController;
  private runtime: ChatRuntime | null = null;
  /** Callback fired once after a session is successfully created. */
  onSessionCreated: (() => void) | null = null;

  constructor(private stateManager: ChatStateManager) {
    this.streamController = new StreamController(stateManager);
  }

  setRuntime(runtime: ChatRuntime): void {
    this.runtime = runtime;
  }

  async sendMessage(text: string, mentions?: UserInput['mentions'], instruction?: string): Promise<void> {
    // Auto-create a tab if none exists (e.g. first message from default view)
    let tab = this.stateManager.getActiveTab();
    if (!tab) {
      tab = this.stateManager.addTab();
    }

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
          thinkingEnabled: tab.thinkingEnabled,
          permissionMode: tab.permissionMode,
        });
        this.setupEventListeners(tab.id);
        // Notify view that a session is available (for model list loading etc.)
        this.onSessionCreated?.();
      } catch (err) {
        this.stateManager.updateTab(tab.id, { status: 'error' });

        // Get rich diagnostic from runtime if available
        let diagnostic = err instanceof Error ? err.message : String(err);
        const runtime = this.runtime as ChatRuntime & {
          getConnectionFailureDiagnostic?(e: Error): string;
        };
        if (runtime.getConnectionFailureDiagnostic && err instanceof Error) {
          try {
            diagnostic = runtime.getConnectionFailureDiagnostic(err);
          } catch {
            // fallback to original
          }
        }

        const errorMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'system',
          content: `Failed to start session\n\n${diagnostic}`,
          timestamp: Date.now(),
        };
        this.stateManager.addMessage(tab.id, errorMsg);

        // Also remove the streaming placeholder so user sees clean state
        return;
      }
    }

    // Send the message
    const input: UserInput = { text, mentions, instruction };
    this.streamController.startNewTurn();

    try {
      await this.sessionHandle?.send(input);
    } catch (err) {
      // The session may have been broken after a cancel/interrupt.
      // Try to recreate the session and resend.
      logger.warn('[ConversationController] Send failed, attempting session recovery:', err);
      try {
        await this.sessionHandle?.close();
      } catch {}
      this.sessionHandle = null;

      if (this.runtime) {
        try {
          this.sessionHandle = await this.runtime.start({
            cwd: '',
            model: tab.model || undefined,
            effort: tab.effort || undefined,
            thinkingEnabled: tab.thinkingEnabled,
            permissionMode: tab.permissionMode,
          });
          this.setupEventListeners(tab.id);
          this.onSessionCreated?.();
          await this.sessionHandle.send(input);
        } catch (retryErr) {
          this.stateManager.updateTab(tab.id, { status: 'error' });
          const errorMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'system',
            content: `Failed to reconnect session: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
            timestamp: Date.now(),
          };
          this.stateManager.addMessage(tab.id, errorMsg);
        }
      } else {
        this.stateManager.updateTab(tab.id, { status: 'error' });
      }
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
      content: 'Interrupted. What should CodeBuddy do instead?',
      timestamp: Date.now(),
    };
    this.stateManager.addMessage(tab.id, interruptedMsg);
    this.stateManager.updateTab(tab.id, { status: 'idle' });
  }

  async setMode(mode: ChatMode): Promise<void> {
    const tab = this.stateManager.getActiveTab();
    if (!tab) return;

    const permissionMode = MODE_TO_PERMISSION[mode];

    this.stateManager.updateTab(tab.id, {
      mode,
      permissionMode,
    });

    // If we have an active SDK session, update its permission mode
    if (this.sessionHandle && this.runtime) {
      try {
        const sdkSession = this.runtime.getSdkSession();
        if (sdkSession) {
          await (sdkSession as { setPermissionMode?(m: string): Promise<void> }).setPermissionMode!(permissionMode);
        }
      } catch (e) {
        // Session might not be connected yet — settings will apply on next start
      }
    }
  }

  /**
   * Switch the model for the current tab's session.
   *
   * Strategy: the SDK's `setModel()` control request is not reliably applied
   * to the active conversation by all CLI versions (the model may only affect
   * the next *new* session).  To guarantee the switch while preserving history,
   * we close the current session and resume it with the new model via
   * `resumeSdkSession(sessionId, { model: newModel })`.  The CLI restores the
   * conversation history from the server-side session store and continues with
   * the requested model.
   */
  async switchModel(model: string): Promise<boolean> {
    const tab = this.stateManager.getActiveTab();
    if (!tab) return false;

    // Update tab state first so the UI reflects the change immediately
    this.stateManager.updateTab(tab.id, { model });

    // If no session exists yet, the model will be picked up when the
    // session is first created in sendMessage()
    if (!this.sessionHandle || !this.runtime) return true;

    // Capture the current session ID before closing
    const oldSessionId = this.sessionHandle.sessionId;
    console.log('[codebuddian] switchModel — closing session:', oldSessionId);

    // Close the old session (releases lock, kills CLI process)
    try {
      await this.sessionHandle.close();
    } catch {
      // ignore close errors
    }
    this.sessionHandle = null;

    // Resume the session with the new model.  The CLI restores conversation
    // history from the server-side store and continues with the new model.
    try {
      this.sessionHandle = await this.runtime.start({
        cwd: '',
        resume: oldSessionId,
        model: tab.model || undefined,
        effort: tab.effort || undefined,
        thinkingEnabled: tab.thinkingEnabled,
        permissionMode: tab.permissionMode,
      });
      this.setupEventListeners(tab.id);
      this.onSessionCreated?.();
      console.log('[codebuddian] switchModel — session resumed with model:', model, 'id:', this.sessionHandle.sessionId);
      return true;
    } catch (e) {
      console.error('[codebuddian] switchModel — failed to resume session:', e);
      this.stateManager.updateTab(tab.id, { status: 'error' });
      return false;
    }
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
