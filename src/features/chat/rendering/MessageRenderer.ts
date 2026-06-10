import { MarkdownRenderer, Component, App } from 'obsidian';
import type { ChatMessage } from '../../../core/types';
import { ToolCallRenderer } from './ToolCallRenderer';

interface RenderedMessage {
  el: HTMLElement;
  contentEl: HTMLElement | null;
  // Hash of "stable" fields to detect when full re-render is needed
  signature: string;
  // Last rendered content (for streaming text fast-path)
  lastContent: string;
  // Whether currently rendered as streaming (raw text) vs final (markdown)
  isStreamingRender: boolean;
}

export class MessageRenderer {
  private containerEl: HTMLElement;
  private component: Component;
  private app: App;
  private rendered = new Map<string, RenderedMessage>();
  private hasWelcome = false;

  constructor(containerEl: HTMLElement, component: Component, app: App) {
    this.containerEl = containerEl;
    this.component = component;
    this.app = app;
  }

  /** Build a signature for fields that, when changed, require full re-render. */
  private buildSignature(message: ChatMessage): string {
    const toolCount = message.toolCalls?.length ?? 0;
    const toolStatuses = message.toolCalls?.map(t => `${t.id}:${t.status}`).join('|') ?? '';
    return [
      message.role,
      message.thinkingContent ?? '',
      toolCount,
      toolStatuses,
      message.isStreaming ? 'S' : 'F',
    ].join('::');
  }

  renderMessages(messages: ChatMessage[]): void {
    // Empty state
    if (messages.length === 0) {
      if (!this.hasWelcome) {
        this.containerEl.empty();
        this.rendered.clear();
        this.renderWelcome();
        this.hasWelcome = true;
      }
      return;
    }

    // Clear welcome state if leaving empty
    if (this.hasWelcome) {
      this.containerEl.empty();
      this.hasWelcome = false;
    }

    // Diff-based render: keep elements where possible, only update what changed
    const seenIds = new Set<string>();
    let prevEl: HTMLElement | null = null;

    for (const message of messages) {
      // Skip empty system messages
      if (message.role === 'system' && (!message.content || message.content.trim().length === 0)) {
        continue;
      }

      seenIds.add(message.id);
      const existing = this.rendered.get(message.id);
      const signature = this.buildSignature(message);

      if (!existing || existing.signature !== signature) {
        // Need full re-render of this message
        if (existing) {
          existing.el.remove();
        }
        const newRendered = this.fullRender(message);
        if (newRendered) {
          // Insert in correct DOM position (after prevEl, or at start)
          if (prevEl && prevEl.nextSibling) {
            this.containerEl.insertBefore(newRendered.el, prevEl.nextSibling);
          } else if (!prevEl) {
            this.containerEl.prepend(newRendered.el);
          }
          // else: appended by createDiv default
          this.rendered.set(message.id, newRendered);
          prevEl = newRendered.el;
        }
      } else {
        // Signature matches — fast path: only update content if it changed
        if (message.content !== existing.lastContent && existing.contentEl) {
          if (message.role === 'assistant' && message.isStreaming) {
            // Streaming: just update text, no markdown render (avoid flicker)
            existing.contentEl.textContent = message.content;
            existing.isStreamingRender = true;
          } else if (message.role === 'assistant' && !message.isStreaming) {
            // Stream finished: re-render with markdown
            existing.contentEl.empty();
            MarkdownRenderer.render(
              this.app,
              message.content,
              existing.contentEl,
              '',
              this.component,
            );
            existing.isStreamingRender = false;
          } else {
            existing.contentEl.textContent = message.content;
          }
          existing.lastContent = message.content;
        }
        prevEl = existing.el;
      }
    }

    // Remove stale messages no longer in the list
    for (const [id, rendered] of this.rendered) {
      if (!seenIds.has(id)) {
        rendered.el.remove();
        this.rendered.delete(id);
      }
    }
  }

  /** Full render of a single message (build all DOM). */
  private fullRender(message: ChatMessage): RenderedMessage | null {
    if (message.role === 'system' && (!message.content || message.content.trim().length === 0)) {
      return null;
    }

    const msgEl = this.containerEl.createDiv({
      cls: `codebuddian-message codebuddian-message-${message.role}`,
    });

    // Header
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
    let contentEl: HTMLElement | null = null;
    let isStreamingRender = false;
    if (message.content) {
      contentEl = msgEl.createDiv({ cls: 'codebuddian-message-content' });
      if (message.role === 'assistant') {
        if (message.isStreaming) {
          // Streaming: plain text (markdown comes at finalization)
          contentEl.textContent = message.content;
          isStreamingRender = true;
        } else {
          MarkdownRenderer.render(
            this.app,
            message.content,
            contentEl,
            '',
            this.component,
          );
        }
      } else if (message.role === 'system') {
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

    // Streaming indicator (separate element so we can leave content alone)
    if (message.isStreaming) {
      const streamEl = msgEl.createDiv({ cls: 'codebuddian-streaming-indicator' });
      streamEl.createSpan({ text: '●' });
      streamEl.createSpan({ text: '●' });
      streamEl.createSpan({ text: '●' });
    }

    return {
      el: msgEl,
      contentEl,
      signature: this.buildSignature(message),
      lastContent: message.content,
      isStreamingRender,
    };
  }

  private renderWelcome(): void {
    const welcome = this.containerEl.createDiv({ cls: 'codebuddian-welcome' });

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

    welcome.createDiv({
      cls: 'codebuddian-welcome-greeting',
      text: 'How can I help you today?',
    });

    const tipsEl = welcome.createDiv({ cls: 'codebuddian-welcome-tips' });
    tipsEl.createDiv({ text: '💡 Use @ to mention files, # for instructions' });
    tipsEl.createDiv({ text: '⌘ Press Enter to send, Shift+Enter for newline' });
    tipsEl.createDiv({ text: '🛑 Press Esc to stop generation' });
  }

  /** Reset all cached state (called when switching tabs). */
  reset(): void {
    this.containerEl.empty();
    this.rendered.clear();
    this.hasWelcome = false;
  }
}
