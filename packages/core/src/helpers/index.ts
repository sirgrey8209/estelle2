/**
 * @file helpers/index.ts
 * @description 헬퍼 함수 모듈의 진입점
 *
 * 메시지 생성, 캐릭터 조회, 메시지 타입 가드 등
 * 유틸리티 함수들을 이 파일에서 re-export 합니다.
 */

// === 메시지 생성 ===
export {
  createMessage,
  type CreateMessageOptions,
} from './create-message.js';

// === 캐릭터(디바이스) 정보 ===
export {
  getCharacter,
  getConversationFullName,
  getDeskFullName, // deprecated alias
  DEFAULT_CHARACTER,
} from './character.js';

// === 메시지 타입 가드 ===
export {
  // 기본 메시지 검사
  isMessage,
  getMessageType,
  // Auth
  isAuthMessage,
  isAuthResultMessage,
  // Workspace
  isWorkspaceListResultMessage,
  // Claude
  isClaudeEventMessage,
  isClaudeSendMessage,
  // Blob
  isBlobStartMessage,
  isBlobChunkMessage,
  isBlobEndMessage,
  // Utility
  isPingMessage,
  isPongMessage,
  isErrorMessage,
  // Error 페이로드 타입
  type ErrorPayload,
} from './message-type-guards.js';
