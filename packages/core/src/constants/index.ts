/**
 * @file constants/index.ts
 * @description 상수 모듈 진입점
 *
 * 시스템에서 사용하는 모든 상수를 re-export 합니다.
 */

// === 메시지 타입 ===
export { MessageType, type MessageTypeValue } from './message-type.js';

// === 대화 상태 ===
export {
  ConversationStatus,
  type ConversationStatusValue,
} from './conversation-status.js';

// === Claude 이벤트 타입 ===
export { ClaudeEventType, type ClaudeEventTypeValue } from './claude-event-type.js';

// === 권한 모드 ===
export { PermissionMode, type PermissionModeValue } from './permission-mode.js';

// === Blob 설정 ===
export { BlobConfig, type ChunkSize, type BlobEncoding } from './blob-config.js';

// === 캐릭터(디바이스) 정보 ===
export {
  Characters,
  type CharacterId,
  type CharacterInfo,
} from './characters.js';
