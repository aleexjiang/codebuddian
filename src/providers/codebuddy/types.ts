export interface CodebuddyProviderState {
  cliPath: string;
  cliVersion: string;
  isInstalled: boolean;
  model: string;
  sessionId: string | null;
}

export interface AcpMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface AcpEvent {
  type: string;
  [key: string]: unknown;
}

export interface CodebuddyLaunchOptions {
  cwd: string;
  sessionId?: string;
  resume?: string;
  model?: string;
  permissionMode?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  systemPromptFile?: string;
  appendSystemPrompt?: string;
  mcpConfigPath?: string;
  addDirs?: string[];
  maxTurns?: number;
  effort?: string;
  includePartialMessages?: boolean;
  strictMcpConfig?: boolean;
  debug?: boolean;
  verbose?: boolean;
}
