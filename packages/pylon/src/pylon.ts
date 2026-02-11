/**
 * @file pylon.ts
 * @description Pylon - Estelle 시스템의 핵심 서비스
 *
 * Pylon은 Claude Code와 클라이언트 앱 사이를 중계하는 핵심 서비스입니다.
 * 모든 모듈(WorkspaceStore, MessageStore, ClaudeManager, BlobHandler 등)을
 * 통합하고 메시지 라우팅을 담당합니다.
 *
 * 주요 기능:
 * - Relay 서버 연결 및 인증
 * - 워크스페이스/대화 관리
 * - Claude SDK 연동 및 이벤트 전달
 * - Blob(이미지) 전송 처리
 * - 세션 뷰어 관리
 *
 * 설계 원칙:
 * - 의존성 주입을 통한 테스트 용이성
 * - 모킹 없이 테스트 가능한 순수 로직 중심
 * - 외부 I/O는 어댑터/콜백으로 분리
 *
 * @example
 * ```typescript
 * import { Pylon, createDefaultDependencies } from './pylon.js';
 *
 * const config = {
 *   deviceId: 1,
 *   relayUrl: 'ws://relay.example.com',
 *   uploadsDir: './uploads',
 * };
 *
 * const deps = createDefaultDependencies(config);
 * const pylon = new Pylon(config, deps);
 *
 * await pylon.start();
 * ```
 */

import type { PermissionModeValue, ConversationStatusValue } from '@estelle/core';
import { decodeEntityId, type EntityId } from '@estelle/core';
import type { WorkspaceStore, Workspace, Conversation } from './stores/workspace-store.js';
import type { MessageStore, StoreMessage } from './stores/message-store.js';
import type { ClaudeManagerEvent } from './claude/claude-manager.js';
import type { PersistenceAdapter } from './persistence/types.js';
import { generateThumbnail } from './utils/thumbnail.js';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * Pylon 설정
 */
export interface PylonConfig {
  /** 디바이스 ID (숫자) */
  deviceId: number;

  /** 디바이스 이름 (선택) */
  deviceName?: string;

  /** Relay 서버 URL */
  relayUrl: string;

  /** 업로드 파일 저장 디렉토리 */
  uploadsDir: string;
}

/**
 * RelayClient 인터페이스 (의존성 주입용)
 */
export interface RelayClientAdapter {
  connect(): void;
  disconnect(): void;
  send(message: unknown): void;
  isConnected(): boolean;
  onMessage(callback: (data: unknown) => void): void;
  onStatusChange(callback: (isConnected: boolean) => void): void;
}

/**
 * ClaudeManager 인터페이스 (의존성 주입용)
 */
export interface ClaudeManagerAdapter {
  sendMessage(entityId: number, message: string, options: { workingDir: string; claudeSessionId?: string }): Promise<void>;
  stop(entityId: number): void;
  newSession(entityId: number): void;
  cleanup(): void;
  abortAllSessions(): number[];
  respondPermission(entityId: number, toolUseId: string, decision: 'allow' | 'deny' | 'allowAll'): void;
  respondQuestion(entityId: number, toolUseId: string, answer: string): void;
  hasActiveSession(entityId: number): boolean;
  getSessionStartTime(entityId: number): number | null;
  getPendingEvent(entityId: number): unknown;
}

/**
 * BlobHandler 인터페이스 (의존성 주입용)
 */
export interface BlobHandlerAdapter {
  handleBlobStart(message: unknown): { success: boolean; path?: string };
  handleBlobChunk(message: unknown): void;
  handleBlobEnd(message: unknown): { success: boolean; path?: string; context?: unknown };
  handleBlobRequest(message: unknown): void;
}

/**
 * TaskManager 인터페이스 (의존성 주입용)
 */
export interface TaskManagerAdapter {
  listTasks(workingDir: string): { success: boolean; tasks: unknown[] };
  getTask(workingDir: string, taskId: string): { success: boolean; task?: unknown };
  updateTaskStatus(workingDir: string, taskId: string, status: string, error?: string): { success: boolean };
}

/**
 * WorkerManager 인터페이스 (의존성 주입용)
 */
export interface WorkerManagerAdapter {
  getWorkerStatus(workspaceId: number, workingDir: string): { running: boolean };
  startWorker(workspaceId: number, workingDir: string, callback: unknown): Promise<{ success: boolean }>;
  stopWorker(workspaceId: number, workingDir: string): { success: boolean };
}

/**
 * 드라이브 정보
 */
interface DriveInfo {
  path: string;
  label: string;
  hasChildren: boolean;
}

/**
 * FolderManager 인터페이스 (의존성 주입용)
 */
export interface FolderManagerAdapter {
  listFolders(path: string): { success: boolean; folders: unknown[] };
  listDrives(): { success: boolean; drives: DriveInfo[]; error?: string };
  createFolder(parentPath: string, name: string): { success: boolean };
  renameFolder(folderPath: string, newName: string): { success: boolean };
}

/**
 * Logger 인터페이스 (의존성 주입용)
 */
export interface LoggerAdapter {
  log(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * CredentialManager 인터페이스 (의존성 주입용)
 */
export interface CredentialManagerAdapter {
  getCurrentAccount(): Promise<{ account: string; subscriptionType: string } | null>;
  switchAccount(account: string): Promise<void>;
  hasBackup(account: string): Promise<boolean>;
}

/**
 * PacketLogger 인터페이스 (의존성 주입용)
 */
export interface PacketLoggerAdapter {
  logSend(source: string, message: unknown): void;
  logRecv(source: string, message: unknown): void;
}

/**
 * 버그 리포트 작성기 인터페이스
 */
export interface BugReportWriter {
  /** 버그 리포트 파일에 내용 추가 */
  append(content: string): void;
}

/**
 * Pylon 의존성 (의존성 주입)
 */
export interface PylonDependencies {
  workspaceStore: WorkspaceStore;
  messageStore: MessageStore;
  relayClient: RelayClientAdapter;
  claudeManager: ClaudeManagerAdapter;
  blobHandler: BlobHandlerAdapter;
  taskManager: TaskManagerAdapter;
  workerManager: WorkerManagerAdapter;
  folderManager: FolderManagerAdapter;
  logger: LoggerAdapter;
  packetLogger: PacketLoggerAdapter;

  /** 영속성 어댑터 (선택, 없으면 메모리만 사용) */
  persistence?: PersistenceAdapter;

  /** 버그 리포트 작성기 (선택) */
  bugReportWriter?: BugReportWriter;

  /** 인증 관리자 (선택, 계정 전환 기능에 필요) */
  credentialManager?: CredentialManagerAdapter;
}

/**
 * 메시지 from 정보
 */
interface MessageFrom {
  deviceId: string;
  name?: string;
}

/**
 * 디바이스 정보
 */
interface DeviceInfo {
  deviceId: string;
  name: string;
  icon?: string;
}

// ============================================================================
// Pylon 클래스
// ============================================================================

/**
 * Pylon - Estelle 시스템의 핵심 서비스 클래스
 *
 * @description
 * Pylon은 모든 모듈을 통합하고 메시지 라우팅을 담당하는 메인 클래스입니다.
 * 의존성 주입 패턴을 사용하여 테스트 용이성을 확보합니다.
 *
 * @example
 * ```typescript
 * const pylon = new Pylon(config, dependencies);
 * await pylon.start();
 * ```
 */
export class Pylon {
  // ==========================================================================
  // Private 필드
  // ==========================================================================

  /** 설정 */
  private readonly config: PylonConfig;

  /** 의존성 */
  private readonly deps: PylonDependencies;

  /** 인증 여부 */
  private authenticated: boolean = false;

  /** 디바이스 정보 */
  private deviceInfo: DeviceInfo | null = null;

  /** 캐싱된 계정 정보 */
  private cachedAccount: { current: string; subscriptionType: string } | null = null;

  /** 세션별 시청자: Map<entityId, Set<clientDeviceId>> */
  private readonly sessionViewers: Map<number, Set<string>> = new Map();

  /** 앱별 unread 알림 전송 기록: Map<appId, Set<entityId>> */
  private readonly appUnreadSent: Map<string, Set<number>> = new Map();

  /** 대화별 pending 파일: Map<entityId, Map<fileId, FileInfo>> */
  private readonly pendingFiles: Map<number, Map<string, unknown>> = new Map();

  /** Claude 누적 사용량 */
  private claudeUsage = {
    totalCostUsd: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheCreationTokens: 0,
    sessionCount: 0,
    lastUpdated: null as string | null,
  };

  /** 메시지 저장 debounce 타이머: Map<entityId, timerId> */
  private readonly messageSaveTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();

  /** 메시지 저장 debounce 시간 (ms) */
  private readonly MESSAGE_SAVE_DEBOUNCE_MS = 2000;

  /** 워크스페이스 저장 debounce 타이머 */
  private workspaceSaveTimer: ReturnType<typeof setTimeout> | null = null;

  /** 워크스페이스 저장 debounce 시간 (ms) */
  private readonly WORKSPACE_SAVE_DEBOUNCE_MS = 3000;

  // ==========================================================================
  // 생성자
  // ==========================================================================

  /**
   * Pylon 인스턴스 생성
   *
   * @param config - Pylon 설정
   * @param deps - 의존성 (테스트 시 Mock 주입)
   */
  constructor(config: PylonConfig, deps: PylonDependencies) {
    this.config = config;
    this.deps = deps;

    // 콜백 설정
    this.setupCallbacks();
  }

  // ==========================================================================
  // Public 메서드 - 생명주기
  // ==========================================================================

  /**
   * Pylon 시작
   *
   * @description
   * 영속 데이터를 로드하고 Relay에 연결합니다.
   */
  async start(): Promise<void> {
    this.log(`[Estelle Pylon] Starting...`);
    this.log(`Device ID: ${this.config.deviceId}`);
    this.log(`Relay URL: ${this.config.relayUrl}`);

    // 영속 데이터 로드
    await this.loadPersistedData();

    // 계정 정보 캐싱
    await this.refreshAccountCache();

    // 모든 대화의 메시지 세션 로딩
    // 로딩 없이 메시지 추가 시 _ensureCache가 빈 배열을 생성하여 히스토리가 덮어써짐
    this.loadAllMessageSessions();

    // 워크스페이스 초기화: working/waiting 상태인 대화들을 idle로 리셋
    const resetEntityIds = this.deps.workspaceStore.resetActiveConversations();
    for (const entityId of resetEntityIds) {
      this.deps.messageStore.addAborted(entityId, 'session_ended');
      this.log(`[Startup] Added session_ended to history: ${entityId}`);
    }

    // 리셋된 대화가 있으면 워크스페이스 저장
    if (resetEntityIds.length > 0) {
      await this.saveWorkspaceStore();
    }

    // Relay 연결
    this.deps.relayClient.connect();
  }

  /**
   * 계정 정보 캐싱 갱신
   */
  private async refreshAccountCache(): Promise<void> {
    if (!this.deps.credentialManager) {
      this.cachedAccount = null;
      return;
    }

    try {
      const info = await this.deps.credentialManager.getCurrentAccount();
      if (info) {
        this.cachedAccount = {
          current: info.account,
          subscriptionType: info.subscriptionType,
        };
        this.log(`[Account] Cached: ${info.account} (${info.subscriptionType})`);
      } else {
        this.cachedAccount = null;
        this.log(`[Account] No account info found`);
      }
    } catch (err) {
      this.cachedAccount = null;
      this.deps.logger.error(`[Account] Failed to cache account info: ${err}`);
    }
  }

  /**
   * Pylon 종료
   *
   * @description
   * 데이터를 저장하고 모든 서비스를 정리합니다.
   */
  async stop(): Promise<void> {
    this.log('Shutting down...');

    // 모든 debounce 타이머 취소 및 즉시 저장
    await this.flushPendingSaves();

    // 워크스페이스 저장
    await this.saveWorkspaceStore();

    // Claude 세션 정리
    this.deps.claudeManager.cleanup();

    // Relay 연결 종료
    this.deps.relayClient.disconnect();
  }

  // ==========================================================================
  // Public 메서드 - 상태 조회
  // ==========================================================================

  /**
   * 디바이스 ID 반환
   */
  getDeviceId(): number {
    return this.config.deviceId;
  }

  /**
   * 디바이스 이름 반환
   */
  getDeviceName(): string | undefined {
    return this.config.deviceName;
  }

  /**
   * 인증 여부 반환
   */
  isAuthenticated(): boolean {
    return this.authenticated;
  }

  /**
   * 세션 시청자 수 반환
   */
  getSessionViewerCount(entityId: number): number {
    return this.sessionViewers.get(entityId)?.size ?? 0;
  }

  /**
   * 세션 시청자 목록 반환
   */
  getSessionViewers(entityId: number): Set<string> {
    return this.sessionViewers.get(entityId) ?? new Set();
  }

  // ==========================================================================
  // Public 메서드 - 메시지 처리
  // ==========================================================================

  /**
   * 메시지 처리 (Relay에서 호출)
   *
   * @param message - 수신된 메시지
   */
  handleMessage(message: Record<string, unknown>): void {
    const { type, payload, from } = message as {
      type: string;
      payload?: Record<string, unknown>;
      from?: MessageFrom;
    };

    // 연결 확인
    if (type === 'connected') {
      this.log(`Connected to Relay: ${(payload as { message?: string })?.message || ''}`);
      return;
    }

    // 인증 결과
    if (type === 'auth_result') {
      this.handleAuthResult(payload);
      return;
    }

    // 레거시: registered 응답 처리
    if (type === 'registered') {
      this.handleRegistered();
      return;
    }

    // 디바이스 상태 변경
    if (type === 'device_status') {
      this.handleDeviceStatus(payload);
      return;
    }

    // 클라이언트 연결 해제
    if (type === 'client_disconnect') {
      const clientId = (payload as { deviceId?: string })?.deviceId;
      if (clientId) {
        this.unregisterSessionViewer(clientId);
      }
      return;
    }

    // 에러
    if (type === 'error') {
      this.log(`Error from Relay: ${(payload as { error?: string })?.error}`);
      return;
    }

    // ping/pong
    if (type === 'ping') {
      this.send({ type: 'pong', timestamp: Date.now(), to: from?.deviceId });
      return;
    }

    // 상태 조회
    if (type === 'get_status') {
      this.handleGetStatus(from);
      return;
    }

    // 히스토리 요청
    if (type === 'history_request') {
      this.handleHistoryRequest(payload, from);
      return;
    }

    // ===== 워크스페이스 관련 =====
    if (type === 'workspace_list') {
      this.handleWorkspaceList(from);
      return;
    }

    if (type === 'workspace_create') {
      this.handleWorkspaceCreate(payload, from);
      return;
    }

    if (type === 'workspace_delete') {
      this.handleWorkspaceDelete(payload, from);
      return;
    }

    if (type === 'workspace_update') {
      this.handleWorkspaceUpdate(payload, from);
      return;
    }

    if (type === 'workspace_reorder') {
      this.handleWorkspaceReorder(payload);
      return;
    }

    if (type === 'workspace_rename') {
      this.handleWorkspaceRename(payload);
      return;
    }

    if (type === 'workspace_switch') {
      this.handleWorkspaceSwitch(payload);
      return;
    }

    // ===== 대화 관련 =====
    if (type === 'conversation_create') {
      this.handleConversationCreate(payload, from);
      return;
    }

    if (type === 'conversation_delete') {
      this.handleConversationDelete(payload);
      return;
    }

    if (type === 'conversation_rename') {
      this.handleConversationRename(payload);
      return;
    }

    if (type === 'conversation_select') {
      this.handleConversationSelect(payload, from);
      return;
    }

    if (type === 'conversation_reorder') {
      this.handleConversationReorder(payload);
      return;
    }

    // ===== Claude 관련 =====
    if (type === 'claude_send') {
      this.handleClaudeSend(payload, from);
      return;
    }

    if (type === 'claude_permission') {
      this.handleClaudePermission(payload);
      return;
    }

    if (type === 'claude_answer') {
      this.handleClaudeAnswer(payload);
      return;
    }

    if (type === 'claude_control') {
      this.handleClaudeControl(payload);
      return;
    }

    if (type === 'claude_set_permission_mode') {
      this.handleClaudeSetPermissionMode(payload);
      return;
    }

    // ===== Blob 관련 =====
    if (type === 'blob_start') {
      this.deps.blobHandler.handleBlobStart(message);
      return;
    }

    if (type === 'blob_chunk') {
      this.deps.blobHandler.handleBlobChunk(message);
      return;
    }

    if (type === 'blob_end') {
      const result = this.deps.blobHandler.handleBlobEnd(message);
      // 비동기로 썸네일 생성 후 완료 알림 (에러는 내부에서 처리)
      void this.handleBlobEndResult(result, from, payload);
      return;
    }

    if (type === 'blob_request') {
      this.deps.blobHandler.handleBlobRequest(message);
      return;
    }

    // ===== 폴더 관련 =====
    if (type === 'folder_list') {
      this.handleFolderList(payload, from);
      return;
    }

    if (type === 'folder_create') {
      this.handleFolderCreate(payload, from);
      return;
    }

    if (type === 'folder_rename') {
      this.handleFolderRename(payload, from);
      return;
    }

    // ===== 태스크 관련 =====
    if (type === 'task_list') {
      this.handleTaskList(payload, from);
      return;
    }

    if (type === 'task_get') {
      this.handleTaskGet(payload, from);
      return;
    }

    if (type === 'task_status') {
      this.handleTaskStatus(payload, from);
      return;
    }

    // ===== 워커 관련 =====
    if (type === 'worker_status') {
      this.handleWorkerStatus(payload, from);
      return;
    }

    if (type === 'worker_start') {
      this.handleWorkerStart(payload, from);
      return;
    }

    if (type === 'worker_stop') {
      this.handleWorkerStop(payload, from);
      return;
    }

    // ===== 디버그 로그 =====
    if (type === 'debug_log') {
      this.handleDebugLog(payload, from);
      return;
    }

    // ===== 버그 리포트 =====
    if (type === 'bug_report') {
      this.handleBugReport(payload);
      return;
    }

    // ===== Usage 조회 =====
    if (type === 'usage_request') {
      this.handleUsageRequest(from);
      return;
    }

    // ===== 계정 전환 =====
    if (type === 'account_switch') {
      this.handleAccountSwitch(payload, from);
      return;
    }

    // 알 수 없는 메시지는 무시
  }

  /**
   * Claude 이벤트 전달
   *
   * @description
   * ClaudeManager에서 발생한 이벤트를 클라이언트에게 전달합니다.
   *
   * @param entityId - 엔티티 ID
   * @param event - Claude 이벤트
   */
  sendClaudeEvent(entityId: number, event: ClaudeManagerEvent): void {
    // 이벤트 타입별 메시지 저장
    this.saveEventToHistory(entityId, event);

    // init 이벤트에서 claudeSessionId 저장
    if (event.type === 'init' && (event as Record<string, unknown>).session_id) {
      this.deps.workspaceStore.updateClaudeSessionId(
        entityId as EntityId,
        (event as Record<string, unknown>).session_id as string
      );
      this.saveWorkspaceStore().catch((err) => {
        this.log(`[Persistence] Failed to save claudeSessionId: ${err}`);
      });
    }

    // result 이벤트에서 사용량 누적
    if (event.type === 'result') {
      this.accumulateUsage(event);
    }

    const message = {
      type: 'claude_event',
      payload: { entityId, event },
    };

    // 해당 세션을 시청 중인 클라이언트에게만 전송
    const viewers = this.getSessionViewers(entityId);
    if (viewers.size > 0) {
      this.send({
        ...message,
        to: Array.from(viewers),
      });
    }

    // 상태 변경은 모든 클라이언트에게 브로드캐스트
    if (event.type === 'state') {
      const state = (event as Record<string, unknown>).state as ConversationStatusValue;
      this.deps.workspaceStore.updateConversationStatus(entityId as EntityId, state);
      this.scheduleSaveWorkspaceStore();

      this.send({
        type: 'conversation_status',
        payload: {
          deviceId: this.config.deviceId,
          entityId,
          status: state,
        },
        broadcast: 'clients',
      });
    }

    // 안 보고 있는 앱에게 unread 알림
    if (['textComplete', 'toolComplete', 'result', 'claudeAborted'].includes(event.type)) {
      this.sendUnreadToNonViewers(entityId, viewers);
    }
  }

  // ==========================================================================
  // Private 메서드 - 콜백 설정
  // ==========================================================================

  /**
   * 콜백 설정
   */
  private setupCallbacks(): void {
    // Relay 메시지 콜백
    this.deps.relayClient.onMessage((data) => {
      this.deps.packetLogger.logRecv('relay', data);
      this.handleMessage(data as Record<string, unknown>);
    });

    // Relay 상태 변경 콜백
    this.deps.relayClient.onStatusChange((isConnected) => {
      if (!isConnected) {
        this.authenticated = false;
        this.deviceInfo = null;
      }
    });
  }

  // ==========================================================================
  // Private 메서드 - 인증 관련
  // ==========================================================================

  /**
   * 인증 결과 처리
   */
  private handleAuthResult(payload: Record<string, unknown> | undefined): void {
    if (payload?.success) {
      this.authenticated = true;
      const device = payload.device as DeviceInfo;
      this.deviceInfo = device;
      this.log(`Authenticated as ${device?.name || this.config.deviceId}`);
      // broadcastWorkspaceList()에서 계정 상태도 함께 전송
      this.broadcastWorkspaceList();
    } else {
      this.log(`Auth failed: ${payload?.error}`);
    }
  }

  /**
   * 레거시 registered 처리
   */
  private handleRegistered(): void {
    this.authenticated = true;
    if (!this.deviceInfo) {
      this.deviceInfo = {
        deviceId: String(this.config.deviceId),
        name: `Device ${this.config.deviceId}`,
      };
    }
    this.log(`Registered as Device ${this.config.deviceId}`);
    this.broadcastWorkspaceList();
  }

  /**
   * 디바이스 상태 처리
   */
  private handleDeviceStatus(_payload: Record<string, unknown> | undefined): void {
    this.broadcastPylonStatus();
  }

  // ==========================================================================
  // Private 메서드 - 상태 조회
  // ==========================================================================

  /**
   * get_status 처리
   */
  private handleGetStatus(from: MessageFrom | undefined): void {
    this.send({
      type: 'status',
      to: from?.deviceId,
      payload: {
        deviceId: this.config.deviceId,
        deviceInfo: this.deviceInfo,
        authenticated: this.authenticated,
        workspaces: this.deps.workspaceStore.getAllWorkspaces(),
      },
    });
  }

  // ==========================================================================
  // Private 메서드 - 히스토리
  // ==========================================================================

  /**
   * 히스토리 요청 처리 (페이징: 100KB 제한)
   *
   * @param loadBefore - 이 인덱스 이전의 메시지를 로드 (0이면 최신부터)
   */
  private handleHistoryRequest(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { entityId, loadBefore = 0 } = payload || {};
    if (!entityId) return;

    const MAX_BYTES = 100 * 1024; // 100KB
    const eid = entityId as number;
    const totalCount = this.deps.messageStore.getCount(eid);
    const messages = this.deps.messageStore.getMessages(eid, {
      maxBytes: MAX_BYTES,
      loadBefore: loadBefore as number,
    });

    // hasMore 계산:
    // - 초기 로드 (loadBefore=0): 반환된 메시지 수 < totalCount
    // - 페이징 (loadBefore>0): loadBefore - messages.length > 0 (더 과거 메시지 있음)
    const lb = loadBefore as number;
    const hasMore = lb > 0
      ? (lb - messages.length) > 0
      : messages.length < totalCount;

    // メッセージセッションをロード (lazy loading)
    this.loadMessageSession(eid);

    this.send({
      type: 'history_result',
      to: from?.deviceId,
      payload: {
        deviceId: this.config.deviceId,
        entityId: eid,
        messages,
        loadBefore,
        totalCount,
        hasMore,
      },
    });
  }

  // ==========================================================================
  // Private 메서드 - 워크스페이스
  // ==========================================================================

  /**
   * workspace_list 처리
   */
  private handleWorkspaceList(from: MessageFrom | undefined): void {
    const workspaces = this.deps.workspaceStore.getAllWorkspaces();
    const activeState = this.deps.workspaceStore.getActiveState();
    this.send({
      type: 'workspace_list_result',
      to: from?.deviceId,
      payload: {
        deviceId: this.config.deviceId,
        workspaces,
        activeWorkspaceId: activeState.activeWorkspaceId,
        activeConversationId: activeState.activeConversationId,
        account: this.cachedAccount,  // 계정 정보 포함
      },
    });
  }

  /**
   * workspace_create 처리
   */
  private handleWorkspaceCreate(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { name, workingDir } = payload || {};
    if (!name || !workingDir) return;

    const result = this.deps.workspaceStore.createWorkspace(name as string, workingDir as string);
    this.send({
      type: 'workspace_create_result',
      to: from?.deviceId,
      payload: {
        deviceId: this.config.deviceId,
        success: true,
        workspace: result.workspace,
        conversation: result.conversation,
      },
    });
    this.broadcastWorkspaceList();
    this.saveWorkspaceStore().catch((err) => {
      this.deps.logger.error(`[Pylon] Failed to save after workspace create: ${err}`);
    });
  }

  /**
   * workspace_delete 처리
   */
  private handleWorkspaceDelete(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { workspaceId } = payload || {};
    if (!workspaceId) return;

    // 삭제 전에 모든 대화의 메시지 정리
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId as number);
    if (workspace) {
      for (const conv of workspace.conversations) {
        this.clearMessagesForEntity(conv.entityId);
      }
    }

    const success = this.deps.workspaceStore.deleteWorkspace(workspaceId as number);
    this.send({
      type: 'workspace_delete_result',
      to: from?.deviceId,
      payload: { deviceId: this.config.deviceId, success, workspaceId },
    });
    if (success) {
      this.broadcastWorkspaceList();
      this.saveWorkspaceStore().catch((err) => {
        this.deps.logger.error(`[Pylon] Failed to save after workspace delete: ${err}`);
      });
    }
  }

  /**
   * workspace_update 처리
   */
  private handleWorkspaceUpdate(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { workspaceId, name, workingDir } = payload || {};
    if (!workspaceId) return;

    const success = this.deps.workspaceStore.updateWorkspace(workspaceId as number, {
      name: name as string | undefined,
      workingDir: workingDir as string | undefined,
    });

    this.send({
      type: 'workspace_update_result',
      to: from?.deviceId,
      payload: { deviceId: this.config.deviceId, success, workspaceId },
    });

    if (success) {
      this.broadcastWorkspaceList();
      this.saveWorkspaceStore().catch((err) => {
        this.deps.logger.error(`[Pylon] Failed to save after workspace update: ${err}`);
      });
    }
  }

  /**
   * workspace_reorder 처리
   */
  private handleWorkspaceReorder(payload: Record<string, unknown> | undefined): void {
    const { workspaceIds } = payload || {};
    if (!workspaceIds || !Array.isArray(workspaceIds)) return;

    const success = this.deps.workspaceStore.reorderWorkspaces(workspaceIds as number[]);
    if (success) {
      this.broadcastWorkspaceList();
      this.saveWorkspaceStore().catch((err) => {
        this.deps.logger.error(`[Pylon] Failed to save after workspace reorder: ${err}`);
      });
    }
  }

  /**
   * conversation_reorder 처리
   */
  private handleConversationReorder(payload: Record<string, unknown> | undefined): void {
    const { workspaceId, conversationIds } = payload || {};
    if (!workspaceId || !conversationIds || !Array.isArray(conversationIds)) return;

    const success = this.deps.workspaceStore.reorderConversations(
      workspaceId as number,
      conversationIds as EntityId[]
    );
    if (success) {
      this.broadcastWorkspaceList();
      this.saveWorkspaceStore().catch((err) => {
        this.deps.logger.error(`[Pylon] Failed to save after conversation reorder: ${err}`);
      });
    }
  }

  /**
   * workspace_rename 처리
   */
  private handleWorkspaceRename(payload: Record<string, unknown> | undefined): void {
    const { workspaceId, newName } = payload || {};
    if (!workspaceId || !newName) return;

    const success = this.deps.workspaceStore.renameWorkspace(workspaceId as number, newName as string);
    if (success) {
      this.broadcastWorkspaceList();
      this.saveWorkspaceStore().catch((err) => {
        this.deps.logger.error(`[Pylon] Failed to save after workspace rename: ${err}`);
      });
    }
  }

  /**
   * workspace_switch 처리
   */
  private handleWorkspaceSwitch(payload: Record<string, unknown> | undefined): void {
    const { workspaceId, conversationId } = payload || {};
    if (!workspaceId) return;

    this.deps.workspaceStore.setActiveWorkspace(
      workspaceId as number,
      conversationId as EntityId | undefined
    );
    this.broadcastWorkspaceList();
    this.saveWorkspaceStore().catch((err) => {
      this.deps.logger.error(`[Pylon] Failed to save after workspace switch: ${err}`);
    });
  }

  // ==========================================================================
  // Private 메서드 - 대화
  // ==========================================================================

  /**
   * conversation_create 처리
   */
  private handleConversationCreate(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { workspaceId, name } = payload || {};
    if (!workspaceId) return;

    const conversation = this.deps.workspaceStore.createConversation(
      workspaceId as number,
      name as string | undefined
    );

    this.send({
      type: 'conversation_create_result',
      to: from?.deviceId,
      payload: {
        deviceId: this.config.deviceId,
        success: !!conversation,
        workspaceId,
        conversation,
      },
    });

    if (conversation) {
      // ID 재사용 대비: 기존 메시지 파일 삭제 및 캐시 클리어
      this.clearMessagesForEntity(conversation.entityId);

      this.broadcastWorkspaceList();
      this.saveWorkspaceStore().catch((err) => {
        this.deps.logger.error(`[Pylon] Failed to save after conversation create: ${err}`);
      });

      // 세션 뷰어 등록
      if (from?.deviceId) {
        this.registerSessionViewer(from.deviceId, conversation.entityId);
      }
    }
  }

  /**
   * conversation_delete 처리
   */
  private handleConversationDelete(payload: Record<string, unknown> | undefined): void {
    const { entityId } = payload || {};
    if (!entityId) return;

    const eid = entityId as EntityId;

    // 삭제 전에 메시지 정리
    this.clearMessagesForEntity(eid);

    const success = this.deps.workspaceStore.deleteConversation(eid);
    if (success) {
      this.broadcastWorkspaceList();
      this.saveWorkspaceStore().catch((err) => {
        this.deps.logger.error(`[Pylon] Failed to save after conversation delete: ${err}`);
      });
    }
  }

  /**
   * conversation_rename 처리
   */
  private handleConversationRename(payload: Record<string, unknown> | undefined): void {
    const { entityId, newName } = payload || {};
    if (!entityId || !newName) return;

    const success = this.deps.workspaceStore.renameConversation(
      entityId as EntityId,
      newName as string
    );
    if (success) {
      this.broadcastWorkspaceList();
      this.saveWorkspaceStore().catch((err) => {
        this.deps.logger.error(`[Pylon] Failed to save after conversation rename: ${err}`);
      });
    }
  }

  /**
   * conversation_select 처리
   */
  private handleConversationSelect(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { entityId, workspaceId } = payload || {};
    if (!entityId) return;

    const eid = entityId as number;
    const wsId = workspaceId as number;

    // 워크스페이스와 대화 모두 active 상태로 설정
    if (wsId) {
      this.deps.workspaceStore.setActiveWorkspace(wsId);
    }
    this.deps.workspaceStore.setActiveConversation(eid as EntityId);

    // unread 해제 및 클라이언트에 알림
    const conversation = this.deps.workspaceStore.getConversation(eid as EntityId);
    if (conversation?.unread) {
      this.deps.workspaceStore.updateConversationUnread(eid as EntityId, false);

      // 모든 클라이언트에게 unread 변경만 알림 (status는 현재 값 유지)
      this.send({
        type: 'conversation_status',
        payload: {
          deviceId: this.config.deviceId,
          entityId: eid,
          status: conversation.status,
          unread: false,
        },
      });

      // 해당 앱의 unread 전송 기록도 초기화
      if (from?.deviceId) {
        const unreadSent = this.appUnreadSent.get(from.deviceId);
        if (unreadSent) {
          unreadSent.delete(eid);
        }
      }
    }

    // 저장
    this.scheduleSaveWorkspaceStore();

    // 메시지 세션 로드 (lazy loading)
    this.loadMessageSession(eid);

    // 클라이언트를 해당 세션의 시청자로 등록
    if (from?.deviceId) {
      this.registerSessionViewer(from.deviceId, eid);

      // 활성 세션 정보
      const hasActiveSession = this.deps.claudeManager.hasActiveSession(eid);
      const workStartTime = this.deps.claudeManager.getSessionStartTime(eid);

      // 현재 상태 판단 (재연결 시 정확한 상태 동기화)
      // idle: 활성 세션 없음
      // permission: 활성 세션 있고 pending 이벤트 있음
      // working: 활성 세션 있고 pending 이벤트 없음
      let currentStatus: 'idle' | 'working' | 'permission' = 'idle';
      if (hasActiveSession) {
        const pendingEvent = this.deps.claudeManager.getPendingEvent(eid);
        if (pendingEvent) {
          currentStatus = 'permission';
        } else {
          currentStatus = 'working';
        }
      }

      // 메시지 히스토리 전송 (페이징: 100KB 제한)
      const MAX_BYTES = 100 * 1024; // 100KB
      const totalCount = this.deps.messageStore.getCount(eid);
      const messages = this.deps.messageStore.getMessages(eid, { maxBytes: MAX_BYTES });
      const hasMore = messages.length < totalCount;

      this.send({
        type: 'history_result',
        to: from.deviceId,
        payload: {
          deviceId: this.config.deviceId,
          entityId: eid,
          messages,
          totalCount,
          hasMore,
          hasActiveSession,
          workStartTime,
          currentStatus,
        },
      });

      // pending 이벤트가 있으면 전송
      const pendingEvent = this.deps.claudeManager.getPendingEvent(eid);
      if (pendingEvent) {
        const pe = pendingEvent as { type: string };
        if (pe.type === 'permission_request' || pe.type === 'askQuestion') {
          this.send({
            type: 'claude_event',
            payload: { entityId: eid, event: { type: 'state', state: 'permission' } },
            to: [from.deviceId],
          });
        }
        this.send({
          type: 'claude_event',
          payload: { entityId: eid, event: pendingEvent },
          to: [from.deviceId],
        });
      }
    }
  }

  // ==========================================================================
  // Private 메서드 - Claude
  // ==========================================================================

  /**
   * claude_send 처리
   */
  private handleClaudeSend(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { entityId, message: userMessage, attachedFileIds, attachments: attachmentPaths } = payload || {};
    const hasAttachments = (attachedFileIds as string[] | undefined)?.length || (attachmentPaths as string[] | undefined)?.length;
    // 메시지나 첨부파일 중 하나는 있어야 함
    if (!entityId || (!userMessage && !hasAttachments)) return;

    const eid = entityId as number;

    // workingDir 및 conversation 정보 가져오기
    const conversation = this.deps.workspaceStore.getConversation(eid as EntityId) ?? null;
    const decoded = decodeEntityId(eid as EntityId);
    const workspace = this.deps.workspaceStore.getWorkspace(decoded.workspaceId);
    const workingDir = workspace?.workingDir ?? null;

    // 첨부 파일 처리
    let attachments: unknown[] | null = null;
    const pendingFilesForConv = this.pendingFiles.get(eid);
    const fileIds = attachedFileIds as string[] | undefined;
    const paths = attachmentPaths as string[] | undefined;

    // 방법 1: attachedFileIds로 pendingFiles에서 찾기
    if (fileIds && fileIds.length > 0 && pendingFilesForConv) {
      attachments = [];
      for (const fileId of fileIds) {
        const fileInfo = pendingFilesForConv.get(fileId);
        if (fileInfo) {
          attachments.push(fileInfo);
          pendingFilesForConv.delete(fileId);
        }
      }
      if (attachments.length === 0) {
        attachments = null;
      }
    }
    // 방법 2: attachments로 경로가 직접 전달된 경우
    else if (paths && paths.length > 0) {
      attachments = paths.map((path) => {
        const filename = path.split(/[/\\]/).pop() || 'unknown';
        // pendingFiles에서 경로로 thumbnail 찾기
        let thumbnail: string | undefined;
        if (pendingFilesForConv) {
          for (const fileInfo of pendingFilesForConv.values()) {
            const info = fileInfo as { path?: string; thumbnail?: string };
            if (info.path === path) {
              thumbnail = info.thumbnail;
              break;
            }
          }
        }
        return { path, filename, ...(thumbnail && { thumbnail }) };
      });
      if (attachments.length === 0) {
        attachments = null;
      }
    }

    // 사용자 메시지 (빈 문자열 허용)
    const messageText = (userMessage as string) || '';

    // 사용자 메시지 저장
    this.deps.messageStore.addUserMessage(eid, messageText, attachments as never);
    this.scheduleSaveMessages(eid);

    // 사용자 메시지 브로드캐스트
    const userMessageEvent = {
      type: 'claude_event',
      payload: {
        entityId: eid,
        event: {
          type: 'userMessage',
          content: messageText,
          timestamp: Date.now(),
          ...(attachments && { attachments }),
        },
      },
    };
    this.send({ ...userMessageEvent, broadcast: 'clients' });

    // Claude에게 메시지 전송
    if (workingDir) {
      let promptToSend = messageText;

      // 첨부 파일 경로 추가 (Read 도구 사용 유도)
      // 이 지시문은 히스토리에 저장되지 않음 (promptToSend만 Claude에게 전송)
      if (attachments && attachments.length > 0) {
        const filePaths = (attachments as Array<{ path: string }>)
          .map((file) => `- ${file.path}`)
          .join('\n');
        promptToSend = `[시스템: 아래 파일들을 Read 도구로 읽을 것]\n${filePaths}${messageText ? '\n\n' + messageText : ''}`;
      }

      const claudeSessionId = conversation?.claudeSessionId ?? undefined;
      this.deps.claudeManager.sendMessage(eid, promptToSend, {
        workingDir,
        claudeSessionId,
      });
    }
  }

  /**
   * claude_permission 처리
   */
  private handleClaudePermission(payload: Record<string, unknown> | undefined): void {
    const { entityId, toolUseId, decision } = payload || {};
    if (!entityId || !toolUseId || !decision) return;

    this.deps.claudeManager.respondPermission(
      entityId as number,
      toolUseId as string,
      decision as 'allow' | 'deny' | 'allowAll'
    );
  }

  /**
   * claude_answer 처리
   */
  private handleClaudeAnswer(payload: Record<string, unknown> | undefined): void {
    const { entityId, toolUseId, answer } = payload || {};
    if (!entityId || !toolUseId) return;

    this.deps.claudeManager.respondQuestion(
      entityId as number,
      toolUseId as string,
      answer as string
    );
  }

  /**
   * claude_control 처리
   */
  private handleClaudeControl(payload: Record<string, unknown> | undefined): void {
    const { entityId, action } = payload || {};
    if (!entityId || !action) return;

    const eid = entityId as number;

    switch (action) {
      case 'stop':
        this.deps.claudeManager.stop(eid);
        break;
      case 'new_session':
      case 'clear':
        this.deps.claudeManager.newSession(eid);
        this.deps.messageStore.clear(eid);
        break;
      case 'compact':
        this.log(`Compact not implemented yet`);
        break;
    }
  }

  /**
   * claude_set_permission_mode 처리
   */
  private handleClaudeSetPermissionMode(payload: Record<string, unknown> | undefined): void {
    const { entityId, mode } = payload || {};
    if (!entityId || !mode) return;

    const success = this.deps.workspaceStore.setConversationPermissionMode(
      entityId as EntityId,
      mode as PermissionModeValue
    );

    // 변경 성공 시 저장
    if (success) {
      this.saveWorkspaceStore().catch((err) => {
        this.deps.logger.error(`[Persistence] Failed to save permission mode: ${err}`);
      });
    }
  }

  // ==========================================================================
  // Private 메서드 - Blob
  // ==========================================================================

  /**
   * blob_end 결과 처리
   */
  private async handleBlobEndResult(
    result: { success: boolean; path?: string; context?: unknown; mimeType?: string },
    from: MessageFrom | undefined,
    payload: Record<string, unknown> | undefined
  ): Promise<void> {
    if (!result.success) return;

    const context = result.context as { type?: string; entityId?: number } | undefined;
    if (context?.type === 'image_upload') {
      const { entityId } = context;
      const blobId = (payload as { blobId?: string })?.blobId;

      if (entityId && blobId && result.path) {
        const fileId = blobId;
        const filename = result.path.split(/[/\\]/).pop() || 'unknown';
        const mimeType = result.mimeType || 'application/octet-stream';

        // 썸네일 생성 (이미지인 경우에만)
        let thumbnail: string | null = null;
        try {
          thumbnail = await generateThumbnail(result.path, mimeType);
        } catch (err) {
          console.error('[BLOB] Thumbnail generation failed:', err);
        }

        // 클라이언트에 업로드 완료 알림
        this.send({
          type: 'blob_upload_complete',
          to: from?.deviceId,
          payload: {
            blobId,
            fileId,
            path: result.path,
            filename,
            entityId,
            mimeType,
            ...(thumbnail && { thumbnail }),
          },
        });

        // pending 파일로 저장
        if (!this.pendingFiles.has(entityId)) {
          this.pendingFiles.set(entityId, new Map());
        }
        this.pendingFiles.get(entityId)!.set(fileId, {
          fileId,
          path: result.path,
          filename,
          mimeType,
          ...(thumbnail && { thumbnail }),
        });
      }
    }
  }

  // ==========================================================================
  // Private 메서드 - 폴더
  // ==========================================================================

  /**
   * folder_list 처리
   *
   * path가 비어있거나 '__DRIVES__'이면 드라이브 목록 반환
   */
  private handleFolderList(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { path: targetPath, deviceId: targetDeviceId } = payload || {};

    // 대상 Pylon이 아니면 무시
    if (targetDeviceId !== undefined && targetDeviceId !== this.config.deviceId) {
      return;
    }

    // 드라이브 목록 요청 (빈 문자열, undefined, null, '__DRIVES__')
    const isEmptyPath = targetPath === '' || targetPath === undefined || targetPath === null;
    if (isEmptyPath || targetPath === '__DRIVES__') {
      const driveResult = this.deps.folderManager.listDrives();
      this.send({
        type: 'folder_list_result',
        to: from?.deviceId,
        payload: {
          deviceId: this.config.deviceId,
          path: '',
          folders: driveResult.drives.map((d) => d.label),
          foldersWithChildren: driveResult.drives.map((d) => ({
            name: d.label,
            path: d.path,
            hasChildren: d.hasChildren,
            isDrive: true,
          })),
          success: driveResult.success,
          error: driveResult.error,
        },
      });
      return;
    }

    const result = this.deps.folderManager.listFolders(targetPath as string);
    this.send({
      type: 'folder_list_result',
      to: from?.deviceId,
      payload: {
        deviceId: this.config.deviceId,
        ...result,
      },
    });
  }

  /**
   * folder_create 처리
   */
  private handleFolderCreate(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { path: parentPath, name } = payload || {};
    if (!parentPath || !name) return;

    const result = this.deps.folderManager.createFolder(parentPath as string, name as string);
    this.send({
      type: 'folder_create_result',
      to: from?.deviceId,
      payload: {
        deviceId: this.config.deviceId,
        ...result,
      },
    });
  }

  /**
   * folder_rename 처리
   */
  private handleFolderRename(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { path: folderPath, newName } = payload || {};
    if (!folderPath || !newName) return;

    const result = this.deps.folderManager.renameFolder(folderPath as string, newName as string);
    this.send({
      type: 'folder_rename_result',
      to: from?.deviceId,
      payload: {
        deviceId: this.config.deviceId,
        ...result,
      },
    });
  }

  // ==========================================================================
  // Private 메서드 - 태스크
  // ==========================================================================

  /**
   * task_list 처리
   */
  private handleTaskList(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { workspaceId } = payload || {};
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId as number);
    if (!workspace) return;

    const result = this.deps.taskManager.listTasks(workspace.workingDir);
    this.send({
      type: 'task_list_result',
      to: from?.deviceId,
      payload: {
        deviceId: this.config.deviceId,
        workspaceId,
        ...result,
      },
    });
  }

  /**
   * task_get 처리
   */
  private handleTaskGet(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { workspaceId, taskId } = payload || {};
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId as number);
    if (!workspace || !taskId) return;

    const result = this.deps.taskManager.getTask(workspace.workingDir, taskId as string);
    this.send({
      type: 'task_get_result',
      to: from?.deviceId,
      payload: {
        deviceId: this.config.deviceId,
        workspaceId,
        ...result,
      },
    });
  }

  /**
   * task_status 처리
   */
  private handleTaskStatus(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { workspaceId, taskId, status, error } = payload || {};
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId as number);
    if (!workspace || !taskId || !status) return;

    const result = this.deps.taskManager.updateTaskStatus(
      workspace.workingDir,
      taskId as string,
      status as string,
      error as string | undefined
    );
    this.send({
      type: 'task_status_result',
      to: from?.deviceId,
      payload: {
        deviceId: this.config.deviceId,
        workspaceId,
        ...result,
      },
    });

    // 태스크 목록 브로드캐스트
    this.broadcastTaskList(workspaceId as number);
  }

  // ==========================================================================
  // Private 메서드 - 워커
  // ==========================================================================

  /**
   * worker_status 처리
   */
  private handleWorkerStatus(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { workspaceId } = payload || {};
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId as number);
    if (!workspace) return;

    const status = this.deps.workerManager.getWorkerStatus(workspaceId as number, workspace.workingDir);
    this.send({
      type: 'worker_status_result',
      to: from?.deviceId,
      payload: {
        deviceId: this.config.deviceId,
        ...status,
      },
    });
  }

  /**
   * worker_start 처리
   */
  private handleWorkerStart(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { workspaceId } = payload || {};
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId as number);
    if (!workspace) return;

    // 비동기 처리
    (async () => {
      const startClaudeCallback = async (_wsId: number, workingDir: string, prompt: string) => {
        // 워커용 대화 생성 또는 기존 대화 사용
        let conversation = workspace.conversations.find((c) => c.name === 'Worker');
        if (!conversation) {
          conversation = this.deps.workspaceStore.createConversation(workspaceId as number, 'Worker')!;
        }

        this.deps.workspaceStore.setActiveConversation(conversation.entityId);
        this.deps.claudeManager.sendMessage(conversation.entityId, prompt, { workingDir });

        return {
          process: null,
          entityId: conversation.entityId,
        };
      };

      const result = await this.deps.workerManager.startWorker(
        workspaceId as number,
        workspace.workingDir,
        startClaudeCallback
      );

      this.send({
        type: 'worker_start_result',
        to: from?.deviceId,
        payload: {
          deviceId: this.config.deviceId,
          ...result,
        },
      });

      if (result.success) {
        this.broadcastWorkerStatus(workspaceId as number);
        this.broadcastTaskList(workspaceId as number);
      }
    })();
  }

  /**
   * worker_stop 처리
   */
  private handleWorkerStop(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { workspaceId } = payload || {};
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId as number);
    if (!workspace) return;

    const result = this.deps.workerManager.stopWorker(workspaceId as number, workspace.workingDir);
    this.send({
      type: 'worker_stop_result',
      to: from?.deviceId,
      payload: {
        deviceId: this.config.deviceId,
        ...result,
      },
    });
  }

  // ==========================================================================
  // Private 메서드 - 디버그
  // ==========================================================================

  /**
   * debug_log 처리
   */
  private handleDebugLog(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { tag, message: logMsg, extra } = payload || {};
    const fromInfo = from ? `${from.name || from.deviceId}` : 'unknown';
    const extraStr = extra ? ` | ${JSON.stringify(extra)}` : '';
    this.log(`[APP:${fromInfo}] [${tag}] ${logMsg}${extraStr}`);
  }

  /**
   * bug_report 처리
   *
   * @description
   * 버그 리포트를 bug-reports.txt 파일에 저장합니다.
   */
  private handleBugReport(payload: Record<string, unknown> | undefined): void {
    const { message, conversationId, workspaceId, timestamp } = payload || {};
    if (!message) return;

    const entry = `[${timestamp || new Date().toISOString()}]
Workspace: ${workspaceId || 'N/A'}
Conversation: ${conversationId || 'N/A'}
Message: ${message}
-----
`;

    // 로그 출력
    this.log(`[BugReport] ${message}`);

    // 파일에 저장 (bugReportWriter가 있는 경우)
    if (this.deps.bugReportWriter) {
      try {
        this.deps.bugReportWriter.append(entry);
        this.log('[BugReport] Saved to bug-reports.txt');
      } catch (err) {
        this.deps.logger.error(`[BugReport] Failed to save: ${err}`);
      }
    }
  }

  // ==========================================================================
  // Private 메서드 - 브로드캐스트
  // ==========================================================================

  /**
   * 워크스페이스 목록 브로드캐스트
   */
  private broadcastWorkspaceList(): void {
    const workspaces = this.deps.workspaceStore.getAllWorkspaces();
    const activeState = this.deps.workspaceStore.getActiveState();

    // 각 워크스페이스에 태스크/워커 정보 추가
    const workspacesWithTasks = workspaces.map((ws) => {
      const taskResult = this.deps.taskManager.listTasks(ws.workingDir);
      const workerStatus = this.deps.workerManager.getWorkerStatus(ws.workspaceId, ws.workingDir);

      return {
        ...ws,
        tasks: taskResult.success ? taskResult.tasks : [],
        workerStatus,
      };
    });

    const payload = {
      deviceId: this.config.deviceId,
      deviceInfo: this.deviceInfo,
      workspaces: workspacesWithTasks,
      activeWorkspaceId: activeState.activeWorkspaceId,
      activeConversationId: activeState.activeConversationId,
      account: this.cachedAccount,  // 캐싱된 계정 정보 사용
    };

    this.log(`[Broadcast] workspace_list_result account: ${JSON.stringify(this.cachedAccount)}`);

    this.send({
      type: 'workspace_list_result',
      payload,
      broadcast: 'clients',
    });

    // 워크스페이스 저장 (비동기)
    this.saveWorkspaceStore().catch((err) => {
      this.deps.logger.error(`[Persistence] Failed to save workspace store: ${err}`);
    });
  }

  /**
   * 태스크 목록 브로드캐스트
   */
  private broadcastTaskList(workspaceId: number): void {
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId);
    if (!workspace) return;

    const taskResult = this.deps.taskManager.listTasks(workspace.workingDir);
    const workerStatus = this.deps.workerManager.getWorkerStatus(workspaceId, workspace.workingDir);

    const payload = {
      deviceId: this.config.deviceId,
      workspaceId,
      tasks: taskResult.success ? taskResult.tasks : [],
      workerStatus,
    };

    this.send({
      type: 'task_list_result',
      payload,
      broadcast: 'clients',
    });
  }

  /**
   * 워커 상태 브로드캐스트
   */
  private broadcastWorkerStatus(workspaceId: number): void {
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId);
    if (!workspace) return;

    const workerStatus = this.deps.workerManager.getWorkerStatus(workspaceId, workspace.workingDir);

    const payload = {
      deviceId: this.config.deviceId,
      workspaceId,
      workerStatus,
    };

    this.send({
      type: 'worker_status_result',
      payload,
      broadcast: 'clients',
    });
  }

  /**
   * Pylon 상태 브로드캐스트
   */
  private broadcastPylonStatus(): void {
    this.send({
      type: 'pylon_status',
      broadcast: 'clients',
      payload: {
        deviceId: this.config.deviceId,
        claudeUsage: this.claudeUsage,
      },
    });
  }

  // ==========================================================================
  // Private 메서드 - 세션 뷰어
  // ==========================================================================

  /**
   * 세션 뷰어 등록
   */
  private registerSessionViewer(clientId: string, entityId: number): void {
    // 기존 시청 세션에서 제거
    for (const [existingEntityId, viewers] of this.sessionViewers) {
      if (viewers.has(clientId)) {
        viewers.delete(clientId);
        if (viewers.size === 0) {
          this.sessionViewers.delete(existingEntityId);
          // 활성 Claude 세션이 있으면 캐시 유지
          // (언로드 후 이벤트가 빈 캐시를 생성하여 히스토리가 유실되는 것 방지)
          if (this.deps.claudeManager.hasActiveSession(existingEntityId)) {
            this.log(`Keeping message cache for session ${existingEntityId} (active Claude session)`);
          } else {
            this.deps.messageStore.unloadCache(existingEntityId);
            this.log(`Unloaded message cache for session ${existingEntityId} (no viewers)`);
          }
        }
        break;
      }
    }

    // 새 세션에 등록
    if (!this.sessionViewers.has(entityId)) {
      this.sessionViewers.set(entityId, new Set());
    }
    this.sessionViewers.get(entityId)!.add(clientId);

    // appUnreadSent 초기화
    if (!this.appUnreadSent.has(clientId)) {
      this.appUnreadSent.set(clientId, new Set());
    }
    this.appUnreadSent.get(clientId)!.delete(entityId);

    this.log(`Client ${clientId} now viewing session ${entityId}`);
  }

  /**
   * 세션 뷰어 해제
   */
  private unregisterSessionViewer(clientId: string): void {
    for (const [entityId, viewers] of this.sessionViewers) {
      if (viewers.has(clientId)) {
        viewers.delete(clientId);
        if (viewers.size === 0) {
          this.sessionViewers.delete(entityId);
          if (this.deps.claudeManager.hasActiveSession(entityId)) {
            this.log(`Keeping message cache for session ${entityId} (active Claude session)`);
          } else {
            this.deps.messageStore.unloadCache(entityId);
            this.log(`Unloaded message cache for session ${entityId} (no viewers)`);
          }
        }
        this.log(`Client ${clientId} removed from session ${entityId} viewers`);
        break;
      }
    }

    this.appUnreadSent.delete(clientId);
  }

  /**
   * 안 보고 있는 앱에게 unread 알림
   */
  private sendUnreadToNonViewers(entityId: number, viewers: Set<string>): void {
    const unreadTargets: string[] = [];

    for (const [appId, unreadSent] of this.appUnreadSent) {
      if (viewers.has(appId)) continue;
      if (unreadSent.has(entityId)) continue;

      unreadTargets.push(appId);
      unreadSent.add(entityId);
    }

    if (unreadTargets.length > 0) {
      this.deps.workspaceStore.updateConversationUnread(entityId as EntityId, true);
      this.scheduleSaveWorkspaceStore();

      // unread 알림은 status를 변경하지 않고 unread 플래그만 전달
      // (status: 'unread'를 보내면 클라이언트가 status를 'unread'로 변경해버림)
      const conversation = this.deps.workspaceStore.getConversation(entityId as EntityId);
      this.send({
        type: 'conversation_status',
        payload: {
          deviceId: this.config.deviceId,
          entityId,
          status: conversation?.status ?? 'idle',
          unread: true,
        },
        to: unreadTargets,
      });

      this.log(`Sent unread notification for ${entityId} to ${unreadTargets.length} clients`);
    }
  }

  // ==========================================================================
  // Private 메서드 - 이벤트 저장
  // ==========================================================================

  /**
   * 이벤트를 메시지 히스토리에 저장
   */
  private saveEventToHistory(entityId: number, event: ClaudeManagerEvent): void {
    const e = event as Record<string, unknown>;
    let shouldSave = false;

    switch (event.type) {
      case 'textComplete':
        this.deps.messageStore.addAssistantText(entityId, e.text as string);
        shouldSave = true;
        break;

      case 'toolInfo':
        this.deps.messageStore.addToolStart(
          entityId,
          e.toolName as string,
          e.input as Record<string, unknown>,
          e.parentToolUseId as string | null | undefined,
          e.toolUseId as string | undefined
        );
        shouldSave = true;
        break;

      case 'toolComplete':
        this.deps.messageStore.updateToolComplete(
          entityId,
          e.toolName as string,
          e.success as boolean,
          e.result as string | undefined,
          e.error as string | undefined
        );
        shouldSave = true;
        break;

      case 'error':
        this.deps.messageStore.addError(entityId, e.error as string);
        shouldSave = true;
        break;

      case 'result': {
        const usage = e.usage as { inputTokens?: number; outputTokens?: number; cacheReadInputTokens?: number } | undefined;
        this.deps.messageStore.addResult(entityId, {
          durationMs: (e.duration_ms as number) || 0,
          inputTokens: usage?.inputTokens || 0,
          outputTokens: usage?.outputTokens || 0,
          cacheReadTokens: usage?.cacheReadInputTokens || 0,
        });
        shouldSave = true;
        break;
      }

      case 'claudeAborted':
        this.deps.messageStore.addAborted(entityId, (e.reason as 'user' | 'session_ended') || 'user');
        shouldSave = true;
        break;
    }

    // 메시지 저장 예약 (debounce)
    if (shouldSave) {
      this.scheduleSaveMessages(entityId);
    }
  }

  /**
   * 사용량 누적
   */
  private accumulateUsage(event: ClaudeManagerEvent): void {
    const e = event as Record<string, unknown>;
    if (e.total_cost_usd) {
      this.claudeUsage.totalCostUsd += e.total_cost_usd as number;
    }
    if (e.usage) {
      const usage = e.usage as Record<string, number>;
      this.claudeUsage.totalInputTokens += usage.inputTokens || 0;
      this.claudeUsage.totalOutputTokens += usage.outputTokens || 0;
      this.claudeUsage.totalCacheReadTokens += usage.cacheReadInputTokens || 0;
      this.claudeUsage.totalCacheCreationTokens += usage.cacheCreationInputTokens || 0;
    }
    this.claudeUsage.sessionCount++;
    this.claudeUsage.lastUpdated = new Date().toISOString();

    this.broadcastPylonStatus();
  }

  // ==========================================================================
  // Private 메서드 - 메시지 정리
  // ==========================================================================

  /**
   * 엔티티(대화)의 메시지 캐시 및 영속 파일 정리
   *
   * @description
   * 대화 삭제, 워크스페이스 삭제, ID 재사용 시 호출합니다.
   * 메모리 캐시와 영속 파일을 모두 삭제합니다.
   */
  private clearMessagesForEntity(entityId: EntityId): void {
    // 메모리 캐시 클리어
    this.deps.messageStore.clear(entityId);

    // 영속성 파일 삭제
    if (this.deps.persistence) {
      this.deps.persistence.deleteMessageSession(String(entityId));
    }
  }

  // ==========================================================================
  // Private 메서드 - 영속성
  // ==========================================================================

  /**
   * 영속 데이터 로드
   */
  private async loadPersistedData(): Promise<void> {
    const persistence = this.deps.persistence;
    if (!persistence) return;

    // WorkspaceStore 로드
    const workspaceData = persistence.loadWorkspaceStore();
    if (workspaceData) {
      // WorkspaceStore는 생성자에서 데이터를 받으므로 여기서는 직접 접근 불가
      // 대신 fromJSON으로 새 인스턴스 생성하거나 bin.ts에서 로드해야 함
      this.log(`[Persistence] Loaded workspace data (${workspaceData.workspaces?.length || 0} workspaces)`);
    }

    // MessageStore는 세션별로 lazy loading
    // 세션 선택 시 loadMessageSession 호출
    this.log('[Persistence] Ready for lazy message loading');
  }

  /**
   * WorkspaceStore 저장
   */
  private async saveWorkspaceStore(): Promise<void> {
    const persistence = this.deps.persistence;
    if (!persistence) return;

    try {
      const data = this.deps.workspaceStore.toJSON();
      await persistence.saveWorkspaceStore(data);
      this.log('[Persistence] Saved workspace store');
    } catch (err) {
      this.deps.logger.error(`[Persistence] Failed to save workspace store: ${err}`);
    }
  }

  /**
   * WorkspaceStore 저장 예약 (debounce)
   * status/unread 같이 자주 변경되는 항목에 사용
   */
  private scheduleSaveWorkspaceStore(): void {
    const persistence = this.deps.persistence;
    if (!persistence) return;

    // 기존 타이머 취소
    if (this.workspaceSaveTimer) {
      clearTimeout(this.workspaceSaveTimer);
    }

    // 새 타이머 설정
    this.workspaceSaveTimer = setTimeout(async () => {
      this.workspaceSaveTimer = null;
      await this.saveWorkspaceStore();
    }, this.WORKSPACE_SAVE_DEBOUNCE_MS);
  }

  /**
   * 메시지 세션 저장 예약 (debounce)
   */
  private scheduleSaveMessages(entityId: number): void {
    const persistence = this.deps.persistence;
    if (!persistence) return;

    // 기존 타이머 취소
    const existingTimer = this.messageSaveTimers.get(entityId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 새 타이머 설정
    const timer = setTimeout(async () => {
      this.messageSaveTimers.delete(entityId);
      await this.saveMessageSession(entityId);
    }, this.MESSAGE_SAVE_DEBOUNCE_MS);

    this.messageSaveTimers.set(entityId, timer);
  }

  /**
   * 메시지 세션 즉시 저장
   */
  private async saveMessageSession(entityId: number): Promise<void> {
    const persistence = this.deps.persistence;
    if (!persistence) return;

    try {
      const sessionData = this.deps.messageStore.getSessionData(entityId);
      if (sessionData) {
        await persistence.saveMessageSession(String(entityId), sessionData);
        this.deps.messageStore.markClean(entityId);
        this.log(`[Persistence] Saved message session: ${entityId}`);
      }
    } catch (err) {
      this.deps.logger.error(`[Persistence] Failed to save session ${entityId}: ${err}`);
    }
  }

  /**
   * 모든 pending 저장 즉시 실행
   */
  private async flushPendingSaves(): Promise<void> {
    // 워크스페이스 타이머 취소 및 저장
    if (this.workspaceSaveTimer) {
      clearTimeout(this.workspaceSaveTimer);
      this.workspaceSaveTimer = null;
      await this.saveWorkspaceStore();
    }

    // 메시지 타이머 취소
    for (const [entityId, timer] of this.messageSaveTimers) {
      clearTimeout(timer);
      this.messageSaveTimers.delete(entityId);
    }

    // dirty 세션 모두 저장
    if (this.deps.messageStore.hasDirtyData()) {
      const dirtySessions = this.deps.messageStore.getDirtySessions();
      for (const entityId of dirtySessions) {
        await this.saveMessageSession(entityId);
      }
    }
  }

  /**
   * 모든 대화의 메시지 세션 로드 (시작 시 호출)
   */
  private loadAllMessageSessions(): void {
    const workspaces = this.deps.workspaceStore.getAllWorkspaces();
    let count = 0;
    for (const workspace of workspaces) {
      for (const conv of workspace.conversations) {
        this.loadMessageSession(conv.entityId);
        count++;
      }
    }
    if (count > 0) {
      this.log(`[Startup] Loaded ${count} message sessions`);
    }
  }

  /**
   * 메시지 세션 로드 (lazy loading)
   */
  loadMessageSession(entityId: number): void {
    const persistence = this.deps.persistence;
    if (!persistence) return;

    // 이미 캐시되어 있으면 스킵
    if (this.deps.messageStore.hasCache(entityId)) return;

    const sessionData = persistence.loadMessageSession(String(entityId));
    if (sessionData) {
      this.deps.messageStore.loadSessionData(entityId, sessionData);
      this.log(`[Persistence] Loaded message session: ${entityId}`);
    }
  }

  // ==========================================================================
  // Private 유틸리티
  // ==========================================================================

  /**
   * 메시지 전송 (Relay)
   */
  private send(message: unknown): void {
    this.deps.packetLogger.logSend('relay', message);
    this.deps.relayClient.send(message);
  }

  /**
   * 로그 출력
   */
  private log(message: string): void {
    this.deps.logger.log(`[${new Date().toISOString()}] ${message}`);
  }

  // ==========================================================================
  // Private 메서드 - Usage 조회
  // ==========================================================================

  /**
   * usage_request 처리
   *
   * @description
   * ccusage CLI를 실행하여 Claude Code 사용량 데이터를 조회하고
   * 요약 정보를 클라이언트에게 응답합니다.
   */
  private handleUsageRequest(from: MessageFrom | undefined): void {
    // 비동기 처리
    (async () => {
      try {
        const { getUsageSummary } = await import('./utils/ccusage.js');
        const summary = await getUsageSummary();

        this.send({
          type: 'usage_response',
          to: from?.deviceId,
          payload: {
            deviceId: this.config.deviceId,
            success: !!summary,
            summary,
            error: summary ? undefined : 'ccusage not available',
          },
        });

        if (summary) {
          this.log(`[Usage] Fetched usage: today=$${summary.todayCost.toFixed(2)}, week=$${summary.weekCost.toFixed(2)}`);
        }
      } catch (err) {
        this.send({
          type: 'usage_response',
          to: from?.deviceId,
          payload: {
            deviceId: this.config.deviceId,
            success: false,
            error: (err as Error).message,
          },
        });
        this.deps.logger.error(`[Usage] Failed to fetch usage: ${err}`);
      }
    })();
  }

  // ==========================================================================
  // Private 메서드 - 계정 전환
  // ==========================================================================

  /**
   * account_switch 처리
   *
   * @description
   * 계정 전환 요청을 처리합니다.
   * 1. 모든 활성 Claude 세션 중단
   * 2. 인증 파일 스왑
   * 3. 새 계정 정보를 클라이언트에 전송
   */
  private handleAccountSwitch(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { account } = payload || {};
    if (!account || typeof account !== 'string') {
      this.send({
        type: 'account_status',
        to: from?.deviceId,
        payload: {
          error: 'Invalid account type',
        },
      });
      return;
    }

    // credentialManager가 없으면 에러
    if (!this.deps.credentialManager) {
      this.send({
        type: 'account_status',
        to: from?.deviceId,
        payload: {
          error: 'Credential manager not configured',
        },
      });
      return;
    }

    // 비동기 처리
    (async () => {
      try {
        this.log(`[Account] Switching to account: ${account}`);

        // 1. 모든 세션 중단
        const abortedSessions = this.deps.claudeManager.abortAllSessions();
        if (abortedSessions.length > 0) {
          this.log(`[Account] Aborted ${abortedSessions.length} active sessions`);
        }

        // 2. 인증 파일 스왑
        await this.deps.credentialManager!.switchAccount(account);

        // 3. 새 계정 정보 조회
        const accountInfo = await this.deps.credentialManager!.getCurrentAccount();

        // 4. 클라이언트에 상태 알림 (broadcast)
        this.send({
          type: 'account_status',
          broadcast: 'clients',
          payload: {
            current: accountInfo?.account || account,
            subscriptionType: accountInfo?.subscriptionType,
          },
        });

        this.log(`[Account] Switched to: ${accountInfo?.account || account} (${accountInfo?.subscriptionType || 'unknown'})`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.deps.logger.error(`[Account] Failed to switch account: ${errorMessage}`);

        this.send({
          type: 'account_status',
          to: from?.deviceId,
          payload: {
            error: errorMessage,
          },
        });
      }
    })();
  }

  /**
   * 현재 계정 정보를 클라이언트에 전송
   *
   * @description
   * 클라이언트 연결 시 또는 요청 시 현재 계정 정보를 전송합니다.
   */
  private async sendAccountStatus(to?: string): Promise<void> {
    if (!this.deps.credentialManager) {
      this.log('[Account] No credential manager');
      return;
    }

    try {
      const accountInfo = await this.deps.credentialManager.getCurrentAccount();
      this.log(`[Account] Got account info: ${JSON.stringify(accountInfo)}`);

      if (accountInfo) {
        const msg: Record<string, unknown> = {
          type: 'account_status',
          payload: {
            current: accountInfo.account,
            subscriptionType: accountInfo.subscriptionType,
          },
        };
        // 특정 대상이 있으면 to, 없으면 broadcast
        if (to) {
          msg.to = to;
        } else {
          msg.broadcast = 'clients';
        }
        this.send(msg);
        this.log(`[Account] Sent account_status: ${accountInfo.account}`);
      } else {
        this.log('[Account] No account info found');
      }
    } catch (err) {
      this.deps.logger.error(`[Account] Failed to get account status: ${err}`);
    }
  }
}
