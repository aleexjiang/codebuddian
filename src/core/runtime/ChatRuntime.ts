import type { StartOptions, SessionHandle } from './types';
import type { ProviderDescriptor } from '../types';

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

export interface ChatRuntime {
  readonly descriptor: ProviderDescriptor;
  start(opts: StartOptions): Promise<SessionHandle>;
  getActiveSession(): SessionHandle | null;
  dispose(): Promise<void>;
  /** Get available models from the CLI (requires an active session). */
  getAvailableModels(): Promise<ModelInfo[]>;
  /** Get the underlying SDK session for direct control (setPermissionMode, etc). */
  getSdkSession(): unknown;
}
