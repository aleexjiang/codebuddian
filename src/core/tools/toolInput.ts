export interface ToolInputSpec {
  tool: string;
  args: Record<string, unknown>;
}

export function formatToolInput(tool: string, args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return `${tool}()`;
  const formatted = entries.map(([k, v]) => {
    const val = typeof v === 'string' ? v : JSON.stringify(v);
    const truncated = val.length > 200 ? val.slice(0, 200) + '...' : val;
    return `${k}: ${truncated}`;
  });
  return `${tool}(${formatted.join(', ')})`;
}
