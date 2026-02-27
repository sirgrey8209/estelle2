/**
 * Autorun 문서 감지기
 *
 * 연결된 문서들 중 autorun: true가 설정된 문서를 찾는다.
 *
 * @module utils/autorun-detector
 */

import { hasAutorun } from './frontmatter.js';

/**
 * 연결 문서들 중 autorun: true인 문서를 찾는다
 *
 * @param linkedDocs 문서 경로 목록
 * @param readFile 파일 읽기 함수 (의존성 주입)
 * @returns autorun 문서 경로 또는 undefined
 */
export function findAutorunDoc(
  linkedDocs: string[],
  readFile: (path: string) => string | null
): string | undefined {
  for (const docPath of linkedDocs) {
    const content = readFile(docPath);
    if (content === null) {
      continue;
    }

    if (hasAutorun(content)) {
      return docPath;
    }
  }

  return undefined;
}
