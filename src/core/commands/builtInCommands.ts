import type { App, Command } from 'obsidian';

export const BUILT_IN_COMMANDS: Omit<Command, 'callback'>[] = [
  {
    id: 'codebuddian.open-chat',
    name: 'Open chat',
  },
  {
    id: 'codebuddian.new-chat',
    name: 'New chat tab',
  },
  {
    id: 'codebuddian.inline-edit',
    name: 'Inline edit selection',
  },
  {
    id: 'codebuddian.toggle-plan-mode',
    name: 'Toggle plan mode',
  },
  {
    id: 'codebuddian.cancel-current-turn',
    name: 'Cancel current turn',
  },
  {
    id: 'codebuddian.resume-session',
    name: 'Resume session',
  },
  {
    id: 'codebuddian.fork-session',
    name: 'Fork current session',
  },
  {
    id: 'codebuddian.open-settings',
    name: 'Open settings',
  },
];
