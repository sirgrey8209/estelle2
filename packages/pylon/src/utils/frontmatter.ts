/**
 * Frontmatter 파서
 *
 * YAML frontmatter를 파싱하여 객체로 반환한다.
 * 외부 라이브러리 없이 간단한 key: value 형식만 지원.
 *
 * @module utils/frontmatter
 */

/**
 * Markdown 문서의 YAML frontmatter를 파싱합니다.
 *
 * frontmatter는 `---`로 시작하고 `---`로 끝나며,
 * 문서 맨 앞에 있어야 합니다.
 *
 * @param content - 파싱할 Markdown 내용
 * @returns 파싱된 frontmatter 객체 또는 null (frontmatter가 없는 경우)
 *
 * @example
 * const content = `---
 * title: 테스트
 * autorun: true
 * ---
 *
 * # 문서 내용`;
 *
 * const result = parseFrontmatter(content);
 * // { title: '테스트', autorun: true }
 */
const FRONTMATTER_DELIMITER = '---';
const DELIMITER_LENGTH = 3;

export function parseFrontmatter(content: string): Record<string, unknown> | null {
  if (!content || !content.startsWith(FRONTMATTER_DELIMITER)) {
    return null;
  }

  const endIndex = content.indexOf(FRONTMATTER_DELIMITER, DELIMITER_LENGTH);
  if (endIndex === -1) {
    return null;
  }

  const frontmatterContent = content.slice(DELIMITER_LENGTH, endIndex).trim();
  if (!frontmatterContent) {
    return {};
  }

  return parseKeyValueLines(frontmatterContent);
}

/**
 * key: value 형식의 라인들을 파싱하여 객체로 반환합니다.
 */
function parseKeyValueLines(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const line of content.split('\n')) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmedLine.slice(0, colonIndex).trim();
    const rawValue = trimmedLine.slice(colonIndex + 1).trim();
    result[key] = parseValue(rawValue);
  }

  return result;
}

/**
 * 문자열 값을 적절한 타입으로 변환합니다.
 * - "true"/"false" -> boolean
 * - 숫자 문자열 -> number
 * - 따옴표로 감싸진 문자열 -> 따옴표 제거
 */
function parseValue(rawValue: string): unknown {
  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;

  const numValue = Number(rawValue);
  if (!isNaN(numValue) && rawValue !== '') {
    return numValue;
  }

  return stripQuotes(rawValue);
}

/**
 * 문자열 양끝의 따옴표(큰따옴표 또는 작은따옴표)를 제거합니다.
 */
function stripQuotes(value: string): string {
  const isDoubleQuoted = value.startsWith('"') && value.endsWith('"');
  const isSingleQuoted = value.startsWith("'") && value.endsWith("'");

  if (isDoubleQuoted || isSingleQuoted) {
    return value.slice(1, -1);
  }

  return value;
}

/**
 * 문서에 autorun: true가 설정되어 있는지 확인합니다.
 *
 * autorun 값이 boolean true일 때만 true를 반환합니다.
 * 문자열 "true"나 숫자 1은 false를 반환합니다.
 *
 * @param content - 확인할 Markdown 내용
 * @returns autorun이 true로 설정되어 있으면 true, 그렇지 않으면 false
 *
 * @example
 * const content = `---
 * autorun: true
 * ---
 *
 * # 작업 계획`;
 *
 * hasAutorun(content); // true
 */
export function hasAutorun(content: string): boolean {
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) {
    return false;
  }

  return frontmatter.autorun === true;
}
