/**
 * @file useShareConnection.test.ts
 * @description Share 연결 훅 테스트 - Viewer WebSocket 연결 관리
 *
 * TDD 2-TEST 단계: 실패하는 테스트 작성
 * - useShareConnection 훅은 아직 구현되지 않음
 * - import 에러는 의도된 것
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MessageType } from '@estelle/core';
import { useShareStore } from '../stores/shareStore';
// 아직 구현되지 않은 훅 import - 의도된 에러
import { useShareConnection } from './useShareConnection';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * MockWebSocket 인스턴스 추적
 */
let mockWsInstance: MockWebSocket | null = null;

/**
 * MockWebSocket 클래스
 * setupTests.ts의 것을 확장하여 테스트에서 직접 제어 가능
 */
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;

  send = vi.fn();
  close = vi.fn();

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    mockWsInstance = this;
  }

  // 테스트 헬퍼: 연결 성공 시뮬레이션
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  // 테스트 헬퍼: 메시지 수신 시뮬레이션
  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  // 테스트 헬퍼: 연결 종료 시뮬레이션
  simulateClose(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }

  // 테스트 헬퍼: 에러 시뮬레이션
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('useShareConnection', () => {
  beforeEach(() => {
    // WebSocket mock 설정
    // @ts-expect-error - global WebSocket mock
    globalThis.WebSocket = MockWebSocket;
    mockWsInstance = null;

    // shareStore 초기화
    useShareStore.getState().reset();

    // 타이머 mock
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mockWsInstance = null;
  });

  // ==========================================================================
  // 연결 시작
  // ==========================================================================

  describe('연결 시작', () => {
    it('should_start_websocket_connection_when_shareId_provided', () => {
      // Arrange
      const shareId = 'test-share-123';

      // Act
      renderHook(() => useShareConnection(shareId));

      // Assert
      expect(mockWsInstance).not.toBeNull();
      expect(mockWsInstance?.url).toContain('ws');
    });

    it('should_not_connect_when_shareId_is_empty', () => {
      // Arrange
      const shareId = '';

      // Act
      renderHook(() => useShareConnection(shareId));

      // Assert
      expect(mockWsInstance).toBeNull();
    });

    it('should_set_shareId_in_store_when_hook_called', () => {
      // Arrange
      const shareId = 'test-share-456';

      // Act
      renderHook(() => useShareConnection(shareId));

      // Assert
      expect(useShareStore.getState().shareId).toBe(shareId);
    });
  });

  // ==========================================================================
  // 연결 성공
  // ==========================================================================

  describe('연결 성공', () => {
    it('should_set_connected_true_when_websocket_opens', async () => {
      // Arrange
      const shareId = 'test-share-789';

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });

      // Assert
      expect(useShareStore.getState().isConnected).toBe(true);
    });

    it('should_send_auth_message_with_viewer_deviceType_when_connected', async () => {
      // Arrange
      const shareId = 'test-share-auth';

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });

      // Assert
      expect(mockWsInstance?.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWsInstance?.send.mock.calls[0][0]);
      expect(sentData.type).toBe(MessageType.AUTH);
      expect(sentData.payload.deviceType).toBe('viewer');
      expect(sentData.payload.shareId).toBe(shareId);
    });
  });

  // ==========================================================================
  // 인증 결과 처리
  // ==========================================================================

  describe('인증 결과 처리', () => {
    it('should_set_authenticated_true_when_auth_result_success', async () => {
      // Arrange
      const shareId = 'test-share-auth-success';

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });
      act(() => {
        mockWsInstance?.simulateMessage({
          type: MessageType.AUTH_RESULT,
          payload: {
            success: true,
            conversationId: 12345,
          },
        });
      });

      // Assert
      expect(useShareStore.getState().isAuthenticated).toBe(true);
    });

    it('should_set_conversationId_when_auth_result_success', async () => {
      // Arrange
      const shareId = 'test-share-conv-id';
      const conversationId = 98765;

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });
      act(() => {
        mockWsInstance?.simulateMessage({
          type: MessageType.AUTH_RESULT,
          payload: {
            success: true,
            conversationId,
          },
        });
      });

      // Assert
      expect(useShareStore.getState().conversationId).toBe(conversationId);
    });

    it('should_set_error_when_auth_result_failed', async () => {
      // Arrange
      const shareId = 'test-share-auth-fail';

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });
      act(() => {
        mockWsInstance?.simulateMessage({
          type: MessageType.AUTH_RESULT,
          payload: {
            success: false,
            error: 'Invalid share link',
          },
        });
      });

      // Assert
      expect(useShareStore.getState().error).toBe('Invalid share link');
      expect(useShareStore.getState().isAuthenticated).toBe(false);
    });

    it('should_send_share_history_request_when_auth_success', async () => {
      // Arrange
      const shareId = 'test-share-history';

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });
      act(() => {
        mockWsInstance?.simulateMessage({
          type: MessageType.AUTH_RESULT,
          payload: {
            success: true,
            conversationId: 11111,
          },
        });
      });

      // Assert - auth 메시지 이후 share_history 요청
      const calls = mockWsInstance?.send.mock.calls || [];
      expect(calls.length).toBeGreaterThan(1);

      const historyRequest = JSON.parse(calls[calls.length - 1][0]);
      expect(historyRequest.type).toBe('share_history');
      expect(historyRequest.payload.shareId).toBe(shareId);
    });
  });

  // ==========================================================================
  // 히스토리 수신
  // ==========================================================================

  describe('히스토리 수신', () => {
    it('should_set_messages_when_share_history_result_received', async () => {
      // Arrange
      const shareId = 'test-share-history-result';
      const messages = [
        { id: 'msg-1', role: 'user', type: 'text', content: 'Hello', timestamp: Date.now() },
        { id: 'msg-2', role: 'assistant', type: 'text', content: 'Hi there!', timestamp: Date.now() },
      ];

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });
      act(() => {
        mockWsInstance?.simulateMessage({
          type: 'share_history_result',
          payload: {
            shareId,
            messages,
          },
        });
      });

      // Assert
      const storeMessages = useShareStore.getState().messages;
      expect(storeMessages).toHaveLength(2);
      expect(storeMessages[0].id).toBe('msg-1');
      expect(storeMessages[1].id).toBe('msg-2');
    });

    it('should_set_empty_messages_when_no_history', async () => {
      // Arrange
      const shareId = 'test-share-empty-history';

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });
      act(() => {
        mockWsInstance?.simulateMessage({
          type: 'share_history_result',
          payload: {
            shareId,
            messages: [],
          },
        });
      });

      // Assert
      expect(useShareStore.getState().messages).toEqual([]);
    });
  });

  // ==========================================================================
  // 실시간 이벤트 수신
  // ==========================================================================

  describe('실시간 이벤트 수신', () => {
    it('should_add_message_when_claude_event_message_received', async () => {
      // Arrange
      const shareId = 'test-share-realtime';
      const conversationId = 22222;

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });
      // 인증 성공
      act(() => {
        mockWsInstance?.simulateMessage({
          type: MessageType.AUTH_RESULT,
          payload: { success: true, conversationId },
        });
      });
      // 히스토리 수신
      act(() => {
        mockWsInstance?.simulateMessage({
          type: 'share_history_result',
          payload: { shareId, messages: [] },
        });
      });
      // 실시간 메시지 수신
      act(() => {
        mockWsInstance?.simulateMessage({
          type: MessageType.CLAUDE_EVENT,
          payload: {
            conversationId,
            event: {
              type: 'message',
              message: {
                id: 'realtime-msg-1',
                role: 'assistant',
                type: 'text',
                content: 'New message!',
                timestamp: Date.now(),
              },
            },
          },
        });
      });

      // Assert
      const storeMessages = useShareStore.getState().messages;
      expect(storeMessages).toHaveLength(1);
      expect(storeMessages[0].id).toBe('realtime-msg-1');
    });

    it('should_not_add_message_when_conversationId_mismatch', async () => {
      // Arrange
      const shareId = 'test-share-mismatch';
      const conversationId = 33333;

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });
      act(() => {
        mockWsInstance?.simulateMessage({
          type: MessageType.AUTH_RESULT,
          payload: { success: true, conversationId },
        });
      });
      // 다른 conversationId로 메시지 수신
      act(() => {
        mockWsInstance?.simulateMessage({
          type: MessageType.CLAUDE_EVENT,
          payload: {
            conversationId: 99999, // 다른 ID
            event: {
              type: 'message',
              message: {
                id: 'wrong-conv-msg',
                role: 'assistant',
                type: 'text',
                content: 'Should not appear',
                timestamp: Date.now(),
              },
            },
          },
        });
      });

      // Assert
      expect(useShareStore.getState().messages).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 연결 해제
  // ==========================================================================

  describe('연결 해제', () => {
    it('should_close_websocket_when_unmounted', async () => {
      // Arrange
      const shareId = 'test-share-unmount';

      // Act
      const { unmount } = renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });

      // Unmount
      unmount();

      // Assert
      expect(mockWsInstance?.close).toHaveBeenCalled();
    });

    it('should_set_connected_false_when_websocket_closes', async () => {
      // Arrange
      const shareId = 'test-share-close';

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });
      act(() => {
        mockWsInstance?.simulateClose();
      });

      // Assert
      expect(useShareStore.getState().isConnected).toBe(false);
    });

    it('should_reset_authenticated_when_websocket_closes', async () => {
      // Arrange
      const shareId = 'test-share-close-auth';

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });
      act(() => {
        mockWsInstance?.simulateMessage({
          type: MessageType.AUTH_RESULT,
          payload: { success: true, conversationId: 44444 },
        });
      });
      act(() => {
        mockWsInstance?.simulateClose();
      });

      // Assert
      expect(useShareStore.getState().isAuthenticated).toBe(false);
    });
  });

  // ==========================================================================
  // 재연결
  // ==========================================================================

  describe('재연결', () => {
    it('should_attempt_reconnect_when_connection_lost', async () => {
      // Arrange
      const shareId = 'test-share-reconnect';

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });
      const firstInstance = mockWsInstance;

      // 연결 종료
      act(() => {
        mockWsInstance?.simulateClose(1006, 'Connection lost');
      });

      // 재연결 타이머 실행
      act(() => {
        vi.advanceTimersByTime(3000); // 재연결 대기 시간
      });

      // Assert
      expect(mockWsInstance).not.toBe(firstInstance);
      expect(mockWsInstance).not.toBeNull();
    });

    it('should_not_reconnect_when_intentionally_closed', async () => {
      // Arrange
      const shareId = 'test-share-no-reconnect';

      // Act
      const { unmount } = renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });
      const firstInstance = mockWsInstance;

      // 언마운트 (의도적 종료)
      unmount();

      // 재연결 타이머 실행 시도
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Assert - 재연결 없음 (첫 인스턴스가 마지막)
      // 새 인스턴스가 생성되지 않아야 함
      expect(mockWsInstance).toBe(firstInstance);
    });
  });

  // ==========================================================================
  // 에러 처리
  // ==========================================================================

  describe('에러 처리', () => {
    it('should_set_error_when_websocket_error_occurs', async () => {
      // Arrange
      const shareId = 'test-share-error';

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateError();
      });

      // Assert
      const error = useShareStore.getState().error;
      expect(error).not.toBeNull();
    });

    it('should_handle_invalid_json_message_gracefully', async () => {
      // Arrange
      const shareId = 'test-share-invalid-json';

      // Act & Assert - should not throw
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });

      expect(() => {
        act(() => {
          if (mockWsInstance?.onmessage) {
            mockWsInstance.onmessage(new MessageEvent('message', { data: 'invalid json' }));
          }
        });
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // shareId 변경
  // ==========================================================================

  describe('shareId 변경', () => {
    it('should_reconnect_when_shareId_changes', async () => {
      // Arrange
      const { rerender } = renderHook(
        ({ shareId }) => useShareConnection(shareId),
        { initialProps: { shareId: 'share-1' } }
      );

      act(() => {
        mockWsInstance?.simulateOpen();
      });
      const firstInstance = mockWsInstance;

      // Act - shareId 변경
      rerender({ shareId: 'share-2' });

      // Assert
      expect(firstInstance?.close).toHaveBeenCalled();
      expect(useShareStore.getState().shareId).toBe('share-2');
    });

    it('should_reset_store_when_shareId_changes', async () => {
      // Arrange
      const { rerender } = renderHook(
        ({ shareId }) => useShareConnection(shareId),
        { initialProps: { shareId: 'share-old' } }
      );

      act(() => {
        mockWsInstance?.simulateOpen();
      });
      act(() => {
        mockWsInstance?.simulateMessage({
          type: MessageType.AUTH_RESULT,
          payload: { success: true, conversationId: 55555 },
        });
      });

      // Act - shareId 변경
      rerender({ shareId: 'share-new' });

      // Assert - 이전 상태 초기화
      const state = useShareStore.getState();
      expect(state.conversationId).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.messages).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 엣지 케이스
  // ==========================================================================

  describe('엣지 케이스', () => {
    it('should_handle_undefined_shareId', () => {
      // Arrange & Act
      // @ts-expect-error - 의도적 undefined 테스트
      renderHook(() => useShareConnection(undefined));

      // Assert
      expect(mockWsInstance).toBeNull();
    });

    it('should_handle_null_shareId', () => {
      // Arrange & Act
      // @ts-expect-error - 의도적 null 테스트
      renderHook(() => useShareConnection(null));

      // Assert
      expect(mockWsInstance).toBeNull();
    });

    it('should_handle_rapid_mount_unmount', async () => {
      // Arrange
      const shareId = 'test-rapid';

      // Act - 빠르게 마운트/언마운트 반복
      const { unmount: unmount1 } = renderHook(() => useShareConnection(shareId));
      unmount1();

      const { unmount: unmount2 } = renderHook(() => useShareConnection(shareId));
      unmount2();

      const { unmount: unmount3 } = renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });

      // Assert - 에러 없이 동작
      expect(useShareStore.getState().isConnected).toBe(true);
      unmount3();
    });

    it('should_handle_message_before_auth_complete', async () => {
      // Arrange
      const shareId = 'test-early-message';

      // Act
      renderHook(() => useShareConnection(shareId));
      act(() => {
        mockWsInstance?.simulateOpen();
      });

      // 인증 완료 전에 메시지 수신 시도
      act(() => {
        mockWsInstance?.simulateMessage({
          type: MessageType.CLAUDE_EVENT,
          payload: {
            conversationId: 66666,
            event: {
              type: 'message',
              message: {
                id: 'early-msg',
                role: 'assistant',
                type: 'text',
                content: 'Too early',
                timestamp: Date.now(),
              },
            },
          },
        });
      });

      // Assert - 인증 전이므로 메시지 추가되지 않음
      expect(useShareStore.getState().messages).toHaveLength(0);
    });
  });
});
