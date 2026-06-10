import type { StartOptions, SessionHandle } from './types';
import type { ProviderDescriptor } from '../types';

export interface ChatRuntime {
  readonly descriptor: ProviderDescriptor;
  start(opts: StartOptions): Promise<SessionHandle>;
  getActiveSession(): SessionHandle | null;
  dispose(): Promise<void>;
}
