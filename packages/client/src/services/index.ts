/**
 * @file services/index.ts
 * @description 서비스 모듈 진입점
 */

export {
  ImageCacheService,
  imageCache,
  type CacheStats,
  type CacheConfig,
} from './imageCacheService';

export {
  RelayService,
  type RelayConfig,
  type RelayMessage,
  type RelayEventType,
} from './relayService';

// WebSocketAdapter는 @estelle/core에서 직접 import
export type { WebSocketAdapter } from '@estelle/core';

export {
  BlobTransferService,
  blobService,
  type BlobTransfer,
  type BlobTransferState,
  type BlobUploadCompleteEvent,
  type BlobDownloadCompleteEvent,
  type BlobSender,
} from './blobService';

export {
  setWebSocket,
  getWebSocket,
  sendMessage,
  requestWorkspaceList,
  createWorkspace,
  deleteWorkspace,
  createConversation,
  selectConversation,
  sendClaudeMessage,
  sendPermissionResponse,
  sendQuestionResponse,
  sendClaudeControl,
  setPermissionMode,
} from './relaySender';

export {
  conversationCache,
  type CacheMetadata,
  type CacheData,
  type CacheConfig as ConversationCacheConfig,
} from './conversationCacheService';
