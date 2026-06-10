import { readFile } from 'fs/promises';
import type { McpConfig, McpServerConfig } from '../types';
import { EMPTY_MCP_CONFIG } from '../types/mcp';

export class McpConfigParser {
  static async loadFromFile(path: string): Promise<McpConfig> {
    try {
      const raw = await readFile(path, 'utf-8');
      const parsed = JSON.parse(raw);
      return McpConfigParser.validate(parsed);
    } catch {
      return { ...EMPTY_MCP_CONFIG };
    }
  }

  static validate(raw: unknown): McpConfig {
    if (!raw || typeof raw !== 'object') return { ...EMPTY_MCP_CONFIG };
    const config = raw as Record<string, unknown>;
    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      return { ...EMPTY_MCP_CONFIG };
    }
    const mcpServers: Record<string, McpServerConfig> = {};
    for (const [name, server] of Object.entries(config.mcpServers as Record<string, unknown>)) {
      if (server && typeof server === 'object') {
        mcpServers[name] = server as McpServerConfig;
      }
    }
    return { mcpServers };
  }

  static toJson(config: McpConfig): string {
    return JSON.stringify(config, null, 2);
  }
}
