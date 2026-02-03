/**
 * @file mock-websocket-adapter.test.ts
 * @description MockWebSocketAdapter 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockWebSocketAdapter } from '../../src/network/mock-websocket-adapter.js';

describe('MockWebSocketAdapter', () => {
  let adapter: MockWebSocketAdapter;

  beforeEach(() => {
    adapter = new MockWebSocketAdapter();
  });

  describe('연결', () => {
    it('초기 상태는 연결되지 않음', () => {
      expect(adapter.isConnected).toBe(false);
    });

    it('connect() 호출 시 연결됨', async () => {
      adapter.connect();
      expect(adapter.isConnected).toBe(true);
    });

    it('connect() 호출 시 onOpen 콜백 호출', async () => {
      const onOpen = vi.fn();
      adapter.onOpen = onOpen;

      adapter.connect();

      // queueMicrotask 대기
      await Promise.resolve();

      expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('disconnect() 호출 시 연결 해제', async () => {
      adapter.connect();
      adapter.disconnect();

      expect(adapter.isConnected).toBe(false);
    });

    it('disconnect() 호출 시 onClose 콜백 호출', async () => {
      const onClose = vi.fn();
      adapter.onClose = onClose;

      adapter.connect();
      adapter.disconnect();

      await Promise.resolve();

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('메시지 송수신', () => {
    it('연결되지 않은 상태에서 send() 호출 시 에러', () => {
      expect(() => adapter.send('test')).toThrow('Not connected');
    });

    it('simulateMessage()로 메시지 수신 시뮬레이션', async () => {
      const onMessage = vi.fn();
      adapter.onMessage = onMessage;

      adapter.simulateMessage('{"type": "test"}');

      await Promise.resolve();

      expect(onMessage).toHaveBeenCalledWith('{"type": "test"}');
    });

    it('simulateError()로 에러 시뮬레이션', async () => {
      const onError = vi.fn();
      adapter.onError = onError;

      const error = new Error('Test error');
      adapter.simulateError(error);

      await Promise.resolve();

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('simulateClose()로 연결 종료 시뮬레이션', async () => {
      const onClose = vi.fn();
      adapter.onClose = onClose;
      adapter.connect();

      adapter.simulateClose();

      await Promise.resolve();

      expect(adapter.isConnected).toBe(false);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('링크 (양방향 통신)', () => {
    it('link()로 두 어댑터 연결', async () => {
      const adapter1 = new MockWebSocketAdapter();
      const adapter2 = new MockWebSocketAdapter();

      const onMessage1 = vi.fn();
      const onMessage2 = vi.fn();
      adapter1.onMessage = onMessage1;
      adapter2.onMessage = onMessage2;

      MockWebSocketAdapter.link(adapter1, adapter2);

      adapter1.connect();
      adapter2.connect();

      // adapter1 → adapter2
      adapter1.send('hello from 1');
      await Promise.resolve();
      expect(onMessage2).toHaveBeenCalledWith('hello from 1');

      // adapter2 → adapter1
      adapter2.send('hello from 2');
      await Promise.resolve();
      expect(onMessage1).toHaveBeenCalledWith('hello from 2');
    });

    it('unlink()로 링크 해제', async () => {
      const adapter1 = new MockWebSocketAdapter();
      const adapter2 = new MockWebSocketAdapter();

      const onMessage2 = vi.fn();
      adapter2.onMessage = onMessage2;

      MockWebSocketAdapter.link(adapter1, adapter2);
      adapter1.connect();
      adapter2.connect();

      adapter1.unlink();

      // 링크 해제 후 send해도 onMessage 호출되지 않음
      adapter1.send('hello');
      await Promise.resolve();
      expect(onMessage2).not.toHaveBeenCalled();
    });
  });

  describe('Client ↔ Server 시뮬레이션', () => {
    it('Client에서 메시지 전송 → Server에서 수신 → Server 응답 → Client 수신', async () => {
      const clientAdapter = new MockWebSocketAdapter();
      const serverAdapter = new MockWebSocketAdapter();

      const clientReceived: string[] = [];
      const serverReceived: string[] = [];

      clientAdapter.onMessage = (data) => clientReceived.push(data);
      serverAdapter.onMessage = (data) => {
        serverReceived.push(data);
        // 서버가 응답
        serverAdapter.send(`echo: ${data}`);
      };

      MockWebSocketAdapter.link(clientAdapter, serverAdapter);
      clientAdapter.connect();
      serverAdapter.connect();

      // Client → Server
      clientAdapter.send('ping');
      await Promise.resolve();
      await Promise.resolve(); // 서버 응답까지 대기

      expect(serverReceived).toEqual(['ping']);
      expect(clientReceived).toEqual(['echo: ping']);
    });
  });
});
