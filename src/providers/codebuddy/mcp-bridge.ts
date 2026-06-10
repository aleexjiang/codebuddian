import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { McpConfig } from '../../core/types';
import { McpConfigParser } from '../../core/mcp/McpConfigParser';
import { EMPTY_MCP_CONFIG } from '../../core/types/mcp';

export class McpBridge {
  constructor(private vaultPath: string) {}

  get mcpConfigPath(): string {
    return `${this.vaultPath}/.codebuddian/mcp.json`;
  }

  async loadConfig(): Promise<McpConfig> {
    if (!existsSync(this.mcpConfigPath)) {
      return { ...EMPTY_MCP_CONFIG };
    }
    return McpConfigParser.loadFromFile(this.mcpConfigPath);
  }

  async saveConfig(config: McpConfig): Promise<void> {
    await writeFile(this.mcpConfigPath, McpConfigParser.toJson(config), 'utf-8');
  }

  async getConfigPath(): Promise<string> {
    // Ensure config file exists
    if (!existsSync(this.mcpConfigPath)) {
      await this.saveConfig({ ...EMPTY_MCP_CONFIG });
    }
    return this.mcpConfigPath;
  }
}
