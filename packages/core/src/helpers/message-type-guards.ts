/**
 * @file message-type-guards.ts
 * @description 메시지 타입 가드 함수
 *
 * 시스템에서 주고받는 메시지의 타입을 런타임에 확인하기 위한
 * 타입 가드 함수들을 제공합니다. MessageType 상수와 함께 사용하여
 * 타입 안전한 메시지 처리를 가능하게 합니다.
 */

import type { Message } from '../types/index.js';
import type {
  AuthPayload,
  AuthResultPayload,
} from '../types/auth.js';
import type {
  WorkspaceListResultPayload,
} from '../types/workspace.js';
import type {
  ClaudeEventPayload,
} from '../types/claude-event.js';
import type {
  ClaudeSendPayload,
} from '../types/claude-control.js';
import type {
  BlobStartPayload,
  BlobChunkPayload,
  BlobEndPayload,
} from '../types/blob.js';
import { MessageType } from '../constants/index.js';

// ============================================================================
// 헬퍼 함수
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

// ============================================================================
// 기본 메시지 타입 가드
// ============================================================================

/**
 * 값이 유효한 Message 구조인지 확인합니다
 *
 * @description
 * 메시지의 기본 구조(type, payload, timestamp)가 유효한지 검사합니다.
 * 세부적인 payload 타입은 검사하지 않습니다.
 *
 * @param value - 확인할 값
 * @returns 유효한 Message 구조면 true
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(rawMessage);
 * if (isMessage(data)) {
 *   console.log('Type:', data.type);
 *   console.log('Payload:', data.payload);
 * }
 * ```
 */
export function isMessage(value: unknown): value is Message<unknown> {
  if (!isObject(value)) return false;
  if (typeof value.type !== 'string') return false;
  if (typeof value.timestamp !== 'number') return false;
  if (!('payload' in value)) return false;
  return true;
}

/**
 * 메시지의 type 필드를 추출합니다
 *
 * @description
 * 메시지 객체에서 type 필드를 안전하게 추출합니다.
 * 유효하지 않은 메시지인 경우 null을 반환합니다.
 *
 * @param value - 메시지 또는 알 수 없는 값
 * @returns 메시지 타입 문자열 또는 null
 *
 * @example
 * ```typescript
 * const type = getMessageType(message);
 * if (type === MessageType.AUTH) {
 *   // auth 메시지 처리
 * }
 * ```
 */
export function getMessageType(value: unknown): string | null {
  if (!isObject(value)) return null;
  if (typeof value.type !== 'string') return null;
  return value.type;
}

// ============================================================================
// Auth 메시지 타입 가드
// ============================================================================

/**
 * Auth 메시지 타입 가드
 *
 * @description
 * 메시지가 인증 요청(auth) 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns auth 타입 메시지면 true
 *
 * @example
 * ```typescript
 * if (isAuthMessage(message)) {
 *   const { pcId, deviceType } = message.payload;
 *   // 인증 처리
 * }
 * ```
 */
export function isAuthMessage(value: unknown): value is Message<AuthPayload> {
  if (!isMessage(value)) return false;
  return value.type === MessageType.AUTH;
}

/**
 * AuthResult 메시지 타입 가드
 *
 * @description
 * 메시지가 인증 결과(auth_result) 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns auth_result 타입 메시지면 true
 *
 * @example
 * ```typescript
 * if (isAuthResultMessage(message)) {
 *   if (message.payload.success) {
 *     console.log('인증 성공!');
 *   }
 * }
 * ```
 */
export function isAuthResultMessage(value: unknown): value is Message<AuthResultPayload> {
  if (!isMessage(value)) return false;
  return value.type === MessageType.AUTH_RESULT;
}

// ============================================================================
// Workspace 메시지 타입 가드
// ============================================================================

/**
 * WorkspaceListResult 메시지 타입 가드
 *
 * @description
 * 메시지가 워크스페이스 목록 결과(workspace_list_result) 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns workspace_list_result 타입 메시지면 true
 *
 * @example
 * ```typescript
 * if (isWorkspaceListResultMessage(message)) {
 *   message.payload.workspaces.forEach(workspace => {
 *     console.log(workspace.name);
 *   });
 * }
 * ```
 */
export function isWorkspaceListResultMessage(value: unknown): value is Message<WorkspaceListResultPayload> {
  if (!isMessage(value)) return false;
  return value.type === MessageType.WORKSPACE_LIST_RESULT;
}

// ============================================================================
// Claude 메시지 타입 가드
// ============================================================================

/**
 * ClaudeEvent 메시지 타입 가드
 *
 * @description
 * 메시지가 Claude 이벤트(claude_event) 타입인지 확인합니다.
 * Claude SDK에서 발생하는 다양한 이벤트(text, tool_start 등)를 포함합니다.
 *
 * @param value - 확인할 값
 * @returns claude_event 타입 메시지면 true
 *
 * @example
 * ```typescript
 * if (isClaudeEventMessage(message)) {
 *   const { conversationId, event } = message.payload;
 *   switch (event.type) {
 *     case 'text':
 *       console.log(event.content);
 *       break;
 *     // ...
 *   }
 * }
 * ```
 */
export function isClaudeEventMessage(value: unknown): value is Message<ClaudeEventPayload> {
  if (!isMessage(value)) return false;
  return value.type === MessageType.CLAUDE_EVENT;
}

/**
 * ClaudeSend 메시지 타입 가드
 *
 * @description
 * 메시지가 Claude 전송(claude_send) 타입인지 확인합니다.
 * 사용자가 Claude에게 보내는 메시지입니다.
 *
 * @param value - 확인할 값
 * @returns claude_send 타입 메시지면 true
 *
 * @example
 * ```typescript
 * if (isClaudeSendMessage(message)) {
 *   const { conversationId, message: content } = message.payload;
 *   // Claude에 메시지 전달
 * }
 * ```
 */
export function isClaudeSendMessage(value: unknown): value is Message<ClaudeSendPayload> {
  if (!isMessage(value)) return false;
  return value.type === MessageType.CLAUDE_SEND;
}

// ============================================================================
// Blob 메시지 타입 가드
// ============================================================================

/**
 * BlobStart 메시지 타입 가드
 *
 * @description
 * 메시지가 Blob 전송 시작(blob_start) 타입인지 확인합니다.
 * 대용량 파일 전송의 시작을 알리는 메시지입니다.
 *
 * @param value - 확인할 값
 * @returns blob_start 타입 메시지면 true
 *
 * @example
 * ```typescript
 * if (isBlobStartMessage(message)) {
 *   const { blobId, filename, totalChunks } = message.payload;
 *   // 파일 수신 준비
 * }
 * ```
 */
export function isBlobStartMessage(value: unknown): value is Message<BlobStartPayload> {
  if (!isMessage(value)) return false;
  return value.type === MessageType.BLOB_START;
}

/**
 * BlobChunk 메시지 타입 가드
 *
 * @description
 * 메시지가 Blob 청크(blob_chunk) 타입인지 확인합니다.
 * 파일 데이터의 한 조각을 담고 있는 메시지입니다.
 *
 * @param value - 확인할 값
 * @returns blob_chunk 타입 메시지면 true
 *
 * @example
 * ```typescript
 * if (isBlobChunkMessage(message)) {
 *   const { blobId, index, data } = message.payload;
 *   // 청크 데이터 저장
 * }
 * ```
 */
export function isBlobChunkMessage(value: unknown): value is Message<BlobChunkPayload> {
  if (!isMessage(value)) return false;
  return value.type === MessageType.BLOB_CHUNK;
}

/**
 * BlobEnd 메시지 타입 가드
 *
 * @description
 * 메시지가 Blob 전송 완료(blob_end) 타입인지 확인합니다.
 * 파일 전송 완료를 알리는 메시지입니다.
 *
 * @param value - 확인할 값
 * @returns blob_end 타입 메시지면 true
 *
 * @example
 * ```typescript
 * if (isBlobEndMessage(message)) {
 *   const { blobId, totalReceived, checksum } = message.payload;
 *   // 파일 조립 및 무결성 검증
 * }
 * ```
 */
export function isBlobEndMessage(value: unknown): value is Message<BlobEndPayload> {
  if (!isMessage(value)) return false;
  return value.type === MessageType.BLOB_END;
}

// ============================================================================
// Utility 메시지 타입 가드
// ============================================================================

/**
 * Ping 메시지 타입 가드
 *
 * @description
 * 메시지가 연결 유지 확인 요청(ping) 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns ping 타입 메시지면 true
 *
 * @example
 * ```typescript
 * if (isPingMessage(message)) {
 *   // pong 응답 전송
 *   send(createMessage('pong', null));
 * }
 * ```
 */
export function isPingMessage(value: unknown): value is Message<null> {
  if (!isMessage(value)) return false;
  return value.type === MessageType.PING;
}

/**
 * Pong 메시지 타입 가드
 *
 * @description
 * 메시지가 연결 유지 확인 응답(pong) 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns pong 타입 메시지면 true
 *
 * @example
 * ```typescript
 * if (isPongMessage(message)) {
 *   // 연결 살아있음 확인
 *   lastPongTime = Date.now();
 * }
 * ```
 */
export function isPongMessage(value: unknown): value is Message<null> {
  if (!isMessage(value)) return false;
  return value.type === MessageType.PONG;
}

/**
 * Error 페이로드 타입
 *
 * @description
 * 에러 메시지에 포함되는 페이로드 구조입니다.
 */
export interface ErrorPayload {
  /** 에러 코드 */
  code: string;
  /** 에러 메시지 */
  message: string;
  /** 추가 데이터 (선택적) */
  data?: unknown;
}

/**
 * Error 메시지 타입 가드
 *
 * @description
 * 메시지가 에러(error) 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns error 타입 메시지면 true
 *
 * @example
 * ```typescript
 * if (isErrorMessage(message)) {
 *   console.error(`Error [${message.payload.code}]: ${message.payload.message}`);
 * }
 * ```
 */
export function isErrorMessage(value: unknown): value is Message<ErrorPayload> {
  if (!isMessage(value)) return false;
  return value.type === MessageType.ERROR;
}
