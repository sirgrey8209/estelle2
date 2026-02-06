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
import type { WorkspaceStore, Workspace, Conversation } from './stores/workspace-store.js';
import type { MessageStore, StoreMessage } from './stores/message-store.js';
import type { ClaudeManagerEvent } from './claude/claude-manager.js';
import type { PersistenceAdapter } from './persistence/types.js';

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
  sendMessage(sessionId: string, message: string, options: { workingDir: string; claudeSessionId?: string }): Promise<void>;
  stop(sessionId: string): void;
  newSession(sessionId: string): void;
  cleanup(): void;
  respondPermission(sessionId: string, toolUseId: string, decision: 'allow' | 'deny' | 'allowAll'): void;
  respondQuestion(sessionId: string, toolUseId: string, answer: string): void;
  hasActiveSession(sessionId: string): boolean;
  getSessionStartTime(sessionId: string): number | null;
  getPendingEvent(sessionId: string): unknown;
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
  getWorkerStatus(workspaceId: string, workingDir: string): { running: boolean };
  startWorker(workspaceId: string, workingDir: string, callback: unknown): Promise<{ success: boolean }>;
  stopWorker(workspaceId: string, workingDir: string): { success: boolean };
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

  /** 세션별 시청자: Map<sessionId, Set<clientDeviceId>> */
  private readonly sessionViewers: Map<string, Set<string>> = new Map();

  /** 앱별 unread 알림 전송 기록: Map<appId, Set<conversationId>> */
  private readonly appUnreadSent: Map<string, Set<string>> = new Map();

  /** 대화별 pending 파일: Map<conversationId, Map<fileId, FileInfo>> */
  private readonly pendingFiles: Map<string, Map<string, unknown>> = new Map();

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

  /** 메시지 저장 debounce 타이머: Map<sessionId, timerId> */
  private readonly messageSaveTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** 메시지 저장 debounce 시간 (ms) */
  private readonly MESSAGE_SAVE_DEBOUNCE_MS = 2000;

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

    // 워크스페이스 초기화: working/waiting 상태인 대화들을 idle로 리셋
    const resetIds = this.deps.workspaceStore.resetActiveConversations();
    for (const conversationId of resetIds) {
      this.deps.messageStore.addAborted(conversationId, 'session_ended');
      this.log(`[Startup] Added session_ended to history: ${conversationId}`);
    }

    // 리셋된 대화가 있으면 워크스페이스 저장
    if (resetIds.length > 0) {
      await this.saveWorkspaceStore();
    }

    // Relay 연결
    this.deps.relayClient.connect();
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
  getSessionViewerCount(sessionId: string): number {
    return this.sessionViewers.get(sessionId)?.size ?? 0;
  }

  /**
   * 세션 시청자 목록 반환
   */
  getSessionViewers(sessionId: string): Set<string> {
    return this.sessionViewers.get(sessionId) ?? new Set();
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
      this.handleBlobEndResult(result, from, payload);
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

    // 알 수 없는 메시지는 무시
  }

  /**
   * Claude 이벤트 전달
   *
   * @description
   * ClaudeManager에서 발생한 이벤트를 클라이언트에게 전달합니다.
   *
   * @param sessionId - 세션 ID (conversationId)
   * @param event - Claude 이벤트
   */
  sendClaudeEvent(sessionId: string, event: ClaudeManagerEvent): void {
    // 이벤트 타입별 메시지 저장
    this.saveEventToHistory(sessionId, event);

    // send_file MCP 도구 결과 처리
    if (event.type === 'toolComplete' && (event as Record<string, unknown>).toolName === 'mcp__estelle-mcp__send_file') {
      this.handleSendFileResult(sessionId, event);
    }

    // init 이벤트에서 claudeSessionId 저장
    if (event.type === 'init' && (event as Record<string, unknown>).session_id) {
      const workspaceId = this.deps.workspaceStore.findWorkspaceByConversation(sessionId);
      if (workspaceId) {
        this.deps.workspaceStore.updateClaudeSessionId(
          workspaceId,
          sessionId,
          (event as Record<string, unknown>).session_id as string
        );
        // claudeSessionId 저장
        this.saveWorkspaceStore().catch((err) => {
          this.log(`[Persistence] Failed to save claudeSessionId: ${err}`);
        });
      }
    }

    // result 이벤트에서 사용량 누적
    if (event.type === 'result') {
      this.accumulateUsage(event);
    }

    const message = {
      type: 'claude_event',
      payload: { conversationId: sessionId, event },
    };

    // 해당 세션을 시청 중인 클라이언트에게만 전송
    const viewers = this.getSessionViewers(sessionId);
    if (viewers.size > 0) {
      this.send({
        ...message,
        to: Array.from(viewers),
      });
    }

    // 상태 변경은 모든 클라이언트에게 브로드캐스트
    if (event.type === 'state') {
      const state = (event as Record<string, unknown>).state as ConversationStatusValue;
      const workspaceId = this.deps.workspaceStore.findWorkspaceByConversation(sessionId);
      if (workspaceId) {
        this.deps.workspaceStore.updateConversationStatus(workspaceId, sessionId, state);
      }

      this.send({
        type: 'conversation_status',
        payload: {
          deviceId: this.config.deviceId,
          conversationId: sessionId,
          status: state,
        },
        broadcast: 'clients',
      });
    }

    // 안 보고 있는 앱에게 unread 알림
    if (['textComplete', 'toolComplete', 'result', 'claudeAborted'].includes(event.type)) {
      this.sendUnreadToNonViewers(sessionId, viewers);
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
   * 히스토리 요청 처리
   */
  private handleHistoryRequest(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { workspaceId, conversationId, limit = 50, offset = 0 } = payload || {};
    if (!conversationId) return;

    const cid = conversationId as string;
    const totalCount = this.deps.messageStore.getCount(cid);
    const messages = this.deps.messageStore.getMessages(cid, {
      limit: limit as number,
      offset: offset as number,
    });
    const hasMore = (offset as number) + messages.length < totalCount;

    this.send({
      type: 'history_result',
      to: from?.deviceId,
      payload: {
        deviceId: this.config.deviceId,
        workspaceId,
        conversationId,
        messages,
        offset,
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

    const success = this.deps.workspaceStore.deleteWorkspace(workspaceId as string);
    this.send({
      type: 'workspace_delete_result',
      to: from?.deviceId,
      payload: { deviceId: this.config.deviceId, success, workspaceId },
    });
    if (success) {
      this.broadcastWorkspaceList();
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

    const success = this.deps.workspaceStore.updateWorkspace(workspaceId as string, {
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
    }
  }

  /**
   * workspace_reorder 처리
   */
  private handleWorkspaceReorder(payload: Record<string, unknown> | undefined): void {
    const { workspaceIds } = payload || {};
    if (!workspaceIds || !Array.isArray(workspaceIds)) return;

    const success = this.deps.workspaceStore.reorderWorkspaces(workspaceIds as string[]);
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
      workspaceId as string,
      conversationIds as string[]
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

    const success = this.deps.workspaceStore.renameWorkspace(workspaceId as string, newName as string);
    if (success) {
      this.broadcastWorkspaceList();
    }
  }

  /**
   * workspace_switch 처리
   */
  private handleWorkspaceSwitch(payload: Record<string, unknown> | undefined): void {
    const { workspaceId, conversationId } = payload || {};
    if (!workspaceId) return;

    this.deps.workspaceStore.setActiveWorkspace(
      workspaceId as string,
      conversationId as string | undefined
    );
    this.broadcastWorkspaceList();
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
      workspaceId as string,
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
      this.broadcastWorkspaceList();

      // 세션 뷰어 등록
      if (from?.deviceId) {
        this.registerSessionViewer(from.deviceId, conversation.conversationId);
      }
    }
  }

  /**
   * conversation_delete 처리
   */
  private handleConversationDelete(payload: Record<string, unknown> | undefined): void {
    const { workspaceId, conversationId } = payload || {};
    if (!workspaceId || !conversationId) return;

    const success = this.deps.workspaceStore.deleteConversation(
      workspaceId as string,
      conversationId as string
    );
    if (success) {
      this.broadcastWorkspaceList();
    }
  }

  /**
   * conversation_rename 처리
   */
  private handleConversationRename(payload: Record<string, unknown> | undefined): void {
    const { workspaceId, conversationId, newName } = payload || {};
    if (!workspaceId || !conversationId || !newName) return;

    const success = this.deps.workspaceStore.renameConversation(
      workspaceId as string,
      conversationId as string,
      newName as string
    );
    if (success) {
      this.broadcastWorkspaceList();
    }
  }

  /**
   * conversation_select 처리
   */
  private handleConversationSelect(
    payload: Record<string, unknown> | undefined,
    from: MessageFrom | undefined
  ): void {
    const { workspaceId, conversationId } = payload || {};
    if (!conversationId) return;

    const wsId = workspaceId as string | undefined;
    const cid = conversationId as string;

    // 워크스페이스와 대화 모두 active 상태로 설정
    if (wsId) {
      this.deps.workspaceStore.setActiveWorkspace(wsId, cid);
    } else {
      this.deps.workspaceStore.setActiveConversation(cid);
    }

    // 저장
    this.saveWorkspaceStore().catch((err) => {
      this.deps.logger.error(`[Pylon] Failed to save after conversation select: ${err}`);
    });

    // 메시지 세션 로드 (lazy loading)
    this.loadMessageSession(cid);

    // 클라이언트를 해당 세션의 시청자로 등록
    if (from?.deviceId) {
      this.registerSessionViewer(from.deviceId, cid);

      // 활성 세션 정보
      const hasActiveSession = this.deps.claudeManager.hasActiveSession(cid);
      const workStartTime = this.deps.claudeManager.getSessionStartTime(cid);

      // 메시지 히스토리 전송
      const totalCount = this.deps.messageStore.getCount(cid);
      const messages = this.deps.messageStore.getMessages(cid);

      this.send({
        type: 'history_result',
        to: from.deviceId,
        payload: {
          deviceId: this.config.deviceId,
          workspaceId,
          conversationId,
          messages,
          offset: 0,
          totalCount,
          hasMore: false,
          hasActiveSession,
          workStartTime,
        },
      });

      // pending 이벤트가 있으면 전송
      const pendingEvent = this.deps.claudeManager.getPendingEvent(cid);
      if (pendingEvent) {
        const pe = pendingEvent as { type: string };
        if (pe.type === 'permission_request' || pe.type === 'askQuestion') {
          this.send({
            type: 'claude_event',
            payload: { conversationId, event: { type: 'state', state: 'permission' } },
            to: [from.deviceId],
          });
        }
        this.send({
          type: 'claude_event',
          payload: { conversationId, event: pendingEvent },
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
    const { workspaceId, conversationId, message: userMessage, attachedFileIds } = payload || {};
    if (!conversationId || !userMessage) return;

    const cid = conversationId as string;
    const wid = workspaceId as string;

    // workingDir 및 conversation 정보 가져오기
    let workingDir: string | null = null;
    let conversation: Conversation | null = null;
    if (wid) {
      const workspace = this.deps.workspaceStore.getWorkspace(wid);
      workingDir = workspace?.workingDir ?? null;
      conversation = this.deps.workspaceStore.getConversation(wid, cid) ?? null;
    }

    // 첨부 파일 처리
    let attachments: unknown[] | null = null;
    const pendingFilesForConv = this.pendingFiles.get(cid);
    const fileIds = attachedFileIds as string[] | undefined;

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

    // 사용자 메시지 저장
    this.deps.messageStore.addUserMessage(cid, userMessage as string, attachments as never);
    this.scheduleSaveMessages(cid);

    // 사용자 메시지 브로드캐스트
    const userMessageEvent = {
      type: 'claude_event',
      payload: {
        workspaceId,
        conversationId,
        event: {
          type: 'userMessage',
          content: userMessage,
          timestamp: Date.now(),
          ...(attachments && { attachments }),
        },
      },
    };
    this.send({ ...userMessageEvent, broadcast: 'clients' });

    // Claude에게 메시지 전송
    if (workingDir) {
      let promptToSend = userMessage as string;

      // 첨부 파일 경로 추가
      if (attachments && attachments.length > 0) {
        const fileAttachments = (attachments as Array<{ path: string }>)
          .map((file) => `[첨부 파일: ${file.path}]`)
          .join('\n');
        promptToSend = `${fileAttachments}\n\n${promptToSend}`;
      }

      const claudeSessionId = conversation?.claudeSessionId ?? undefined;
      this.deps.claudeManager.sendMessage(cid, promptToSend, {
        workingDir,
        claudeSessionId,
      });
    }
  }

  /**
   * claude_permission 처리
   */
  private handleClaudePermission(payload: Record<string, unknown> | undefined): void {
    const { conversationId, toolUseId, decision } = payload || {};
    if (!conversationId || !toolUseId || !decision) return;

    this.deps.claudeManager.respondPermission(
      conversationId as string,
      toolUseId as string,
      decision as 'allow' | 'deny' | 'allowAll'
    );
  }

  /**
   * claude_answer 처리
   */
  private handleClaudeAnswer(payload: Record<string, unknown> | undefined): void {
    const { conversationId, toolUseId, answer } = payload || {};
    if (!conversationId || !toolUseId) return;

    this.deps.claudeManager.respondQuestion(
      conversationId as string,
      toolUseId as string,
      answer as string
    );
  }

  /**
   * claude_control 처리
   */
  private handleClaudeControl(payload: Record<string, unknown> | undefined): void {
    const { conversationId, action } = payload || {};
    if (!conversationId || !action) return;

    const sessionId = conversationId as string;

    switch (action) {
      case 'stop':
        this.deps.claudeManager.stop(sessionId);
        break;
      case 'new_session':
      case 'clear':
        this.deps.claudeManager.newSession(sessionId);
        this.deps.messageStore.clear(sessionId);
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
    const { conversationId, mode } = payload || {};
    if (!conversationId || !mode) return;

    // setConversationPermissionMode는 workspaceId 없이 conversationId로 찾음
    const success = this.deps.workspaceStore.setConversationPermissionMode(
      conversationId as string,
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
  private handleBlobEndResult(
    result: { success: boolean; path?: string; context?: unknown },
    from: MessageFrom | undefined,
    payload: Record<string, unknown> | undefined
  ): void {
    if (!result.success) return;

    const context = result.context as { type?: string; conversationId?: string } | undefined;
    if (context?.type === 'image_upload') {
      const { conversationId } = context;
      const blobId = (payload as { blobId?: string })?.blobId;

      if (conversationId && blobId && result.path) {
        const fileId = blobId;
        const filename = result.path.split(/[/\\]/).pop() || 'unknown';

        // 클라이언트에 업로드 완료 알림
        this.send({
          type: 'blob_upload_complete',
          to: from?.deviceId,
          payload: {
            blobId,
            fileId,
            path: result.path,
            filename,
            conversationId,
          },
        });

        // pending 파일로 저장
        if (!this.pendingFiles.has(conversationId)) {
          this.pendingFiles.set(conversationId, new Map());
        }
        this.pendingFiles.get(conversationId)!.set(fileId, {
          fileId,
          path: result.path,
          filename,
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
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId as string);
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
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId as string);
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
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId as string);
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
    this.broadcastTaskList(workspaceId as string);
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
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId as string);
    if (!workspace) return;

    const status = this.deps.workerManager.getWorkerStatus(workspaceId as string, workspace.workingDir);
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
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId as string);
    if (!workspace) return;

    // 비동기 처리
    (async () => {
      const startClaudeCallback = async (_wsId: string, workingDir: string, prompt: string) => {
        // 워커용 대화 생성 또는 기존 대화 사용
        let conversation = workspace.conversations.find((c) => c.name === 'Worker');
        if (!conversation) {
          conversation = this.deps.workspaceStore.createConversation(workspaceId as string, 'Worker')!;
        }

        this.deps.workspaceStore.setActiveConversation(conversation.conversationId);
        this.deps.claudeManager.sendMessage(conversation.conversationId, prompt, { workingDir });

        return {
          process: null,
          conversationId: conversation.conversationId,
        };
      };

      const result = await this.deps.workerManager.startWorker(
        workspaceId as string,
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
        this.broadcastWorkerStatus(workspaceId as string);
        this.broadcastTaskList(workspaceId as string);
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
    const workspace = this.deps.workspaceStore.getWorkspace(workspaceId as string);
    if (!workspace) return;

    const result = this.deps.workerManager.stopWorker(workspaceId as string, workspace.workingDir);
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
    };

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
  private broadcastTaskList(workspaceId: string): void {
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
  private broadcastWorkerStatus(workspaceId: string): void {
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
  private registerSessionViewer(clientId: string, sessionId: string): void {
    // 기존 시청 세션에서 제거
    for (const [existingSessionId, viewers] of this.sessionViewers) {
      if (viewers.has(clientId)) {
        viewers.delete(clientId);
        if (viewers.size === 0) {
          this.sessionViewers.delete(existingSessionId);
          this.deps.messageStore.unloadCache(existingSessionId);
          this.log(`Unloaded message cache for session ${existingSessionId} (no viewers)`);
        }
        break;
      }
    }

    // 새 세션에 등록
    if (!this.sessionViewers.has(sessionId)) {
      this.sessionViewers.set(sessionId, new Set());
    }
    this.sessionViewers.get(sessionId)!.add(clientId);

    // appUnreadSent 초기화
    if (!this.appUnreadSent.has(clientId)) {
      this.appUnreadSent.set(clientId, new Set());
    }
    this.appUnreadSent.get(clientId)!.delete(sessionId);

    this.log(`Client ${clientId} now viewing session ${sessionId}`);
  }

  /**
   * 세션 뷰어 해제
   */
  private unregisterSessionViewer(clientId: string): void {
    for (const [sessionId, viewers] of this.sessionViewers) {
      if (viewers.has(clientId)) {
        viewers.delete(clientId);
        if (viewers.size === 0) {
          this.sessionViewers.delete(sessionId);
          this.deps.messageStore.unloadCache(sessionId);
          this.log(`Unloaded message cache for session ${sessionId} (no viewers)`);
        }
        this.log(`Client ${clientId} removed from session ${sessionId} viewers`);
        break;
      }
    }

    this.appUnreadSent.delete(clientId);
  }

  /**
   * 안 보고 있는 앱에게 unread 알림
   */
  private sendUnreadToNonViewers(conversationId: string, viewers: Set<string>): void {
    const unreadTargets: string[] = [];

    for (const [appId, unreadSent] of this.appUnreadSent) {
      if (viewers.has(appId)) continue;
      if (unreadSent.has(conversationId)) continue;

      unreadTargets.push(appId);
      unreadSent.add(conversationId);
    }

    if (unreadTargets.length > 0) {
      const workspaceId = this.deps.workspaceStore.findWorkspaceByConversation(conversationId);
      if (workspaceId) {
        this.deps.workspaceStore.updateConversationUnread(workspaceId, conversationId, true);
      }

      this.send({
        type: 'conversation_status',
        payload: {
          deviceId: this.config.deviceId,
          conversationId,
          status: 'unread',
        },
        to: unreadTargets,
      });

      this.log(`Sent unread notification for ${conversationId} to ${unreadTargets.length} clients`);
    }
  }

  // ==========================================================================
  // Private 메서드 - 이벤트 저장
  // ==========================================================================

  /**
   * 이벤트를 메시지 히스토리에 저장
   */
  private saveEventToHistory(sessionId: string, event: ClaudeManagerEvent): void {
    const e = event as Record<string, unknown>;
    let shouldSave = false;

    switch (event.type) {
      case 'textComplete':
        this.deps.messageStore.addAssistantText(sessionId, e.text as string);
        shouldSave = true;
        break;

      case 'toolInfo':
        this.deps.messageStore.addToolStart(
          sessionId,
          e.toolName as string,
          e.input as Record<string, unknown>,
          e.parentToolUseId as string | null | undefined,
          e.toolUseId as string | undefined
        );
        shouldSave = true;
        break;

      case 'toolComplete':
        this.deps.messageStore.updateToolComplete(
          sessionId,
          e.toolName as string,
          e.success as boolean,
          e.result as string | undefined,
          e.error as string | undefined
        );
        shouldSave = true;
        break;

      case 'error':
        this.deps.messageStore.addError(sessionId, e.error as string);
        shouldSave = true;
        break;

      case 'result': {
        const usage = e.usage as { inputTokens?: number; outputTokens?: number; cacheReadInputTokens?: number } | undefined;
        this.deps.messageStore.addResult(sessionId, {
          durationMs: (e.duration_ms as number) || 0,
          inputTokens: usage?.inputTokens || 0,
          outputTokens: usage?.outputTokens || 0,
          cacheReadTokens: usage?.cacheReadInputTokens || 0,
        });
        shouldSave = true;
        break;
      }

      case 'claudeAborted':
        this.deps.messageStore.addAborted(sessionId, (e.reason as 'user' | 'session_ended') || 'user');
        shouldSave = true;
        break;
    }

    // 메시지 저장 예약 (debounce)
    if (shouldSave) {
      this.scheduleSaveMessages(sessionId);
    }
  }

  /**
   * send_file MCP 도구 결과 처리
   */
  private handleSendFileResult(sessionId: string, event: ClaudeManagerEvent): void {
    const e = event as Record<string, unknown>;
    if (!e.success || !e.result) return;

    try {
      const result = JSON.parse(e.result as string);
      if (!result.success || !result.file) return;

      const { path: filePath, filename, mimeType, fileType, size, description } = result.file;

      this.log(`[send_file] Sending file attachment: ${filename} (${fileType})`);

      const fileEvent = {
        type: 'fileAttachment',
        file: { path: filePath, filename, mimeType, fileType, size, description },
      };

      const message = {
        type: 'claude_event',
        payload: { conversationId: sessionId, event: fileEvent },
      };

      const viewers = this.getSessionViewers(sessionId);
      if (viewers.size > 0) {
        this.send({ ...message, to: Array.from(viewers) });
      }

      this.deps.messageStore.addFileAttachment(sessionId, result.file);
    } catch (err) {
      this.log(`[send_file] Failed to parse result: ${(err as Error).message}`);
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
   * 메시지 세션 저장 예약 (debounce)
   */
  private scheduleSaveMessages(sessionId: string): void {
    const persistence = this.deps.persistence;
    if (!persistence) return;

    // 기존 타이머 취소
    const existingTimer = this.messageSaveTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 새 타이머 설정
    const timer = setTimeout(async () => {
      this.messageSaveTimers.delete(sessionId);
      await this.saveMessageSession(sessionId);
    }, this.MESSAGE_SAVE_DEBOUNCE_MS);

    this.messageSaveTimers.set(sessionId, timer);
  }

  /**
   * 메시지 세션 즉시 저장
   */
  private async saveMessageSession(sessionId: string): Promise<void> {
    const persistence = this.deps.persistence;
    if (!persistence) return;

    try {
      const sessionData = this.deps.messageStore.getSessionData(sessionId);
      if (sessionData) {
        await persistence.saveMessageSession(sessionId, sessionData);
        this.deps.messageStore.markClean(sessionId);
        this.log(`[Persistence] Saved message session: ${sessionId}`);
      }
    } catch (err) {
      this.deps.logger.error(`[Persistence] Failed to save session ${sessionId}: ${err}`);
    }
  }

  /**
   * 모든 pending 저장 즉시 실행
   */
  private async flushPendingSaves(): Promise<void> {
    // 모든 타이머 취소
    for (const [sessionId, timer] of this.messageSaveTimers) {
      clearTimeout(timer);
      this.messageSaveTimers.delete(sessionId);
    }

    // dirty 세션 모두 저장
    if (this.deps.messageStore.hasDirtyData()) {
      const dirtySessions = this.deps.messageStore.getDirtySessions();
      for (const sessionId of dirtySessions) {
        await this.saveMessageSession(sessionId);
      }
    }
  }

  /**
   * 메시지 세션 로드 (lazy loading)
   */
  loadMessageSession(sessionId: string): void {
    const persistence = this.deps.persistence;
    if (!persistence) return;

    // 이미 캐시되어 있으면 스킵
    if (this.deps.messageStore.hasCache(sessionId)) return;

    const sessionData = persistence.loadMessageSession(sessionId);
    if (sessionData) {
      this.deps.messageStore.loadSessionData(sessionId, sessionData);
      this.log(`[Persistence] Loaded message session: ${sessionId}`);
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
}
