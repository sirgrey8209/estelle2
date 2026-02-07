/**
 * @file useMessageRouter.ts
 * @description 메시지 라우터
 *
 * Relay에서 수신한 메시지를 적절한 Store에 디스패치합니다.
 */

import { MessageType } from '@estelle/core';
import type { WorkspaceWithActive, StoreMessage } from '@estelle/core';
import type { RelayMessage } from '../services/relayService';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useConversationStore } from '../stores/conversationStore';
import { useRelayStore } from '../stores/relayStore';
import { useSettingsStore } from '../stores/settingsStore';
import { selectConversation } from '../services/relaySender';

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
      const { deviceId, deviceName, workspaces, activeWorkspaceId, activeConversationId } = payload as {
        deviceId: string | number;
        deviceName?: string;
        workspaces?: WorkspaceWithActive[];
        activeWorkspaceId?: string;
        activeConversationId?: string;
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

      // 이전에 이 Pylon의 데이터가 있었는지 확인 (첫 연결 vs 단순 갱신 구분)
      const isFirstSync = !useWorkspaceStore.getState().workspacesByPylon.has(pylonId);

      // 워크스페이스 목록 업데이트 (서버의 active 정보 전달)
      const activeInfo = activeWorkspaceId && activeConversationId
        ? { workspaceId: activeWorkspaceId, conversationId: activeConversationId }
        : undefined;
      useWorkspaceStore.getState().setWorkspaces(pylonId, workspaces || [], activeInfo);
      useRelayStore.getState().setDesksLoaded(true);

      // 첫 연결/재연결 시에만 selectConversation 재전송 (히스토리 로드 + 뷰어 등록)
      // rename, delete 등 단순 목록 갱신에서는 불필요
      if (isFirstSync) {
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
      const { messages, conversationId, totalCount, hasMore, offset } = payload as {
        messages: StoreMessage[];
        conversationId?: string;
        totalCount?: number;
        hasMore?: boolean;
        offset?: number;
      };

      const targetConvId = conversationId || useWorkspaceStore.getState().selectedConversation?.conversationId;
      if (targetConvId) {
        const store = useConversationStore.getState();
        if (offset && offset > 0) {
          // 추가 로드 (페이징)
          store.prependMessages(targetConvId, messages, hasMore ?? false);
        } else {
          // 초기 로드
          store.setMessages(targetConvId, messages, {
            totalCount: totalCount ?? messages.length,
            hasMore: hasMore ?? false,
          });
        }
      }
      break;
    }

    // === Claude 이벤트 ===
    case MessageType.CLAUDE_EVENT: {
      // payload에 conversationId가 있으면 해당 대화에 적용 (다른 대화에서 온 이벤트도 처리)
      const targetConvId = (payload as { conversationId?: string }).conversationId
        || useWorkspaceStore.getState().selectedConversation?.conversationId;
      if (targetConvId) {
        handleClaudeEventForConversation(targetConvId, payload);
      }
      break;
    }

    // === 폴더 목록 ===
    case MessageType.FOLDER_LIST_RESULT: {
      // CustomEvent로 컴포넌트에 전달 (WorkspaceDialog에서 수신)
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

    // === Usage 응답 ===
    case MessageType.USAGE_RESPONSE: {
      const { success, summary, error } = payload as {
        success: boolean;
        summary?: import('@estelle/core').UsageSummary;
        error?: string;
      };
      useSettingsStore.getState().setUsageSummary(
        success && summary ? summary : null,
        error
      );
      break;
    }

    default:
      // Unknown message type - do nothing
      break;
  }
}

/**
 * Claude 이벤트를 conversationStore에 라우팅
 *
 * @param conversationId - 대상 대화 ID
 * @param payload - Claude 이벤트 페이로드
 */
function handleClaudeEventForConversation(
  conversationId: string,
  payload: Record<string, unknown>
): void {
  const event = payload.event as Record<string, unknown> | undefined;
  if (!event) return;

  const eventType = event.type as string;
  const store = useConversationStore.getState();

  switch (eventType) {
    case 'state': {
      const status = event.state as 'idle' | 'working' | 'permission';
      if (status) {
        store.setStatus(conversationId, status);
      }
      break;
    }

    case 'text': {
      const text = event.text as string;
      if (text) {
        store.appendTextBuffer(conversationId, text);
      }
      break;
    }

    case 'textComplete': {
      store.flushTextBuffer(conversationId);
      break;
    }

    case 'toolInfo':
    case 'tool_start': {
      const toolUseId = event.toolUseId as string | undefined;
      const parentToolUseId = event.parentToolUseId as string | null | undefined;
      const message: StoreMessage = {
        id: toolUseId || generateId(),
        role: 'assistant',
        type: 'tool_start',
        timestamp: Date.now(),
        toolName: event.toolName as string,
        toolInput: (event.toolInput || event.input) as Record<string, unknown>,
        ...(parentToolUseId ? { parentToolUseId } : {}),
      };
      store.addMessage(conversationId, message);
      break;
    }

    case 'toolComplete':
    case 'tool_complete': {
      const toolUseId = event.toolUseId as string | undefined;
      const toolName = event.toolName as string;
      const success = (event.success as boolean) ?? true;
      const output = (event.toolOutput || event.result) as string | undefined;
      const parentToolUseId = event.parentToolUseId as string | null | undefined;

      // tool_start → tool_complete 교체
      const state = store.getState(conversationId);
      if (state) {
        const messages = [...state.messages];
        let replaced = false;

        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg.type === 'tool_start') {
            const isMatch = toolUseId
              ? msg.id === toolUseId
              : (msg as any).toolName === toolName;

            if (isMatch) {
              messages[i] = {
                id: msg.id,
                role: 'assistant',
                type: 'tool_complete',
                timestamp: msg.timestamp,
                toolName,
                toolInput: (msg as any).toolInput,
                success,
                ...(success ? { output } : { error: output }),
                ...(parentToolUseId ? { parentToolUseId } : {}),
              } as StoreMessage;
              replaced = true;
              break;
            }
          }
        }

        if (replaced) {
          store.setMessages(conversationId, messages);
        } else {
          store.addMessage(conversationId, {
            id: toolUseId || generateId(),
            role: 'assistant',
            type: 'tool_complete',
            timestamp: Date.now(),
            toolName,
            toolInput: (event.toolInput || event.input || {}) as Record<string, unknown>,
            success,
            ...(success ? { output } : { error: output }),
            ...(parentToolUseId ? { parentToolUseId } : {}),
          } as StoreMessage);
        }
      }
      break;
    }

    case 'permission_request': {
      store.addPendingRequest(conversationId, {
        type: 'permission',
        toolUseId: event.toolUseId as string,
        toolName: event.toolName as string,
        toolInput: event.toolInput as Record<string, unknown>,
      });
      store.setStatus(conversationId, 'permission');
      break;
    }

    case 'askQuestion':
    case 'ask_question': {
      const rawQuestions = event.questions as Array<{
        question: string;
        header?: string;
        options?: Array<{ label: string }>;
        multiSelect?: boolean;
      }> | undefined;

      const questions = rawQuestions?.map(q => ({
        question: q.question,
        header: q.header,
        options: q.options?.map(o => o.label) || [],
        multiSelect: q.multiSelect,
      })) || [{
        question: (event.question as string) || '',
        options: (event.options as string[]) || [],
      }];

      store.addPendingRequest(conversationId, {
        type: 'question',
        toolUseId: event.toolUseId as string,
        questions,
      });
      store.setStatus(conversationId, 'permission');
      break;
    }

    case 'result': {
      store.flushTextBuffer(conversationId);
      const usage = event.usage as Record<string, unknown> | undefined;
      store.addMessage(conversationId, {
        id: generateId(),
        role: 'system',
        type: 'result',
        timestamp: Date.now(),
        resultInfo: {
          durationMs: (event.duration_ms as number) || 0,
          inputTokens: (usage?.inputTokens as number) || 0,
          outputTokens: (usage?.outputTokens as number) || 0,
          cacheReadTokens: (usage?.cacheReadInputTokens as number) || 0,
        },
      } as StoreMessage);
      store.setStatus(conversationId, 'idle');
      break;
    }

    case 'error': {
      store.addMessage(conversationId, {
        id: generateId(),
        role: 'system',
        type: 'error',
        content: (event.message as string) || 'Unknown error',
        timestamp: Date.now(),
      } as StoreMessage);
      store.setStatus(conversationId, 'idle');
      break;
    }

    case 'aborted': {
      store.addMessage(conversationId, {
        id: generateId(),
        role: 'system',
        type: 'aborted',
        timestamp: Date.now(),
        reason: (event.reason as 'user' | 'session_ended') || 'user',
      } as StoreMessage);
      store.setStatus(conversationId, 'idle');
      break;
    }

    case 'file_attachment': {
      const fileInfo = event.file as Record<string, unknown>;
      if (fileInfo) {
        store.addMessage(conversationId, {
          id: generateId(),
          role: 'assistant',
          type: 'file_attachment',
          timestamp: Date.now(),
          file: {
            path: (fileInfo.path as string) || '',
            filename: (fileInfo.filename as string) || '',
            mimeType: (fileInfo.mimeType as string) || '',
            fileType: (fileInfo.fileType as string) || 'text',
            size: (fileInfo.size as number) || 0,
            description: fileInfo.description as string | undefined,
          },
        } as StoreMessage);
      }
      break;
    }

    case 'usage_update': {
      const usage = event.usage as Record<string, number> | undefined;
      if (usage) {
        store.updateRealtimeUsage(conversationId, {
          inputTokens: usage.inputTokens || 0,
          outputTokens: usage.outputTokens || 0,
          cacheReadInputTokens: usage.cacheReadInputTokens || 0,
          cacheCreationInputTokens: usage.cacheCreationInputTokens || 0,
        });
      }
      break;
    }

    default:
      break;
  }
}

/**
 * UUID 생성 (간단한 버전)
 */
function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
