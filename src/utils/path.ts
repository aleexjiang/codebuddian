import { join, relative, isAbsolute, normalize } from 'path';

export function isSubPath(parent: string, child: string): boolean {
	const rel = relative(parent, child);
	return !rel.startsWith('..') && !isAbsolute(rel);
}

export function resolveVaultPath(vaultPath: string, relativePath: string): string {
	if (isAbsolute(relativePath)) return normalize(relativePath);
	return join(vaultPath, relativePath);
}

export function toRelativePath(vaultPath: string, fullPath: string): string {
	if (!isAbsolute(fullPath)) return fullPath;
	return relative(vaultPath, fullPath);
}
