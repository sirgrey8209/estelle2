/**
 * @file claude-event-type.ts
 * @description Claude 이벤트 타입 상수 정의
 *
 * Claude SDK에서 발생하는 이벤트의 타입을 정의합니다.
 * Pylon이 Claude 응답을 스트리밍할 때 각 이벤트를 구분하는 데 사용됩니다.
 */

/**
 * Claude 이벤트 타입 상수
 *
 * @description
 * Claude SDK 스트리밍 응답에서 발생하는 8가지 이벤트 타입을 정의합니다.
 *
 * 이벤트 흐름 예시:
 * 1. STATE (processing) - 처리 시작
 * 2. TEXT - 텍스트 응답 청크
 * 3. TOOL_START - 도구 사용 시작
 * 4. PERMISSION_REQUEST - 권한 필요 시 (선택적)
 * 5. TOOL_COMPLETE - 도구 사용 완료
 * 6. TEXT - 추가 텍스트 응답
 * 7. STATE (idle) - 처리 완료
 * 8. RESULT - 최종 결과
 *
 * @example
 * ```typescript
 * import { ClaudeEventType } from '@estelle/core';
 *
 * switch (event.type) {
 *   case ClaudeEventType.TEXT:
 *     appendText(event.content);
 *     break;
 *   case ClaudeEventType.PERMISSION_REQUEST:
 *     showPermissionDialog(event);
 *     break;
 * }
 * ```
 */
export const ClaudeEventType = {
  /** 상태 변경 (idle, processing 등) */
  STATE: 'state',
  /** 텍스트 응답 청크 */
  TEXT: 'text',
  /** 도구 사용 시작 */
  TOOL_START: 'tool_start',
  /** 도구 사용 완료 */
  TOOL_COMPLETE: 'tool_complete',
  /** 권한 요청 (파일 수정, 명령 실행 등) */
  PERMISSION_REQUEST: 'permission_request',
  /** 사용자에게 질문 */
  ASK_QUESTION: 'ask_question',
  /** 최종 결과 */
  RESULT: 'result',
  /** 에러 발생 */
  ERROR: 'error',
} as const;

/**
 * Claude 이벤트 타입 값의 유니온 타입
 *
 * @description
 * ClaudeEventType 객체의 모든 값들의 유니온 타입입니다.
 * 이벤트 타입을 받는 함수의 파라미터 타입으로 사용합니다.
 *
 * @example
 * ```typescript
 * function isInteractiveEvent(type: ClaudeEventTypeValue): boolean {
 *   return type === 'permission_request' || type === 'ask_question';
 * }
 * ```
 */
export type ClaudeEventTypeValue = typeof ClaudeEventType[keyof typeof ClaudeEventType];
