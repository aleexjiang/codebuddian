import type { McpConfig, McpServerConfig } from '../types';
import { McpConfigParser } from './McpConfigParser';

export class McpServerManager {
  private config: McpConfig = { mcpServers: {} };

  async load(configPath: string): Promise<void> {
    this.config = await McpConfigParser.loadFromFile(configPath);
  }

  getServers(): Record<string, McpServerConfig> {
    return this.config.mcpServers;
  }

  getEnabledServers(): Record<string, McpServerConfig> {
    const result: Record<string, McpServerConfig> = {};
    for (const [name, server] of Object.entries(this.config.mcpServers)) {
      if (server && !(server as McpServerConfig).disabled) {
        result[name] = server;
      }
    }
    return result;
  }

  addServer(name: string, config: McpServerConfig): void {
    this.config.mcpServers[name] = config;
  }

  removeServer(name: string): void {
    delete this.config.mcpServers[name];
  }

  toggleServer(name: string): void {
    if (this.config.mcpServers[name]) {
      this.config.mcpServers[name].disabled = !this.config.mcpServers[name].disabled;
    }
  }

  getConfig(): McpConfig {
    return this.config;
  }
}
