export const CHAT_VIEW_TYPE = 'codebuddian-chat';
export const CHAT_ICON = 'message-circle';
export const MAX_INPUT_HEIGHT = 200;
export const MIN_INPUT_HEIGHT = 40;
export const AUTO_SCROLL_THRESHOLD = 100; // px from bottom

/** Dynamically populated from SDK — see ChatRuntime.getAvailableModels() */
export let AVAILABLE_MODELS: Array<{ id: string; label: string }> = [
  { id: '', label: 'Default (CLI default)' },
];

/** Replace the model list at runtime (called after SDK returns real models). */
export function setAvailableModels(models: Array<{ id: string; label: string }>): void {
  AVAILABLE_MODELS = [{ id: '', label: 'Default (CLI default)' }, ...models];
}

export const EFFORT_OPTIONS = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];
