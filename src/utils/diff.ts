import type { DiffSegment } from '../core/types';

export function computeWordDiff(original: string, modified: string): DiffSegment[] {
	const origWords = splitWords(original);
	const modWords = splitWords(modified);
	const segments: DiffSegment[] = [];

	const lcs = wordLcs(origWords, modWords);
	let oi = 0, mi = 0, li = 0;

	while (oi < origWords.length || mi < modWords.length) {
		if (li < lcs.length && oi < origWords.length && mi < modWords.length
			&& origWords[oi] === lcs[li] && modWords[mi] === lcs[li]) {
			segments.push({ type: 'equal', text: lcs[li] });
			oi++; mi++; li++;
		} else if (oi < origWords.length && (li >= lcs.length || origWords[oi] !== lcs[li])) {
			segments.push({ type: 'delete', text: origWords[oi] });
			oi++;
		} else if (mi < modWords.length && (li >= lcs.length || modWords[mi] !== lcs[li])) {
			segments.push({ type: 'insert', text: modWords[mi] });
			mi++;
		} else {
			oi++; mi++;
		}
	}

	return segments;
}

function splitWords(text: string): string[] {
	return text.split(/(\s+)/).filter(s => s.length > 0);
}

function wordLcs(a: string[], b: string[]): string[] {
	const m = a.length, n = b.length;
	const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
		}
	}

	const result: string[] = [];
	let i = m, j = n;
	while (i > 0 && j > 0) {
		if (a[i - 1] === b[j - 1]) {
			result.unshift(a[i - 1]);
			i--; j--;
		} else if (dp[i - 1][j] > dp[i][j - 1]) {
			i--;
		} else {
			j--;
		}
	}
	return result;
}
