export interface PluginHook {
  name: string;
  description: string;
  handler: (...args: unknown[]) => unknown;
}
