export function shellQuote(str: string): string {
	if (/[^A-Za-z0-9_\/:=.-]/.test(str)) {
		return `'${str.replace(/'/g, "'\\''")}'`;
	}
	return str;
}

export function shellEscapeArgs(args: string[]): string {
	return args.map(shellQuote).join(' ');
}
