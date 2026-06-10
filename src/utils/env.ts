export function getHomeDir(): string {
	return process.env.HOME || process.env.USERPROFILE || '~';
}

export function isWindows(): boolean {
	return process.platform === 'win32';
}

export function isMac(): boolean {
	return process.platform === 'darwin';
}

export function getPlatform(): string {
	return process.platform;
}
