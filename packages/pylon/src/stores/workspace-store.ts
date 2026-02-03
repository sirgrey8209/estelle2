/**
 * @file workspace-store.ts
 * @description WorkspaceStore - 워크스페이스 영속 저장
 *
 * 워크스페이스와 대화 정보를 관리하는 순수 데이터 클래스입니다.
 * 파일 I/O는 외부에서 처리하여 테스트 용이성을 확보합니다.
 *
 * 저장 구조:
 * ```json
 * {
 *   "activeWorkspaceId": "uuid",
 *   "activeConversationId": "uuid",
 *   "workspaces": [
 *     {
 *       "workspaceId": "uuid",
 *       "name": "Estelle",
 *       "workingDir": "C:\\workspace\\estelle",
 *       "conversations": [
 *         {
 *           "conversationId": "uuid",
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
 *
 * @example
 * ```typescript
 * import { WorkspaceStore } from './stores/workspace-store.js';
 * import fs from 'fs';
 *
 * // 파일에서 로드
 * const data = fs.existsSync('workspaces.json')
 *   ? JSON.parse(fs.readFileSync('workspaces.json', 'utf-8'))
 *   : undefined;
 * const store = new WorkspaceStore(data);
 *
 * // 워크스페이스 생성
 * const { workspace, conversation } = store.createWorkspace('Project', 'C:\\project');
 *
 * // 파일에 저장
 * fs.writeFileSync('workspaces.json', JSON.stringify(store.toJSON(), null, 2));
 * ```
 */

import { randomUUID } from 'crypto';
import { ConversationStatus, PermissionMode } from '@estelle/core';
import type { ConversationStatusValue, PermissionModeValue } from '@estelle/core';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 대화(Conversation) 정보
 *
 * @description
 * 워크스페이스 내의 개별 대화를 나타냅니다.
 * 각 대화는 Claude Code 세션과 연결될 수 있습니다.
 */
export interface Conversation {
  /** 대화 고유 식별자 (UUID) */
  conversationId: string;

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
}

/**
 * 워크스페이스(Workspace) 정보
 *
 * @description
 * 특정 작업 디렉토리와 연결된 워크스페이스를 나타냅니다.
 * 각 워크스페이스는 여러 대화를 포함할 수 있습니다.
 */
export interface Workspace {
  /** 워크스페이스 고유 식별자 (UUID) */
  workspaceId: string;

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
 *
 * @description
 * getAllWorkspaces()에서 반환되는 타입으로,
 * 기본 Workspace에 isActive 플래그가 추가됩니다.
 */
export interface WorkspaceWithActive extends Workspace {
  /** 현재 활성화된 워크스페이스 여부 */
  isActive: boolean;
}

/**
 * 워크스페이스 스토어 데이터 (직렬화용)
 *
 * @description
 * 파일에 저장/로드되는 전체 스토어 데이터 구조입니다.
 */
export interface WorkspaceStoreData {
  /** 현재 활성 워크스페이스 ID (없으면 null) */
  activeWorkspaceId: string | null;

  /** 현재 활성 대화 ID (없으면 null) */
  activeConversationId: string | null;

  /** 모든 워크스페이스 목록 */
  workspaces: Workspace[];
}

/**
 * 워크스페이스 생성 결과
 */
export interface CreateWorkspaceResult {
  /** 생성된 워크스페이스 */
  workspace: Workspace;

  /** 자동 생성된 첫 번째 대화 */
  conversation: Conversation;
}

/**
 * 활성 상태 정보
 */
export interface ActiveState {
  /** 현재 활성 워크스페이스 ID */
  activeWorkspaceId: string | null;

  /** 현재 활성 대화 ID */
  activeConversationId: string | null;
}

/**
 * finishing 상태 대화 정보 (재처리용)
 */
export interface FinishingConversationInfo {
  workspaceId: string;
  conversationId: string;
  workingDir: string;
  claudeSessionId: string | null;
}

/**
 * finished 상태 대화 정보 (다이얼로그 표시용)
 */
export interface FinishedConversationInfo {
  workspaceId: string;
  conversationId: string;
}

// ============================================================================
// 상수
// ============================================================================

/** 기본 작업 디렉토리 (환경 변수 또는 기본값) */
const DEFAULT_WORKING_DIR = process.env.DEFAULT_WORKING_DIR || 'C:\\workspace';

// ============================================================================
// WorkspaceStore 클래스
// ============================================================================

/**
 * WorkspaceStore - 워크스페이스 영속 저장 관리
 *
 * @description
 * 워크스페이스와 대화 정보를 관리하는 순수 데이터 클래스입니다.
 * 모든 상태 변경은 이 클래스를 통해 이루어지며,
 * 파일 I/O는 외부에서 toJSON()/fromJSON()을 통해 처리합니다.
 *
 * 설계 원칙:
 * - 순수 데이터 클래스: 외부 의존성 없음 (파일 I/O 분리)
 * - 모킹 없이 테스트 가능
 * - Single Source of Truth: 모든 워크스페이스/대화 상태의 유일한 진실 소스
 *
 * @example
 * ```typescript
 * // 빈 스토어 생성
 * const store = new WorkspaceStore();
 *
 * // 기존 데이터로 초기화
 * const store = new WorkspaceStore(existingData);
 *
 * // 정적 팩토리 메서드로 생성
 * const store = WorkspaceStore.fromJSON(jsonData);
 * ```
 */
export class WorkspaceStore {
  // ============================================================================
  // Private 필드
  // ============================================================================

  /** 현재 활성 워크스페이스 ID */
  private _activeWorkspaceId: string | null;

  /** 현재 활성 대화 ID */
  private _activeConversationId: string | null;

  /** 모든 워크스페이스 목록 */
  private _workspaces: Workspace[];

  // ============================================================================
  // 생성자
  // ============================================================================

  /**
   * WorkspaceStore 생성자
   *
   * @param data - 초기 데이터 (없으면 빈 상태로 시작)
   */
  constructor(data?: WorkspaceStoreData) {
    this._activeWorkspaceId = data?.activeWorkspaceId ?? null;
    this._activeConversationId = data?.activeConversationId ?? null;
    this._workspaces = data?.workspaces ?? [];
  }

  // ============================================================================
  // 정적 팩토리 메서드
  // ============================================================================

  /**
   * JSON 데이터에서 WorkspaceStore 생성
   *
   * @param data - 직렬화된 스토어 데이터
   * @returns 새 WorkspaceStore 인스턴스
   */
  static fromJSON(data: WorkspaceStoreData): WorkspaceStore {
    return new WorkspaceStore(data);
  }

  // ============================================================================
  // 직렬화
  // ============================================================================

  /**
   * 스토어 데이터를 JSON으로 내보내기
   *
   * @description
   * 파일 저장을 위해 전체 스토어 상태를 직렬화합니다.
   *
   * @returns 직렬화 가능한 스토어 데이터
   */
  toJSON(): WorkspaceStoreData {
    return {
      activeWorkspaceId: this._activeWorkspaceId,
      activeConversationId: this._activeConversationId,
      workspaces: this._workspaces,
    };
  }

  // ============================================================================
  // Workspace CRUD
  // ============================================================================

  /**
   * 모든 워크스페이스 목록 조회
   *
   * @description
   * 모든 워크스페이스를 isActive 플래그와 함께 반환합니다.
   *
   * @returns 활성 상태가 포함된 워크스페이스 목록
   */
  getAllWorkspaces(): WorkspaceWithActive[] {
    return this._workspaces.map((w) => ({
      ...w,
      isActive: w.workspaceId === this._activeWorkspaceId,
    }));
  }

  /**
   * 활성 워크스페이스 조회
   *
   * @returns 활성 워크스페이스 또는 null
   */
  getActiveWorkspace(): Workspace | null {
    return (
      this._workspaces.find(
        (w) => w.workspaceId === this._activeWorkspaceId
      ) || null
    );
  }

  /**
   * 워크스페이스 ID로 조회
   *
   * @param workspaceId - 조회할 워크스페이스 ID
   * @returns 워크스페이스 또는 null
   */
  getWorkspace(workspaceId: string): Workspace | null {
    return (
      this._workspaces.find((w) => w.workspaceId === workspaceId) || null
    );
  }

  /**
   * 워크스페이스 생성
   *
   * @description
   * 새 워크스페이스를 생성하고 첫 번째 대화를 자동으로 추가합니다.
   * 생성된 워크스페이스와 대화가 활성 상태로 설정됩니다.
   *
   * @param name - 워크스페이스 이름
   * @param workingDir - 작업 디렉토리 경로 (기본값: DEFAULT_WORKING_DIR)
   * @returns 생성된 워크스페이스와 대화
   */
  createWorkspace(
    name: string,
    workingDir: string = DEFAULT_WORKING_DIR
  ): CreateWorkspaceResult {
    const now = Date.now();

    // 첫 번째 대화 자동 생성
    const firstConversation: Conversation = {
      conversationId: randomUUID(),
      name: '새 대화',
      claudeSessionId: null,
      status: ConversationStatus.IDLE,
      unread: false,
      permissionMode: PermissionMode.DEFAULT,
      createdAt: now,
    };

    // 새 워크스페이스 생성
    const newWorkspace: Workspace = {
      workspaceId: randomUUID(),
      name,
      workingDir,
      conversations: [firstConversation],
      createdAt: now,
      lastUsed: now,
    };

    // 스토어에 추가
    this._workspaces.push(newWorkspace);

    // 활성 상태 설정
    this._activeWorkspaceId = newWorkspace.workspaceId;
    this._activeConversationId = firstConversation.conversationId;

    return { workspace: newWorkspace, conversation: firstConversation };
  }

  /**
   * 워크스페이스 삭제
   *
   * @description
   * 워크스페이스를 삭제합니다.
   * 삭제된 워크스페이스가 활성 상태였다면 다음 워크스페이스로 전환됩니다.
   *
   * @param workspaceId - 삭제할 워크스페이스 ID
   * @returns 삭제 성공 여부
   */
  deleteWorkspace(workspaceId: string): boolean {
    const idx = this._workspaces.findIndex(
      (w) => w.workspaceId === workspaceId
    );
    if (idx < 0) return false;

    // 워크스페이스 제거
    this._workspaces.splice(idx, 1);

    // 활성 워크스페이스였다면 다음 워크스페이스로 전환
    if (this._activeWorkspaceId === workspaceId) {
      const nextWorkspace = this._workspaces[0];
      this._activeWorkspaceId = nextWorkspace?.workspaceId || null;
      this._activeConversationId =
        nextWorkspace?.conversations[0]?.conversationId || null;
    }

    return true;
  }

  /**
   * 워크스페이스 이름 변경
   *
   * @param workspaceId - 변경할 워크스페이스 ID
   * @param newName - 새 이름
   * @returns 변경 성공 여부
   */
  renameWorkspace(workspaceId: string, newName: string): boolean {
    const workspace = this._workspaces.find(
      (w) => w.workspaceId === workspaceId
    );
    if (!workspace) return false;

    workspace.name = newName;
    return true;
  }

  /**
   * 활성 워크스페이스 설정
   *
   * @description
   * 지정된 워크스페이스를 활성 상태로 설정합니다.
   * conversationId가 주어지면 해당 대화도 활성화됩니다.
   *
   * @param workspaceId - 활성화할 워크스페이스 ID
   * @param conversationId - 활성화할 대화 ID (선택, 없으면 첫 번째 대화)
   * @returns 설정 성공 여부
   */
  setActiveWorkspace(
    workspaceId: string,
    conversationId?: string | null
  ): boolean {
    const workspace = this._workspaces.find(
      (w) => w.workspaceId === workspaceId
    );
    if (!workspace) return false;

    this._activeWorkspaceId = workspaceId;
    workspace.lastUsed = Date.now();

    // conversationId가 주어지면 해당 대화 활성화, 아니면 첫 번째 대화
    if (conversationId) {
      const conv = workspace.conversations.find(
        (c) => c.conversationId === conversationId
      );
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

  /**
   * 대화 조회
   *
   * @param workspaceId - 워크스페이스 ID
   * @param conversationId - 대화 ID
   * @returns 대화 또는 null
   */
  getConversation(
    workspaceId: string,
    conversationId: string
  ): Conversation | null {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) return null;
    return (
      workspace.conversations.find(
        (c) => c.conversationId === conversationId
      ) || null
    );
  }

  /**
   * 대화 ID로 워크스페이스 찾기
   *
   * @description
   * 주어진 대화 ID가 속한 워크스페이스 ID를 반환합니다.
   *
   * @param conversationId - 찾을 대화 ID
   * @returns 워크스페이스 ID 또는 null
   */
  findWorkspaceByConversation(conversationId: string): string | null {
    for (const workspace of this._workspaces) {
      if (
        workspace.conversations.some(
          (c) => c.conversationId === conversationId
        )
      ) {
        return workspace.workspaceId;
      }
    }
    return null;
  }

  /**
   * 활성 대화 조회
   *
   * @returns 활성 대화 또는 null
   */
  getActiveConversation(): Conversation | null {
    if (!this._activeWorkspaceId || !this._activeConversationId) return null;

    const workspace = this._workspaces.find(
      (w) => w.workspaceId === this._activeWorkspaceId
    );
    if (!workspace) return null;

    return (
      workspace.conversations.find(
        (c) => c.conversationId === this._activeConversationId
      ) || null
    );
  }

  /**
   * 대화 생성
   *
   * @description
   * 지정된 워크스페이스에 새 대화를 생성합니다.
   * 생성된 대화가 활성 상태로 설정됩니다.
   *
   * @param workspaceId - 대화를 추가할 워크스페이스 ID
   * @param name - 대화 이름 (기본값: '새 대화')
   * @returns 생성된 대화 또는 null (워크스페이스 없음)
   */
  createConversation(
    workspaceId: string,
    name: string = '새 대화'
  ): Conversation | null {
    const workspace = this._workspaces.find(
      (w) => w.workspaceId === workspaceId
    );
    if (!workspace) return null;

    const newConversation: Conversation = {
      conversationId: randomUUID(),
      name,
      claudeSessionId: null,
      status: ConversationStatus.IDLE,
      unread: false,
      permissionMode: PermissionMode.DEFAULT,
      createdAt: Date.now(),
    };

    workspace.conversations.push(newConversation);
    workspace.lastUsed = Date.now();
    this._activeConversationId = newConversation.conversationId;

    return newConversation;
  }

  /**
   * 대화 삭제
   *
   * @description
   * 대화를 삭제합니다.
   * 삭제된 대화가 활성 상태였다면 다음 대화로 전환됩니다.
   *
   * @param workspaceId - 워크스페이스 ID
   * @param conversationId - 삭제할 대화 ID
   * @returns 삭제 성공 여부
   */
  deleteConversation(workspaceId: string, conversationId: string): boolean {
    const workspace = this._workspaces.find(
      (w) => w.workspaceId === workspaceId
    );
    if (!workspace) return false;

    const idx = workspace.conversations.findIndex(
      (c) => c.conversationId === conversationId
    );
    if (idx < 0) return false;

    workspace.conversations.splice(idx, 1);

    // 삭제된 대화가 활성 대화였으면 다른 대화로 전환
    if (this._activeConversationId === conversationId) {
      this._activeConversationId =
        workspace.conversations[0]?.conversationId || null;
    }

    return true;
  }

  /**
   * 대화 이름 변경
   *
   * @param workspaceId - 워크스페이스 ID
   * @param conversationId - 대화 ID
   * @param newName - 새 이름
   * @returns 변경 성공 여부
   */
  renameConversation(
    workspaceId: string,
    conversationId: string,
    newName: string
  ): boolean {
    const workspace = this._workspaces.find(
      (w) => w.workspaceId === workspaceId
    );
    if (!workspace) return false;

    const conv = workspace.conversations.find(
      (c) => c.conversationId === conversationId
    );
    if (!conv) return false;

    conv.name = newName;
    return true;
  }

  /**
   * 활성 대화 설정
   *
   * @param conversationId - 활성화할 대화 ID
   * @returns 설정 성공 여부 (항상 true)
   */
  setActiveConversation(conversationId: string): boolean {
    this._activeConversationId = conversationId;
    return true;
  }

  // ============================================================================
  // Conversation 상태 업데이트
  // ============================================================================

  /**
   * 대화 상태 업데이트
   *
   * @param workspaceId - 워크스페이스 ID
   * @param conversationId - 대화 ID
   * @param status - 새 상태
   * @returns 업데이트 성공 여부
   */
  updateConversationStatus(
    workspaceId: string,
    conversationId: string,
    status: ConversationStatusValue
  ): boolean {
    const workspace = this._workspaces.find(
      (w) => w.workspaceId === workspaceId
    );
    if (!workspace) return false;

    const conv = workspace.conversations.find(
      (c) => c.conversationId === conversationId
    );
    if (!conv) return false;

    conv.status = status;
    return true;
  }

  /**
   * 대화 읽음 상태 업데이트
   *
   * @param workspaceId - 워크스페이스 ID
   * @param conversationId - 대화 ID
   * @param unread - 읽지 않음 여부
   * @returns 업데이트 성공 여부
   */
  updateConversationUnread(
    workspaceId: string,
    conversationId: string,
    unread: boolean
  ): boolean {
    const workspace = this._workspaces.find(
      (w) => w.workspaceId === workspaceId
    );
    if (!workspace) return false;

    const conv = workspace.conversations.find(
      (c) => c.conversationId === conversationId
    );
    if (!conv) return false;

    conv.unread = unread;
    return true;
  }

  /**
   * Claude 세션 ID 업데이트
   *
   * @description
   * 대화에 연결된 Claude Code 세션 ID를 업데이트합니다.
   * 워크스페이스의 lastUsed도 함께 업데이트됩니다.
   *
   * @param workspaceId - 워크스페이스 ID
   * @param conversationId - 대화 ID
   * @param sessionId - Claude 세션 ID
   * @returns 업데이트 성공 여부
   */
  updateClaudeSessionId(
    workspaceId: string,
    conversationId: string,
    sessionId: string | null
  ): boolean {
    const workspace = this._workspaces.find(
      (w) => w.workspaceId === workspaceId
    );
    if (!workspace) return false;

    const conv = workspace.conversations.find(
      (c) => c.conversationId === conversationId
    );
    if (!conv) return false;

    conv.claudeSessionId = sessionId;
    workspace.lastUsed = Date.now();
    return true;
  }

  // ============================================================================
  // Permission Mode
  // ============================================================================

  /**
   * 대화 권한 모드 조회
   *
   * @description
   * 대화의 현재 권한 모드를 반환합니다.
   * 대화를 찾을 수 없으면 기본값(default)을 반환합니다.
   *
   * @param conversationId - 대화 ID
   * @returns 권한 모드
   */
  getConversationPermissionMode(conversationId: string): PermissionModeValue {
    for (const workspace of this._workspaces) {
      const conv = workspace.conversations.find(
        (c) => c.conversationId === conversationId
      );
      if (conv) return conv.permissionMode || PermissionMode.DEFAULT;
    }
    return PermissionMode.DEFAULT;
  }

  /**
   * 대화 권한 모드 설정
   *
   * @param conversationId - 대화 ID
   * @param mode - 권한 모드
   * @returns 설정 성공 여부
   */
  setConversationPermissionMode(
    conversationId: string,
    mode: PermissionModeValue
  ): boolean {
    for (const workspace of this._workspaces) {
      const conv = workspace.conversations.find(
        (c) => c.conversationId === conversationId
      );
      if (conv) {
        conv.permissionMode = mode;
        return true;
      }
    }
    return false;
  }

  // ============================================================================
  // Utility 메서드
  // ============================================================================

  /**
   * 이름으로 워크스페이스 찾기
   *
   * @description
   * 대소문자 구분 없이 워크스페이스를 검색합니다.
   * 정확히 일치하는 것을 먼저 찾고, 없으면 부분 일치를 찾습니다.
   *
   * @param name - 검색할 이름
   * @returns 워크스페이스 또는 null
   */
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

  /**
   * 작업 디렉토리로 워크스페이스 찾기
   *
   * @param workingDir - 검색할 작업 디렉토리
   * @returns 워크스페이스 또는 null
   */
  findWorkspaceByWorkingDir(workingDir: string): Workspace | null {
    return this._workspaces.find((w) => w.workingDir === workingDir) || null;
  }

  /**
   * 활성 상태 정보 조회
   *
   * @returns 활성 워크스페이스/대화 ID
   */
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
   * @description
   * working, permission 상태인 대화들을 idle로 초기화합니다.
   * Pylon 재시작 시 이전에 진행 중이던 작업들을 정리하는 데 사용됩니다.
   *
   * @returns 초기화된 대화 ID 목록
   */
  resetActiveConversations(): string[] {
    const resetConversationIds: string[] = [];

    for (const workspace of this._workspaces) {
      for (const conv of workspace.conversations) {
        // working, waiting 상태를 idle로 초기화
        if (
          conv.status === ConversationStatus.WORKING ||
          conv.status === ConversationStatus.WAITING
        ) {
          conv.status = ConversationStatus.IDLE;
          resetConversationIds.push(conv.conversationId);
        }
      }
    }

    return resetConversationIds;
  }

  /**
   * finishing 상태 대화 목록 조회
   *
   * @description
   * Pylon 시작 시 재처리가 필요한 finishing 상태의 대화들을 반환합니다.
   *
   * 참고: 현재 ConversationStatus에는 'finishing' 상태가 없습니다.
   * 원본 코드와의 호환성을 위해 메서드는 유지하지만,
   * 실제로 finishing 상태가 필요하면 ConversationStatus에 추가해야 합니다.
   *
   * @returns finishing 상태 대화 정보 목록
   */
  getFinishingConversations(): FinishingConversationInfo[] {
    const result: FinishingConversationInfo[] = [];

    for (const workspace of this._workspaces) {
      for (const conv of workspace.conversations) {
        // 원본에서는 'finishing' 상태를 체크했으나,
        // 현재 ConversationStatus에는 없으므로 빈 배열 반환
        // 필요시 ConversationStatus 확장 필요
        if ((conv.status as string) === 'finishing') {
          result.push({
            workspaceId: workspace.workspaceId,
            conversationId: conv.conversationId,
            workingDir: workspace.workingDir,
            claudeSessionId: conv.claudeSessionId,
          });
        }
      }
    }

    return result;
  }

  /**
   * finished 상태 대화 목록 조회
   *
   * @description
   * 앱 재접속 시 완료 다이얼로그를 표시해야 하는 대화들을 반환합니다.
   *
   * 참고: 현재 ConversationStatus에는 'finished' 상태가 없습니다.
   * 원본 코드와의 호환성을 위해 메서드는 유지하지만,
   * 실제로 finished 상태가 필요하면 ConversationStatus에 추가해야 합니다.
   *
   * @returns finished 상태 대화 정보 목록
   */
  getFinishedConversations(): FinishedConversationInfo[] {
    const result: FinishedConversationInfo[] = [];

    for (const workspace of this._workspaces) {
      for (const conv of workspace.conversations) {
        // 원본에서는 'finished' 상태를 체크했으나,
        // 현재 ConversationStatus에는 없으므로 빈 배열 반환
        // 필요시 ConversationStatus 확장 필요
        if ((conv.status as string) === 'finished') {
          result.push({
            workspaceId: workspace.workspaceId,
            conversationId: conv.conversationId,
          });
        }
      }
    }

    return result;
  }
}
