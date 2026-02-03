/**
 * @estelle/core
 *
 * Estelle 시스템의 공유 타입, 상수, 헬퍼 함수를 제공합니다.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import {
 *   // 상수
 *   MessageType,
 *   ConversationStatus,
 *   ClaudeEventType,
 *   PermissionMode,
 *
 *   // 타입
 *   Message,
 *   DeviceId,
 *   AuthPayload,
 *   Workspace,
 *   Conversation,
 *
 *   // 헬퍼
 *   createMessage,
 *   isAuthMessage,
 *   getCharacter,
 * } from '@estelle/core';
 * ```
 */

// ============================================================================
// 상수 (Constants)
// ============================================================================
export * from './constants/index.js';

// ============================================================================
// 타입 (Types) - 새로운 표준
// ============================================================================
export * from './types/index.js';

// ============================================================================
// 헬퍼 함수 (Helpers)
// ============================================================================
export * from './helpers/index.js';

// ============================================================================
// 유틸리티 (Utils)
// ============================================================================
export * from './utils/index.js';

// ============================================================================
// 네트워크 (Network)
// ============================================================================
export * from './network/index.js';

// ============================================================================
// 레거시 타입 (Deprecated - 하위 호환성)
// ============================================================================
/**
 * @deprecated 레거시 타입입니다. 새로운 Message 타입을 사용하세요.
 *
 * 마이그레이션 가이드:
 * - BaseMessage → Message<T>
 * - Routable → Message의 from/to 필드
 * - PromptMessage → Message<PromptPayload> with type: 'prompt'
 * - ClaudeMessage → Message<ClaudeEventPayload>
 * - StreamChunk → Message with type: 'claude_event'
 * - isPromptMessage → isMessage(msg) && msg.type === MessageType.PROMPT
 * - isClaudeMessage → isClaudeEventMessage(msg)
 * - isStreamChunk → isClaudeEventMessage(msg)
 *
 * 이 타입들은 @estelle/pylon, @estelle/relay 마이그레이션 완료 후 제거됩니다.
 */
export {
  /** @deprecated */
  BaseMessage,
  /** @deprecated */
  Routable,
  /** @deprecated */
  PromptMessage,
  /** @deprecated */
  ClaudeMessage,
  /** @deprecated */
  StreamChunk,
  /** @deprecated */
  Message as LegacyMessage,
  /** @deprecated */
  isPromptMessage,
  /** @deprecated */
  isClaudeMessage,
  /** @deprecated */
  isStreamChunk,
} from './messages.js';
