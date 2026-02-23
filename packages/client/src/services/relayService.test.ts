import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RelayService, RelayConfig } from './relayService';
import type { WebSocketAdapter } from '@estelle/core';

// Mock WebSocket 어댑터
class MockWebSocketAdapter implements WebSocketAdapter {
  onOpen: (() => void) | null = null;
  onClose: (() => void) | null = null;
  onMessage: ((data: string) => void) | null = null;
  onError: ((error: Error) => void) | null = null;

  private _isConnected = false;
  sentMessages: string[] = [];

  connect(): void {
    this._isConnected = true;
    setTimeout(() => this.onOpen?.(), 0);
  }

  disconnect(): void {
    this._isConnected = false;
    setTimeout(() => this.onClose?.(), 0);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  // 테스트 헬퍼
  simulateMessage(data: string): void {
    this.onMessage?.(data);
  }

  simulateError(error: Error): void {
    this.onError?.(error);
  }
}

describe('RelayService', () => {
  let service: RelayService;
  let mockAdapter: MockWebSocketAdapter;

  const config: RelayConfig = {
    url: 'ws://localhost:8080',
    authToken: 'test-token',
    deviceType: 'app',
  };

  beforeEach(() => {
    mockAdapter = new MockWebSocketAdapter();
    service = new RelayService(config, () => mockAdapter);
  });

  describe('연결', () => {
    it('should connect to relay', async () => {
      const onConnect = vi.fn();
      service.on('connected', onConnect);

      service.connect();

      await new Promise((r) => setTimeout(r, 10));
      expect(onConnect).toHaveBeenCalled();
    });

    it('should send auth message on connect', async () => {
      service.connect();

      await new Promise((r) => setTimeout(r, 10));

      expect(mockAdapter.sentMessages).toHaveLength(1);
      const authMessage = JSON.parse(mockAdapter.sentMessages[0]);
      expect(authMessage.type).toBe('auth');
      expect(authMessage.payload.token).toBe('test-token');
    });
  });

  describe('연결 해제', () => {
    it('should disconnect from relay', async () => {
      const onDisconnect = vi.fn();
      service.on('disconnected', onDisconnect);

      service.connect();
      await new Promise((r) => setTimeout(r, 10));

      service.disconnect();
      await new Promise((r) => setTimeout(r, 10));

      expect(onDisconnect).toHaveBeenCalled();
    });
  });

  describe('메시지 수신', () => {
    it('should emit message event on receive', async () => {
      const onMessage = vi.fn();
      service.on('message', onMessage);

      service.connect();
      await new Promise((r) => setTimeout(r, 10));

      mockAdapter.simulateMessage(
        JSON.stringify({
          type: 'desk_list_result',
          payload: { desks: [] },
        })
      );

      expect(onMessage).toHaveBeenCalledWith({
        type: 'desk_list_result',
        payload: { desks: [] },
      });
    });

    it('should handle auth_result message', async () => {
      const onAuthenticated = vi.fn();
      service.on('authenticated', onAuthenticated);

      service.connect();
      await new Promise((r) => setTimeout(r, 10));

      // Relay는 payload.device.deviceId로 인코딩된 deviceId를 전송
      mockAdapter.simulateMessage(
        JSON.stringify({
          type: 'auth_result',
          payload: { success: true, device: { deviceId: 123 } },
        })
      );

      // deviceId는 숫자로 오므로 문자열로 변환되어 emit됨
      expect(onAuthenticated).toHaveBeenCalledWith('123');
    });
  });

  describe('메시지 전송', () => {
    it('should send message', async () => {
      service.connect();
      await new Promise((r) => setTimeout(r, 10));

      service.send({
        type: 'desk_list',
        payload: {},
      });

      expect(mockAdapter.sentMessages).toHaveLength(2); // auth + desk_list
      const lastMessage = JSON.parse(mockAdapter.sentMessages[1]);
      expect(lastMessage.type).toBe('desk_list');
    });

    it('should throw if not connected', () => {
      expect(() =>
        service.send({
          type: 'desk_list',
          payload: {},
        })
      ).toThrow('Not connected');
    });
  });

  describe('Claude 메시지', () => {
    it('should send claude message', async () => {
      service.connect();
      await new Promise((r) => setTimeout(r, 10));

      service.sendClaude(1001, 'Hello Claude');

      const lastMessage = JSON.parse(mockAdapter.sentMessages[1]);
      expect(lastMessage.type).toBe('claude_send');
      expect(lastMessage.payload.conversationId).toBe(1001);
      expect(lastMessage.payload.content).toBe('Hello Claude');
    });

    it('should send claude control', async () => {
      service.connect();
      await new Promise((r) => setTimeout(r, 10));

      service.sendClaudeControl(1001, 'stop');

      const lastMessage = JSON.parse(mockAdapter.sentMessages[1]);
      expect(lastMessage.type).toBe('claude_control');
      expect(lastMessage.payload.action).toBe('stop');
    });
  });

  describe('Google Auth - idToken', () => {
    it('should_include_idToken_in_auth_message_when_provided', async () => {
      // Arrange - idToken을 포함한 config
      const configWithIdToken: RelayConfig = {
        url: 'ws://localhost:8080',
        authToken: 'test-token',
        deviceType: 'app',
        idToken: 'google-id-token-12345',
      };
      const adapter = new MockWebSocketAdapter();
      const serviceWithIdToken = new RelayService(configWithIdToken, () => adapter);

      // Act
      serviceWithIdToken.connect();
      await new Promise((r) => setTimeout(r, 10));

      // Assert
      expect(adapter.sentMessages).toHaveLength(1);
      const authMessage = JSON.parse(adapter.sentMessages[0]);
      expect(authMessage.type).toBe('auth');
      expect(authMessage.payload.idToken).toBe('google-id-token-12345');
    });

    it('should_not_include_idToken_when_not_provided', async () => {
      // Arrange - idToken 없는 config (기존 config)
      service.connect();
      await new Promise((r) => setTimeout(r, 10));

      // Assert
      const authMessage = JSON.parse(mockAdapter.sentMessages[0]);
      expect(authMessage.type).toBe('auth');
      expect(authMessage.payload.idToken).toBeUndefined();
    });

    it('should_update_idToken_via_setIdToken_method', async () => {
      // Arrange
      service.connect();
      await new Promise((r) => setTimeout(r, 10));

      // Act - idToken 업데이트 후 재인증
      service.setIdToken('new-google-id-token');
      service.sendAuth();

      // Assert - 마지막 auth 메시지에 idToken 포함
      const lastAuthMessage = JSON.parse(
        mockAdapter.sentMessages[mockAdapter.sentMessages.length - 1]
      );
      expect(lastAuthMessage.type).toBe('auth');
      expect(lastAuthMessage.payload.idToken).toBe('new-google-id-token');
    });

    it('should_clear_idToken_when_set_to_null', async () => {
      // Arrange - idToken으로 시작
      const configWithIdToken: RelayConfig = {
        url: 'ws://localhost:8080',
        authToken: 'test-token',
        deviceType: 'app',
        idToken: 'initial-token',
      };
      const adapter = new MockWebSocketAdapter();
      const serviceWithIdToken = new RelayService(configWithIdToken, () => adapter);

      serviceWithIdToken.connect();
      await new Promise((r) => setTimeout(r, 10));

      // Act - idToken 제거
      serviceWithIdToken.setIdToken(null);
      serviceWithIdToken.sendAuth();

      // Assert - idToken이 없어야 함
      const lastAuthMessage = JSON.parse(
        adapter.sentMessages[adapter.sentMessages.length - 1]
      );
      expect(lastAuthMessage.payload.idToken).toBeUndefined();
    });
  });
});
