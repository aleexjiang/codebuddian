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
        // System messages: plain text, no markdown
        contentEl.setText(message.content);
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
    for (const message of messages) {
      this.renderMessage(message);
    }
  }
}
