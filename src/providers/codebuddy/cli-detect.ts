import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const CLI_NAMES = ['codebuddy', 'cbc'];

export class CliDetector {
  private cachedPath: string | null = null;

  async detect(): Promise<string | null> {
    if (this.cachedPath) return this.cachedPath;

    // Try each known binary name
    for (const name of CLI_NAMES) {
      try {
        const path = await this.which(name);
        if (path) {
          this.cachedPath = path;
          return path;
        }
      } catch {
        // continue
      }
    }

    // Try common install paths
    const home = process.env.HOME || '';
    const commonPaths = [
      join(home, '.nvm/versions/node/v25.8.1/bin/codebuddy'),
      join(home, '.nvm/versions/node/v25.8.1/bin/cbc'),
      '/usr/local/bin/codebuddy',
      '/usr/local/bin/cbc',
    ];

    for (const p of commonPaths) {
      if (existsSync(p)) {
        this.cachedPath = p;
        return p;
      }
    }

    return null;
  }

  private which(cmd: string): Promise<string | null> {
    return new Promise((resolve) => {
      const isWin = process.platform === 'win32';
      const whichCmd = isWin ? 'where.exe' : 'which';
      execFile(whichCmd, [cmd], (err, stdout) => {
        if (err) {
          resolve(null);
        } else {
          const path = stdout.trim().split('\n')[0].trim();
          resolve(path || null);
        }
      });
    });
  }

  async getVersion(cliPath?: string): Promise<string> {
    const path = cliPath || this.cachedPath;
    if (!path) return 'unknown';
    return new Promise((resolve) => {
      execFile(path, ['--version'], (err, stdout) => {
        if (err) resolve('unknown');
        else resolve(stdout.trim());
      });
    });
  }

  clearCache(): void {
    this.cachedPath = null;
  }
}
