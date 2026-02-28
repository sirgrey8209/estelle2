/**
 * @file workspace-store.ts
 * @description WorkspaceStore - 워크스페이스 영속 저장
 *
 * 워크스페이스와 대화 정보를 관리하는 순수 데이터 클래스입니다.
 * 파일 I/O는 외부에서 처리하여 테스트 용이성을 확보합니다.
 *
 * ID 체계 (24비트 통합 ID):
 * - PylonId (7비트): envId(2) + deviceType(1, 0=Pylon) + deviceIndex(4)
 * - WorkspaceId (14비트): PylonId(7) + workspaceIndex(7)
 * - ConversationId (24비트): WorkspaceId(14) + conversationIndex(10)
 *
 * 레거시 호환:
 * - conversationId 필드명은 유지 (ConversationId와 동일)
 * - workspaceId: number (1~127) - workspaceIndex와 동일
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
 *           "conversationId": 2049,
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

import {
  ConversationStatus,
  PermissionMode,
  // 새로운 ID 시스템
  encodePylonId as encodeNewPylonId,
  encodeWorkspaceId as encodeNewWorkspaceId,
  encodeConversationId as encodeNewConversationId,
  decodeConversationId as decodeNewConversationId,
  decodeWorkspaceId as decodeNewWorkspaceId,
  MAX_WORKSPACE_INDEX,
  MAX_CONVERSATION_INDEX,
} from '@estelle/core';
import type {
  ConversationStatusValue,
  PermissionModeValue,
  LinkedDocument,
  // 새로운 ID 시스템 타입 (내부용)
  EnvId,
  PylonId,
  WorkspaceId,
  ConversationId,
} from '@estelle/core';

// 레거시 호환: 외부 인터페이스에서 conversationId 필드명 유지
// 내부적으로 ConversationId 타입 사용 (branded type)
// ConversationId 타입 별칭은 사용하지 않음 - Core의 ConversationId와 충돌 방지

// ============================================================================
// 상수
// ============================================================================

/** 워크스페이스 ID 최대값 (7비트: 1~127) - MAX_WORKSPACE_INDEX 사용 */
const MAX_WORKSPACE_ID = MAX_WORKSPACE_INDEX;

/** 대화 ID 최대값 (10비트: 1~1023) - MAX_CONVERSATION_INDEX 사용 */
const MAX_CONVERSATION_ID = MAX_CONVERSATION_INDEX;

/** 기본 작업 디렉토리 (환경 변수 또는 기본값) */
const DEFAULT_WORKING_DIR = process.env.DEFAULT_WORKING_DIR || 'C:\\workspace';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 대화(Conversation) 정보
 */
export interface Conversation {
  /** 대화 고유 식별자 (24비트 ConversationId) */
  conversationId: ConversationId;

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

  /** 커스텀 시스템 프롬프트 (선택, 파일 내용 또는 직접 입력) */
  customSystemPrompt?: string;
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

  /** 현재 활성 대화 ConversationId (없으면 null) */
  activeConversationId: ConversationId | null;

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

  /** 현재 활성 대화 ConversationId */
  activeConversationId: ConversationId | null;
}

/**
 * finishing 상태 대화 정보 (재처리용)
 */
export interface FinishingConversationInfo {
  conversationId: ConversationId;
  workingDir: string;
  claudeSessionId: string | null;
}

/**
 * finished 상태 대화 정보 (다이얼로그 표시용)
 */
export interface FinishedConversationInfo {
  conversationId: ConversationId;
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
 * 대화는 ConversationId로 전역 고유 식별됩니다.
 */
export class WorkspaceStore {
  // ============================================================================
  // Private 필드
  // ============================================================================

  /**
   * Pylon ID (7비트)
   * 새로운 ID 시스템: envId(2) + deviceType(1, 0=Pylon) + deviceIndex(4)
   */
  private _pylonId: PylonId;

  /** 현재 활성 워크스페이스 ID */
  private _activeWorkspaceId: number | null;

  /** 현재 활성 대화 ConversationId (ConversationId) */
  private _activeConversationId: ConversationId | null;

  /** 모든 워크스페이스 목록 */
  private _workspaces: Workspace[];

  // ============================================================================
  // 생성자
  // ============================================================================

  /**
   * WorkspaceStore 생성자
   *
   * @param deviceIndex - 디바이스 인덱스 (1~15, Pylon은 0 불가)
   * @param data - 기존 데이터 (직렬화된 상태)
   * @param envId - 환경 ID (0=release, 1=stage, 2=dev), 기본값 0
   *
   * @remarks
   * 레거시 호환: 이전에는 pylonId(4비트)를 직접 받았지만,
   * 새 ID 시스템에서는 deviceIndex와 envId를 받아 PylonId를 생성합니다.
   */
  constructor(deviceIndex: number, data?: WorkspaceStoreData, envId: EnvId = 0) {
    this._pylonId = encodeNewPylonId(envId, deviceIndex);
    this._activeWorkspaceId = data?.activeWorkspaceId ?? null;
    this._activeConversationId = data?.activeConversationId as ConversationId ?? null;
    this._workspaces = data?.workspaces ?? [];
  }

  // ============================================================================
  // 정적 팩토리 메서드
  // ============================================================================

  /**
   * JSON 데이터로부터 WorkspaceStore 생성
   *
   * @param deviceIndex - 디바이스 인덱스 (1~15)
   * @param data - 직렬화된 데이터
   * @param envId - 환경 ID (0=release, 1=stage, 2=dev)
   */
  static fromJSON(deviceIndex: number, data: WorkspaceStoreData, envId: EnvId = 0): WorkspaceStore {
    return new WorkspaceStore(deviceIndex, data, envId);
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
    // 기존 워크스페이스의 workspaceIndex 사용 현황 조회
    const usedIndices = new Set(this._workspaces.map((w) => {
      const decoded = decodeNewWorkspaceId(w.workspaceId as WorkspaceId);
      return decoded.workspaceIndex;
    }));
    for (let i = 1; i <= MAX_WORKSPACE_ID; i++) {
      if (!usedIndices.has(i)) {
        // pylonId를 포함한 인코딩된 WorkspaceId 반환
        return encodeNewWorkspaceId(this._pylonId, i);
      }
    }
    throw new Error('No available workspace IDs (max: 127)');
  }

  /**
   * 사용 가능한 가장 작은 대화 로컬 ID(conversationIndex) 할당
   */
  private allocateConversationId(workspace: Workspace): number {
    const used = new Set(
      workspace.conversations.map((c) => {
        // ConversationId에서 conversationIndex 추출
        const { conversationIndex } = decodeNewConversationId(c.conversationId as ConversationId);
        return conversationIndex;
      })
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
   * conversationId로 워크스페이스와 대화를 함께 찾기
   */
  private findConversation(
    conversationId: ConversationId
  ): { workspace: Workspace; conversation: Conversation } | null {
    // ConversationId → WorkspaceId 추출 (인코딩된 값)
    const { workspaceId: wsId } = decodeNewConversationId(conversationId as ConversationId);

    const workspace = this._workspaces.find((w) => w.workspaceId === wsId);
    if (!workspace) return null;

    const conversation = workspace.conversations.find((c) => c.conversationId === conversationId);
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
      this._activeConversationId = next?.conversations[0]?.conversationId ?? null;
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

  reorderConversations(workspaceId: number, conversationIds: ConversationId[]): boolean {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) return false;

    const validIds = conversationIds.every((id) =>
      workspace.conversations.some((c) => c.conversationId === id)
    );
    if (!validIds) return false;

    const reordered = conversationIds
      .map((id) => workspace.conversations.find((c) => c.conversationId === id))
      .filter((c): c is Conversation => c !== undefined);

    const remaining = workspace.conversations.filter(
      (c) => !(conversationIds as number[]).includes(c.conversationId as number)
    );

    workspace.conversations = [...reordered, ...remaining];
    return true;
  }

  setActiveWorkspace(
    workspaceId: number,
    conversationId?: ConversationId | null
  ): boolean {
    const workspace = this._workspaces.find((w) => w.workspaceId === workspaceId);
    if (!workspace) return false;

    this._activeWorkspaceId = workspaceId;
    workspace.lastUsed = Date.now();

    if (conversationId) {
      const conv = workspace.conversations.find((c) => c.conversationId === conversationId);
      this._activeConversationId = conv
        ? conversationId
        : workspace.conversations[0]?.conversationId ?? null;
    } else {
      this._activeConversationId =
        workspace.conversations[0]?.conversationId ?? null;
    }

    return true;
  }

  // ============================================================================
  // Conversation CRUD
  // ============================================================================

  getConversation(conversationId: ConversationId): Conversation | null {
    const found = this.findConversation(conversationId);
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

    const conversationIndex = this.allocateConversationId(workspace);

    // 새로운 ID 시스템으로 ConversationId 생성
    // workspaceId는 이미 인코딩된 값 (pylonId + workspaceIndex)
    // WorkspaceId(14) + conversationIndex(10) = ConversationId(24)
    const conversationId = encodeNewConversationId(workspaceId as WorkspaceId, conversationIndex) as ConversationId;

    const newConversation: Conversation = {
      conversationId,
      name,
      claudeSessionId: null,
      status: ConversationStatus.IDLE,
      unread: false,
      permissionMode: PermissionMode.BYPASS,
      createdAt: Date.now(),
    };

    workspace.conversations.push(newConversation);
    workspace.lastUsed = Date.now();
    this._activeConversationId = conversationId;

    return newConversation;
  }

  deleteConversation(conversationId: ConversationId): boolean {
    const found = this.findConversation(conversationId);
    if (!found) return false;

    const { workspace } = found;
    const idx = workspace.conversations.findIndex((c) => c.conversationId === conversationId);
    if (idx < 0) return false;

    workspace.conversations.splice(idx, 1);

    if (this._activeConversationId === conversationId) {
      this._activeConversationId =
        workspace.conversations[0]?.conversationId ?? null;
    }

    return true;
  }

  renameConversation(conversationId: ConversationId, newName: string): boolean {
    const found = this.findConversation(conversationId);
    if (!found) return false;

    found.conversation.name = newName;
    return true;
  }

  setActiveConversation(conversationId: ConversationId): boolean {
    this._activeConversationId = conversationId;
    return true;
  }

  /**
   * 활성 대화를 해제합니다 (멀티 Pylon 환경에서 다른 Pylon 대화 선택 시)
   */
  clearActiveConversation(): void {
    this._activeConversationId = null;
  }

  // ============================================================================
  // Conversation 상태 업데이트
  // ============================================================================

  updateConversationStatus(
    conversationId: ConversationId,
    status: ConversationStatusValue
  ): boolean {
    const found = this.findConversation(conversationId);
    if (!found) return false;

    found.conversation.status = status;
    return true;
  }

  updateConversationUnread(conversationId: ConversationId, unread: boolean): boolean {
    const found = this.findConversation(conversationId);
    if (!found) return false;

    found.conversation.unread = unread;
    return true;
  }

  updateClaudeSessionId(
    conversationId: ConversationId,
    sessionId: string | null
  ): boolean {
    const found = this.findConversation(conversationId);
    if (!found) return false;

    found.conversation.claudeSessionId = sessionId;
    found.workspace.lastUsed = Date.now();
    return true;
  }

  // ============================================================================
  // Permission Mode
  // ============================================================================

  getConversationPermissionMode(conversationId: ConversationId): PermissionModeValue {
    const conv = this.getConversation(conversationId);
    return conv?.permissionMode || PermissionMode.DEFAULT;
  }

  setConversationPermissionMode(
    conversationId: ConversationId,
    mode: PermissionModeValue
  ): boolean {
    const conv = this.getConversation(conversationId);
    if (!conv) return false;

    conv.permissionMode = mode;
    return true;
  }

  // ============================================================================
  // Custom System Prompt
  // ============================================================================

  /**
   * 대화의 커스텀 시스템 프롬프트 설정
   *
   * @param conversationId 대화 ConversationId
   * @param prompt 시스템 프롬프트 (null로 설정하면 제거)
   * @returns 설정 성공 여부
   */
  setCustomSystemPrompt(
    conversationId: ConversationId,
    prompt: string | null
  ): boolean {
    const conv = this.getConversation(conversationId);
    if (!conv) return false;

    if (prompt === null) {
      delete conv.customSystemPrompt;
    } else {
      conv.customSystemPrompt = prompt;
    }
    return true;
  }

  /**
   * 대화의 커스텀 시스템 프롬프트 조회
   *
   * @param conversationId 대화 ConversationId
   * @returns 커스텀 시스템 프롬프트 (없으면 undefined)
   */
  getCustomSystemPrompt(conversationId: ConversationId): string | undefined {
    const conv = this.getConversation(conversationId);
    return conv?.customSystemPrompt;
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
   * @param conversationId 대화 ConversationId
   * @param path 문서 경로
   * @returns 연결 성공 여부 (중복이면 false)
   */
  linkDocument(conversationId: ConversationId, path: string): boolean {
    // 빈 경로 또는 공백만 있는 경로 처리
    const normalizedPath = this.normalizePath(path);
    if (normalizedPath === '') {
      return false;
    }

    const found = this.findConversation(conversationId);
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
   * @param conversationId 대화 ConversationId
   * @param path 문서 경로
   * @returns 해제 성공 여부 (없으면 false)
   */
  unlinkDocument(conversationId: ConversationId, path: string): boolean {
    // 빈 경로 처리
    const normalizedPath = this.normalizePath(path);
    if (normalizedPath === '') {
      return false;
    }

    const found = this.findConversation(conversationId);
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
   * @param conversationId 대화 ConversationId
   * @returns 연결된 문서 목록 (추가 순서대로)
   */
  getLinkedDocuments(conversationId: ConversationId): LinkedDocument[] {
    const found = this.findConversation(conversationId);
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
   * @returns 초기화된 대화의 conversationId 목록
   */
  resetActiveConversations(): ConversationId[] {
    const result: ConversationId[] = [];

    for (const workspace of this._workspaces) {
      for (const conv of workspace.conversations) {
        if (
          conv.status === ConversationStatus.WORKING ||
          conv.status === ConversationStatus.WAITING
        ) {
          conv.status = ConversationStatus.IDLE;
          result.push(conv.conversationId);
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
            conversationId: conv.conversationId,
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
          result.push({ conversationId: conv.conversationId });
        }
      }
    }

    return result;
  }
}
