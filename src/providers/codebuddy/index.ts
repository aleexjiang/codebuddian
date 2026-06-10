import type { ProviderDescriptor, ProviderCapabilities } from '../../core/types';

export const CODEBUDDY_PROVIDER: ProviderDescriptor = {
  id: 'codebuddy',
  displayName: 'CodeBuddy',
  description: 'CodeBuddy CLI – AI coding agent via Agent SDK',
  icon: '🤖',
  capabilities: {
    chat: true,
    inlineEdit: true,
    planMode: true,
    mcp: true,
    resume: true,
    slashCommands: true,
    skills: true,
    agents: true,
  } satisfies ProviderCapabilities,
};
