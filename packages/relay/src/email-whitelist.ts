/**
 * @file email-whitelist.ts
 * @description 이메일 화이트리스트 관리
 *
 * 허용된 이메일 목록을 관리하고 검증합니다.
 */

import { readFile } from 'fs/promises';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 이메일 화이트리스트 타입
 *
 * @description
 * 허용된 이메일 주소 배열입니다.
 */
export type EmailWhitelist = string[];

// ============================================================================
// 화이트리스트 검증 함수
// ============================================================================

/**
 * 이메일을 정규화합니다 (소문자 변환 + 공백 제거).
 *
 * @param email - 정규화할 이메일
 * @returns 정규화된 이메일, 유효하지 않으면 null
 */
function normalizeEmail(email: string | null | undefined): string | null {
  if (email === null || email === undefined || email === '') {
    return null;
  }

  const normalized = email.trim().toLowerCase();
  return normalized === '' ? null : normalized;
}

/**
 * 이메일이 화이트리스트에 있는지 확인합니다.
 *
 * @description
 * 대소문자 구분 없이 이메일을 비교합니다.
 * 입력 이메일과 화이트리스트 이메일 모두 앞뒤 공백을 제거하고 비교합니다.
 *
 * @param email - 확인할 이메일 주소
 * @param whitelist - 허용된 이메일 목록
 * @returns 이메일이 화이트리스트에 있으면 true, 없으면 false
 *
 * @example
 * ```typescript
 * const whitelist = ['admin@example.com', 'user@example.com'];
 *
 * isEmailAllowed('admin@example.com', whitelist); // true
 * isEmailAllowed('ADMIN@EXAMPLE.COM', whitelist); // true (대소문자 무관)
 * isEmailAllowed('unknown@example.com', whitelist); // false
 * ```
 */
export function isEmailAllowed(
  email: string | null | undefined,
  whitelist: EmailWhitelist
): boolean {
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail === null) {
    return false;
  }

  if (whitelist.length === 0) {
    return false;
  }

  return whitelist.some(
    (allowedEmail) => normalizeEmail(allowedEmail) === normalizedEmail
  );
}

// ============================================================================
// 화이트리스트 로드 함수
// ============================================================================

/**
 * JSON 파일에서 허용된 이메일 목록을 로드합니다.
 *
 * @description
 * JSON 파일은 문자열 배열 형태여야 합니다.
 *
 * @param filePath - JSON 파일 경로
 * @returns 허용된 이메일 목록
 * @throws 파일이 없거나 유효하지 않은 JSON인 경우
 *
 * @example
 * ```typescript
 * // data/allowed-emails.json: ["admin@example.com", "user@example.com"]
 * const whitelist = await loadAllowedEmails('data/allowed-emails.json');
 * console.log(whitelist); // ['admin@example.com', 'user@example.com']
 * ```
 */
export async function loadAllowedEmails(filePath: string): Promise<EmailWhitelist> {
  // 파일 읽기 (파일 없으면 에러 throw)
  const content = await readFile(filePath, 'utf-8');

  // JSON 파싱 (유효하지 않은 JSON이면 에러 throw)
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in file: ${filePath}`);
  }

  // 배열인지 확인
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array in file: ${filePath}`);
  }

  // 모든 요소가 문자열인지 확인하고 반환
  const emails = parsed.map((item, index) => {
    if (typeof item !== 'string') {
      throw new Error(`Expected string at index ${index} in file: ${filePath}`);
    }
    return item;
  });

  return emails;
}
