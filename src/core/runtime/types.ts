import type { UserInput, SessionEvent, ChatMessage, PermissionMode } from '../types';

export type RuntimeStatus = 'idle' | 'starting' | 'running' | 'waiting_approval' | 'stopping' | 'error';

export interface StartOptions {
  sessionId?: string;
  resume?: string;
  model?: string;
  permissionMode?: PermissionMode;
  systemPromptFile?: string;
  appendSystemPrompt?: string;
  mcpConfigPath?: string;
  addDirs?: string[];
  allowedTools?: string[];
  disallowedTools?: string[];
  maxTurns?: number;
  effort?: string;
  cwd: string;
}

export interface SessionHandle {
  readonly sessionId: string;
  readonly status: RuntimeStatus;
  send(input: UserInput): Promise<void>;
  cancel(): Promise<void>;
  resume(sessionId: string): Promise<void>;
  fork(): Promise<string>;
  rewind(): Promise<void>;
  on(evt: string, cb: (e: SessionEvent) => void): () => void;  // returns unsubscribe fn
  close(): Promise<void>;
}
