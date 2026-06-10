export const CHAT_VIEW_TYPE = 'codebuddian-chat';
export const CHAT_ICON = 'message-circle';
export const MAX_INPUT_HEIGHT = 200;
export const MIN_INPUT_HEIGHT = 40;
export const AUTO_SCROLL_THRESHOLD = 100; // px from bottom

export const AVAILABLE_MODELS = [
  { id: '', label: 'Default (CLI default)' },
  { id: 'claude-opus-4.8', label: 'Claude Opus 4.8' },
  { id: 'claude-sonnet-4.7', label: 'Claude Sonnet 4.7' },
  { id: 'gpt-5.5', label: 'GPT-5.5' },
  { id: 'gpt-5.5-mini', label: 'GPT-5.5 Mini' },
  { id: 'kimi-k2.6', label: 'Kimi K2.6' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { id: 'deepseek-v4-lite', label: 'DeepSeek V4 Lite' },
  { id: 'gemini-3.5-pro', label: 'Gemini 3.5 Pro' },
  { id: 'qwen-4.5-max', label: 'Qwen 4.5 Max' },
];

export const EFFORT_OPTIONS = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];
