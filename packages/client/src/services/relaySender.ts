/**
 * @file relaySender.ts
 * @description Relay 메시지 전송 헬퍼 함수
 *
 * UI 컴포넌트에서 Pylon으로 메시지를 보낼 때 사용합니다.
 * conversationId(number)를 사용하여 대화를 식별합니다.
 *
 * 라우팅 규칙:
 * - conversationId가 있는 메시지: conversationId에서 pylonId 추출 → to: [pylonId]
 * - workspaceId가 있는 메시지: workspaceId에서 pylonId 추출 → to: [pylonId]
 * - deviceId가 지정된 메시지: to: [deviceId]
 * - 전체 Pylon 대상 메시지: broadcast: 'pylons'
 */

import {
  MessageType,
  decodeConversationIdFull,
  decodeWorkspaceId,
} from '@estelle/core';
import type { AccountType, ConversationId, WorkspaceId } from '@estelle/core';
import type { RelayMessage } from './relayService';

// 전역 WebSocket 참조 (app/_layout.tsx에서 설정)
let globalWs: WebSocket | null = null;

/**
 * WebSocket 참조 설정
 */
export function setWebSocket(ws: WebSocket | null): void {
  globalWs = ws;
}

/**
 * WebSocket 참조 가져오기
 */
export function getWebSocket(): WebSocket | null {
  return globalWs;
}

/**
 * 메시지 전송
 */
export function sendMessage(message: RelayMessage): boolean {
  if (globalWs && globalWs.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify(message));
    console.log('[Relay] Sent:', message.type, message.to ? `to:${message.to}` : message.broadcast ? `broadcast:${message.broadcast}` : '');
    return true;
  }
  console.warn('[Relay] Cannot send, not connected:', message.type);
  return false;
}

/**
 * conversationId에서 pylonId 추출
 */
function getPylonIdFromConversation(conversationId: number): number {
  const decoded = decodeConversationIdFull(conversationId as ConversationId);
  return decoded.pylonId;
}

/**
 * workspaceId에서 pylonId 추출
 */
function getPylonIdFromWorkspace(workspaceId: number): number {
  const decoded = decodeWorkspaceId(workspaceId as WorkspaceId);
  return decoded.pylonId;
}

// ============================================================================
// 워크스페이스 관련
// ============================================================================

/**
 * 워크스페이스 목록 요청
 * - 모든 Pylon에게 요청
 */
export function requestWorkspaceList(): boolean {
  return sendMessage({
    type: MessageType.WORKSPACE_LIST,
    payload: {},
    broadcast: 'pylons',
  });
}

/**
 * 워크스페이스 생성 요청
 * - 모든 Pylon에게 요청 (deviceId가 지정되면 해당 Pylon만)
 */
export function createWorkspace(name: string, workingDir: string): boolean {
  return sendMessage({
    type: MessageType.WORKSPACE_CREATE,
    payload: { name, workingDir },
    broadcast: 'pylons',
  });
}

/**
 * 워크스페이스 삭제 요청
 * - workspaceId에서 pylonId 추출하여 해당 Pylon에만 전송
 */
export function deleteWorkspace(workspaceId: number): boolean {
  const pylonId = getPylonIdFromWorkspace(workspaceId);
  return sendMessage({
    type: MessageType.WORKSPACE_DELETE,
    payload: { workspaceId },
    to: [pylonId],
  });
}

/**
 * 워크스페이스 수정 요청
 * - workspaceId에서 pylonId 추출하여 해당 Pylon에만 전송
 */
export function updateWorkspace(
  workspaceId: number,
  updates: { name?: string; workingDir?: string }
): boolean {
  const pylonId = getPylonIdFromWorkspace(workspaceId);
  return sendMessage({
    type: MessageType.WORKSPACE_UPDATE,
    payload: { workspaceId, ...updates },
    to: [pylonId],
  });
}

/**
 * 워크스페이스 순서 변경 요청
 * - 모든 Pylon에게 전송 (각 Pylon이 자신의 워크스페이스만 처리)
 */
export function reorderWorkspaces(workspaceIds: number[]): boolean {
  return sendMessage({
    type: MessageType.WORKSPACE_REORDER,
    payload: { workspaceIds },
    broadcast: 'pylons',
  });
}

/**
 * 대화 순서 변경 요청
 * - workspaceId에서 pylonId 추출하여 해당 Pylon에만 전송
 */
export function reorderConversations(workspaceId: number, conversationIds: number[]): boolean {
  const pylonId = getPylonIdFromWorkspace(workspaceId);
  return sendMessage({
    type: MessageType.CONVERSATION_REORDER,
    payload: { workspaceId, conversationIds },
    to: [pylonId],
  });
}

// ============================================================================
// 대화 관련
// ============================================================================

/**
 * 대화 생성 요청
 * - workspaceId에서 pylonId 추출하여 해당 Pylon에만 전송
 */
export function createConversation(workspaceId: number, name?: string): boolean {
  const pylonId = getPylonIdFromWorkspace(workspaceId);
  return sendMessage({
    type: MessageType.CONVERSATION_CREATE,
    payload: { workspaceId, name },
    to: [pylonId],
  });
}

/**
 * 대화 선택 (히스토리 로드)
 * - conversationId에서 pylonId 추출하여 해당 Pylon에만 전송
 */
export function selectConversation(conversationId: number, workspaceId?: number): boolean {
  const pylonId = getPylonIdFromConversation(conversationId);
  return sendMessage({
    type: MessageType.CONVERSATION_SELECT,
    payload: { conversationId, workspaceId },
    to: [pylonId],
  });
}

/**
 * 추가 히스토리 요청 (페이징)
 * - conversationId에서 pylonId 추출하여 해당 Pylon에만 전송
 *
 * @param conversationId - 대화 ID
 * @param loadBefore - 이 인덱스 이전의 메시지를 로드 (현재 syncedFrom 값)
 * @param limit - 로드할 최대 메시지 수
 */
export function requestMoreHistory(
  conversationId: number,
  loadBefore: number,
  limit: number = 50
): boolean {
  const pylonId = getPylonIdFromConversation(conversationId);
  return sendMessage({
    type: MessageType.HISTORY_REQUEST,
    payload: { conversationId, loadBefore, limit },
    to: [pylonId],
  });
}

/**
 * 대화 삭제 요청
 * - conversationId에서 pylonId 추출하여 해당 Pylon에만 전송
 */
export function deleteConversation(conversationId: number): boolean {
  const pylonId = getPylonIdFromConversation(conversationId);
  return sendMessage({
    type: MessageType.CONVERSATION_DELETE,
    payload: { conversationId },
    to: [pylonId],
  });
}

/**
 * 대화 이름 변경 요청
 * - conversationId에서 pylonId 추출하여 해당 Pylon에만 전송
 */
export function renameConversation(conversationId: number, newName: string): boolean {
  const pylonId = getPylonIdFromConversation(conversationId);
  return sendMessage({
    type: MessageType.CONVERSATION_RENAME,
    payload: { conversationId, newName },
    to: [pylonId],
  });
}

// ============================================================================
// Claude 관련
// ============================================================================

/**
 * Claude에 메시지 전송
 * - conversationId에서 pylonId 추출하여 해당 Pylon에만 전송
 */
export function sendClaudeMessage(
  conversationId: number,
  message: string,
  attachments?: string[]
): boolean {
  const pylonId = getPylonIdFromConversation(conversationId);
  return sendMessage({
    type: MessageType.CLAUDE_SEND,
    payload: {
      conversationId,
      message,
      attachments,
    },
    to: [pylonId],
  });
}

/**
 * Claude 권한 응답
 * - conversationId에서 pylonId 추출하여 해당 Pylon에만 전송
 */
export function sendPermissionResponse(
  conversationId: number,
  toolUseId: string,
  decision: 'allow' | 'deny'
): boolean {
  const pylonId = getPylonIdFromConversation(conversationId);
  return sendMessage({
    type: MessageType.CLAUDE_PERMISSION,
    payload: {
      conversationId,
      toolUseId,
      decision,
    },
    to: [pylonId],
  });
}

/**
 * Claude 질문 응답
 * - conversationId에서 pylonId 추출하여 해당 Pylon에만 전송
 */
export function sendQuestionResponse(
  conversationId: number,
  toolUseId: string,
  answer: string
): boolean {
  const pylonId = getPylonIdFromConversation(conversationId);
  return sendMessage({
    type: MessageType.CLAUDE_ANSWER,
    payload: {
      conversationId,
      toolUseId,
      answer,
    },
    to: [pylonId],
  });
}

/**
 * Claude 제어 (중단/재시작)
 * - conversationId에서 pylonId 추출하여 해당 Pylon에만 전송
 */
export function sendClaudeControl(
  conversationId: number,
  action: 'stop' | 'new_session'
): boolean {
  const pylonId = getPylonIdFromConversation(conversationId);
  return sendMessage({
    type: MessageType.CLAUDE_CONTROL,
    payload: {
      conversationId,
      action,
    },
    to: [pylonId],
  });
}

/**
 * Claude 권한 모드 설정
 * - conversationId에서 pylonId 추출하여 해당 Pylon에만 전송
 */
export function setPermissionMode(
  conversationId: number,
  mode: 'default' | 'acceptEdits' | 'bypassPermissions'
): boolean {
  const pylonId = getPylonIdFromConversation(conversationId);
  return sendMessage({
    type: MessageType.CLAUDE_SET_PERMISSION_MODE,
    payload: {
      conversationId,
      mode,
    },
    to: [pylonId],
  });
}

// ============================================================================
// 폴더 관련
// ============================================================================

/**
 * 폴더 목록 요청
 * - 특정 deviceId(pylonId)에 전송
 */
export function requestFolderList(deviceId: number, path?: string): boolean {
  return sendMessage({
    type: MessageType.FOLDER_LIST,
    payload: { deviceId, path },
    to: [deviceId],
  });
}

/**
 * 폴더 생성 요청
 * - 특정 deviceId(pylonId)에 전송
 */
export function requestFolderCreate(deviceId: number, path: string, name: string): boolean {
  return sendMessage({
    type: MessageType.FOLDER_CREATE,
    payload: { deviceId, path, name },
    to: [deviceId],
  });
}

/**
 * 폴더 이름 변경 요청
 * - 특정 deviceId(pylonId)에 전송
 */
export function requestFolderRename(deviceId: number, path: string, newName: string): boolean {
  return sendMessage({
    type: MessageType.FOLDER_RENAME,
    payload: { deviceId, path, newName },
    to: [deviceId],
  });
}

/**
 * 특정 PC에 워크스페이스 생성 요청
 * - 특정 deviceId(pylonId)에 전송
 */
export function requestWorkspaceCreate(deviceId: number, name: string, workingDir: string): boolean {
  return sendMessage({
    type: MessageType.WORKSPACE_CREATE,
    payload: { deviceId, name, workingDir },
    to: [deviceId],
  });
}

// ============================================================================
// Usage 관련
// ============================================================================

/**
 * Claude 사용량 조회 요청
 * - 모든 Pylon에게 요청
 *
 * @description
 * 특정 Pylon에 ccusage를 통한 사용량 조회를 요청합니다.
 */
export function requestUsage(): boolean {
  return sendMessage({
    type: MessageType.USAGE_REQUEST,
    payload: {},
    broadcast: 'pylons',
  });
}

// ============================================================================
// 버그 리포트 관련
// ============================================================================

/**
 * 버그 리포트 전송
 * - 모든 Pylon에게 전송
 */
export function sendBugReport(
  message: string,
  conversationId?: number,
  workspaceId?: number
): boolean {
  return sendMessage({
    type: MessageType.BUG_REPORT,
    payload: {
      message,
      conversationId,
      workspaceId,
      timestamp: new Date().toISOString(),
    },
    broadcast: 'pylons',
  });
}

// ============================================================================
// 계정 관련
// ============================================================================

/**
 * 계정 전환 요청
 * - 모든 Pylon에게 전송
 *
 * @description
 * Pylon에 계정 전환을 요청합니다.
 * 모든 Claude SDK 세션이 종료되고 인증 파일이 교체됩니다.
 */
export function requestAccountSwitch(account: AccountType): boolean {
  return sendMessage({
    type: MessageType.ACCOUNT_SWITCH,
    payload: { account },
    broadcast: 'pylons',
  });
}

// ============================================================================
// 공유 관련
// ============================================================================

/**
 * 공유 링크 생성 요청
 * - conversationId에서 pylonId 추출하여 해당 Pylon에만 전송
 */
export function createShare(conversationId: number): boolean {
  const pylonId = getPylonIdFromConversation(conversationId);
  return sendMessage({
    type: MessageType.SHARE_CREATE,
    payload: { conversationId },
    to: [pylonId],
  });
}
