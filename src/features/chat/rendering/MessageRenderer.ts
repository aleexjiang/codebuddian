import { MarkdownRenderer, Component, App } from 'obsidian';
import type { ChatMessage } from '../../../core/types';
import { ToolCallRenderer } from './ToolCallRenderer';

export class MessageRenderer {
  private containerEl: HTMLElement;
  private component: Component;
  private app: App;

  constructor(containerEl: HTMLElement, component: Component, app: App) {
    this.containerEl = containerEl;
    this.component = component;
    this.app = app;
  }

  renderMessage(message: ChatMessage): HTMLElement | null {
    // Skip empty system messages (e.g. SDK init messages with no content)
    if (message.role === 'system' && (!message.content || message.content.trim().length === 0)) {
      return null;
    }

    const msgEl = this.containerEl.createDiv({
      cls: `codebuddian-message codebuddian-message-${message.role}`,
    });

    // Header (skip for minimal system messages)
    const headerEl = msgEl.createDiv({ cls: 'codebuddian-message-header' });
    const roleLabel = message.role === 'user' ? '👤 You'
      : message.role === 'assistant' ? '🤖 CodeBuddy'
      : '💡';
    headerEl.createSpan({ text: roleLabel, cls: 'codebuddian-message-role' });
    headerEl.createSpan({
      text: new Date(message.timestamp).toLocaleTimeString(),
      cls: 'codebuddian-message-time',
    });

    // Thinking content
    if (message.thinkingContent) {
      const thinkingEl = msgEl.createDiv({ cls: 'codebuddian-thinking' });
      thinkingEl.createDiv({ cls: 'codebuddian-thinking-header', text: '💭 Thinking' });
      thinkingEl.createDiv({ cls: 'codebuddian-thinking-content', text: message.thinkingContent });
    }

    // Main content
    if (message.content) {
      const contentEl = msgEl.createDiv({ cls: 'codebuddian-message-content' });
      // Use Obsidian's markdown renderer for assistant messages
      if (message.role === 'assistant') {
        MarkdownRenderer.render(
          this.app,
          message.content,
          contentEl,
          '',
          this.component,
        );
      } else if (message.role === 'system') {
        // System messages: preserve newlines, render as preformatted text for
        // multi-line diagnostics (e.g. connection failure with stderr dump)
        const isMultiline = message.content.includes('\n');
        if (isMultiline) {
          const pre = contentEl.createEl('pre', { cls: 'codebuddian-message-system-pre' });
          pre.createEl('code', { text: message.content });
        } else {
          contentEl.setText(message.content);
        }
      } else {
        contentEl.setText(message.content);
      }
    }

    // Tool calls
    if (message.toolCalls && message.toolCalls.length > 0) {
      const toolRenderer = new ToolCallRenderer(msgEl);
      for (const toolCall of message.toolCalls) {
        toolRenderer.render(toolCall);
      }
    }

    // Streaming indicator
    if (message.isStreaming) {
      const streamEl = msgEl.createDiv({ cls: 'codebuddian-streaming-indicator' });
      streamEl.createSpan({ text: '●' });
      streamEl.createSpan({ text: '●' });
      streamEl.createSpan({ text: '●' });
    }

    return msgEl;
  }

  renderMessages(messages: ChatMessage[]): void {
    this.containerEl.empty();

    // Empty state: show welcome when no messages
    if (messages.length === 0) {
      this.renderWelcome();
      return;
    }

    for (const message of messages) {
      this.renderMessage(message);
    }
  }

  private renderWelcome(): void {
    const welcome = this.containerEl.createDiv({ cls: 'codebuddian-welcome' });

    // Logo
    const logoWrap = welcome.createDiv({ cls: 'codebuddian-welcome-logo' });
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '48');
    svg.setAttribute('height', '48');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M12 2a2 2 0 0 1 2 2v2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4V4a2 2 0 0 1 2-2zm-5 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z');
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    logoWrap.appendChild(svg);

    // Greeting
    welcome.createDiv({
      cls: 'codebuddian-welcome-greeting',
      text: 'How can I help you today?',
    });

    // Tips
    const tipsEl = welcome.createDiv({ cls: 'codebuddian-welcome-tips' });
    tipsEl.createDiv({ text: '💡 Use @ to mention files, # for instructions' });
    tipsEl.createDiv({ text: '⌘ Press Enter to send, Shift+Enter for newline' });
    tipsEl.createDiv({ text: '🛑 Press Esc to stop generation' });
  }
}
