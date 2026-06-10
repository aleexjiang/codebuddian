import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

export class HomeFileAdapter {
  private homePath: string;

  constructor() {
    this.homePath = homedir();
  }

  get basePath(): string {
    return this.homePath;
  }

  async read(relativePath: string): Promise<string> {
    return readFile(join(this.homePath, relativePath), 'utf-8');
  }

  async write(relativePath: string, content: string): Promise<void> {
    const fullPath = join(this.homePath, relativePath);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(fullPath, content, 'utf-8');
  }

  exists(relativePath: string): boolean {
    return existsSync(join(this.homePath, relativePath));
  }
}
