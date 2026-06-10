// 聊天核心类型
export type MessageRole = 'user' | 'assistant' | 'system';
export type MentionType = 'file' | 'mcp' | 'agent' | 'extDir';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  mentions?: Mention[];
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  isStreaming?: boolean;
  thinkingContent?: string;
  instruction?: string;
  sessionId?: string;
}

export interface Mention {
  type: MentionType;
  ref: string;  // file path, mcp server name, agent name, or external dir
  label?: string;
}

export interface Attachment {
  path: string;
  mime?: string;
  name?: string;
}

export interface UserInput {
  text: string;
  mentions?: Mention[];
  attachments?: Attachment[];
  instruction?: string;       // from # instruction mode
  permissionMode?: PermissionMode;
}

export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';

export interface ToolCall {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error' | 'approval_needed';
  result?: string;
  error?: string;
}

export interface ToolResult {
  id: string;
  toolCallId: string;
  ok: boolean;
  result?: string;
  error?: string;
}

export type SessionEventType = 'message' | 'tool_use' | 'tool_result' | 'approval' | 'thinking' | 'end' | 'error' | 'turn_end';

export interface SessionEvent {
  type: SessionEventType;
  data: unknown;
  timestamp: number;
}
