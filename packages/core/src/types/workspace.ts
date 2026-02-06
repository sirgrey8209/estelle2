/**
 * @file workspace.ts
 * @description 워크스페이스 및 대화 관련 타입 정의
 *
 * Estelle 시스템의 2단계 구조:
 * - Workspace: 프로젝트 (Git 리포지터리)
 * - Conversation: 작업 단위 (Claude와의 대화 세션)
 */

import type { ConversationStatusValue } from '../constants/conversation-status.js';
import type { PermissionModeValue } from '../constants/permission-mode.js';

// ============================================================================
// Conversation (대화)
// ============================================================================

/**
 * 대화(Conversation) 정보
 *
 * @description
 * 워크스페이스 내의 개별 대화(작업 단위)를 나타냅니다.
 * 각 대화는 Claude Code 세션과 연결될 수 있습니다.
 *
 * @example
 * ```typescript
 * const conversation: Conversation = {
 *   conversationId: 'conv-001',
 *   name: '로그인 기능 구현',
 *   claudeSessionId: 'session-uuid',
 *   status: 'idle',
 *   unread: false,
 *   permissionMode: 'default',
 *   createdAt: Date.now(),
 * };
 * ```
 */
export interface Conversation {
  /** 대화 고유 식별자 (UUID) */
  conversationId: string;

  /** 대화 이름 (표시용) */
  name: string;

  /** Claude Code 세션 ID (연결되지 않은 경우 null) */
  claudeSessionId: string | null;

  /** 대화 상태 (idle, working, waiting, error) */
  status: ConversationStatusValue;

  /** 읽지 않은 메시지 여부 */
  unread: boolean;

  /** 권한 모드 (default, acceptEdits, bypassPermissions) */
  permissionMode: PermissionModeValue;

  /** 대화 생성 시각 (Unix timestamp) */
  createdAt: number;

  // 향후 추가 예정
  // /** 연결된 문서 경로 */
  // linkedDocument?: string;
  // /** 분기 원본 대화 ID */
  // parentConversationId?: string;
}

// ============================================================================
// Workspace (워크스페이스)
// ============================================================================

/**
 * 워크스페이스(Workspace) 정보
 *
 * @description
 * 프로젝트(Git 리포지터리)를 나타냅니다.
 * 각 워크스페이스는 작업 디렉토리와 연결되며, 여러 대화를 포함합니다.
 *
 * @example
 * ```typescript
 * const workspace: Workspace = {
 *   workspaceId: 'ws-001',
 *   name: 'estelle',
 *   workingDir: 'C:\\WorkSpace\\estelle',
 *   conversations: [...],
 *   createdAt: Date.now(),
 *   lastUsed: Date.now(),
 * };
 * ```
 */
export interface Workspace {
  /** 워크스페이스 고유 식별자 (UUID) */
  workspaceId: string;

  /** 워크스페이스 이름 (표시용) */
  name: string;

  /** 작업 디렉토리 경로 (Git 리포지터리) */
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
 * 워크스페이스 목록 조회 시 반환되는 타입으로,
 * 기본 Workspace에 isActive 플래그가 추가됩니다.
 */
export interface WorkspaceWithActive extends Workspace {
  /** 현재 활성화된 워크스페이스 여부 */
  isActive: boolean;
}

// ============================================================================
// 메시지 Payload 타입
// ============================================================================

/**
 * 워크스페이스 목록 조회 결과 페이로드
 *
 * @description
 * `workspace_list_result` 메시지의 페이로드입니다.
 */
export interface WorkspaceListResultPayload {
  /** 워크스페이스 목록 */
  workspaces: WorkspaceWithActive[];
}

/**
 * 워크스페이스 생성 요청 페이로드
 *
 * @description
 * `workspace_create` 메시지의 페이로드입니다.
 */
export interface WorkspaceCreatePayload {
  /** 생성할 워크스페이스 이름 */
  name: string;

  /** 작업 디렉토리 경로 */
  workingDir: string;
}

/**
 * 워크스페이스 생성 결과 페이로드
 *
 * @description
 * `workspace_create_result` 메시지의 페이로드입니다.
 */
export interface WorkspaceCreateResultPayload {
  /** 생성된 워크스페이스 */
  workspace: Workspace;

  /** 자동 생성된 첫 번째 대화 */
  conversation: Conversation;
}

/**
 * 워크스페이스 삭제 요청 페이로드
 *
 * @description
 * `workspace_delete` 메시지의 페이로드입니다.
 */
export interface WorkspaceDeletePayload {
  /** 삭제할 워크스페이스 ID */
  workspaceId: string;
}

/**
 * 워크스페이스 수정 요청 페이로드
 *
 * @description
 * `workspace_update` 메시지의 페이로드입니다.
 * name과 workingDir 중 최소 하나는 제공되어야 합니다.
 */
export interface WorkspaceUpdatePayload {
  /** 수정할 워크스페이스 ID */
  workspaceId: string;

  /** 새 워크스페이스 이름 (선택) */
  name?: string;

  /** 새 작업 디렉토리 경로 (선택) */
  workingDir?: string;
}

/**
 * 워크스페이스 순서 변경 요청 페이로드
 *
 * @description
 * `workspace_reorder` 메시지의 페이로드입니다.
 */
export interface WorkspaceReorderPayload {
  /** 새 순서의 워크스페이스 ID 배열 */
  workspaceIds: string[];
}

/**
 * 대화 생성 요청 페이로드
 *
 * @description
 * `conversation_create` 메시지의 페이로드입니다.
 */
export interface ConversationCreatePayload {
  /** 대화를 추가할 워크스페이스 ID */
  workspaceId: string;

  /** 대화 이름 (선택, 기본값: '새 대화') */
  name?: string;
}

/**
 * 대화 생성 결과 페이로드
 *
 * @description
 * `conversation_create_result` 메시지의 페이로드입니다.
 */
export interface ConversationCreateResultPayload {
  /** 생성된 대화 */
  conversation: Conversation;
}

/**
 * 대화 선택 요청 페이로드
 *
 * @description
 * `conversation_select` 메시지의 페이로드입니다.
 */
export interface ConversationSelectPayload {
  /** 워크스페이스 ID */
  workspaceId: string;

  /** 선택할 대화 ID */
  conversationId: string;
}

/**
 * 대화 상태 변경 알림 페이로드
 *
 * @description
 * `conversation_status` 메시지의 페이로드입니다.
 */
export interface ConversationStatusPayload {
  /** 워크스페이스 ID */
  workspaceId: string;

  /** 대화 ID */
  conversationId: string;

  /** 새 상태 */
  status: ConversationStatusValue;

  /** 읽지 않음 여부 (선택) */
  unread?: boolean;
}

/**
 * 대화 순서 변경 요청 페이로드
 *
 * @description
 * `conversation_reorder` 메시지의 페이로드입니다.
 */
export interface ConversationReorderPayload {
  /** 워크스페이스 ID */
  workspaceId: string;

  /** 새 순서의 대화 ID 배열 */
  conversationIds: string[];
}
