/**
 * LocalServer 모듈 테스트
 *
 * 테스트 항목:
 * - LocalServer 인스턴스 생성
 * - 콜백 등록 (onMessage, onConnect, setRelayStatusCallback)
 * - broadcast 메서드 동작
 * - sendRelayStatus 메서드 동작
 * - 클라이언트 관리
 *
 * 주의: 실제 WebSocket 서버 테스트는 통합 테스트에서 수행
 * 여기서는 순수 로직만 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LocalServer,
  createLocalServer,
  LocalServerOptions,
  LocalServerCallbacks,
} from '../../src/network/local-server.js';

describe('LocalServer', () => {
  describe('createLocalServer', () => {
    it('should create a LocalServer instance with port', () => {
      const server = createLocalServer({ port: 9000 });
      expect(server).toBeInstanceOf(LocalServer);
      expect(server.getPort()).toBe(9000);
    });

    it('should use default port 9000 if not specified', () => {
      const server = createLocalServer({});
      expect(server.getPort()).toBe(9000);
    });
  });

  describe('callbacks', () => {
    let server: LocalServer;

    beforeEach(() => {
      server = createLocalServer({ port: 9000 });
    });

    it('should register onMessage callback', () => {
      const callback = vi.fn();
      server.onMessage(callback);

      // 콜백이 등록되었는지 확인 (내부 테스트용 메서드 사용)
      expect(server.hasMessageCallback()).toBe(true);
    });

    it('should register onConnect callback', () => {
      const callback = vi.fn();
      server.onConnect(callback);

      expect(server.hasConnectCallback()).toBe(true);
    });

    it('should register relay status callback', () => {
      const callback = vi.fn(() => true);
      server.setRelayStatusCallback(callback);

      expect(server.getRelayStatus()).toBe(true);
    });

    it('should return false for relay status by default', () => {
      expect(server.getRelayStatus()).toBe(false);
    });
  });

  describe('client count', () => {
    let server: LocalServer;

    beforeEach(() => {
      server = createLocalServer({ port: 9000 });
    });

    it('should start with zero clients', () => {
      expect(server.getClientCount()).toBe(0);
    });
  });

  describe('broadcast filtering', () => {
    it('should not log relay_status and pong messages to packet logger', () => {
      // 이 동작은 실제 WebSocket 연결이 필요하므로
      // 통합 테스트에서 검증
      // 여기서는 메서드 존재 여부만 확인
      const server = createLocalServer({ port: 9000 });
      expect(typeof server.broadcast).toBe('function');
      expect(typeof server.sendRelayStatus).toBe('function');
    });
  });

  describe('server lifecycle', () => {
    it('should have start and stop methods', () => {
      const server = createLocalServer({ port: 9000 });
      expect(typeof server.start).toBe('function');
      expect(typeof server.stop).toBe('function');
    });

    it('should report not running before start', () => {
      const server = createLocalServer({ port: 9000 });
      expect(server.isRunning()).toBe(false);
    });
  });

  describe('options validation', () => {
    it('should accept logger and packetLogger options', () => {
      const mockLogger = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const mockPacketLogger = {
        logRecv: vi.fn(),
        logSend: vi.fn(),
      };

      const server = createLocalServer({
        port: 9000,
        logger: mockLogger as any,
        packetLogger: mockPacketLogger as any,
      });

      expect(server).toBeInstanceOf(LocalServer);
    });
  });

  describe('message handling types', () => {
    it('should define correct callback types', () => {
      const server = createLocalServer({ port: 9000 });

      // 메시지 콜백 타입 확인
      const messageCallback = (data: unknown, ws: unknown) => {};
      server.onMessage(messageCallback);

      // 연결 콜백 타입 확인
      const connectCallback = (ws: unknown) => {};
      server.onConnect(connectCallback);

      // 릴레이 상태 콜백 타입 확인
      const relayCallback = () => true;
      server.setRelayStatusCallback(relayCallback);

      expect(server.hasMessageCallback()).toBe(true);
      expect(server.hasConnectCallback()).toBe(true);
    });
  });
});

describe('LocalServerCallbacks interface', () => {
  it('should allow creating callbacks object', () => {
    const callbacks: LocalServerCallbacks = {
      onMessage: (data, ws) => {
        console.log('message received');
      },
      onConnect: (ws) => {
        console.log('client connected');
      },
      getRelayStatus: () => true,
    };

    expect(callbacks.onMessage).toBeDefined();
    expect(callbacks.onConnect).toBeDefined();
    expect(callbacks.getRelayStatus).toBeDefined();
  });

  it('should allow partial callbacks', () => {
    const callbacks: Partial<LocalServerCallbacks> = {
      onMessage: (data, ws) => {},
    };

    expect(callbacks.onMessage).toBeDefined();
    expect(callbacks.onConnect).toBeUndefined();
  });
});
