import { join } from 'path';

export class StoragePaths {
  constructor(private vaultPath: string) {}

  get base(): string {
    return join(this.vaultPath, '.codebuddian');
  }

  get settings(): string {
    return join(this.base, 'settings.json');
  }

  get sessions(): string {
    return join(this.base, 'sessions');
  }

  get mcpConfig(): string {
    return join(this.base, 'mcp.json');
  }

  get skills(): string {
    return join(this.base, 'skills');
  }

  get commands(): string {
    return join(this.base, 'commands');
  }

  sessionFile(sessionId: string): string {
    return join(this.sessions, `${sessionId}.jsonl`);
  }
}
