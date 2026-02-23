/**
 * @file useShareConnection.ts
 * @description Share 연결 훅 - Viewer WebSocket 연결 관리
 *
 * 공유 링크를 통해 대화를 볼 수 있는 Viewer의 WebSocket 연결을 관리합니다.
 * - shareId를 받아 WebSocket 연결 시작
 * - viewer 디바이스 타입으로 인증
 * - 히스토리 수신 및 실시간 이벤트 처리
 * - 연결 해제 시 자동 재연결
 */

import { useEffect, useRef, useCallback } from 'react';
import { MessageType } from '@estelle/core';
import type { StoreMessage } from '@estelle/core';
import { useShareStore } from '../stores/shareStore';
import { RelayConfig } from '../utils/config';

/**
 * 인증 결과 페이로드
 */
interface AuthResultPayload {
  success: boolean;
  conversationId?: number;
  error?: string;
}

/**
 * 히스토리 결과 페이로드 (성공/실패 모두 포함)
 */
interface ShareHistoryResultPayload {
  success?: boolean;
  error?: string;
  shareId?: string;
  conversationId?: number;
  messages?: StoreMessage[];
}

/**
 * Claude 이벤트 페이로드
 */
interface ClaudeEventPayload {
  conversationId: number;
  event: {
    type: string;
    message?: StoreMessage;
  };
}

/**
 * Relay 메시지 타입
 */
interface RelayMessage {
  type: string;
  payload?: unknown;
}

/**
 * Share 연결 훅
 *
 * @param shareId - 공유 ID
 *
 * @description
 * 공유 링크를 통해 대화를 볼 수 있는 Viewer의 WebSocket 연결을 관리합니다.
 *
 * 연결 흐름:
 * 1. shareId가 유효하면 WebSocket 연결 시작
 * 2. 연결 성공 시 viewer 타입으로 인증 요청
 * 3. 인증 성공 시 히스토리 요청
 * 4. 히스토리 수신 후 실시간 이벤트 대기
 *
 * @example
 * ```tsx
 * function SharePage() {
 *   const { shareId } = useParams();
 *   useShareConnection(shareId ?? '');
 *
 *   const { messages, isConnected, error } = useShareStore();
 *   // ...
 * }
 * ```
 */
export function useShareConnection(shareId: string): void {
  const {
    setShareId,
    setConnected,
    setAuthenticated,
    setConversationId,
    setError,
    setMessages,
    addMessage,
    reset,
  } = useShareStore();

  const wsRef = useRef<WebSocket | null>(null);
  const intentionalCloseRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousShareIdRef = useRef<string | null>(null);

  /**
   * 메시지 핸들러
   */
  const handleMessage = useCallback(
    (message: RelayMessage) => {
      const { conversationId: currentConvId, isAuthenticated } = useShareStore.getState();

      switch (message.type) {
        case MessageType.AUTH_RESULT: {
          const payload = message.payload as AuthResultPayload;
          if (payload.success) {
            setAuthenticated(true);
            if (payload.conversationId !== undefined) {
              setConversationId(payload.conversationId);
            }
            // 인증 성공 시 히스토리 요청
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'share_history',
                  payload: { shareId },
                })
              );
            }
          } else {
            setError(payload.error ?? 'Authentication failed');
          }
          break;
        }

        case 'share_history_result': {
          const payload = message.payload as ShareHistoryResultPayload;
          // 실패 응답 처리
          if (payload.success === false) {
            setError(payload.error ?? 'Failed to load share history');
            break;
          }
          // 성공 응답: conversationId와 messages 설정
          if (payload.conversationId !== undefined) {
            setConversationId(payload.conversationId);
          }
          if (payload.messages) {
            setMessages(payload.messages);
          }
          break;
        }

        case MessageType.CLAUDE_EVENT: {
          const payload = message.payload as ClaudeEventPayload;
          // 인증 전이거나 conversationId가 다르면 무시
          if (!isAuthenticated || currentConvId === null) {
            break;
          }
          if (payload.conversationId !== currentConvId) {
            break;
          }
          // message 이벤트만 처리
          if (payload.event.type === 'message' && payload.event.message) {
            addMessage(payload.event.message);
          }
          break;
        }
      }
    },
    [shareId, setAuthenticated, setConversationId, setError, setMessages, addMessage]
  );

  /**
   * WebSocket 연결 함수
   */
  const connect = useCallback(() => {
    const wsUrl = RelayConfig.url;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);

        // viewer 타입으로 인증 요청
        ws.send(
          JSON.stringify({
            type: MessageType.AUTH,
            payload: {
              deviceType: 'viewer',
              shareId,
            },
          })
        );
      };

      ws.onclose = () => {
        // 현재 활성 연결이 아니면 무시
        if (wsRef.current !== ws) {
          return;
        }

        setConnected(false);

        // 의도적 종료가 아니면 재연결
        if (!intentionalCloseRef.current && !reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
          }, RelayConfig.reconnectInterval);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as RelayMessage;
          handleMessage(message);
        } catch {
          // 잘못된 JSON 메시지는 무시
        }
      };
    } catch {
      setError('Failed to create WebSocket connection');
    }
  }, [shareId, setConnected, setError, handleMessage]);

  /**
   * 연결 정리 함수
   */
  const cleanup = useCallback(() => {
    intentionalCloseRef.current = true;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    // shareId가 유효하지 않으면 연결하지 않음
    if (!shareId) {
      return;
    }

    // shareId가 변경된 경우 이전 연결 정리 및 스토어 초기화
    if (previousShareIdRef.current !== null && previousShareIdRef.current !== shareId) {
      cleanup();
      // 스토어 초기화 (shareId는 새로 설정됨)
      reset();
      intentionalCloseRef.current = false;
    }

    previousShareIdRef.current = shareId;

    // 스토어에 shareId 설정
    setShareId(shareId);

    // 이미 연결된 경우 스킵
    if (wsRef.current) {
      return;
    }

    // 새 연결 시작
    intentionalCloseRef.current = false;
    connect();

    return () => {
      cleanup();
    };
  }, [shareId, setShareId, connect, cleanup, reset]);
}
