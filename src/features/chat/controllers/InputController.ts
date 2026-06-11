import type { ConversationController } from './ConversationController';
import type { ChatStateManager } from '../state/ChatState';
import type { Mention } from '../../../core/types';

export class InputController {
  private textareaEl: HTMLTextAreaElement;
  private sendButtonEl: HTMLButtonElement;
  private conversationController: ConversationController;
  private stateManager: ChatStateManager;
  private isStreaming = false;
  private onCancel: (() => void) | null = null;

  constructor(
    textareaEl: HTMLTextAreaElement,
    sendButtonEl: HTMLButtonElement,
    conversationController: ConversationController,
    stateManager: ChatStateManager,
  ) {
    this.textareaEl = textareaEl;
    this.sendButtonEl = sendButtonEl;
    this.conversationController = conversationController;
    this.stateManager = stateManager;

    this.setupListeners();
  }

  private setupListeners(): void {
    // Send on Enter (Shift+Enter for newline)
    this.textareaEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Send / Stop button — behaviour toggles based on streaming state
    this.sendButtonEl.addEventListener('click', () => {
      this.handleSend();
    });

    // Track input value
    this.textareaEl.addEventListener('input', () => {
      this.stateManager.setInputValue(this.textareaEl.value);
      this.autoResize();
    });
  }

  /**
   * Called by the view whenever the streaming state changes.
   */
  setStreaming(isStreaming: boolean): void {
    this.isStreaming = isStreaming;
  }

  /**
   * Provide a cancel callback so the send button can act as a stop button
   * while the agent is streaming a response.
   */
  setOnCancel(cb: (() => void) | null): void {
    this.onCancel = cb;
  }

  private handleSend(): void {
    // While streaming the button acts as a STOP button
    if (this.isStreaming) {
      this.onCancel?.();
      return;
    }

    const text = this.textareaEl.value.trim();
    if (!text) return;

    // Parse mentions from text
    const mentions = this.parseMentions(text);

    // Parse instruction from # prefix
    const instruction = this.parseInstruction(text);

    // Clean text (remove #instruction prefix for display)
    const cleanText = this.cleanInputText(text, instruction);

    this.conversationController.sendMessage(cleanText, mentions.length > 0 ? mentions : undefined, instruction || undefined);

    this.textareaEl.value = '';
    this.stateManager.setInputValue('');
    this.resetHeight();
  }

  private parseMentions(text: string): Mention[] {
    const mentions: Mention[] = [];
    const mentionRegex = /@(\S+)/g;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const ref = match[1];
      if (ref.startsWith('mcp:')) {
        mentions.push({ type: 'mcp', ref: ref.slice(4) });
      } else if (ref.startsWith('agent:')) {
        mentions.push({ type: 'agent', ref: ref.slice(6) });
      } else if (ref.startsWith('dir:')) {
        mentions.push({ type: 'extDir', ref: ref.slice(4) });
      } else {
        mentions.push({ type: 'file', ref });
      }
    }

    return mentions;
  }

  private parseInstruction(text: string): string | null {
    const instructionMatch = text.match(/^#(.+?)(?:\n|$)/);
    return instructionMatch ? instructionMatch[1].trim() : null;
  }

  private cleanInputText(text: string, instruction: string | null): string {
    if (!instruction) return text;
    return text.replace(/^#.+?(?:\n|$)/, '').trim() || text;
  }

  private autoResize(): void {
    this.textareaEl.style.height = 'auto';
    this.textareaEl.style.height = Math.min(this.textareaEl.scrollHeight, 200) + 'px';
  }

  private resetHeight(): void {
    this.textareaEl.style.height = '';
  }

  focus(): void {
    this.textareaEl.focus();
  }

  setValue(value: string): void {
    this.textareaEl.value = value;
    this.autoResize();
  }
}
