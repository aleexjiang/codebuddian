import { App, Modal, MarkdownRenderer, Component, Notice } from 'obsidian';
import type { CodebuddianSettings } from '../../../core/types/settings';
import { PrintTransport } from '../../../providers/codebuddy/transport-print';
import { DiffRenderer } from '../../chat/rendering/DiffRenderer';
import type { DiffSegment } from '../../../core/types';

export class InlineEditModal extends Modal {
  private originalText: string;
  private modifiedText: string = '';
  private diffSegments: DiffSegment[] = [];
  private prompt: string;
  private settings: CodebuddianSettings;
  private cliPath: string;
  private vaultPath: string;
  private onApply: (newText: string) => void;
  private component: Component;

  constructor(
    app: App,
    opts: {
      originalText: string;
      prompt: string;
      settings: CodebuddianSettings;
      cliPath: string;
      vaultPath: string;
      onApply: (newText: string) => void;
    }
  ) {
    super(app);
    this.originalText = opts.originalText;
    this.prompt = opts.prompt;
    this.settings = opts.settings;
    this.cliPath = opts.cliPath;
    this.vaultPath = opts.vaultPath;
    this.onApply = opts.onApply;
    this.component = new Component();
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('codebuddian-inline-edit-modal');
    contentEl.createEl('h2', { text: 'Inline Edit' });

    // Show original
    contentEl.createEl('h3', { text: 'Original' });
    const origEl = contentEl.createDiv({ cls: 'codebuddian-inline-original' });
    origEl.setText(this.originalText);

    // Show prompt
    contentEl.createEl('h3', { text: `Instruction: ${this.prompt}` });

    // Run the edit
    const statusEl = contentEl.createDiv({ text: '⏳ Running CodeBuddy…', cls: 'codebuddian-inline-status' });

    this.runEdit().then(result => {
      statusEl.setText('');

      if (result.exitCode === 0 && result.stdout) {
        this.modifiedText = result.stdout;
        this.diffSegments = DiffRenderer.computeDiff(this.originalText, this.modifiedText);

        // Show diff
        contentEl.createEl('h3', { text: 'Changes' });
        const diffEl = contentEl.createDiv({ cls: 'codebuddian-inline-diff' });
        DiffRenderer.render(this.diffSegments, diffEl);

        // Buttons
        const btnRow = contentEl.createDiv({ cls: 'codebuddian-inline-buttons' });
        const applyBtn = btnRow.createEl('button', { text: '✅ Apply', cls: 'mod-cta' });
        applyBtn.addEventListener('click', () => {
          this.onApply(this.modifiedText);
          this.close();
        });

        const cancelBtn = btnRow.createEl('button', { text: '❌ Cancel' });
        cancelBtn.addEventListener('click', () => this.close());
      } else {
        statusEl.setText(`❌ Error: ${result.stderr || 'Unknown error'}`);
        const closeBtn = contentEl.createEl('button', { text: 'Close' });
        closeBtn.addEventListener('click', () => this.close());
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async runEdit() {
    const transport = new PrintTransport();
    const fullPrompt = `Edit the following text according to the instruction. Return ONLY the modified text, nothing else.\n\nInstruction: ${this.prompt}\n\nOriginal text:\n${this.originalText}`;

    return transport.execute(this.cliPath, fullPrompt, {
      cwd: this.vaultPath,
      model: this.settings.model || undefined,
      permissionMode: this.settings.permissionMode,
    });
  }
}
