/**
 * @file conversation-status.ts
 * @description 대화 상태 상수 정의
 *
 * Pylon의 각 대화(Conversation)가 가질 수 있는 상태를 정의합니다.
 * App에서 대화의 현재 상태를 표시하는 데 사용됩니다.
 */

/**
 * 대화 상태 상수
 *
 * @description
 * 대화가 가질 수 있는 4가지 상태를 정의합니다.
 *
 * 상태 전이:
 * - IDLE -> WORKING: Claude 작업 시작 시
 * - WORKING -> WAITING: 권한 요청 대기 시
 * - WAITING -> WORKING: 권한 승인/거부 후
 * - WORKING -> IDLE: 작업 완료 시
 * - * -> ERROR: 에러 발생 시
 *
 * 참고:
 * - 연결 상태(online/offline)는 Conversation 상태가 아닌 Device 레벨에서 관리
 * - unread는 별도 boolean 필드로 관리
 *
 * @example
 * ```typescript
 * import { ConversationStatus } from '@estelle/core';
 *
 * if (conversation.status === ConversationStatus.WAITING) {
 *   showPermissionDialog();
 * }
 * ```
 */
export const ConversationStatus = {
  /** 대기 중 - Claude가 유휴 상태 */
  IDLE: 'idle',
  /** 작업 중 - Claude가 응답 생성 중 */
  WORKING: 'working',
  /** 권한 대기 - Claude가 사용자 권한 승인 대기 중 */
  WAITING: 'waiting',
  /** 에러 - 오류 발생 */
  ERROR: 'error',
} as const;

/**
 * 대화 상태 값의 유니온 타입
 *
 * @description
 * ConversationStatus 객체의 모든 값들의 유니온 타입입니다.
 * 대화 상태를 받는 함수의 파라미터 타입으로 사용합니다.
 *
 * @example
 * ```typescript
 * function updateStatusIcon(status: ConversationStatusValue): string {
 *   switch (status) {
 *     case 'idle': return '💤';
 *     case 'working': return '⚡';
 *     case 'waiting': return '🔐';
 *     case 'error': return '❌';
 *   }
 * }
 * ```
 */
export type ConversationStatusValue =
  (typeof ConversationStatus)[keyof typeof ConversationStatus];
