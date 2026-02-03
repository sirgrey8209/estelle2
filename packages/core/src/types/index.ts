/**
 * @file types/index.ts
 * @description 타입 모듈의 진입점
 *
 * 모든 공유 타입들을 이 파일에서 re-export 합니다.
 */

export * from './device.js';
export * from './message.js';
export * from './auth.js';
export * from './workspace.js';

// === 레거시 (deprecated) ===
// 하위 호환성을 위해 유지, 추후 제거 예정
export * from './claude-event.js';
export * from './claude-control.js';

// blob.js - Attachment는 BlobAttachment로 별칭
export {
  type Attachment as BlobAttachment,
  type BlobContextType,
  type BlobContext,
  type BlobStartPayload,
  type BlobChunkPayload,
  type BlobEndPayload,
  type BlobAckPayload,
  type BlobRequestPayload,
  isAttachment as isBlobAttachment,
  isBlobContextType,
  isBlobContext,
  isBlobStartPayload,
  isBlobChunkPayload,
  isBlobEndPayload,
  isBlobAckPayload,
  isBlobRequestPayload,
} from './blob.js';

// store-message.js - 모든 타입 export
export * from './store-message.js';
