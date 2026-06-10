import type { ChatMessage, PermissionMode } from '../../../core/types';

export type ChatMode = 'ask' | 'plan' | 'craft';

export interface ChatTab {
  id: string;
  title: string;
  messages: ChatMessage[];
  status: 'idle' | 'streaming' | 'waiting_approval' | 'error';
  permissionMode: PermissionMode;
  mode: ChatMode;
  sessionId: string | null;
  model: string;
  effort: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatState {
  activeTabId: string | null;
  tabs: ChatTab[];
  inputValue: string;
  isInputFocused: boolean;
}

export function createEmptyTab(id: string): ChatTab {
  return {
    id,
    title: 'New chat',
    messages: [],
    status: 'idle',
    permissionMode: 'default',
    mode: 'ask',
    sessionId: null,
    model: '',
    effort: 'medium',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
