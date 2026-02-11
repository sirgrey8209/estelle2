/**
 * @file useMessageRouter.ts
 * @description 메시지 라우터
 *
 * Relay에서 수신한 메시지를 적절한 Store에 디스패치합니다.
 * entityId(number)를 사용하여 대화를 식별합니다.
 */

import { MessageType } from '@estelle/core';
import type { WorkspaceWithActive, StoreMessage } from '@estelle/core';
import type { RelayMessage } from '../services/relayService';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSyncStore } from '../stores/syncStore';
import { syncOrchestrator } from '../services/syncOrchestrator';

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
      const { deviceId, deviceName, workspaces, activeWorkspaceId, activeConversationId, account } = payload as {
        deviceId: string | number;
        deviceName?: string;
        workspaces?: WorkspaceWithActive[];
        activeWorkspaceId?: string;
        activeConversationId?: string;
        account?: { current: string; subscriptionType: string };
      };

      console.log('[Router] workspace_list_result payload:', { deviceId, account });

      const pylonId = typeof deviceId === 'number' ? deviceId : parseInt(deviceId, 10);
      const pylonName = deviceName || `Device ${deviceId}`;

      // 삭제된 대화의 캐시 정리 (setWorkspaces 호출 전에 비교해야 함)
      const workspaceStore = useWorkspaceStore.getState();
      const previousWorkspaces = workspaceStore.workspacesByPylon.get(pylonId);
      if (previousWorkspaces && previousWorkspaces.length > 0) {
        // 이전 워크스페이스들의 모든 entityId 추출
        const previousEntityIds = new Set<number>();
        for (const ws of previousWorkspaces as Array<{ conversations?: Array<{ entityId: number }> }>) {
          if (ws.conversations) {
            for (const conv of ws.conversations) {
              previousEntityIds.add(conv.entityId);
            }
          }
        }

        // 새 워크스페이스들의 모든 entityId 추출
        const newEntityIds = new Set<number>();
        for (const ws of (workspaces || [])) {
          if (ws.conversations) {
            for (const conv of ws.conversations) {
              newEntityIds.add(conv.entityId);
            }
          }
        }

        // 이전에 있었지만 새 목록에 없는 entityId들의 캐시 삭제
        const convStore = useConversationStore.getState();
        for (const entityId of previousEntityIds) {
          if (!newEntityIds.has(entityId)) {
            convStore.deleteConversation(entityId);
          }
        }
      }

      // Pylon 정보 저장
      if (deviceId) {
        workspaceStore.addConnectedPylon({
          deviceId: pylonId,
          deviceName: pylonName,
        });
      }

      // 계정 정보 업데이트
      if (account) {
        console.log('[Router] Setting account:', account);
        useSettingsStore.getState().setAccountStatus({
          current: account.current as import('@estelle/core').AccountType,
          subscriptionType: account.subscriptionType,
        });
      } else {
        console.log('[Router] No account in payload');
      }

      // 워크스페이스 목록 업데이트 (서버의 active 정보 전달)
      const activeInfo = activeWorkspaceId && activeConversationId
        ? { workspaceId: activeWorkspaceId, conversationId: activeConversationId }
        : undefined;
      workspaceStore.setWorkspaces(pylonId, workspaces || [], activeInfo);

      // workspaceStore → conversationStore 동기화
      // setWorkspaces()에서 자동 선택된 대화를 conversationStore에도 반영
      const { selectedConversation } = useWorkspaceStore.getState();
      if (selectedConversation) {
        const convStore = useConversationStore.getState();
        if (convStore.currentEntityId !== selectedConversation.entityId) {
          convStore.setCurrentConversation(selectedConversation.entityId);
        }
      }

      // syncOrchestrator 알림 (requesting일 때만 동작, push 무시)
      syncOrchestrator.onWorkspaceListReceived(selectedConversation?.entityId ?? null);

      break;
    }

    // === Conversation 상태 ===
    case MessageType.CONVERSATION_STATUS: {
      const { entityId, status, unread, deviceId } = payload as {
        entityId?: number;
        status: string;
        unread?: boolean;
        deviceId?: number;
      };

      if (!entityId) break;

      // deviceId가 없으면 첫 번째 연결된 Pylon 사용
      const pylonId = deviceId || useWorkspaceStore.getState().connectedPylons[0]?.deviceId;
      if (pylonId) {
        // status가 유효한 값인 경우에만 업데이트 (방어적 처리)
        // 과거 버전에서 status: 'unread'를 보내는 경우가 있어서 필터링
        const validStatus = ['idle', 'working', 'waiting', 'error'].includes(status)
          ? (status as 'idle' | 'working' | 'waiting' | 'error')
          : undefined;

        useWorkspaceStore.getState().updateConversationStatus(
          pylonId,
          entityId,
          validStatus,
          unread
        );
      }

      // conversationStore도 동기화 (다른 대화를 보고 있을 때도 상태 반영)
      // pylonId가 없어도 entityId만 있으면 상태 설정 (재연결 시 상태 동기화)
      // ClaudeStatus: 'idle' | 'working' | 'permission'
      if (status === 'idle' || status === 'working') {
        const convStore = useConversationStore.getState();
        // convState가 없어도 setStatus 호출 (재연결 시 상태 동기화)
        convStore.setStatus(entityId, status);

        // idle로 변경 시 stale textBuffer 정리
        if (status === 'idle') {
          convStore.clearTextBuffer(entityId);
        }
      }
      break;
    }

    // === History ===
    case MessageType.HISTORY_RESULT: {
      const { messages, entityId, totalCount, loadBefore, hasActiveSession, currentStatus } = payload as {
        messages: StoreMessage[];
        entityId?: number;
        totalCount?: number;
        loadBefore?: number;
        hasActiveSession?: boolean;
        currentStatus?: 'idle' | 'working' | 'permission';
      };

      // entityId 우선, fallback으로 선택된 대화의 entityId
      const targetEntityId = entityId
        || useWorkspaceStore.getState().selectedConversation?.entityId;
      if (targetEntityId) {
        const convStore = useConversationStore.getState();
        const syncStore = useSyncStore.getState();
        const resolvedTotalCount = totalCount ?? messages.length;
        const loadedCount = messages.length;

        if (loadBefore !== undefined && loadBefore > 0) {
          // 추가 로드 (과거 방향 페이징)
          convStore.prependMessages(targetEntityId, messages);

          // syncStore: syncedFrom 확장
          // loadBefore = 80, loadedCount = 20 → newSyncedFrom = 80 - 20 = 60
          const newSyncedFrom = loadBefore - loadedCount;
          syncStore.extendSyncedFrom(targetEntityId, Math.max(0, newSyncedFrom));
          syncStore.setLoadingMore(targetEntityId, false);
        } else {
          // 초기 로드 — stale textBuffer 정리 후 메시지 설정
          convStore.clearTextBuffer(targetEntityId);
          convStore.setMessages(targetEntityId, messages);

          // syncStore: 범위 설정 (최신 메시지부터 로드됨)
          const syncedFrom = resolvedTotalCount - loadedCount;
          syncStore.setConversationSync(targetEntityId, syncedFrom, resolvedTotalCount, resolvedTotalCount);
          syncStore.setConversationPhase(targetEntityId, 'synced');

          // Pylon이 보낸 현재 상태로 conversationStore 동기화
          // currentStatus가 있으면 해당 상태로 설정 (재연결 시 정확한 상태 동기화)
          if (currentStatus) {
            convStore.setStatus(targetEntityId, currentStatus);
          } else if (hasActiveSession === false) {
            // 레거시 호환: currentStatus가 없고 hasActiveSession=false이면 idle로 설정
            const convState = convStore.getState(targetEntityId);
            if (convState && convState.status !== 'idle') {
              convStore.setStatus(targetEntityId, 'idle');
            }
          }
        }
      }
      break;
    }

    // === Claude 이벤트 ===
    case MessageType.CLAUDE_EVENT: {
      // payload에 entityId가 있으면 해당 대화에 적용 (다른 대화에서 온 이벤트도 처리)
      const targetEntityId = (payload as { entityId?: number }).entityId
        || useWorkspaceStore.getState().selectedConversation?.entityId;
      if (targetEntityId) {
        handleClaudeEventForConversation(targetEntityId, payload);
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

    // === 대화 생성 결과 ===
    case MessageType.CONVERSATION_CREATE_RESULT: {
      const { entityId } = payload as { entityId?: number };

      // entityId가 있으면 이전 캐시 삭제 (새 대화 생성 시 이전 데이터 정리)
      if (entityId) {
        useConversationStore.getState().deleteConversation(entityId);
      }
      break;
    }

    // === Account 상태 ===
    case MessageType.ACCOUNT_STATUS: {
      const { current, subscriptionType } = payload as {
        current: import('@estelle/core').AccountType;
        subscriptionType?: string;
      };
      useSettingsStore.getState().setAccountStatus({
        current,
        subscriptionType,
      });
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
 * @param entityId - 대상 entityId
 * @param payload - Claude 이벤트 페이로드
 */
function handleClaudeEventForConversation(
  entityId: number,
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
        store.setStatus(entityId, status);
      }
      break;
    }

    case 'text': {
      const text = event.text as string;
      if (text) {
        store.appendTextBuffer(entityId, text);
      }
      break;
    }

    case 'textComplete': {
      store.flushTextBuffer(entityId);
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
      store.addMessage(entityId, message);
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
      const state = store.getState(entityId);
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
          store.setMessages(entityId, messages);
        } else {
          store.addMessage(entityId, {
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
      store.addPendingRequest(entityId, {
        type: 'permission',
        toolUseId: event.toolUseId as string,
        toolName: event.toolName as string,
        toolInput: event.toolInput as Record<string, unknown>,
      });
      store.setStatus(entityId, 'permission');
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

      store.addPendingRequest(entityId, {
        type: 'question',
        toolUseId: event.toolUseId as string,
        questions,
      });
      store.setStatus(entityId, 'permission');
      break;
    }

    case 'result': {
      store.flushTextBuffer(entityId);
      const usage = event.usage as Record<string, unknown> | undefined;
      store.addMessage(entityId, {
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
      store.setStatus(entityId, 'idle');
      break;
    }

    case 'error': {
      store.addMessage(entityId, {
        id: generateId(),
        role: 'system',
        type: 'error',
        content: (event.message as string) || 'Unknown error',
        timestamp: Date.now(),
      } as StoreMessage);
      store.setStatus(entityId, 'idle');
      break;
    }

    case 'aborted': {
      store.addMessage(entityId, {
        id: generateId(),
        role: 'system',
        type: 'aborted',
        timestamp: Date.now(),
        reason: (event.reason as 'user' | 'session_ended') || 'user',
      } as StoreMessage);
      store.setStatus(entityId, 'idle');
      break;
    }

    case 'file_attachment': {
      const fileInfo = event.file as Record<string, unknown>;
      if (fileInfo) {
        store.addMessage(entityId, {
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
        store.updateRealtimeUsage(entityId, {
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
