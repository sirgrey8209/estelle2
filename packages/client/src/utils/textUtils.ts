/**
 * 텍스트 유틸리티 함수
 */

/**
 * system-reminder 태그 제거
 */
export function removeSystemReminder(text: string): string {
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
}

/**
 * 줄 단위 diff 결과
 */
export type DiffLine = { type: 'same' | 'add' | 'remove'; text: string };

/**
 * 간단한 줄 단위 diff (LCS 기반)
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // LCS 테이블 생성
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 역추적으로 diff 생성
  let i = m, j = n;
  const temp: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      temp.push({ type: 'same', text: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.push({ type: 'add', text: newLines[j - 1] });
      j--;
    } else {
      temp.push({ type: 'remove', text: oldLines[i - 1] });
      i--;
    }
  }

  return temp.reverse();
}
