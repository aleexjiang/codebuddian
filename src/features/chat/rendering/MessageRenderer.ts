import { MarkdownRenderer, Component, App, setIcon } from 'obsidian';
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
  // Streaming indicator element (managed separately from full re-render)
  indicatorEl: HTMLElement | null;
  // Thinking block element for updating content without full re-render
  thinkingEl: HTMLElement | null;
}

export class MessageRenderer {
  private containerEl: HTMLElement;
  private component: Component;
  private app: App;
  private rendered = new Map<string, RenderedMessage>();
  private hasWelcome = false;
  // Track expanded/collapsed state of thinking blocks per message
  private thinkingExpanded = new Map<string, boolean>();

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
      toolCount,
      toolStatuses,
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
        // Signature matches — fast path
        const msgBubble = existing.el.querySelector('.codebuddian-message-assistant, .codebuddian-message-user, .codebuddian-message-system') as HTMLElement | null;
        const target = msgBubble || existing.el;

        // Ensure contentEl exists (it may have been skipped if initial content was empty)
        if (!existing.contentEl && message.content != null) {
          existing.contentEl = target.createDiv({ cls: 'codebuddian-message-content' });
        }

        if (existing.contentEl) {
          const contentChanged = message.content !== existing.lastContent;
          const streamStateChanged = message.role === 'assistant' && message.isStreaming !== existing.isStreamingRender;

          if (contentChanged || streamStateChanged) {
            if (message.role === 'assistant' && message.isStreaming) {
              // Streaming: just update text, no markdown render (avoid flicker)
              existing.contentEl.textContent = message.content;
              existing.isStreamingRender = true;
            } else if (message.role === 'assistant' && !message.isStreaming) {
              // Stream finished (or switched from streaming to final): re-render with markdown
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
        }

        // Fast path: update thinking content without full re-render
        if (message.thinkingContent && existing.thinkingEl) {
          const thinkContentEl = existing.thinkingEl.querySelector('.codebuddian-thinking-content') as HTMLElement | null;
          if (thinkContentEl) {
            thinkContentEl.textContent = message.thinkingContent;
          }
        }

        prevEl = existing.el;
      }
    }

    // Remove stale messages no longer in the list
    for (const [id, rendered] of this.rendered) {
      if (!seenIds.has(id)) {
        this.removeIndicator(rendered);
        rendered.el.remove();
        this.rendered.delete(id);
        this.thinkingExpanded.delete(id);
      }
    }

    // Sync streaming indicators AFTER diff
    for (const message of messages) {
      const rendered = this.rendered.get(message.id);
      if (!rendered) continue;
      if (message.isStreaming && message.role === 'assistant') {
        this.ensureIndicator(rendered);
      } else {
        this.removeIndicator(rendered);
      }
    }
  }

  /** Full render of a single message (build all DOM). */
  private fullRender(message: ChatMessage): RenderedMessage | null {
    if (message.role === 'system' && (!message.content || message.content.trim().length === 0)) {
      return null;
    }

    // Create row: avatar + message bubble
    const rowEl = this.containerEl.createDiv({
      cls: `codebuddian-message-row codebuddian-message-row-${message.role}`,
    });

    // Avatar (only for user and assistant)
    if (message.role === 'user' || message.role === 'assistant') {
      const avatarEl = rowEl.createDiv({
        cls: `codebuddian-message-avatar codebuddian-message-avatar-${message.role}`,
      });
      if (message.role === 'user') {
        setIcon(avatarEl, 'user');
      } else {
        // Bot icon — inline SVG since 'bot' may not exist in Obsidian's lucide set
        avatarEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><circle cx="8" cy="15" r="1.5"/><circle cx="16" cy="15" r="1.5"/></svg>`;
      }
    }

    // Message bubble
    const msgEl = rowEl.createDiv({
      cls: `codebuddian-message codebuddian-message-${message.role}`,
    });

    // Thinking content (collapsible, Claudian-style)
    let thinkingEl: HTMLElement | null = null;
    if (message.thinkingContent) {
      thinkingEl = this.renderThinkingBlock(msgEl, message);
    }

    // Main content — always create the element so fast-path updates work
    let contentEl: HTMLElement | null = null;
    let isStreamingRender = false;
    if (message.content != null) {
      contentEl = msgEl.createDiv({ cls: 'codebuddian-message-content' });
      if (message.role === 'assistant') {
        if (message.isStreaming) {
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

    return {
      el: rowEl,
      contentEl,
      signature: this.buildSignature(message),
      lastContent: message.content,
      isStreamingRender,
      indicatorEl: null,
      thinkingEl,
    };
  }

  /** Render a collapsible thinking block (Claudian-style). */
  private renderThinkingBlock(parentEl: HTMLElement, message: ChatMessage): HTMLElement {
    const isExpanded = this.thinkingExpanded.get(message.id) ?? false;

    const thinkingEl = parentEl.createDiv({
      cls: `codebuddian-thinking ${isExpanded ? 'is-expanded' : ''}`,
    });

    const toggleBtn = thinkingEl.createEl('button', {
      cls: 'codebuddian-thinking-toggle',
      attr: { type: 'button' },
    });

    const thinkIcon = toggleBtn.createSpan({ cls: 'codebuddian-thinking-toggle-icon' });
    setIcon(thinkIcon, 'sparkles');

    // Label: "Thought for Xs" or just "Thinking" while streaming
    const labelSpan = toggleBtn.createSpan({ text: 'Thought' });

    // Duration badge (placeholder — can be enhanced with real duration tracking)
    const durationSpan = toggleBtn.createSpan({ cls: 'codebuddian-thinking-duration' });
    durationSpan.setText(message.isStreaming ? '' : ' • done');

    const caretSpan = toggleBtn.createSpan({ cls: 'codebuddian-thinking-toggle-caret' });
    setIcon(caretSpan, 'chevron-down');

    // Content
    const contentEl = thinkingEl.createDiv({
      cls: 'codebuddian-thinking-content',
      text: message.thinkingContent ?? '',
    });

    // Toggle handler
    toggleBtn.addEventListener('click', () => {
      const expanded = thinkingEl.hasClass('is-expanded');
      thinkingEl.toggleClass('is-expanded', !expanded);
      this.thinkingExpanded.set(message.id, !expanded);
    });

    return thinkingEl;
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

    const tip1 = tipsEl.createDiv({ cls: 'codebuddian-welcome-tip' });
    const tip1Icon = tip1.createSpan({ cls: 'codebuddian-welcome-tip-icon' });
    setIcon(tip1Icon, 'at-sign');
    tip1.createSpan({ text: 'Use @ to mention files, # for instructions' });

    const tip2 = tipsEl.createDiv({ cls: 'codebuddian-welcome-tip' });
    const tip2Icon = tip2.createSpan({ cls: 'codebuddian-welcome-tip-icon' });
    setIcon(tip2Icon, 'cb-keyboard');
    tip2.createSpan({ text: 'Enter to send, Shift+Enter for newline' });

    const tip3 = tipsEl.createDiv({ cls: 'codebuddian-welcome-tip' });
    const tip3Icon = tip3.createSpan({ cls: 'codebuddian-welcome-tip-icon' });
    setIcon(tip3Icon, 'cb-status-stop');
    tip3.createSpan({ text: 'Esc to stop generation' });
  }

  /** Reset all cached state (called when switching tabs). */
  reset(): void {
    for (const rendered of this.rendered.values()) {
      this.removeIndicator(rendered);
    }
    this.containerEl.empty();
    this.rendered.clear();
    this.thinkingExpanded.clear();
    this.hasWelcome = false;
  }

  /** Create a streaming indicator on a message element (idempotent). */
  private ensureIndicator(rendered: RenderedMessage): void {
    if (rendered.indicatorEl) return;
    // Place indicator inside the message bubble, not the row
    const msgBubble = rendered.el.querySelector('.codebuddian-message-assistant') as HTMLElement | null;
    const target = msgBubble || rendered.el;
    const streamEl = target.createDiv({ cls: 'codebuddian-streaming-indicator' });
    streamEl.createSpan({ cls: 'codebuddian-dot' });
    streamEl.createSpan({ cls: 'codebuddian-dot' });
    streamEl.createSpan({ cls: 'codebuddian-dot' });
    rendered.indicatorEl = streamEl;
  }

  /** Remove streaming indicator if present. */
  private removeIndicator(rendered: RenderedMessage): void {
    if (rendered.indicatorEl) {
      rendered.indicatorEl.remove();
      rendered.indicatorEl = null;
    }
  }
}
