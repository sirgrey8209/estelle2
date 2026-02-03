/**
 * @file messages.ts
 * @deprecated 이 파일은 레거시 호환성을 위해 유지됩니다.
 *
 * 새로운 코드에서는 다음을 사용하세요:
 * - `types/message.ts`의 Message<T> 타입
 * - `constants/message-type.ts`의 MessageType 상수
 * - `helpers/message-type-guards.ts`의 타입 가드 함수들
 *
 * 마이그레이션 예시:
 * ```typescript
 * // 기존 (deprecated)
 * import { PromptMessage, isPromptMessage } from '@estelle/core';
 *
 * // 새로운 방식
 * import {
 *   Message,
 *   MessageType,
 *   createMessage,
 *   isMessage,
 * } from '@estelle/core';
 *
 * const msg = createMessage(MessageType.PROMPT, { content: 'hello' });
 * ```
 *
 * 이 파일은 @estelle/pylon, @estelle/relay 마이그레이션 완료 후 제거됩니다.
 */

/**
 * 기본 메시지 인터페이스
 * @deprecated types/message.ts의 Message<T>를 사용하세요
 */
export interface BaseMessage {
  type: string;
  timestamp?: number;
}

/**
 * 라우팅 정보
 * @deprecated Message의 from/to 필드를 사용하세요
 */
export interface Routable {
  to?: number;       // 특정 디바이스에 전송
  broadcast?: boolean; // 모든 디바이스에 전송
  from?: number;     // 발신자 (Relay가 추가)
}

/**
 * 프롬프트 메시지 (App → Pylon)
 * @deprecated Message<PromptPayload>와 MessageType.PROMPT를 사용하세요
 */
export interface PromptMessage extends BaseMessage, Routable {
  type: 'prompt';
  conversationId: string;
  content: string;
}

/**
 * Claude 메시지 (Pylon → App)
 * @deprecated Message<ClaudeEventPayload>와 MessageType.CLAUDE_EVENT를 사용하세요
 */
export interface ClaudeMessage extends BaseMessage, Routable {
  type: 'claude_message';
  conversationId: string;
  role: 'assistant';
  content: string;
}

/**
 * 스트리밍 청크 (Pylon → App)
 * @deprecated Message<ClaudeEventPayload>와 ClaudeEventType을 사용하세요
 */
export interface StreamChunk extends BaseMessage, Routable {
  type: 'stream_chunk';
  conversationId: string;
  content: string;
}

/**
 * 모든 메시지 타입 유니온
 * @deprecated types/message.ts의 Message<T>를 사용하세요
 */
export type Message = PromptMessage | ClaudeMessage | StreamChunk;

/**
 * 메시지 타입 가드
 * @deprecated helpers/message-type-guards.ts의 isMessage()와 MessageType을 사용하세요
 */
export function isPromptMessage(msg: BaseMessage): msg is PromptMessage {
  return msg.type === 'prompt';
}

/**
 * @deprecated helpers/message-type-guards.ts의 isClaudeEventMessage()를 사용하세요
 */
export function isClaudeMessage(msg: BaseMessage): msg is ClaudeMessage {
  return msg.type === 'claude_message';
}

/**
 * @deprecated helpers/message-type-guards.ts의 isClaudeEventMessage()를 사용하세요
 */
export function isStreamChunk(msg: BaseMessage): msg is StreamChunk {
  return msg.type === 'stream_chunk';
}
