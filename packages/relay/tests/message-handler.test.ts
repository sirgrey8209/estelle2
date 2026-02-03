/**
 * @file message-handler.test.ts
 * @description 메시지 핸들러 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Client, DeviceConfig, RelayMessage } from '../src/types.js';
import {
  handleAuth,
  handleGetDevices,
  handlePing,
  handleRouting,
  handleMessage,
  handleDisconnect,
  handleConnection,
} from '../src/message-handler.js';
import { DYNAMIC_DEVICE_ID_START } from '../src/constants.js';

describe('message-handler', () => {
  // 테스트용 디바이스 설정
  const testDevices: Record<number, DeviceConfig> = {
    1: { name: 'Office', icon: '🏢', role: 'office', allowedIps: ['*'] },
    2: { name: 'Home', icon: '🏠', role: 'home', allowedIps: ['192.168.1.100'] },
  };

  // 테스트용 클라이언트 생성 헬퍼
  function createClient(
    deviceId: number | null,
    deviceType: 'pylon' | 'app' | null,
    authenticated: boolean
  ): Client {
    return {
      deviceId,
      deviceType,
      ip: '192.168.1.100',
      connectedAt: new Date(),
      authenticated,
    };
  }

  let clients: Map<string, Client>;

  beforeEach(() => {
    clients = new Map([
      ['client-pylon-1', createClient(1, 'pylon', true)],
      ['client-app-100', createClient(100, 'app', true)],
      ['client-pending', createClient(null, null, false)],
    ]);
  });

  describe('handleAuth', () => {
    it('should reject missing deviceType', () => {
      const client = createClient(null, null, false);
      const result = handleAuth(
        'client-1',
        client,
        { deviceId: 1 } as any,
        100,
        clients,
        testDevices
      );

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('send');
      if (result.actions[0].type === 'send') {
        expect(result.actions[0].message.type).toBe('auth_result');
        expect((result.actions[0].message.payload as any).success).toBe(false);
        expect((result.actions[0].message.payload as any).error).toContain('deviceType');
      }
    });

    it('should reject pylon without deviceId', () => {
      const client = createClient(null, null, false);
      const result = handleAuth(
        'client-1',
        client,
        { deviceType: 'pylon' },
        100,
        clients,
        testDevices
      );

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0];
      if (action.type === 'send') {
        expect((action.message.payload as any).success).toBe(false);
        expect((action.message.payload as any).error).toContain('Missing deviceId');
      }
    });

    it('should authenticate pylon with valid deviceId', () => {
      const client = createClient(null, null, false);
      client.ip = '192.168.1.100';

      const result = handleAuth(
        'client-1',
        client,
        { deviceId: 1, deviceType: 'pylon' },
        100,
        clients,
        testDevices
      );

      // update_client + send (auth_result) + broadcast (device_status)
      const updateAction = result.actions.find(a => a.type === 'update_client');
      expect(updateAction).toBeDefined();
      if (updateAction?.type === 'update_client') {
        expect(updateAction.updates.deviceId).toBe(1);
        expect(updateAction.updates.deviceType).toBe('pylon');
        expect(updateAction.updates.authenticated).toBe(true);
      }

      const sendAction = result.actions.find(a => a.type === 'send');
      expect(sendAction).toBeDefined();
      if (sendAction?.type === 'send') {
        expect((sendAction.message.payload as any).success).toBe(true);
        expect((sendAction.message.payload as any).device.deviceId).toBe(1);
      }
    });

    it('should auto-assign deviceId for app', () => {
      const client = createClient(null, null, false);
      const nextClientId = 100;

      const result = handleAuth(
        'client-1',
        client,
        { deviceType: 'app' },
        nextClientId,
        clients,
        testDevices
      );

      // increment_next_client_id 액션이 있어야 함
      const incrementAction = result.actions.find(a => a.type === 'increment_next_client_id');
      expect(incrementAction).toBeDefined();

      // deviceId가 nextClientId(100)으로 할당되어야 함
      const updateAction = result.actions.find(a => a.type === 'update_client');
      if (updateAction?.type === 'update_client') {
        expect(updateAction.updates.deviceId).toBe(100);
        expect(updateAction.updates.deviceType).toBe('app');
      }
    });

    it('should reject pylon with IP not allowed', () => {
      const client = createClient(null, null, false);
      client.ip = '10.0.0.1'; // Not in allowedIps for device 2

      const result = handleAuth(
        'client-1',
        client,
        { deviceId: 2, deviceType: 'pylon' },
        100,
        clients,
        testDevices
      );

      const sendAction = result.actions.find(a => a.type === 'send');
      if (sendAction?.type === 'send') {
        expect((sendAction.message.payload as any).success).toBe(false);
        expect((sendAction.message.payload as any).error).toContain('IP not allowed');
      }
    });

    it('should parse string deviceId', () => {
      const client = createClient(null, null, false);

      const result = handleAuth(
        'client-1',
        client,
        { deviceId: '1', deviceType: 'pylon' },
        100,
        clients,
        testDevices
      );

      const updateAction = result.actions.find(a => a.type === 'update_client');
      if (updateAction?.type === 'update_client') {
        expect(updateAction.updates.deviceId).toBe(1);
      }
    });
  });

  describe('handleGetDevices', () => {
    it('should return device list', () => {
      const result = handleGetDevices('client-1', clients, testDevices);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('send');
      if (result.actions[0].type === 'send') {
        expect(result.actions[0].message.type).toBe('device_list');
        const payload = result.actions[0].message.payload as any;
        expect(payload.devices).toBeInstanceOf(Array);
        expect(payload.devices.length).toBe(2); // 2 authenticated clients
      }
    });
  });

  describe('handlePing', () => {
    it('should respond with pong', () => {
      const result = handlePing('client-1');

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('send');
      if (result.actions[0].type === 'send') {
        expect(result.actions[0].message.type).toBe('pong');
      }
    });
  });

  describe('handleRouting', () => {
    it('should route message with to field', () => {
      const client = createClient(100, 'app', true);
      const message: RelayMessage = { type: 'test', to: 1 };

      const result = handleRouting('client-app-100', client, message, clients, testDevices);

      const broadcastAction = result.actions.find(a => a.type === 'broadcast');
      expect(broadcastAction).toBeDefined();
      if (broadcastAction?.type === 'broadcast') {
        expect(broadcastAction.clientIds).toContain('client-pylon-1');
        // from 정보가 주입되어야 함
        expect(broadcastAction.message.from).toBeDefined();
        expect(broadcastAction.message.from?.deviceId).toBe(100);
      }
    });

    it('should not route for unauthenticated client', () => {
      const client = createClient(null, null, false);
      const message: RelayMessage = { type: 'test', broadcast: 'all' };

      const result = handleRouting('client-pending', client, message, clients, testDevices);
      expect(result.actions).toHaveLength(0);
    });
  });

  describe('handleMessage', () => {
    it('should route auth message to handleAuth', () => {
      const client = createClient(null, null, false);
      const data: RelayMessage = {
        type: 'auth',
        payload: { deviceType: 'app' },
      };

      const result = handleMessage('client-1', client, data, 100, clients, testDevices);

      const updateAction = result.actions.find(a => a.type === 'update_client');
      expect(updateAction).toBeDefined();
    });

    it('should reject unauthenticated client for non-auth messages', () => {
      const client = createClient(null, null, false);
      const data: RelayMessage = { type: 'get_devices' };

      const result = handleMessage('client-1', client, data, 100, clients, testDevices);

      expect(result.actions).toHaveLength(1);
      if (result.actions[0].type === 'send') {
        expect(result.actions[0].message.type).toBe('error');
        expect((result.actions[0].message.payload as any).error).toContain('Not authenticated');
      }
    });

    it('should handle get_devices message', () => {
      const client = createClient(1, 'pylon', true);
      const data: RelayMessage = { type: 'get_devices' };

      const result = handleMessage('client-pylon-1', client, data, 100, clients, testDevices);

      const sendAction = result.actions.find(a => a.type === 'send');
      if (sendAction?.type === 'send') {
        expect(sendAction.message.type).toBe('device_list');
      }
    });

    it('should handle ping message', () => {
      const client = createClient(1, 'pylon', true);
      const data: RelayMessage = { type: 'ping' };

      const result = handleMessage('client-pylon-1', client, data, 100, clients, testDevices);

      const sendAction = result.actions.find(a => a.type === 'send');
      if (sendAction?.type === 'send') {
        expect(sendAction.message.type).toBe('pong');
      }
    });

    it('should route other messages', () => {
      const client = createClient(100, 'app', true);
      const data: RelayMessage = { type: 'custom_event', payload: { data: 'test' } };

      const result = handleMessage('client-app-100', client, data, 101, clients, testDevices);

      const broadcastAction = result.actions.find(a => a.type === 'broadcast');
      expect(broadcastAction).toBeDefined();
    });
  });

  describe('handleDisconnect', () => {
    it('should do nothing for unauthenticated client', () => {
      const client = createClient(null, null, false);
      const result = handleDisconnect('client-1', client, clients);
      expect(result.actions).toHaveLength(0);
    });

    it('should broadcast device_status for authenticated client', () => {
      const client = createClient(1, 'pylon', true);
      const result = handleDisconnect('client-pylon-1', client, clients);

      const broadcastAction = result.actions.find(
        a => a.type === 'broadcast' && a.message.type === 'device_status'
      );
      expect(broadcastAction).toBeDefined();
    });

    it('should notify pylons when app disconnects', () => {
      const client = createClient(100, 'app', true);
      // 클라이언트 제거 후 상태 시뮬레이션
      const remainingClients = new Map([
        ['client-pylon-1', createClient(1, 'pylon', true)],
      ]);

      const result = handleDisconnect('client-app-100', client, remainingClients);

      const disconnectNotification = result.actions.find(
        a => a.type === 'broadcast' && a.message.type === 'client_disconnect'
      );
      expect(disconnectNotification).toBeDefined();
    });

    it('should reset nextClientId when all apps disconnect', () => {
      const client = createClient(100, 'app', true);
      // 모든 app 클라이언트 제거 후 상태
      const pylonOnly = new Map([
        ['client-pylon-1', createClient(1, 'pylon', true)],
      ]);

      const result = handleDisconnect('client-app-100', client, pylonOnly);

      const resetAction = result.actions.find(a => a.type === 'reset_next_client_id');
      expect(resetAction).toBeDefined();
      if (resetAction?.type === 'reset_next_client_id') {
        expect(resetAction.value).toBe(DYNAMIC_DEVICE_ID_START);
      }
    });
  });

  describe('handleConnection', () => {
    it('should send connected message', () => {
      const result = handleConnection('client-new');

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('send');
      if (result.actions[0].type === 'send') {
        expect(result.actions[0].clientId).toBe('client-new');
        expect(result.actions[0].message.type).toBe('connected');
        const payload = result.actions[0].message.payload as any;
        expect(payload.clientId).toBe('client-new');
        expect(payload.message).toContain('Estelle Relay');
      }
    });
  });
});
