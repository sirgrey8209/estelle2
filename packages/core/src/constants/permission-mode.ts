/**
 * @file permission-mode.ts
 * @description 권한 모드 상수 정의
 *
 * Claude Code의 권한 모드를 정의합니다.
 * 파일 수정, 명령 실행 등의 권한 요청에 대한 처리 방식을 결정합니다.
 */

/**
 * 권한 모드 상수
 *
 * @description
 * Claude Code의 3가지 권한 모드를 정의합니다.
 *
 * 모드별 동작:
 * - DEFAULT: 모든 권한 요청에 대해 사용자 확인 필요
 * - ACCEPT_EDITS: 파일 수정은 자동 승인, 명령 실행은 확인 필요
 * - BYPASS: 모든 권한 요청 자동 승인 (주의: 위험할 수 있음)
 *
 * @example
 * ```typescript
 * import { PermissionMode } from '@estelle/core';
 *
 * // 권한 모드 설정
 * await setPermissionMode(PermissionMode.ACCEPT_EDITS);
 *
 * // 현재 모드에 따른 분기
 * if (currentMode === PermissionMode.BYPASS) {
 *   console.warn('모든 권한이 자동 승인됩니다!');
 * }
 * ```
 */
export const PermissionMode = {
  /** 기본 모드 - 모든 권한 요청에 확인 필요 */
  DEFAULT: 'default',
  /** 편집 허용 - 파일 수정은 자동 승인 */
  ACCEPT_EDITS: 'acceptEdits',
  /** 권한 우회 - 모든 요청 자동 승인 (위험) */
  BYPASS: 'bypassPermissions',
} as const;

/**
 * 권한 모드 값의 유니온 타입
 *
 * @description
 * PermissionMode 객체의 모든 값들의 유니온 타입입니다.
 * 권한 모드를 받는 함수의 파라미터 타입으로 사용합니다.
 *
 * @example
 * ```typescript
 * function setPermissionMode(mode: PermissionModeValue): void {
 *   // 모드 설정 로직
 * }
 * ```
 */
export type PermissionModeValue = typeof PermissionMode[keyof typeof PermissionMode];
