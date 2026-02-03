/**
 * @file permission-rules.ts
 * @description 권한 규칙 - Claude 도구 실행 권한 결정 로직
 *
 * Claude가 도구를 실행할 때 자동 허용/거부 여부를 결정하는 순수 함수들입니다.
 * 모킹 없이 테스트 가능한 순수 로직으로 구성됩니다.
 *
 * 권한 결정 흐름:
 * 1. bypassPermissions 모드 → 모든 도구 자동 허용 (AskUserQuestion 제외)
 * 2. acceptEdits 모드 → 편집 도구(Edit, Write, Bash, NotebookEdit) 자동 허용
 * 3. 자동 허용 도구(Read, Glob 등) → 자동 허용
 * 4. 자동 거부 패턴 매칭 → 자동 거부
 * 5. 그 외 → 사용자 권한 요청 필요
 *
 * @example
 * ```typescript
 * import { checkPermission, PermissionResult } from './permission-rules.js';
 *
 * const result = checkPermission('Read', { file_path: '/test.txt' }, 'default');
 * if (result.behavior === 'allow') {
 *   // 자동 허용
 * } else if (result.behavior === 'deny') {
 *   // 자동 거부
 * } else {
 *   // 사용자 권한 요청 필요
 * }
 * ```
 */

import { PermissionMode } from '@estelle/core';
import type { PermissionModeValue } from '@estelle/core';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 권한 결정 결과 - 허용
 *
 * @description
 * 도구 실행이 자동으로 허용되는 경우입니다.
 * updatedInput은 원본 입력과 동일하거나 수정된 입력입니다.
 */
export interface PermissionAllowResult {
  /** 허용 동작 */
  behavior: 'allow';

  /** 실행할 입력 (원본 또는 수정됨) */
  updatedInput: Record<string, unknown>;
}

/**
 * 권한 결정 결과 - 거부
 *
 * @description
 * 도구 실행이 자동으로 거부되는 경우입니다.
 * 보안 패턴 매칭으로 위험한 작업을 차단합니다.
 */
export interface PermissionDenyResult {
  /** 거부 동작 */
  behavior: 'deny';

  /** 거부 사유 메시지 */
  message: string;
}

/**
 * 권한 결정 결과 - 사용자 확인 필요
 *
 * @description
 * 자동 허용/거부 규칙에 해당하지 않아 사용자 확인이 필요한 경우입니다.
 */
export interface PermissionAskResult {
  /** 사용자 확인 필요 */
  behavior: 'ask';
}

/**
 * 권한 결정 결과 유니온 타입
 */
export type PermissionResult =
  | PermissionAllowResult
  | PermissionDenyResult
  | PermissionAskResult;

/**
 * 자동 거부 패턴 정의
 *
 * @description
 * 특정 도구와 입력 패턴 조합이 위험한 경우를 정의합니다.
 */
export interface AutoDenyPattern {
  /** 대상 도구 이름 */
  toolName: string;

  /** 위험 패턴 정규식 */
  pattern: RegExp;

  /** 거부 사유 */
  reason: string;
}

// ============================================================================
// 상수 정의
// ============================================================================

/**
 * 자동 허용 도구 목록
 *
 * @description
 * 읽기 전용 작업이나 안전한 도구들의 목록입니다.
 * 이 도구들은 권한 모드와 관계없이 항상 자동 허용됩니다.
 *
 * - Read: 파일 읽기
 * - Glob: 파일 패턴 검색
 * - Grep: 텍스트 검색
 * - WebSearch: 웹 검색
 * - WebFetch: 웹 페이지 가져오기
 * - TodoWrite: 할 일 목록 작성
 * - TaskList/TaskGet/TaskCreate/TaskUpdate: 태스크 관리
 */
export const AUTO_ALLOW_TOOLS = new Set([
  'Read',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
  'TodoWrite',
  'TaskList',
  'TaskGet',
  'TaskCreate',
  'TaskUpdate',
]);

/**
 * 편집 도구 목록 (acceptEdits 모드에서 자동 허용)
 *
 * @description
 * 파일 수정 관련 도구들입니다.
 * acceptEdits 모드에서 이 도구들은 자동 허용됩니다.
 */
export const EDIT_TOOLS = new Set(['Edit', 'Write', 'Bash', 'NotebookEdit']);

/**
 * 자동 거부 패턴 목록
 *
 * @description
 * 보안상 위험한 패턴들을 정의합니다.
 * 민감한 파일 접근이나 위험한 명령어를 자동으로 차단합니다.
 *
 * 패턴 설명:
 * - Edit/Write + .env 등: 환경 변수, 비밀 정보 파일 보호
 * - Bash + rm -rf / 등: 시스템 파괴 명령어 차단
 */
export const AUTO_DENY_PATTERNS: AutoDenyPattern[] = [
  {
    toolName: 'Edit',
    pattern: /\.(env|secret|credentials|password)/i,
    reason: 'Protected file: cannot edit sensitive configuration files',
  },
  {
    toolName: 'Write',
    pattern: /\.(env|secret|credentials|password)/i,
    reason: 'Protected file: cannot write to sensitive configuration files',
  },
  {
    toolName: 'Bash',
    // rm -rf /, format, del /f /s, shutdown, reboot, mkfs
    pattern:
      /rm\s+-rf\s+\/|format\s+|del\s+\/f\s+\/s|shutdown|reboot|mkfs/i,
    reason: 'Dangerous command: potentially destructive system command blocked',
  },
];

// ============================================================================
// 순수 함수
// ============================================================================

/**
 * 도구가 자동 허용 목록에 있는지 확인
 *
 * @param toolName - 확인할 도구 이름
 * @returns 자동 허용 여부
 *
 * @example
 * ```typescript
 * isAutoAllowTool('Read');    // true
 * isAutoAllowTool('Edit');    // false
 * ```
 */
export function isAutoAllowTool(toolName: string): boolean {
  return AUTO_ALLOW_TOOLS.has(toolName);
}

/**
 * 도구가 편집 도구 목록에 있는지 확인
 *
 * @param toolName - 확인할 도구 이름
 * @returns 편집 도구 여부
 *
 * @example
 * ```typescript
 * isEditTool('Edit');   // true
 * isEditTool('Read');   // false
 * ```
 */
export function isEditTool(toolName: string): boolean {
  return EDIT_TOOLS.has(toolName);
}

/**
 * 자동 거부 패턴 매칭 확인
 *
 * @description
 * 도구 이름과 입력값을 자동 거부 패턴과 비교합니다.
 * Bash 도구는 command 필드를, 다른 도구는 file_path 필드를 검사합니다.
 *
 * @param toolName - 도구 이름
 * @param input - 도구 입력
 * @returns 매칭된 거부 패턴 또는 null
 *
 * @example
 * ```typescript
 * checkAutoDenyPattern('Edit', { file_path: '.env' });
 * // { toolName: 'Edit', pattern: /.../, reason: 'Protected file' }
 *
 * checkAutoDenyPattern('Read', { file_path: '.env' });
 * // null (Read는 자동 거부 대상이 아님)
 * ```
 */
export function checkAutoDenyPattern(
  toolName: string,
  input: Record<string, unknown>
): AutoDenyPattern | null {
  for (const pattern of AUTO_DENY_PATTERNS) {
    if (pattern.toolName !== toolName) {
      continue;
    }

    // Bash는 command 필드, 다른 도구는 file_path 필드 검사
    const valueToCheck =
      toolName === 'Bash'
        ? (input.command as string) || ''
        : (input.file_path as string) || '';

    if (pattern.pattern.test(valueToCheck)) {
      return pattern;
    }
  }

  return null;
}

/**
 * 권한 확인 메인 함수
 *
 * @description
 * 도구 실행 권한을 결정하는 핵심 순수 함수입니다.
 * 권한 모드와 도구/입력 조합에 따라 자동 허용, 자동 거부,
 * 또는 사용자 확인 필요 여부를 반환합니다.
 *
 * 결정 우선순위:
 * 1. bypassPermissions 모드 → 모두 허용 (AskUserQuestion 제외)
 * 2. acceptEdits 모드 + 편집 도구 → 허용
 * 3. 자동 허용 도구 → 허용
 * 4. 자동 거부 패턴 → 거부
 * 5. 그 외 → 사용자 확인 필요
 *
 * @param toolName - 도구 이름
 * @param input - 도구 입력
 * @param permissionMode - 현재 권한 모드
 * @returns 권한 결정 결과
 *
 * @example
 * ```typescript
 * // 자동 허용
 * checkPermission('Read', { file_path: '/test.txt' }, 'default');
 * // { behavior: 'allow', updatedInput: { file_path: '/test.txt' } }
 *
 * // 자동 거부
 * checkPermission('Edit', { file_path: '.env' }, 'default');
 * // { behavior: 'deny', message: 'Protected file: ...' }
 *
 * // 사용자 확인 필요
 * checkPermission('Edit', { file_path: 'main.ts' }, 'default');
 * // { behavior: 'ask' }
 * ```
 */
export function checkPermission(
  toolName: string,
  input: Record<string, unknown>,
  permissionMode: PermissionModeValue
): PermissionResult {
  // 1. bypassPermissions 모드: AskUserQuestion 제외 모두 허용
  if (permissionMode === PermissionMode.BYPASS && toolName !== 'AskUserQuestion') {
    return { behavior: 'allow', updatedInput: input };
  }

  // 2. acceptEdits 모드: 편집 도구 자동 허용
  if (permissionMode === PermissionMode.ACCEPT_EDITS && isEditTool(toolName)) {
    return { behavior: 'allow', updatedInput: input };
  }

  // 3. 자동 허용 도구 확인
  if (isAutoAllowTool(toolName)) {
    return { behavior: 'allow', updatedInput: input };
  }

  // 4. 자동 거부 패턴 확인
  const denyPattern = checkAutoDenyPattern(toolName, input);
  if (denyPattern) {
    return { behavior: 'deny', message: denyPattern.reason };
  }

  // 5. 그 외: 사용자 확인 필요
  return { behavior: 'ask' };
}

/**
 * 권한 결과가 허용인지 확인하는 타입 가드
 *
 * @param result - 권한 결과
 * @returns PermissionAllowResult 타입이면 true
 */
export function isPermissionAllow(
  result: PermissionResult
): result is PermissionAllowResult {
  return result.behavior === 'allow';
}

/**
 * 권한 결과가 거부인지 확인하는 타입 가드
 *
 * @param result - 권한 결과
 * @returns PermissionDenyResult 타입이면 true
 */
export function isPermissionDeny(
  result: PermissionResult
): result is PermissionDenyResult {
  return result.behavior === 'deny';
}

/**
 * 권한 결과가 사용자 확인 필요인지 확인하는 타입 가드
 *
 * @param result - 권한 결과
 * @returns PermissionAskResult 타입이면 true
 */
export function isPermissionAsk(
  result: PermissionResult
): result is PermissionAskResult {
  return result.behavior === 'ask';
}
