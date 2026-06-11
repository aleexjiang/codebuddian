import { setIcon } from 'obsidian';
import { TOOL_ICONS } from '../../../core/tools/toolIcons';
import { formatToolInput } from '../../../core/tools/toolInput';
import { formatToolResult } from '../../../core/tools/toolResultContent';
import type { ToolCall, ToolResult } from '../../../core/types';

const STATUS_ICON: Record<string, string> = {
  pending: 'cb-status-pending',
  running: 'cb-status-running',
  completed: 'cb-status-completed',
  error: 'cb-status-error',
  approval_needed: 'cb-status-warning',
};

/** Extract file path from tool args for display as a reference tag. */
function extractFileRef(args: Record<string, unknown>): string | null {
  const candidates = [
    args.file_path,
    args.path,
    args.filePath,
    args.file,
    args.target,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  // Some tools have args like { file: { path: '...' } }
  const nested = args.file as Record<string, unknown> | undefined;
  if (nested && typeof nested.path === 'string') return nested.path;
  return null;
}

export class ToolCallRenderer {
  private containerEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }

  render(toolCall: ToolCall, result?: ToolResult): HTMLElement {
    const el = this.containerEl.createDiv({ cls: 'codebuddian-tool-call' });

    // Header
    const headerEl = el.createDiv({ cls: 'codebuddian-tool-header' });
    const nameSpan = headerEl.createSpan({ cls: 'codebuddian-tool-name' });
    const toolIcon = nameSpan.createSpan({ cls: 'codebuddian-tool-name-icon' });
    const iconName = TOOL_ICONS[toolCall.tool] || 'cb-wrench';
    setIcon(toolIcon, iconName);
    nameSpan.createSpan({ text: toolCall.tool });

    // File reference tag (Claudian-style)
    const fileRef = extractFileRef(toolCall.args);
    if (fileRef) {
      const tagEl = headerEl.createSpan({ cls: 'codebuddian-tool-file-tag' });
      const tagIcon = tagEl.createSpan({ cls: 'codebuddian-tool-file-tag-icon' });
      setIcon(tagIcon, 'file-text');
      tagEl.createSpan({ text: fileRef.split('/').pop() || fileRef });
    }

    // Status badge
    const statusSpan = headerEl.createSpan({
      cls: `codebuddian-tool-status codebuddian-tool-status-${toolCall.status}`,
      attr: { 'aria-label': `Status: ${toolCall.status}` },
    });
    const statusIcon = statusSpan.createSpan({ cls: 'codebuddian-tool-status-icon' });
    setIcon(statusIcon, STATUS_ICON[toolCall.status] || 'cb-status-pending');

    // Args (collapsible)
    const argsEl = el.createDiv({ cls: 'codebuddian-tool-args' });
    const inputStr = formatToolInput(toolCall.tool, toolCall.args);
    const argsPre = argsEl.createEl('pre', { cls: 'codebuddian-tool-args-pre' });
    argsPre.createEl('code', { text: inputStr });

    // Result (if available)
    if (result) {
      const resultEl = el.createDiv({ cls: 'codebuddian-tool-result' });
      const resultStr = formatToolResult(toolCall.tool, result.result || '', result.ok);
      const resultPre = resultEl.createEl('pre', { cls: 'codebuddian-tool-result-pre' });
      resultPre.createEl('code', { text: resultStr });
    } else if (toolCall.result) {
      const resultEl = el.createDiv({ cls: 'codebuddian-tool-result' });
      const resultStr = formatToolResult(toolCall.tool, toolCall.result, toolCall.status !== 'error');
      const resultPre = resultEl.createEl('pre', { cls: 'codebuddian-tool-result-pre' });
      resultPre.createEl('code', { text: resultStr });
    }

    return el;
  }

  renderApprovalCard(toolCall: ToolCall, onApprove: () => void, onDeny: () => void): HTMLElement {
    const el = this.containerEl.createDiv({ cls: 'codebuddian-approval-card' });

    el.createDiv({
      cls: 'codebuddian-approval-header',
      text: `Approval required: ${toolCall.tool}`,
    });

    const argsEl = el.createDiv({ cls: 'codebuddian-approval-args' });
    const inputStr = formatToolInput(toolCall.tool, toolCall.args);
    argsEl.createEl('pre', { text: inputStr });

    const btnRow = el.createDiv({ cls: 'codebuddian-approval-buttons' });
    const approveBtn = btnRow.createEl('button', {
      text: 'Approve',
      cls: 'codebuddian-btn codebuddian-btn-approve',
    });
    approveBtn.addEventListener('click', onApprove);

    const denyBtn = btnRow.createEl('button', {
      text: 'Deny',
      cls: 'codebuddian-btn codebuddian-btn-deny',
    });
    denyBtn.addEventListener('click', onDeny);

    return el;
  }
}
