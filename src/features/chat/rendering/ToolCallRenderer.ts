import { TOOL_ICONS } from '../../../core/tools/toolIcons';
import { formatToolInput } from '../../../core/tools/toolInput';
import { formatToolResult } from '../../../core/tools/toolResultContent';
import type { ToolCall, ToolResult } from '../../../core/types';

export class ToolCallRenderer {
  private containerEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }

  render(toolCall: ToolCall, result?: ToolResult): HTMLElement {
    const el = this.containerEl.createDiv({ cls: 'codebuddian-tool-call' });

    // Header
    const headerEl = el.createDiv({ cls: 'codebuddian-tool-header' });
    const icon = TOOL_ICONS[toolCall.tool] || '🔧';
    headerEl.createSpan({ text: `${icon} ${toolCall.tool}`, cls: 'codebuddian-tool-name' });

    // Status badge
    const statusColors: Record<string, string> = {
      pending: '🟡',
      running: '🔵',
      completed: '🟢',
      error: '🔴',
      approval_needed: '⚠️',
    };
    headerEl.createSpan({
      text: statusColors[toolCall.status] || '⚪',
      cls: 'codebuddian-tool-status',
    });

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
      text: `⚠️ Approval Required: ${toolCall.tool}`,
    });

    const argsEl = el.createDiv({ cls: 'codebuddian-approval-args' });
    const inputStr = formatToolInput(toolCall.tool, toolCall.args);
    argsEl.createEl('pre', { text: inputStr });

    const btnRow = el.createDiv({ cls: 'codebuddian-approval-buttons' });
    const approveBtn = btnRow.createEl('button', {
      text: '✅ Approve',
      cls: 'codebuddian-btn codebuddian-btn-approve',
    });
    approveBtn.addEventListener('click', onApprove);

    const denyBtn = btnRow.createEl('button', {
      text: '❌ Deny',
      cls: 'codebuddian-btn codebuddian-btn-deny',
    });
    denyBtn.addEventListener('click', onDeny);

    return el;
  }
}
