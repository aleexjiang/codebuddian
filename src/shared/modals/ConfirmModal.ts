import { App, Modal } from 'obsidian';

export class ConfirmModal extends Modal {
	private title: string;
	private message: string;
	private onConfirm: () => void;

	constructor(app: App, opts: { title: string; message: string; onConfirm: () => void }) {
		super(app);
		this.title = opts.title;
		this.message = opts.message;
		this.onConfirm = opts.onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: this.title });
		contentEl.createEl('p', { text: this.message });

		const btnRow = contentEl.createDiv();
		const confirmBtn = btnRow.createEl('button', { text: 'Confirm', cls: 'mod-cta' });
		confirmBtn.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});

		const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
