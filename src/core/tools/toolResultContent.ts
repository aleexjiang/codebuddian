export function formatToolResult(tool: string, result: string, ok: boolean): string {
  if (!ok) {
    return `❌ ${tool} failed: ${result}`;
  }
  const truncated = result.length > 2000 ? result.slice(0, 2000) + '\n... (truncated)' : result;
  return truncated;
}
