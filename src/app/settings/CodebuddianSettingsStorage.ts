import type { Plugin } from 'obsidian';
import type { CodebuddianSettings } from '../../core/types/settings';
import { DEFAULT_SETTINGS } from './defaultSettings';

export class SettingsStorage {
  constructor(private plugin: Plugin) {}

  async load(): Promise<CodebuddianSettings> {
    const loaded = await this.plugin.loadData();
    return { ...DEFAULT_SETTINGS, ...loaded };
  }

  async save(settings: CodebuddianSettings): Promise<void> {
    await this.plugin.saveData(settings);
  }
}
