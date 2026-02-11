/**
 * @file stores/index.ts
 * @description Zustand 스토어 모듈 진입점
 */

export { useRelayStore, type RelayState } from './relayStore';

// 워크스페이스 스토어
export {
  useWorkspaceStore,
  type WorkspaceState,
  type ConnectedPylon,
  type SelectedConversation,
} from './workspaceStore';

// 타입과 유틸리티는 @estelle/core에서 re-export
export type {
  ClaudeStatus,
  StoreMessage,
  Attachment,
  FileInfo,
  ResultInfo,
  PendingRequest,
  PermissionRequest,
  QuestionRequest,
} from '@estelle/core';

export {
  parseAttachments,
  getAbortDisplayText,
  formatFileSize,
} from '@estelle/core';

/**
 * @deprecated StoreMessage를 사용하세요
 */
export type { StoreMessage as ClaudeMessage } from '@estelle/core';
export {
  useSettingsStore,
  type SettingsState,
} from './settingsStore';
export {
  useUploadStore,
  type UploadState,
  type UploadStatus,
  type UploadInfo,
} from './uploadStore';
export {
  useDownloadStore,
  type DownloadState,
  type DownloadStatus,
} from './downloadStore';
export {
  useImageUploadStore,
  type ImageUploadState,
  type AttachedImage,
  type UploadInfo as ImageUploadInfo,
} from './imageUploadStore';
export {
  useDeviceConfigStore,
  type DeviceConfigState,
  type DeviceConfig,
} from './deviceConfigStore';

// 대화별 Claude 상태 스토어
export {
  useConversationStore,
  useCurrentConversationState,
  type ConversationStoreState,
  getInitialClaudeState,
} from './conversationStore';

// 동기화 상태 스토어
export {
  useSyncStore,
  type SyncState,
  type SyncPhase,
  type ConversationSyncInfo,
} from './syncStore';
