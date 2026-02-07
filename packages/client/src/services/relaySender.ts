/**
 * @file relaySender.ts
 * @description Relay 메시지 전송 헬퍼 함수
 *
 * UI 컴포넌트에서 Pylon으로 메시지를 보낼 때 사용합니다.
 */

import { MessageType } from '@estelle/core';
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
    console.log('[Relay] Sent:', message.type);
    return true;
  }
  console.warn('[Relay] Cannot send, not connected:', message.type);
  return false;
}

// ============================================================================
// 워크스페이스 관련
// ============================================================================

/**
 * 워크스페이스 목록 요청
 */
export function requestWorkspaceList(): boolean {
  return sendMessage({
    type: MessageType.WORKSPACE_LIST,
    payload: {},
  });
}

/**
 * 워크스페이스 생성 요청
 */
export function createWorkspace(name: string, workingDir: string): boolean {
  return sendMessage({
    type: MessageType.WORKSPACE_CREATE,
    payload: { name, workingDir },
  });
}

/**
 * 워크스페이스 삭제 요청
 */
export function deleteWorkspace(workspaceId: string): boolean {
  return sendMessage({
    type: MessageType.WORKSPACE_DELETE,
    payload: { workspaceId },
  });
}

/**
 * 워크스페이스 수정 요청
 */
export function updateWorkspace(
  workspaceId: string,
  updates: { name?: string; workingDir?: string }
): boolean {
  return sendMessage({
    type: MessageType.WORKSPACE_UPDATE,
    payload: { workspaceId, ...updates },
  });
}

/**
 * 워크스페이스 순서 변경 요청
 */
export function reorderWorkspaces(workspaceIds: string[]): boolean {
  return sendMessage({
    type: MessageType.WORKSPACE_REORDER,
    payload: { workspaceIds },
  });
}

/**
 * 대화 순서 변경 요청
 */
export function reorderConversations(workspaceId: string, conversationIds: string[]): boolean {
  return sendMessage({
    type: MessageType.CONVERSATION_REORDER,
    payload: { workspaceId, conversationIds },
  });
}

// ============================================================================
// 대화 관련
// ============================================================================

/**
 * 대화 생성 요청
 */
export function createConversation(workspaceId: string, name?: string): boolean {
  return sendMessage({
    type: MessageType.CONVERSATION_CREATE,
    payload: { workspaceId, name },
  });
}

/**
 * 대화 선택 (히스토리 로드)
 */
export function selectConversation(workspaceId: string, conversationId: string): boolean {
  return sendMessage({
    type: MessageType.CONVERSATION_SELECT,
    payload: { workspaceId, conversationId },
  });
}

/**
 * 추가 히스토리 요청 (페이징)
 */
export function requestMoreHistory(
  workspaceId: string,
  conversationId: string,
  offset: number,
  limit: number = 50
): boolean {
  return sendMessage({
    type: MessageType.HISTORY_REQUEST,
    payload: { workspaceId, conversationId, offset, limit },
  });
}

/**
 * 대화 삭제 요청
 */
export function deleteConversation(workspaceId: string, conversationId: string): boolean {
  return sendMessage({
    type: MessageType.CONVERSATION_DELETE,
    payload: { workspaceId, conversationId },
  });
}

/**
 * 대화 이름 변경 요청
 */
export function renameConversation(workspaceId: string, conversationId: string, newName: string): boolean {
  return sendMessage({
    type: MessageType.CONVERSATION_RENAME,
    payload: { workspaceId, conversationId, newName },
  });
}

// ============================================================================
// Claude 관련
// ============================================================================

/**
 * Claude에 메시지 전송
 */
export function sendClaudeMessage(
  workspaceId: string,
  conversationId: string,
  message: string,
  attachments?: string[]
): boolean {
  return sendMessage({
    type: MessageType.CLAUDE_SEND,
    payload: {
      workspaceId,
      conversationId,
      message,
      attachments,
    },
  });
}

/**
 * Claude 권한 응답
 */
export function sendPermissionResponse(
  conversationId: string,
  toolUseId: string,
  decision: 'allow' | 'deny'
): boolean {
  return sendMessage({
    type: MessageType.CLAUDE_PERMISSION,
    payload: {
      conversationId,
      toolUseId,
      decision,
    },
  });
}

/**
 * Claude 질문 응답
 */
export function sendQuestionResponse(
  conversationId: string,
  toolUseId: string,
  answer: string
): boolean {
  return sendMessage({
    type: MessageType.CLAUDE_ANSWER,
    payload: {
      conversationId,
      toolUseId,
      answer,
    },
  });
}

/**
 * Claude 제어 (중단/재시작)
 */
export function sendClaudeControl(
  conversationId: string,
  action: 'stop' | 'new_session'
): boolean {
  return sendMessage({
    type: MessageType.CLAUDE_CONTROL,
    payload: {
      conversationId,
      action,
    },
  });
}

/**
 * Claude 권한 모드 설정
 */
export function setPermissionMode(
  conversationId: string,
  mode: 'default' | 'acceptEdits' | 'bypassPermissions'
): boolean {
  return sendMessage({
    type: MessageType.CLAUDE_SET_PERMISSION_MODE,
    payload: {
      conversationId,
      mode,
    },
  });
}

// ============================================================================
// 폴더 관련
// ============================================================================

/**
 * 폴더 목록 요청
 */
export function requestFolderList(deviceId: number, path?: string): boolean {
  return sendMessage({
    type: MessageType.FOLDER_LIST,
    payload: { deviceId, path },
  });
}

/**
 * 폴더 생성 요청
 */
export function requestFolderCreate(deviceId: number, path: string, name: string): boolean {
  return sendMessage({
    type: MessageType.FOLDER_CREATE,
    payload: { deviceId, path, name },
  });
}

/**
 * 폴더 이름 변경 요청
 */
export function requestFolderRename(deviceId: number, path: string, newName: string): boolean {
  return sendMessage({
    type: MessageType.FOLDER_RENAME,
    payload: { deviceId, path, newName },
  });
}

/**
 * 특정 PC에 워크스페이스 생성 요청
 */
export function requestWorkspaceCreate(deviceId: number, name: string, workingDir: string): boolean {
  return sendMessage({
    type: MessageType.WORKSPACE_CREATE,
    payload: { deviceId, name, workingDir },
  });
}

// ============================================================================
// Usage 관련
// ============================================================================

/**
 * Claude 사용량 조회 요청
 *
 * @description
 * 특정 Pylon에 ccusage를 통한 사용량 조회를 요청합니다.
 */
export function requestUsage(): boolean {
  return sendMessage({
    type: MessageType.USAGE_REQUEST,
    payload: {},
  });
}

// ============================================================================
// 버그 리포트 관련
// ============================================================================

/**
 * 버그 리포트 전송
 */
export function sendBugReport(
  message: string,
  conversationId?: string,
  workspaceId?: string
): boolean {
  return sendMessage({
    type: MessageType.BUG_REPORT,
    payload: {
      message,
      conversationId,
      workspaceId,
      timestamp: new Date().toISOString(),
    },
  });
}
