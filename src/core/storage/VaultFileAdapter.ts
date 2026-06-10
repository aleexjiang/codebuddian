import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

export class VaultFileAdapter {
  constructor(private vaultPath: string) {}

  get basePath(): string {
    return this.vaultPath;
  }

  async read(relativePath: string): Promise<string> {
    return readFile(join(this.vaultPath, relativePath), 'utf-8');
  }

  async write(relativePath: string, content: string): Promise<void> {
    const fullPath = join(this.vaultPath, relativePath);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(fullPath, content, 'utf-8');
  }

  exists(relativePath: string): boolean {
    return existsSync(join(this.vaultPath, relativePath));
  }

  resolve(relativePath: string): string {
    return join(this.vaultPath, relativePath);
  }
}
