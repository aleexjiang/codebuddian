import type { DiffSegment } from '../../../core/types';

export class DiffRenderer {
  static render(segments: DiffSegment[], containerEl: HTMLElement): void {
    containerEl.empty();
    containerEl.addClass('codebuddian-diff');

    for (const seg of segments) {
      const span = containerEl.createSpan({
        cls: `codebuddian-diff-${seg.type}`,
      });
      span.setText(seg.text);
    }
  }

  static computeDiff(original: string, modified: string): DiffSegment[] {
    // Simple line-based diff using LCS approach
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    const segments: DiffSegment[] = [];

    const lcs = this.lcs(origLines, modLines);
    let oi = 0, mi = 0, li = 0;

    while (oi < origLines.length || mi < modLines.length) {
      if (li < lcs.length && oi < origLines.length && mi < modLines.length
          && origLines[oi] === lcs[li] && modLines[mi] === lcs[li]) {
        segments.push({ type: 'equal', text: lcs[li] + '\n' });
        oi++; mi++; li++;
      } else if (oi < origLines.length && (li >= lcs.length || origLines[oi] !== lcs[li])) {
        segments.push({ type: 'delete', text: origLines[oi] + '\n' });
        oi++;
      } else if (mi < modLines.length && (li >= lcs.length || modLines[mi] !== lcs[li])) {
        segments.push({ type: 'insert', text: modLines[mi] + '\n' });
        mi++;
      } else {
        oi++; mi++;
      }
    }

    return segments;
  }

  private static lcs(a: string[], b: string[]): string[] {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
      }
    }

    // Backtrack
    const result: string[] = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (a[i-1] === b[j-1]) {
        result.unshift(a[i-1]);
        i--; j--;
      } else if (dp[i-1][j] > dp[i][j-1]) {
        i--;
      } else {
        j--;
      }
    }
    return result;
  }
}
