export type ToolName = 'Read' | 'Write' | 'Edit' | 'Bash' | 'Glob' | 'Grep' | 'WebFetch' | 'WebSearch' | 'ImageGen' | string;

export const BUILTIN_TOOL_NAMES: ToolName[] = [
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'ImageGen',
];

export const TOOL_ICONS: Record<string, string> = {
  Read: '📖',
  Write: '✏️',
  Edit: '🔧',
  Bash: '💻',
  Glob: '🔍',
  Grep: '🔎',
  WebFetch: '🌐',
  WebSearch: '🔬',
  ImageGen: '🎨',
};

export interface ToolApprovalRequest {
  id: string;
  tool: ToolName;
  args: Record<string, unknown>;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ToolApprovalResult {
  id: string;
  approved: boolean;
  modifiedArgs?: Record<string, unknown>;
}
