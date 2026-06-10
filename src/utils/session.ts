export function generateSessionId(prefix = 'cb'): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatSessionTimestamp(ts: number): string {
	return new Date(ts).toLocaleString();
}
