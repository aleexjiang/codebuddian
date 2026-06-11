import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type { CodebuddianPlugin } from '../../main';
import { CliDetector } from '../../providers/codebuddy/cli-detect';
import { CodebuddyChatRuntime } from '../../providers/codebuddy/runtime/CodebuddyChatRuntime';
import { ApprovalManager } from '../../core/security/ApprovalManager';

export class CodebuddianSettingsTab extends PluginSettingTab {
	private plugin: CodebuddianPlugin;
	private cliDetector: CliDetector;

	constructor(app: App, plugin: CodebuddianPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.cliDetector = new CliDetector();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Codebuddian Settings' });

		new Setting(containerEl)
			.setName('CodeBuddy CLI path')
			.setDesc('Path to codebuddy binary. Leave empty for auto-detection.')
			.addText(text => text
				.setPlaceholder('Auto-detect')
				.setValue(this.plugin.settings.cliPath)
				.onChange(async (value) => {
					this.plugin.settings.cliPath = value;
					await this.plugin.saveSettings();
				}))
			.addButton(btn => btn
				.setButtonText('Detect')
				.onClick(async () => {
					const path = await this.cliDetector.detect();
					if (path) {
						this.plugin.settings.cliPath = path;
						await this.plugin.saveSettings();
						this.display();
						new Notice(`Found: ${path}`);
					} else {
						new Notice('CodeBuddy CLI not found');
					}
				}));

		new Setting(containerEl)
			.setName('Model')
			.setDesc('Default model for CodeBuddy sessions')
			.addText(text => text
				.setPlaceholder('auto')
				.setValue(this.plugin.settings.model)
				.onChange(async (value) => {
					this.plugin.settings.model = value;
					await this.plugin.saveSettings();
				}));

		// Detect models button
		new Setting(containerEl)
			.setName('Available models')
			.setDesc('Detect models from CodeBuddy CLI and cache them for the model selector')
			.addButton(btn => btn
				.setButtonText('Detect models')
				.onClick(async () => {
					btn.setDisabled(true);
					btn.setButtonText('Detecting...');
					try {
						const vaultPath = (this.app.vault.adapter as any).getBasePath?.() ?? '';
						const runtime = new CodebuddyChatRuntime(
							this.plugin.settings,
							new ApprovalManager(),
							vaultPath,
						);
						const session = await runtime.start({ cwd: vaultPath || process.cwd() });
						const models = await runtime.getAvailableModels();
						await session.close();
						await runtime.dispose();

						this.plugin.settings.availableModels = models.map(m => ({ id: m.id, name: m.name }));
						await this.plugin.saveSettings();
						this.display();
						new Notice(`Found ${models.length} models`);
					} catch (e) {
						new Notice(`Failed: ${e instanceof Error ? e.message : String(e)}`);
					} finally {
						btn.setDisabled(false);
						btn.setButtonText('Detect models');
					}
				}));

		// Show cached models if any
		if (this.plugin.settings.availableModels.length > 0) {
			const modelsEl = containerEl.createDiv({ cls: 'codebuddian-detected-models' });
			modelsEl.createEl('small', {
				text: `Cached: ${this.plugin.settings.availableModels.map(m => m.name || m.id).join(', ')}`,
				cls: 'codebuddian-muted-text',
			});
		}

		new Setting(containerEl)
			.setName('Permission mode')
			.setDesc('Default permission mode for tool approvals')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'default': 'Default (ask for approval)',
					'acceptEdits': 'Accept Edits (auto-approve file edits)',
					'plan': 'Plan Mode (explore first)',
					'bypassPermissions': 'Bypass All (⚠️ dangerous)',
				})
				.setValue(this.plugin.settings.permissionMode)
				.onChange(async (value) => {
					this.plugin.settings.permissionMode = value as 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Append system prompt')
			.setDesc('Additional system prompt appended to every session')
			.addTextArea(text => text
				.setPlaceholder('Additional instructions for CodeBuddy…')
				.setValue(this.plugin.settings.appendSystemPrompt)
				.onChange(async (value) => {
					this.plugin.settings.appendSystemPrompt = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('MCP config path')
			.setDesc('Path to MCP servers config file (relative to vault root)')
			.addText(text => text
				.setPlaceholder('.codebuddian/mcp.json')
				.setValue(this.plugin.settings.mcpConfigPath)
				.onChange(async (value) => {
					this.plugin.settings.mcpConfigPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Additional directories')
			.setDesc('Extra directories to allow tool access (comma-separated)')
			.addText(text => text
				.setPlaceholder('/path/to/dir1, /path/to/dir2')
				.setValue(this.plugin.settings.addDirs.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.addDirs = value.split(',').map(s => s.trim()).filter(Boolean);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Max turns')
			.setDesc('Maximum agentic turns per session (0 = unlimited)')
			.addText(text => text
				.setValue(String(this.plugin.settings.maxTurns))
				.onChange(async (value) => {
					this.plugin.settings.maxTurns = parseInt(value) || 0;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Reasoning effort')
			.setDesc('Reasoning effort level')
			.addDropdown(dropdown => dropdown
				.addOptions({
					'minimal': 'Minimal',
					'low': 'Low',
					'medium': 'Medium',
					'high': 'High',
					'xhigh': 'Extra High',
					'max': 'Maximum',
				})
				.setValue(this.plugin.settings.effort)
				.onChange(async (value) => {
					this.plugin.settings.effort = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Debug mode')
			.setDesc('Enable CLI debug output')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-detect CLI')
			.setDesc('Automatically detect CodeBuddy CLI path on startup')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoDetectCli)
				.onChange(async (value) => {
					this.plugin.settings.autoDetectCli = value;
					await this.plugin.saveSettings();
				}));
	}
}
