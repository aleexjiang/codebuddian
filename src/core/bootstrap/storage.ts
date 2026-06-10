import { mkdir, readFile, writeFile, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import type { CodebuddianSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types/settings';
import { StoragePaths } from './StoragePaths';

export class PluginStorage {
  readonly paths: StoragePaths;

  constructor(vaultPath: string) {
    this.paths = new StoragePaths(vaultPath);
  }

  async init(): Promise<void> {
    const dirs = [this.paths.base, this.paths.sessions, this.paths.skills, this.paths.commands];
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }
  }

  async loadSettings(): Promise<CodebuddianSettings> {
    try {
      const raw = await readFile(this.paths.settings, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(settings: CodebuddianSettings): Promise<void> {
    await writeFile(this.paths.settings, JSON.stringify(settings, null, 2), 'utf-8');
  }

  async appendSessionLine(sessionId: string, line: object): Promise<void> {
    const { appendFile } = await import('fs/promises');
    const filePath = this.paths.sessionFile(sessionId);
    await appendFile(filePath, JSON.stringify(line) + '\n', 'utf-8');
  }

  async readSessionLines(sessionId: string): Promise<object[]> {
    try {
      const raw = await readFile(this.paths.sessionFile(sessionId), 'utf-8');
      return raw.split('\n').filter(Boolean).map(l => JSON.parse(l));
    } catch {
      return [];
    }
  }

  async listSessions(): Promise<string[]> {
    try {
      const files = await readdir(this.paths.sessions);
      return files.filter(f => f.endsWith('.jsonl')).map(f => f.replace('.jsonl', ''));
    } catch {
      return [];
    }
  }
}
