/**
 * @file useMessageRouter.ts
 * @description 메시지 라우터
 *
 * Relay에서 수신한 메시지를 적절한 Store에 디스패치합니다.
 * conversationId(number)를 사용하여 대화를 식별합니다.
 */

import { MessageType } from '@estelle/core';
import type { WorkspaceWithActive, StoreMessage } from '@estelle/core';
import type { RelayMessage } from '../services/relayService';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSyncStore } from '../stores/syncStore';
import { syncOrchestrator } from '../services/syncOrchestrator';
import { clearDraftText } from '../components/chat/InputBar';
// import { debugLog } from '../stores/debugStore';

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
        // 이전 워크스페이스들의 모든 conversationId 추출
        const previousConversationIds = new Set<number>();
        for (const ws of previousWorkspaces as Array<{ conversations?: Array<{ conversationId: number }> }>) {
          if (ws.conversations) {
            for (const conv of ws.conversations) {
              previousConversationIds.add(conv.conversationId);
            }
          }
        }

        // 새 워크스페이스들의 모든 conversationId 추출
        const newConversationIds = new Set<number>();
        for (const ws of (workspaces || [])) {
          if (ws.conversations) {
            for (const conv of ws.conversations) {
              newConversationIds.add(conv.conversationId);
            }
          }
        }

        // 이전에 있었지만 새 목록에 없는 conversationId들의 캐시 삭제
        const convStore = useConversationStore.getState();
        for (const conversationId of previousConversationIds) {
          if (!newConversationIds.has(conversationId)) {
            convStore.deleteConversation(conversationId);
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

        const settingsStore = useSettingsStore.getState();
        const previousAccount = settingsStore.currentAccount;
        const newAccount = account.current as import('@estelle/core').AccountType;

        // 계정이 변경된 경우 (Pylon 재시작 등) 스토어 초기화
        // - 이전 계정이 있고, 새 계정과 다른 경우에만 초기화
        // - 최초 로드 시 (previousAccount === null)는 초기화하지 않음
        if (previousAccount !== null && previousAccount !== newAccount) {
          console.log(`[Router] Account changed on workspace_list: ${previousAccount} → ${newAccount}, resetting stores`);

          // 계정 변경 시 이전 계정의 데이터 정리
          useConversationStore.getState().reset();
          // workspaceStore는 직후에 setWorkspaces가 호출되므로 reset 불필요
          useSyncStore.getState().resetForReconnect();
        }

        settingsStore.setAccountStatus({
          current: newAccount,
          subscriptionType: account.subscriptionType,
        });
      } else {
        console.log('[Router] No account in payload');
      }

      // 워크스페이스 목록 업데이트 (서버의 active 정보 전달)
      const activeInfo = activeWorkspaceId && activeConversationId
        ? { workspaceId: activeWorkspaceId, conversationId: parseInt(activeConversationId, 10) }
        : undefined;
      workspaceStore.setWorkspaces(pylonId, workspaces || [], activeInfo);

      // workspaceStore → conversationStore 동기화
      // setWorkspaces()에서 자동 선택된 대화를 conversationStore에도 반영
      const { selectedConversation } = useWorkspaceStore.getState();
      if (selectedConversation) {
        const convStore = useConversationStore.getState();
        if (convStore.currentConversationId !== selectedConversation.conversationId) {
          convStore.setCurrentConversation(selectedConversation.conversationId);
        }
      }

      // syncOrchestrator 알림
      const currentSync = useSyncStore.getState().workspaceSync;
      console.log('[Router] Before onWorkspaceListReceived, workspaceSync:', currentSync);
      syncOrchestrator.onWorkspaceListReceived(selectedConversation?.conversationId ?? null);
      console.log('[Router] After onWorkspaceListReceived, workspaceSync:', useSyncStore.getState().workspaceSync);

      break;
    }

    // === Conversation 상태 ===
    case MessageType.CONVERSATION_STATUS: {
      const { conversationId, status, unread, deviceId } = payload as {
        conversationId?: number;
        status: string;
        unread?: boolean;
        deviceId?: number;
      };

      if (!conversationId) break;

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
          conversationId,
          validStatus,
          unread
        );
      }

      // conversationStore도 동기화 (다른 대화를 보고 있을 때도 상태 반영)
      // pylonId가 없어도 conversationId만 있으면 상태 설정 (재연결 시 상태 동기화)
      // ClaudeStatus: 'idle' | 'working' | 'permission'
      if (status === 'idle' || status === 'working') {
        const convStore = useConversationStore.getState();
        // convState가 없어도 setStatus 호출 (재연결 시 상태 동기화)
        convStore.setStatus(conversationId, status);

        // idle로 변경 시 stale textBuffer 정리
        if (status === 'idle') {
          convStore.clearTextBuffer(conversationId);
        }
      }
      break;
    }

    // === History ===
    case MessageType.HISTORY_RESULT: {
      const { messages, conversationId, totalCount, loadBefore, hasActiveSession, currentStatus } = payload as {
        messages: StoreMessage[];
        conversationId?: number;
        totalCount?: number;
        loadBefore?: number;
        hasActiveSession?: boolean;
        currentStatus?: 'idle' | 'working' | 'permission';
      };

      // DEBUG: history_result 수신 로그
      console.log(`[Router] history_result: conversationId=${conversationId}, messages=${messages?.length}, totalCount=${totalCount}`);

      // conversationId 우선, fallback으로 선택된 대화의 conversationId
      const targetConversationId = conversationId
        || useWorkspaceStore.getState().selectedConversation?.conversationId;

      console.log(`[Router] history_result: targetConversationId=${targetConversationId}, selectedConversation=${useWorkspaceStore.getState().selectedConversation?.conversationId}`);

      if (targetConversationId) {
        const convStore = useConversationStore.getState();
        const syncStore = useSyncStore.getState();
        const resolvedTotalCount = totalCount ?? messages.length;
        const loadedCount = messages.length;

        if (loadBefore !== undefined && loadBefore > 0) {
          // 추가 로드 (과거 방향 페이징)
          convStore.prependMessages(targetConversationId, messages);

          // syncStore: syncedFrom 확장
          // loadBefore = 80, loadedCount = 20 → newSyncedFrom = 80 - 20 = 60
          const newSyncedFrom = loadBefore - loadedCount;
          syncStore.extendSyncedFrom(targetConversationId, Math.max(0, newSyncedFrom));
          syncStore.setLoadingMore(targetConversationId, false);
        } else {
          // 초기 로드 — 기존 메시지 비우고 새 히스토리로 교체
          // clearMessages로 이전 상태 초기화 후 setMessages 호출 (중복 방지)
          convStore.clearMessages(targetConversationId);
          convStore.clearTextBuffer(targetConversationId);
          convStore.setMessages(targetConversationId, messages);

          // syncStore: 범위 설정 (최신 메시지부터 로드됨)
          const syncedFrom = resolvedTotalCount - loadedCount;
          syncStore.setConversationSync(targetConversationId, syncedFrom, resolvedTotalCount, resolvedTotalCount);
          syncStore.setConversationPhase(targetConversationId, 'synced');

          // Pylon이 보낸 현재 상태로 conversationStore 동기화
          // currentStatus가 있으면 해당 상태로 설정 (재연결 시 정확한 상태 동기화)
          if (currentStatus) {
            convStore.setStatus(targetConversationId, currentStatus);
          } else if (hasActiveSession === false) {
            // 레거시 호환: currentStatus가 없고 hasActiveSession=false이면 idle로 설정
            const convState = convStore.getState(targetConversationId);
            if (convState && convState.status !== 'idle') {
              convStore.setStatus(targetConversationId, 'idle');
            }
          }
        }
      }
      break;
    }

    // === Claude 이벤트 ===
    case MessageType.CLAUDE_EVENT: {
      // payload에 conversationId가 있으면 해당 대화에 적용 (다른 대화에서 온 이벤트도 처리)
      const payloadConversationId = (payload as { conversationId?: number }).conversationId;
      const selectedConversationId = useWorkspaceStore.getState().selectedConversation?.conversationId;
      const targetConversationId = payloadConversationId || selectedConversationId;

      // DEBUG: conversationId 추적
      const eventType = (payload as { event?: { type?: string } }).event?.type;
      if (payloadConversationId !== selectedConversationId) {
        console.warn(`[Router] CLAUDE_EVENT mismatch! payload=${payloadConversationId}, selected=${selectedConversationId}, eventType=${eventType}`);
      }

      if (targetConversationId) {
        handleClaudeEventForConversation(targetConversationId, payload);
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
      const { conversationId } = payload as { conversationId?: number };

      // conversationId가 있으면 이전 캐시 삭제 (새 대화 생성 시 이전 데이터 정리)
      if (conversationId) {
        useConversationStore.getState().deleteConversation(conversationId);
        // 입력 draft도 삭제
        clearDraftText(conversationId);
      }
      break;
    }

    // === Account 상태 ===
    case MessageType.ACCOUNT_STATUS: {
      const { current, subscriptionType } = payload as {
        current: import('@estelle/core').AccountType;
        subscriptionType?: string;
      };

      const settingsStore = useSettingsStore.getState();
      const previousAccount = settingsStore.currentAccount;

      // 계정이 변경된 경우 (전환 완료) 스토어 초기화
      // - 이전 계정이 있고, 새 계정과 다른 경우에만 초기화
      // - 최초 로드 시 (previousAccount === null)는 초기화하지 않음
      if (previousAccount !== null && previousAccount !== current) {
        console.log(`[Router] Account switched: ${previousAccount} → ${current}, resetting stores`);

        // 계정 전환 시 이전 계정의 데이터 정리
        useConversationStore.getState().reset();
        useWorkspaceStore.getState().reset();
        useSyncStore.getState().resetForReconnect();

        // 워크스페이스 목록 다시 요청
        syncOrchestrator.startInitialSync();
      }

      settingsStore.setAccountStatus({
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
 * @param conversationId - 대상 conversationId
 * @param payload - Claude 이벤트 페이로드
 */
function handleClaudeEventForConversation(
  conversationId: number,
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
        // debugLog('STATE', status);
        store.setStatus(conversationId, status);
      }
      break;
    }

    case 'text': {
      const text = event.text as string;
      if (text) {
        // debugLog('TEXT', `+${text.length}ch "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}"`);
        store.appendTextBuffer(conversationId, text);
      }
      break;
    }

    case 'textComplete': {
      // debugLog('TEXT', 'complete (flush)');
      store.flushTextBuffer(conversationId);
      break;
    }

    case 'toolInfo':
    case 'tool_start': {
      const toolUseId = event.toolUseId as string | undefined;
      const parentToolUseId = event.parentToolUseId as string | null | undefined;
      const toolName = event.toolName as string;
      // debugLog('TOOL', `start: ${toolName}`);
      const message: StoreMessage = {
        id: toolUseId || generateId(),
        role: 'assistant',
        type: 'tool_start',
        timestamp: Date.now(),
        toolName,
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
      const usage = event.usage as Record<string, unknown> | undefined;
      const durationMs = (event.duration_ms as number) || 0;
      // debugLog('RESULT', `done in ${(durationMs / 1000).toFixed(1)}s`);
      store.flushTextBuffer(conversationId);
      store.addMessage(conversationId, {
        id: generateId(),
        role: 'system',
        type: 'result',
        timestamp: Date.now(),
        resultInfo: {
          durationMs,
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

    case 'compactStart': {
      // Compact 시작 - tool_start 메시지 추가
      const message: StoreMessage = {
        id: generateId(),
        role: 'assistant',
        type: 'tool_start',
        timestamp: Date.now(),
        toolName: 'Compact',
        toolInput: {},
      };
      store.addMessage(conversationId, message);
      break;
    }

    case 'compactComplete': {
      const preTokens = event.preTokens as number | undefined;

      // preTokens 포맷팅 (원본 + 천 단위 쉼표)
      // 테스트에서 200000과 200,000 둘 다 포함되어야 함
      let output = 'Compacted';
      if (preTokens !== undefined) {
        const formattedTokens = preTokens.toLocaleString();
        output = `Compacted ${formattedTokens} (${preTokens}) tokens`;
      }

      // tool_start → tool_complete 교체
      const state = store.getState(conversationId);
      if (state) {
        const messages = [...state.messages];
        let replaced = false;

        // 역순으로 Compact tool_start 찾기
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg.type === 'tool_start' && (msg as { toolName?: string }).toolName === 'Compact') {
            messages[i] = {
              id: msg.id,
              role: 'assistant',
              type: 'tool_complete',
              timestamp: msg.timestamp,
              toolName: 'Compact',
              toolInput: (msg as { toolInput?: Record<string, unknown> }).toolInput || {},
              success: true,
              output,
            } as StoreMessage;
            replaced = true;
            break;
          }
        }

        if (replaced) {
          store.setMessages(conversationId, messages);
        } else {
          // tool_start가 없으면 새로 추가
          store.addMessage(conversationId, {
            id: generateId(),
            role: 'assistant',
            type: 'tool_complete',
            timestamp: Date.now(),
            toolName: 'Compact',
            toolInput: {},
            success: true,
            output,
          } as StoreMessage);
        }
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
