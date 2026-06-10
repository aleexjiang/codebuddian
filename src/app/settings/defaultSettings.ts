import type { CodebuddianSettings } from '../../core/types/settings';

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
