import { addIcon } from 'obsidian';

export function registerIcons(): void {
	addIcon('codebuddian-icon', `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
			<rect x="10" y="10" width="80" height="80" rx="15" fill="currentColor" opacity="0.15"/>
			<text x="50" y="65" font-size="50" text-anchor="middle" fill="currentColor">🤖</text>
		</svg>
	`);
}
