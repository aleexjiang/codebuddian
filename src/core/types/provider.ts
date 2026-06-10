import type { PermissionMode } from './chat';

export interface ProviderDescriptor {
  id: string;
  displayName: string;
  description: string;
  icon: string;
  capabilities: ProviderCapabilities;
}

export interface ProviderCapabilities {
  chat: boolean;
  inlineEdit: boolean;
  planMode: boolean;
  mcp: boolean;
  resume: boolean;
  slashCommands: boolean;
  skills: boolean;
  agents: boolean;
}

export interface ProviderInstance {
  descriptor: ProviderDescriptor;
  runtime: import('../runtime/ChatRuntime').ChatRuntime;
  settings: ProviderSettings;
}

export interface ProviderSettings {
  cliPath: string;
  model: string;
  permissionMode: PermissionMode;
  systemPromptFile: string;
  appendSystemPrompt: string;
  mcpConfigPath: string;
  addDirs: string[];
  maxTurns: number;
  effort: string;
  allowedTools: string[];
  disallowedTools: string[];
  autoDetectCli: boolean;
}
