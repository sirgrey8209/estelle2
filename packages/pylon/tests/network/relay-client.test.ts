/**
 * RelayClient 모듈 테스트
 *
 * 테스트 항목:
 * - RelayClient 인스턴스 생성
 * - 연결 상태 관리
 * - 콜백 등록 (onMessage, onStatusChange)
 * - 메시지 전송 로직
 * - 재연결 설정
 *
 * 주의: 실제 WebSocket 연결 테스트는 통합 테스트에서 수행
 * 여기서는 순수 로직만 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Message, AuthPayload } from '@estelle/core';
import {
  RelayClient,
  createRelayClient,
  RelayClientOptions,
  RelayClientCallbacks,
} from '../../src/network/relay-client.js';

describe('RelayClient', () => {
  describe('createRelayClient', () => {
    // deviceId를 숫자로 전달 (기존 문자열 -> 숫자)
    it('should create a RelayClient instance with url and deviceId (number)', () => {
      const client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 1,
      });
      expect(client).toBeInstanceOf(RelayClient);
      expect(client.getUrl()).toBe('ws://localhost:8080');
      expect(client.getDeviceId()).toBe(1);
    });

    it('should accept custom reconnect interval', () => {
      const client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 1,
        reconnectInterval: 5000,
      });
      expect(client.getReconnectInterval()).toBe(5000);
    });

    it('should use default reconnect interval of 3000ms', () => {
      const client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 1,
      });
      expect(client.getReconnectInterval()).toBe(3000);
    });

    // 새 테스트: deviceName 옵션 지원
    it('should accept deviceName option', () => {
      const client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 1,
        deviceName: 'pylonHome',
      });
      expect(client).toBeInstanceOf(RelayClient);
      expect(client.getDeviceName()).toBe('pylonHome');
    });

    // 새 테스트: deviceName 없으면 undefined
    it('should return undefined for deviceName if not provided', () => {
      const client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 1,
      });
      expect(client.getDeviceName()).toBeUndefined();
    });
  });

  describe('connection status', () => {
    let client: RelayClient;

    beforeEach(() => {
      client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 1,
      });
    });

    it('should start as disconnected', () => {
      expect(client.getStatus()).toBe(false);
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('callbacks', () => {
    let client: RelayClient;

    beforeEach(() => {
      client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 1,
      });
    });

    it('should register onMessage callback', () => {
      const callback = vi.fn();
      client.onMessage(callback);

      expect(client.hasMessageCallback()).toBe(true);
    });

    it('should register onStatusChange callback', () => {
      const callback = vi.fn();
      client.onStatusChange(callback);

      expect(client.hasStatusChangeCallback()).toBe(true);
    });
  });

  describe('send method', () => {
    let client: RelayClient;

    beforeEach(() => {
      client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 1,
      });
    });

    it('should not throw when sending while disconnected', () => {
      // 연결 안 된 상태에서 전송 시도
      expect(() => {
        client.send({ type: 'test', data: 'hello' });
      }).not.toThrow();
    });

    it('should have send method', () => {
      expect(typeof client.send).toBe('function');
    });
  });

  describe('connect method', () => {
    it('should have connect method', () => {
      const client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 1,
      });
      expect(typeof client.connect).toBe('function');
    });
  });

  describe('disconnect method', () => {
    it('should have disconnect method', () => {
      const client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 1,
      });
      expect(typeof client.disconnect).toBe('function');
    });

    it('should allow disabling auto-reconnect on disconnect', () => {
      const client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 1,
      });

      // disconnect 호출 시 재연결 방지 옵션
      client.disconnect();
      expect(client.shouldReconnect()).toBe(false);
    });
  });

  describe('auth message', () => {
    it('should create auth message with Message<AuthPayload> format', () => {
      const client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 1,
      });

      // 인증 메시지 생성 - Message<AuthPayload> 형식
      const authMessage: Message<AuthPayload> = client.createIdentifyMessage();
      expect(authMessage).toEqual({
        type: 'auth',
        payload: {
          deviceId: 1,
          deviceType: 'pylon',
        },
        timestamp: expect.any(Number),
      });
    });

    // 새 테스트: deviceName이 있으면 name 필드 포함
    it('should include name in auth message when deviceName is provided', () => {
      const client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 1,
        deviceName: 'pylonOffice',
      });

      const authMessage: Message<AuthPayload> = client.createIdentifyMessage();
      expect(authMessage).toEqual({
        type: 'auth',
        payload: {
          deviceId: 1,
          deviceType: 'pylon',
          name: 'pylonOffice',
        },
        timestamp: expect.any(Number),
      });
    });

    // 새 테스트: deviceName이 없으면 name 필드 없음
    it('should not include name in auth message when deviceName is not provided', () => {
      const client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 2,
      });

      const authMessage: Message<AuthPayload> = client.createIdentifyMessage();
      expect(authMessage.payload).not.toHaveProperty('name');
    });
  });

  describe('options validation', () => {
    it('should accept logger option', () => {
      const mockLogger = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const client = createRelayClient({
        url: 'ws://localhost:8080',
        deviceId: 1,
        logger: mockLogger as any,
      });

      expect(client).toBeInstanceOf(RelayClient);
    });
  });
});

describe('RelayClientCallbacks interface', () => {
  it('should allow creating callbacks object', () => {
    const callbacks: RelayClientCallbacks = {
      onMessage: (data) => {
        console.log('message received', data);
      },
      onStatusChange: (isConnected) => {
        console.log('status changed', isConnected);
      },
    };

    expect(callbacks.onMessage).toBeDefined();
    expect(callbacks.onStatusChange).toBeDefined();
  });

  it('should allow partial callbacks', () => {
    const callbacks: Partial<RelayClientCallbacks> = {
      onMessage: (data) => {},
    };

    expect(callbacks.onMessage).toBeDefined();
    expect(callbacks.onStatusChange).toBeUndefined();
  });
});

describe('RelayClientOptions interface', () => {
  // deviceId를 숫자로 변경
  it('should require url and deviceId (number)', () => {
    const options: RelayClientOptions = {
      url: 'ws://localhost:8080',
      deviceId: 1,
    };

    expect(options.url).toBe('ws://localhost:8080');
    expect(options.deviceId).toBe(1);
  });

  it('should allow optional reconnectInterval', () => {
    const options: RelayClientOptions = {
      url: 'ws://localhost:8080',
      deviceId: 1,
      reconnectInterval: 5000,
    };

    expect(options.reconnectInterval).toBe(5000);
  });

  // 새 테스트: deviceName 옵션 지원
  it('should allow optional deviceName', () => {
    const options: RelayClientOptions = {
      url: 'ws://localhost:8080',
      deviceId: 1,
      deviceName: 'pylonHome',
    };

    expect(options.deviceName).toBe('pylonHome');
  });
});
