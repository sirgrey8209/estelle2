/**
 * @file workspace-store.ts
 * @description WorkspaceStore - 워크스페이스 영속 저장
 *
 * 워크스페이스와 대화 정보를 관리하는 순수 데이터 클래스입니다.
 * 파일 I/O는 외부에서 처리하여 테스트 용이성을 확보합니다.
 *
 * ID 체계:
 * - workspaceId: number (1~127) - 할당 시 빈 번호 검색
 * - entityId: EntityId (비트 팩 number) - pylonId + workspaceId + localConvId
 * - UUID 사용하지 않음
 *
 * 저장 구조:
 * ```json
 * {
 *   "activeWorkspaceId": 1,
 *   "activeConversationId": 2049,
 *   "workspaces": [
 *     {
 *       "workspaceId": 1,
 *       "name": "Estelle",
 *       "workingDir": "C:\\workspace\\estelle",
 *       "conversations": [
 *         {
 *           "entityId": 2049,
 *           "name": "기능 논의",
 *           "claudeSessionId": "session-uuid",
 *           "status": "idle",
 *           "unread": false,
 *           "permissionMode": "default"
 *         }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */

import { ConversationStatus, PermissionMode, encodeEntityIdWithEnv, decodeEntityIdWithEnv } from '@estelle/core';
import type { ConversationStatusValue, PermissionModeValue, EntityId, LinkedDocument } from '@estelle/core';

// ============================================================================
// 상수
// ============================================================================

/** 워크스페이스 ID 최대값 (7비트: 1~127) */
const MAX_WORKSPACE_ID = 127;

/** 대화 ID 최대값 (10비트: 1~1023) */
const MAX_CONVERSATION_ID = 1023;

/** 기본 작업 디렉토리 (환경 변수 또는 기본값) */
const DEFAULT_WORKING_DIR = process.env.DEFAULT_WORKING_DIR || 'C:\\workspace';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 대화(Conversation) 정보
 */
export interface Conversation {
  /** 대화 고유 식별자 (EntityId: pylonId + workspaceId + localConvId 인코딩) */
  entityId: EntityId;

  /** 대화 이름 (표시용) */
  name: string;

  /** Claude Code 세션 ID (연결되지 않은 경우 null) */
  claudeSessionId: string | null;

  /** 대화 상태 (idle, working, permission, offline) */
  status: ConversationStatusValue;

  /** 읽지 않은 메시지 여부 */
  unread: boolean;

  /** 권한 모드 (default, acceptEdits, bypassPermissions) */
  permissionMode: PermissionModeValue;

  /** 대화 생성 시각 (Unix timestamp) */
  createdAt: number;

  /** 연결된 문서 목록 */
  linkedDocuments?: LinkedDocument[];
}

/**
 * 워크스페이스(Workspace) 정보
 */
export interface Workspace {
  /** 워크스페이스 고유 식별자 (1~127) */
  workspaceId: number;

  /** 워크스페이스 이름 (표시용) */
  name: string;

  /** 작업 디렉토리 경로 */
  workingDir: string;

  /** 워크스페이스 내 대화 목록 */
  conversations: Conversation[];

  /** 워크스페이스 생성 시각 (Unix timestamp) */
  createdAt: number;

  /** 마지막 사용 시각 (Unix timestamp) */
  lastUsed: number;
}

/**
 * 활성 상태를 포함한 워크스페이스 정보
 */
export interface WorkspaceWithActive extends Workspace {
  /** 현재 활성화된 워크스페이스 여부 */
  isActive: boolean;
}

/**
 * 워크스페이스 스토어 데이터 (직렬화용)
 */
export interface WorkspaceStoreData {
  /** 현재 활성 워크스페이스 ID (없으면 null) */
  activeWorkspaceId: number | null;

  /** 현재 활성 대화 EntityId (없으면 null) */
  activeConversationId: EntityId | null;

  /** 모든 워크스페이스 목록 */
  workspaces: Workspace[];
}

/**
 * 워크스페이스 생성 결과
 */
export interface CreateWorkspaceResult {
  /** 생성된 워크스페이스 */
  workspace: Workspace;

  /** 자동 생성된 첫 번째 대화 (현재 사용 안 함, undefined) */
  conversation: Conversation | undefined;
}

/**
 * 활성 상태 정보
 */
export interface ActiveState {
  /** 현재 활성 워크스페이스 ID */
  activeWorkspaceId: number | null;

  /** 현재 활성 대화 EntityId */
  activeConversationId: EntityId | null;
}

/**
 * finishing 상태 대화 정보 (재처리용)
 */
export interface FinishingConversationInfo {
  entityId: EntityId;
  workingDir: string;
  claudeSessionId: string | null;
}

/**
 * finished 상태 대화 정보 (다이얼로그 표시용)
 */
export interface FinishedConversationInfo {
  entityId: EntityId;
}

// ============================================================================
// WorkspaceStore 클래스
// ============================================================================

/**
 * WorkspaceStore - 워크스페이스 영속 저장 관리
 *
 * @description
 * 워크스페이스와 대화 정보를 관리하는 순수 데이터 클래스입니다.
 * ID는 숫자 기반으로 할당되며, 삭제된 ID는 다음 할당 시 재사용됩니다.
 * 대화는 EntityId로 전역 고유 식별됩니다.
 */
export class WorkspaceStore {
  // ============================================================================
  // Private 필드
  // ============================================================================

  /** Env ID (0=release, 1=stage, 2=dev) */
  private _envId: number;

  /** Pylon ID (EntityId 인코딩에 사용) */
  private _pylonId: number;

  /** 현재 활성 워크스페이스 ID */
  private _activeWorkspaceId: number | null;

  /** 현재 활성 대화 EntityId */
  private _activeConversationId: EntityId | null;

  /** 모든 워크스페이스 목록 */
  private _workspaces: Workspace[];

  // ============================================================================
  // 생성자
  // ============================================================================

  constructor(pylonId: number, data?: WorkspaceStoreData, envId: number = 0) {
    this._envId = envId;
    this._pylonId = pylonId;
    this._activeWorkspaceId = data?.activeWorkspaceId ?? null;
    this._activeConversationId = data?.activeConversationId ?? null;
    this._workspaces = data?.workspaces ?? [];
  }

  // ============================================================================
  // 정적 팩토리 메서드
  // ============================================================================

  static fromJSON(pylonId: number, data: WorkspaceStoreData, envId: number = 0): WorkspaceStore {
    return new WorkspaceStore(pylonId, data, envId);
  }

  // ============================================================================
  // 직렬화
  // ============================================================================

  toJSON(): WorkspaceStoreData {
    return {
      activeWorkspaceId: this._activeWorkspaceId,
      activeConversationId: this._activeConversationId,
      workspaces: this._workspaces,
    };
  }

  // ============================================================================
  // ID 할당 (빈 번호 검색)
  // ============================================================================

  /**
   * 사용 가능한 가장 작은 워크스페이스 ID 할당
   */
  private allocateWorkspaceId(): number {
    const used = new Set(this._workspaces.map((w) => w.workspaceId));
    for (let i = 1; i <= MAX_WORKSPACE_ID; i++) {
      if (!used.has(i)) return i;
    }
    throw new Error('No available workspace IDs (max: 127)');
  }

  /**
   * 사용 가능한 가장 작은 대화 로컬 ID 할당
   */
  private allocateConversationId(workspace: Workspace): number {
    const used = new Set(
      workspace.conversations.map((c) => decodeEntityIdWithEnv(c.entityId).conversationId)
    );
    for (let i = 1; i <= MAX_CONVERSATION_ID; i++) {
      if (!used.has(i)) return i;
    }
    throw new Error('No available conversation IDs (max: 1023)');
  }

  // ============================================================================
  // Private 헬퍼
  // ============================================================================

  /**
   * entityId로 워크스페이스와 대화를 함께 찾기
   */
  private findConversation(
    entityId: EntityId
  ): { workspace: Workspace; conversation: Conversation } | null {
    const { workspaceId } = decodeEntityIdWithEnv(entityId);
    const workspace = this._workspaces.find((w) => w.workspaceId === workspaceId);
    if (!workspace) return null;

    const conversation = workspace.conversations.find((c) => c.entityId === entityId);
    if (!conversation) return null;

    return { workspace, conversation };
  }

  // ============================================================================
  // Workspace CRUD
  // ============================================================================

  getAllWorkspaces(): WorkspaceWithActive[] {
    return this._workspaces.map((w) => ({
      ...w,
      isActive: w.workspaceId === this._activeWorkspaceId,
    }));
  }

  getActiveWorkspace(): Workspace | null {
    return (
      this._workspaces.find((w) => w.workspaceId === this._activeWorkspaceId) || null
    );
  }

  getWorkspace(workspaceId: number): Workspace | null {
    return this._workspaces.find((w) => w.workspaceId === workspaceId) || null;
  }

  createWorkspace(
    name: string,
    workingDir: string = DEFAULT_WORKING_DIR
  ): CreateWorkspaceResult {
    const now = Date.now();
    const wsId = this.allocateWorkspaceId();

    // 빈 conversations 배열로 워크스페이스 생성
    const newWorkspace: Workspace = {
      workspaceId: wsId,
      name,
      workingDir,
      conversations: [],
      createdAt: now,
      lastUsed: now,
    };

    this._workspaces.push(newWorkspace);
    this._activeWorkspaceId = wsId;
    this._activeConversationId = null;

    return { workspace: newWorkspace, conversation: undefined };
  }

  deleteWorkspace(workspaceId: number): boolean {
    const idx = this._workspaces.findIndex((w) => w.workspaceId === workspaceId);
    if (idx < 0) return false;

    this._workspaces.splice(idx, 1);

    if (this._activeWorkspaceId === workspaceId) {
      const next = this._workspaces[0];
      this._activeWorkspaceId = next?.workspaceId ?? null;
      this._activeConversationId = next?.conversations[0]?.entityId ?? null;
    }

    return true;
  }

  renameWorkspace(workspaceId: number, newName: string): boolean {
    const workspace = this._workspaces.find((w) => w.workspaceId === workspaceId);
    if (!workspace) return false;

    workspace.name = newName;
    return true;
  }

  updateWorkspace(
    workspaceId: number,
    updates: { name?: string; workingDir?: string }
  ): boolean {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) return false;

    const trimmedName = updates.name?.trim();
    const hasName = trimmedName !== undefined && trimmedName !== '';
    const hasWorkingDir = updates.workingDir !== undefined;

    if (!hasName && !hasWorkingDir) return false;
    if (updates.name !== undefined && !hasName) return false;

    if (hasName) workspace.name = trimmedName!;
    if (hasWorkingDir) workspace.workingDir = updates.workingDir!.replace(/\//g, '\\');

    workspace.lastUsed = Date.now();
    return true;
  }

  reorderWorkspaces(workspaceIds: number[]): boolean {
    const validIds = workspaceIds.every((id) =>
      this._workspaces.some((w) => w.workspaceId === id)
    );
    if (!validIds) return false;

    const reordered = workspaceIds
      .map((id) => this._workspaces.find((w) => w.workspaceId === id))
      .filter((w): w is Workspace => w !== undefined);

    const remaining = this._workspaces.filter(
      (w) => !workspaceIds.includes(w.workspaceId)
    );

    this._workspaces = [...reordered, ...remaining];
    return true;
  }

  reorderConversations(workspaceId: number, entityIds: EntityId[]): boolean {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) return false;

    const validIds = entityIds.every((id) =>
      workspace.conversations.some((c) => c.entityId === id)
    );
    if (!validIds) return false;

    const reordered = entityIds
      .map((id) => workspace.conversations.find((c) => c.entityId === id))
      .filter((c): c is Conversation => c !== undefined);

    const remaining = workspace.conversations.filter(
      (c) => !(entityIds as number[]).includes(c.entityId as number)
    );

    workspace.conversations = [...reordered, ...remaining];
    return true;
  }

  setActiveWorkspace(
    workspaceId: number,
    entityId?: EntityId | null
  ): boolean {
    const workspace = this._workspaces.find((w) => w.workspaceId === workspaceId);
    if (!workspace) return false;

    this._activeWorkspaceId = workspaceId;
    workspace.lastUsed = Date.now();

    if (entityId) {
      const conv = workspace.conversations.find((c) => c.entityId === entityId);
      this._activeConversationId = conv
        ? entityId
        : workspace.conversations[0]?.entityId ?? null;
    } else {
      this._activeConversationId =
        workspace.conversations[0]?.entityId ?? null;
    }

    return true;
  }

  // ============================================================================
  // Conversation CRUD
  // ============================================================================

  getConversation(entityId: EntityId): Conversation | null {
    const found = this.findConversation(entityId);
    return found?.conversation ?? null;
  }

  getActiveConversation(): Conversation | null {
    if (!this._activeConversationId) return null;
    return this.getConversation(this._activeConversationId);
  }

  createConversation(
    workspaceId: number,
    name: string = '새 대화'
  ): Conversation | null {
    const workspace = this._workspaces.find((w) => w.workspaceId === workspaceId);
    if (!workspace) return null;

    const localId = this.allocateConversationId(workspace);
    const entityId = encodeEntityIdWithEnv(this._envId, this._pylonId, workspaceId, localId);

    const newConversation: Conversation = {
      entityId,
      name,
      claudeSessionId: null,
      status: ConversationStatus.IDLE,
      unread: false,
      permissionMode: PermissionMode.BYPASS,
      createdAt: Date.now(),
    };

    workspace.conversations.push(newConversation);
    workspace.lastUsed = Date.now();
    this._activeConversationId = entityId;

    return newConversation;
  }

  deleteConversation(entityId: EntityId): boolean {
    const found = this.findConversation(entityId);
    if (!found) return false;

    const { workspace } = found;
    const idx = workspace.conversations.findIndex((c) => c.entityId === entityId);
    if (idx < 0) return false;

    workspace.conversations.splice(idx, 1);

    if (this._activeConversationId === entityId) {
      this._activeConversationId =
        workspace.conversations[0]?.entityId ?? null;
    }

    return true;
  }

  renameConversation(entityId: EntityId, newName: string): boolean {
    const found = this.findConversation(entityId);
    if (!found) return false;

    found.conversation.name = newName;
    return true;
  }

  setActiveConversation(entityId: EntityId): boolean {
    this._activeConversationId = entityId;
    return true;
  }

  // ============================================================================
  // Conversation 상태 업데이트
  // ============================================================================

  updateConversationStatus(
    entityId: EntityId,
    status: ConversationStatusValue
  ): boolean {
    const found = this.findConversation(entityId);
    if (!found) return false;

    found.conversation.status = status;
    return true;
  }

  updateConversationUnread(entityId: EntityId, unread: boolean): boolean {
    const found = this.findConversation(entityId);
    if (!found) return false;

    found.conversation.unread = unread;
    return true;
  }

  updateClaudeSessionId(
    entityId: EntityId,
    sessionId: string | null
  ): boolean {
    const found = this.findConversation(entityId);
    if (!found) return false;

    found.conversation.claudeSessionId = sessionId;
    found.workspace.lastUsed = Date.now();
    return true;
  }

  // ============================================================================
  // Permission Mode
  // ============================================================================

  getConversationPermissionMode(entityId: EntityId): PermissionModeValue {
    const conv = this.getConversation(entityId);
    return conv?.permissionMode || PermissionMode.DEFAULT;
  }

  setConversationPermissionMode(
    entityId: EntityId,
    mode: PermissionModeValue
  ): boolean {
    const conv = this.getConversation(entityId);
    if (!conv) return false;

    conv.permissionMode = mode;
    return true;
  }

  // ============================================================================
  // LinkedDocument 관리
  // ============================================================================

  /**
   * 경로 정규화: 슬래시를 백슬래시로 변환하고 공백 제거
   */
  private normalizePath(path: string): string {
    return path.trim().replace(/\//g, '\\');
  }

  /**
   * 대화에 문서 연결
   *
   * @param entityId 대화 EntityId
   * @param path 문서 경로
   * @returns 연결 성공 여부 (중복이면 false)
   */
  linkDocument(entityId: EntityId, path: string): boolean {
    // 빈 경로 또는 공백만 있는 경로 처리
    const normalizedPath = this.normalizePath(path);
    if (normalizedPath === '') {
      return false;
    }

    const found = this.findConversation(entityId);
    if (!found) return false;

    const { conversation } = found;

    // linkedDocuments 배열 초기화
    if (!conversation.linkedDocuments) {
      conversation.linkedDocuments = [];
    }

    // 중복 체크 (정규화된 경로로 비교)
    const exists = conversation.linkedDocuments.some(
      (doc) => doc.path === normalizedPath
    );
    if (exists) {
      return false;
    }

    // 문서 추가
    conversation.linkedDocuments.push({
      path: normalizedPath,
      addedAt: Date.now(),
    });

    return true;
  }

  /**
   * 대화에서 문서 연결 해제
   *
   * @param entityId 대화 EntityId
   * @param path 문서 경로
   * @returns 해제 성공 여부 (없으면 false)
   */
  unlinkDocument(entityId: EntityId, path: string): boolean {
    // 빈 경로 처리
    const normalizedPath = this.normalizePath(path);
    if (normalizedPath === '') {
      return false;
    }

    const found = this.findConversation(entityId);
    if (!found) return false;

    const { conversation } = found;

    // linkedDocuments가 없거나 비어있으면 false
    if (!conversation.linkedDocuments || conversation.linkedDocuments.length === 0) {
      return false;
    }

    // 경로 찾기
    const idx = conversation.linkedDocuments.findIndex(
      (doc) => doc.path === normalizedPath
    );
    if (idx < 0) {
      return false;
    }

    // 제거
    conversation.linkedDocuments.splice(idx, 1);
    return true;
  }

  /**
   * 대화에 연결된 문서 목록 조회
   *
   * @param entityId 대화 EntityId
   * @returns 연결된 문서 목록 (추가 순서대로)
   */
  getLinkedDocuments(entityId: EntityId): LinkedDocument[] {
    const found = this.findConversation(entityId);
    if (!found) return [];

    return found.conversation.linkedDocuments ?? [];
  }

  // ============================================================================
  // Utility 메서드
  // ============================================================================

  findWorkspaceByName(name: string): Workspace | null {
    const lowerName = name.toLowerCase();
    return (
      this._workspaces.find(
        (w) => w.name.toLowerCase() === lowerName
      ) ||
      this._workspaces.find((w) =>
        w.name.toLowerCase().includes(lowerName)
      ) ||
      null
    );
  }

  findWorkspaceByWorkingDir(workingDir: string): Workspace | null {
    return this._workspaces.find((w) => w.workingDir === workingDir) || null;
  }

  getActiveState(): ActiveState {
    return {
      activeWorkspaceId: this._activeWorkspaceId,
      activeConversationId: this._activeConversationId,
    };
  }

  // ============================================================================
  // 상태 초기화 메서드
  // ============================================================================

  /**
   * 시작 시 활성 상태 대화들 초기화
   *
   * @returns 초기화된 대화의 entityId 목록
   */
  resetActiveConversations(): EntityId[] {
    const result: EntityId[] = [];

    for (const workspace of this._workspaces) {
      for (const conv of workspace.conversations) {
        if (
          conv.status === ConversationStatus.WORKING ||
          conv.status === ConversationStatus.WAITING
        ) {
          conv.status = ConversationStatus.IDLE;
          result.push(conv.entityId);
        }
      }
    }

    return result;
  }

  getFinishingConversations(): FinishingConversationInfo[] {
    const result: FinishingConversationInfo[] = [];

    for (const workspace of this._workspaces) {
      for (const conv of workspace.conversations) {
        if ((conv.status as string) === 'finishing') {
          result.push({
            entityId: conv.entityId,
            workingDir: workspace.workingDir,
            claudeSessionId: conv.claudeSessionId,
          });
        }
      }
    }

    return result;
  }

  getFinishedConversations(): FinishedConversationInfo[] {
    const result: FinishedConversationInfo[] = [];

    for (const workspace of this._workspaces) {
      for (const conv of workspace.conversations) {
        if ((conv.status as string) === 'finished') {
          result.push({ entityId: conv.entityId });
        }
      }
    }

    return result;
  }
}
