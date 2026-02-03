/**
 * @file claude-control.ts
 * @description Claude 제어 관련 Payload 타입 정의
 *
 * Estelle 시스템에서 App이 Pylon을 통해 Claude를 제어할 때 사용하는
 * 페이로드 타입들을 정의합니다. 메시지 전송, 권한 응답, 질문 답변,
 * 세션 제어 등의 기능을 포함합니다.
 */

import type { Attachment } from './blob.js';

// ============================================================================
// Claude Send Types
// ============================================================================

/**
 * Claude 메시지 전송 페이로드
 *
 * @description
 * App에서 Claude에게 메시지를 전송할 때 사용하는 페이로드입니다.
 * 텍스트 메시지와 선택적으로 첨부 파일을 함께 전송할 수 있습니다.
 *
 * @property conversationId - 메시지를 전송할 대상 대화의 고유 식별자
 * @property message - 전송할 텍스트 메시지 내용
 * @property attachments - 첨부 파일 목록 (선택적)
 *
 * @example
 * ```typescript
 * // 텍스트만 전송
 * const payload: ClaudeSendPayload = {
 *   conversationId: 'main-workspace-001',
 *   message: '파일을 읽어주세요.'
 * };
 *
 * // 첨부 파일과 함께 전송
 * const payloadWithAttachment: ClaudeSendPayload = {
 *   conversationId: 'main-workspace-001',
 *   message: '이 파일을 분석해주세요.',
 *   attachments: [{
 *     id: 'att-001',
 *     filename: 'data.csv',
 *     mimeType: 'text/csv',
 *     size: 1024
 *   }]
 * };
 * ```
 */
export interface ClaudeSendPayload {
  /** 메시지를 전송할 대상 대화의 고유 식별자 */
  conversationId: string;

  /** 전송할 텍스트 메시지 내용 */
  message: string;

  /** 첨부 파일 목록 (선택적) */
  attachments?: Attachment[];
}

// ============================================================================
// Permission Types
// ============================================================================

/**
 * 권한 요청에 대한 결정 타입
 *
 * @description
 * Claude가 권한 요청(permission_request 이벤트)을 보냈을 때
 * 사용자가 응답할 수 있는 결정 유형입니다.
 *
 * - `allow`: 이번 요청만 허용
 * - `deny`: 이번 요청 거부
 * - `allowAll`: 이후 동일 유형의 모든 요청 허용
 *
 * @example
 * ```typescript
 * const decision: PermissionDecision = 'allow';
 * ```
 */
export type PermissionDecision = 'allow' | 'deny' | 'allowAll';

/**
 * 권한 응답 페이로드
 *
 * @description
 * Claude의 권한 요청(permission_request 이벤트)에 대한 응답을 전송할 때
 * 사용하는 페이로드입니다. toolUseId를 통해 어떤 요청에 대한 응답인지 식별합니다.
 *
 * @property conversationId - 응답을 전송할 대상 대화의 고유 식별자
 * @property toolUseId - 권한 요청의 고유 식별자 (permission_request 이벤트에서 제공)
 * @property decision - 권한 결정 ('allow', 'deny', 'allowAll')
 *
 * @example
 * ```typescript
 * const payload: ClaudePermissionPayload = {
 *   conversationId: 'main-workspace-001',
 *   toolUseId: 'toolu_01234567890abcdef',
 *   decision: 'allow'
 * };
 * ```
 */
export interface ClaudePermissionPayload {
  /** 응답을 전송할 대상 대화의 고유 식별자 */
  conversationId: string;

  /** 권한 요청의 고유 식별자 */
  toolUseId: string;

  /** 권한 결정 */
  decision: PermissionDecision;
}

// ============================================================================
// Answer Types
// ============================================================================

/**
 * 질문 답변 페이로드
 *
 * @description
 * Claude의 질문(ask_question 이벤트)에 대한 답변을 전송할 때
 * 사용하는 페이로드입니다. 사용자가 선택한 옵션이나 자유 입력 답변을 포함합니다.
 *
 * @property conversationId - 답변을 전송할 대상 대화의 고유 식별자
 * @property toolUseId - 질문의 고유 식별자 (ask_question 이벤트에서 제공)
 * @property answer - 사용자의 답변 내용
 *
 * @example
 * ```typescript
 * // 옵션 선택
 * const payload: ClaudeAnswerPayload = {
 *   conversationId: 'main-workspace-001',
 *   toolUseId: 'toolu_abcdef123456',
 *   answer: 'React'
 * };
 *
 * // 자유 입력
 * const freeformPayload: ClaudeAnswerPayload = {
 *   conversationId: 'main-workspace-001',
 *   toolUseId: 'toolu_xyz789',
 *   answer: '사용자 정의 응답입니다.'
 * };
 * ```
 */
export interface ClaudeAnswerPayload {
  /** 답변을 전송할 대상 대화의 고유 식별자 */
  conversationId: string;

  /** 질문의 고유 식별자 */
  toolUseId: string;

  /** 사용자의 답변 내용 */
  answer: string;
}

// ============================================================================
// Control Types
// ============================================================================

/**
 * Claude 제어 액션 타입
 *
 * @description
 * Claude 세션을 제어하는 액션 유형입니다.
 *
 * - `stop`: 현재 진행 중인 작업 중지
 * - `new_session`: 새 세션 시작 (대화 기록 초기화)
 * - `clear`: 현재 세션 클리어
 * - `compact`: 대화 컨텍스트 압축 (토큰 절약)
 *
 * @example
 * ```typescript
 * const action: ClaudeControlAction = 'stop';
 * ```
 */
export type ClaudeControlAction = 'stop' | 'new_session' | 'clear' | 'compact';

/**
 * Claude 제어 페이로드
 *
 * @description
 * Claude 세션을 제어(중지, 초기화, 압축 등)할 때 사용하는 페이로드입니다.
 *
 * @property conversationId - 제어할 대상 대화의 고유 식별자
 * @property action - 수행할 제어 액션
 *
 * @example
 * ```typescript
 * // 작업 중지
 * const stopPayload: ClaudeControlPayload = {
 *   conversationId: 'main-workspace-001',
 *   action: 'stop'
 * };
 *
 * // 새 세션 시작
 * const newSessionPayload: ClaudeControlPayload = {
 *   conversationId: 'main-workspace-001',
 *   action: 'new_session'
 * };
 *
 * // 컨텍스트 압축
 * const compactPayload: ClaudeControlPayload = {
 *   conversationId: 'main-workspace-001',
 *   action: 'compact'
 * };
 * ```
 */
export interface ClaudeControlPayload {
  /** 제어할 대상 대화의 고유 식별자 */
  conversationId: string;

  /** 수행할 제어 액션 */
  action: ClaudeControlAction;
}

// ============================================================================
// Permission Mode Types
// ============================================================================

/**
 * 권한 모드 타입
 *
 * @description
 * Claude의 도구 사용 권한 모드를 정의합니다.
 * Pylon에서 Claude를 실행할 때 적용되는 권한 정책입니다.
 *
 * - `default`: 기본 모드 - 매 권한 요청마다 사용자 승인 필요
 * - `acceptEdits`: 편집 자동 승인 - 파일 편집 권한 자동 허용
 * - `bypassPermissions`: 권한 우회 - 모든 권한 자동 허용 (주의 필요)
 *
 * @example
 * ```typescript
 * const mode: PermissionModeType = 'default';
 * ```
 */
export type PermissionModeType = 'default' | 'acceptEdits' | 'bypassPermissions';

/**
 * 권한 모드 설정 페이로드
 *
 * @description
 * Claude의 권한 모드를 변경할 때 사용하는 페이로드입니다.
 * 대화 전체에 적용되는 설정입니다.
 *
 * @property mode - 설정할 권한 모드
 *
 * @example
 * ```typescript
 * // 기본 모드로 설정
 * const defaultMode: SetPermissionModePayload = {
 *   mode: 'default'
 * };
 *
 * // 편집 자동 승인 모드
 * const acceptEditsMode: SetPermissionModePayload = {
 *   mode: 'acceptEdits'
 * };
 *
 * // 권한 우회 모드 (위험)
 * const bypassMode: SetPermissionModePayload = {
 *   mode: 'bypassPermissions'
 * };
 * ```
 */
export interface SetPermissionModePayload {
  /** 설정할 권한 모드 */
  mode: PermissionModeType;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * 값이 객체이고 null이 아닌지 확인하는 헬퍼 함수
 *
 * @param value - 확인할 값
 * @returns 객체이고 null이 아니면 true
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 유효한 PermissionDecision 값 목록
 */
const PERMISSION_DECISIONS: readonly string[] = ['allow', 'deny', 'allowAll'];

/**
 * 유효한 ClaudeControlAction 값 목록
 */
const CONTROL_ACTIONS: readonly string[] = ['stop', 'new_session', 'clear', 'compact'];

/**
 * 유효한 PermissionModeType 값 목록
 */
const PERMISSION_MODES: readonly string[] = ['default', 'acceptEdits', 'bypassPermissions'];

/**
 * PermissionDecision 타입 가드
 *
 * @description
 * 주어진 값이 유효한 PermissionDecision 값인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns 유효한 PermissionDecision이면 true
 *
 * @example
 * ```typescript
 * const decision: unknown = 'allow';
 * if (isPermissionDecision(decision)) {
 *   // decision은 PermissionDecision 타입으로 좁혀짐
 * }
 * ```
 */
export function isPermissionDecision(value: unknown): value is PermissionDecision {
  return typeof value === 'string' && PERMISSION_DECISIONS.includes(value);
}

/**
 * ClaudeControlAction 타입 가드
 *
 * @description
 * 주어진 값이 유효한 ClaudeControlAction 값인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns 유효한 ClaudeControlAction이면 true
 *
 * @example
 * ```typescript
 * const action: unknown = 'stop';
 * if (isClaudeControlAction(action)) {
 *   // action은 ClaudeControlAction 타입으로 좁혀짐
 * }
 * ```
 */
export function isClaudeControlAction(value: unknown): value is ClaudeControlAction {
  return typeof value === 'string' && CONTROL_ACTIONS.includes(value);
}

/**
 * PermissionModeType 타입 가드
 *
 * @description
 * 주어진 값이 유효한 PermissionModeType 값인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns 유효한 PermissionModeType이면 true
 *
 * @example
 * ```typescript
 * const mode: unknown = 'default';
 * if (isPermissionModeType(mode)) {
 *   // mode는 PermissionModeType 타입으로 좁혀짐
 * }
 * ```
 */
export function isPermissionModeType(value: unknown): value is PermissionModeType {
  return typeof value === 'string' && PERMISSION_MODES.includes(value);
}

/**
 * ClaudeSendPayload 타입 가드
 *
 * @description
 * 주어진 값이 ClaudeSendPayload 타입인지 확인합니다.
 * conversationId와 message가 문자열인지, attachments가 있다면 배열인지 검사합니다.
 *
 * @param value - 확인할 값
 * @returns ClaudeSendPayload 타입이면 true
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(message);
 * if (isClaudeSendPayload(data)) {
 *   console.log('Desk:', data.conversationId);
 *   console.log('Message:', data.message);
 * }
 * ```
 */
export function isClaudeSendPayload(value: unknown): value is ClaudeSendPayload {
  if (!isObject(value)) return false;
  if (typeof value.conversationId !== 'string') return false;
  if (typeof value.message !== 'string') return false;
  if (value.attachments !== undefined && !Array.isArray(value.attachments)) return false;
  return true;
}

/**
 * ClaudePermissionPayload 타입 가드
 *
 * @description
 * 주어진 값이 ClaudePermissionPayload 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns ClaudePermissionPayload 타입이면 true
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(message);
 * if (isClaudePermissionPayload(data)) {
 *   console.log('Decision:', data.decision);
 * }
 * ```
 */
export function isClaudePermissionPayload(value: unknown): value is ClaudePermissionPayload {
  return (
    isObject(value) &&
    typeof value.conversationId === 'string' &&
    typeof value.toolUseId === 'string' &&
    isPermissionDecision(value.decision)
  );
}

/**
 * ClaudeAnswerPayload 타입 가드
 *
 * @description
 * 주어진 값이 ClaudeAnswerPayload 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns ClaudeAnswerPayload 타입이면 true
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(message);
 * if (isClaudeAnswerPayload(data)) {
 *   console.log('Answer:', data.answer);
 * }
 * ```
 */
export function isClaudeAnswerPayload(value: unknown): value is ClaudeAnswerPayload {
  return (
    isObject(value) &&
    typeof value.conversationId === 'string' &&
    typeof value.toolUseId === 'string' &&
    typeof value.answer === 'string'
  );
}

/**
 * ClaudeControlPayload 타입 가드
 *
 * @description
 * 주어진 값이 ClaudeControlPayload 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns ClaudeControlPayload 타입이면 true
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(message);
 * if (isClaudeControlPayload(data)) {
 *   console.log('Action:', data.action);
 * }
 * ```
 */
export function isClaudeControlPayload(value: unknown): value is ClaudeControlPayload {
  return (
    isObject(value) &&
    typeof value.conversationId === 'string' &&
    isClaudeControlAction(value.action)
  );
}

/**
 * SetPermissionModePayload 타입 가드
 *
 * @description
 * 주어진 값이 SetPermissionModePayload 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns SetPermissionModePayload 타입이면 true
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(message);
 * if (isSetPermissionModePayload(data)) {
 *   console.log('Mode:', data.mode);
 * }
 * ```
 */
export function isSetPermissionModePayload(value: unknown): value is SetPermissionModePayload {
  return (
    isObject(value) &&
    isPermissionModeType(value.mode)
  );
}
