export function stripMarkdown(md: string): string {
	return md
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/\*\*(.+?)\*\*/g, '$1')
		.replace(/\*(.+?)\*/g, '$1')
		.replace(/`(.+?)`/g, '$1')
		.replace(/\[(.+?)\]\(.+?\)/g, '$1')
		.trim();
}
