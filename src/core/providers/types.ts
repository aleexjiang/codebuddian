import type { ProviderDescriptor } from '../types';
import type { CodebuddianSettings } from '../types/settings';
import type { ChatRuntime } from '../runtime/ChatRuntime';

export interface ProviderRegistration {
  descriptor: ProviderDescriptor;
  factory: (settings: CodebuddianSettings) => ChatRuntime;
}
