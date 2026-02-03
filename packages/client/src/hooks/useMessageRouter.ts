/**
 * @file useMessageRouter.ts
 * @description 메시지 라우터
 *
 * Relay에서 수신한 메시지를 적절한 Store에 디스패치합니다.
 */

import { MessageType } from '@estelle/core';
import type { WorkspaceWithActive } from '@estelle/core';
import type { RelayMessage } from '../services/relayService';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useClaudeStore } from '../stores/claudeStore';
import { useRelayStore } from '../stores/relayStore';
import { selectConversation } from '../services/relaySender';
import type { ClaudeMessage } from '../stores/claudeStore';

/**
 * 메시지를 적절한 Store에 라우팅합니다.
 *
 * @param message - Relay에서 수신한 메시지
 */
export function routeMessage(message: RelayMessage): void {
  const { type, payload } = message;

  switch (type) {
    // === Workspace 목록 ===
    case MessageType.WORKSPACE_LIST_RESULT: {
      const { deviceId, deviceName, workspaces } = payload as {
        deviceId: string | number;
        deviceName?: string;
        workspaces?: WorkspaceWithActive[];
      };

      const pylonId = typeof deviceId === 'number' ? deviceId : parseInt(deviceId, 10);
      const pylonName = deviceName || `Device ${deviceId}`;

      // Pylon 정보 저장
      if (deviceId) {
        useWorkspaceStore.getState().addConnectedPylon({
          deviceId: pylonId,
          deviceName: pylonName,
        });
      }

      // 워크스페이스 목록 업데이트
      const isFirstLoad = !useRelayStore.getState().desksLoaded;
      useWorkspaceStore.getState().setWorkspaces(pylonId, workspaces || []);
      useRelayStore.getState().setDesksLoaded(true);

      // 첫 로드 시에만 선택된 대화에 대해 서버에 알림 (히스토리 로드 + 뷰어 등록)
      if (isFirstLoad) {
        const { selectedConversation } = useWorkspaceStore.getState();
        if (selectedConversation) {
          selectConversation(selectedConversation.workspaceId, selectedConversation.conversationId);
        }
      }
      break;
    }

    // === Conversation 상태 ===
    case MessageType.CONVERSATION_STATUS: {
      const { workspaceId, conversationId, status, unread, deviceId } = payload as {
        workspaceId: string;
        conversationId: string;
        status: string;
        unread?: boolean;
        deviceId?: number;
      };

      // deviceId가 없으면 첫 번째 연결된 Pylon 사용
      const pylonId = deviceId || useWorkspaceStore.getState().connectedPylons[0]?.deviceId;
      if (pylonId) {
        useWorkspaceStore.getState().updateConversationStatus(
          pylonId,
          workspaceId,
          conversationId,
          status as 'idle' | 'working' | 'waiting' | 'error',
          unread
        );
      }
      break;
    }

    // === History ===
    case MessageType.HISTORY_RESULT: {
      const { messages } = payload as { messages: ClaudeMessage[] };
      useClaudeStore.getState().setMessages(messages);
      break;
    }

    // === Claude 이벤트 ===
    case MessageType.CLAUDE_EVENT: {
      useClaudeStore.getState().handleClaudeEvent(payload);
      break;
    }

    // === 폴더 목록 ===
    case MessageType.FOLDER_LIST_RESULT: {
      // CustomEvent로 컴포넌트에 전달 (NewWorkspaceDialog에서 수신)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('folder_list_result', { detail: payload })
        );
      }
      break;
    }

    // === 워크스페이스 생성 결과 ===
    case MessageType.WORKSPACE_CREATE_RESULT: {
      // 워크스페이스 목록 새로고침은 별도 메시지로 처리됨
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('workspace_create_result', { detail: payload })
        );
      }
      break;
    }

    default:
      // Unknown message type - do nothing
      break;
  }
}

/**
 * 메시지 라우터 훅
 *
 * RelayService의 메시지 이벤트를 구독하고 적절한 Store에 디스패치합니다.
 *
 * @example
 * ```tsx
 * function App() {
 *   useMessageRouter(relayService);
 *   return <MainScreen />;
 * }
 * ```
 */
export function useMessageRouter(relayService: { on: (event: 'message', handler: (message: RelayMessage) => void) => () => void }): void {
  // React effect에서 사용
  // 실제 구현은 RelayService와 연동 시 추가
}
