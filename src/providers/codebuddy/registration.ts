import type { ProviderRegistration } from '../../core/providers/types';
import type { CodebuddianSettings } from '../../core/types/settings';
import type { ApprovalManager } from '../../core/security/ApprovalManager';
import { CodebuddyChatRuntime } from './runtime/CodebuddyChatRuntime';
import { CODEBUDDY_PROVIDER } from './index';

export function createCodebuddyRegistration(
  getSettings: () => CodebuddianSettings,
  approvalManager: ApprovalManager,
  vaultPath: string,
): ProviderRegistration {
  return {
    descriptor: CODEBUDDY_PROVIDER,
    factory: (settings) => {
      return new CodebuddyChatRuntime(settings, approvalManager, vaultPath);
    },
  };
}
