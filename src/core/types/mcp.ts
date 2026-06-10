export type McpTransport = 'stdio' | 'sse' | 'streamable-http';

export interface McpServerConfig {
  name: string;
  transport: McpTransport;
  command?: string;       // for stdio
  args?: string[];        // for stdio
  url?: string;           // for sse / streamable-http
  env?: Record<string, string>;
  disabled?: boolean;
}

export interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export const EMPTY_MCP_CONFIG: McpConfig = { mcpServers: {} };
