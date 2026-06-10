import type { PermissionMode } from './chat';

export interface CodebuddianSettings {
  // Provider
  cliPath: string;
  model: string;
  permissionMode: PermissionMode;

  // System
  systemPromptFile: string;
  appendSystemPrompt: string;

  // MCP
  mcpConfigPath: string;

  // Directories
  addDirs: string[];

  // Agent
  maxTurns: number;
  effort: string;

  // Tools
  allowedTools: string[];
  disallowedTools: string[];
  autoDetectCli: boolean;

  // UI
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  showThinking: boolean;
  autoScroll: boolean;

  // Advanced
  debugMode: boolean;
  verboseMode: boolean;
  includePartialMessages: boolean;
  strictMcpConfig: boolean;
}

export const DEFAULT_SETTINGS: CodebuddianSettings = {
  cliPath: '',
  model: '',
  permissionMode: 'default',
  systemPromptFile: '',
  appendSystemPrompt: '',
  mcpConfigPath: '',
  addDirs: [],
  maxTurns: 0,
  effort: 'medium',
  allowedTools: [],
  disallowedTools: [],
  autoDetectCli: true,
  theme: 'system',
  fontSize: 14,
  showThinking: false,
  autoScroll: true,
  debugMode: false,
  verboseMode: false,
  includePartialMessages: false,
  strictMcpConfig: false,
};
