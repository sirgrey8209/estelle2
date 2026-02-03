// @estelle/pylon
// Pylon 서비스 진입점

// 메인 Pylon 클래스
export {
  Pylon,
  type PylonConfig,
  type PylonDependencies,
  type RelayClientAdapter,
  type LocalServerAdapter,
  type ClaudeManagerAdapter,
  type BlobHandlerAdapter,
  type TaskManagerAdapter,
  type WorkerManagerAdapter,
  type FolderManagerAdapter,
  type LoggerAdapter,
  type PacketLoggerAdapter,
  type BugReportWriter,
} from './pylon.js';

// 레거시 상태 클래스 (deprecated)
export * from './state.js';
export * from './utils/index.js';

// stores - 명시적 export (Conversation 이름 충돌 방지)
export {
  WorkspaceStore,
  type Conversation as WorkspaceConversation,
  type Workspace,
  type WorkspaceWithActive,
  type WorkspaceStoreData,
  type CreateWorkspaceResult,
  type ActiveState,
  type FinishingConversationInfo,
  type FinishedConversationInfo,
} from './stores/index.js';

// handlers - 메시지 핸들러
export {
  BlobHandler,
  type BlobTransfer,
  type BlobHandlerOptions,
  type BlobHandlerResult,
  type FileSystemAdapter,
  type SendFileFn,
} from './handlers/index.js';

// network - 네트워크 통신 모듈
export {
  LocalServer,
  createLocalServer,
  DEFAULT_LOCAL_PORT,
  RelayClient,
  createRelayClient,
  DEFAULT_RECONNECT_INTERVAL,
  type LocalServerOptions,
  type LocalServerCallbacks,
  type RelayClientOptions,
  type RelayClientCallbacks,
} from './network/index.js';

// managers - 태스크/워커/폴더 관리 모듈
export {
  TaskManager,
  WorkerManager,
  FolderManager,
  type Task,
  type TaskMeta,
  type TaskStatus,
  type CreateTaskResult,
  type GetTaskResult,
  type ListTasksResult,
  type UpdateTaskResult,
  type FileSystem,
  type WorkerState,
  type WorkerStatus,
  type CanStartWorkerResult,
  type StartWorkerResult,
  type StopWorkerResult,
  type StartClaudeCallback,
  type WorkerStatusSummary,
  type FolderFileSystem,
  type ListFoldersResult,
  type FolderOperationResult,
} from './managers/index.js';

// claude - Claude Agent SDK 연동 모듈
export {
  ClaudeManager,
  // 권한 규칙 순수 함수
  checkPermission,
  isAutoAllowTool,
  isEditTool,
  checkAutoDenyPattern,
  isPermissionAllow,
  isPermissionDeny,
  isPermissionAsk,
  // 상수
  AUTO_ALLOW_TOOLS,
  EDIT_TOOLS,
  AUTO_DENY_PATTERNS,
  // 타입
  type ClaudeManagerOptions,
  type ClaudeManagerEvent,
  type ClaudeManagerEventType,
  type ClaudeState,
  type TokenUsage,
  type ClaudeSession,
  type PendingPermission,
  type PendingQuestion,
  type PendingEvent,
  type PermissionCallbackResult,
  type SendMessageOptions,
  type ClaudeEventHandler,
  type GetPermissionModeFn,
  type LoadMcpConfigFn,
  type ClaudeAdapter,
  type ClaudeQueryOptions,
  type ClaudeMessage,
  type PermissionResult,
  type PermissionAllowResult,
  type PermissionDenyResult,
  type PermissionAskResult,
  type AutoDenyPattern,
} from './claude/index.js';

// persistence - 영속성 모듈
export {
  FileSystemPersistence,
  type PersistenceAdapter,
  type FileSystemInterface,
} from './persistence/index.js';
