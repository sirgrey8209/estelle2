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
import { ClientIndexAllocator } from '../src/device-id-validation.js';

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
      ['client-app-0', createClient(0, 'app', true)],
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
        0,  // envId
        0,  // nextClientIndex
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
        0,  // envId
        0,  // nextClientIndex
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
        0,  // envId
        0,  // nextClientIndex
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
      const nextClientIndex = 0;

      const result = handleAuth(
        'client-1',
        client,
        { deviceType: 'app' },
        0,  // envId
        nextClientIndex,
        clients,
        testDevices
      );

      // allocate_client_index 액션이 있어야 함
      const allocateAction = result.actions.find(a => a.type === 'allocate_client_index');
      expect(allocateAction).toBeDefined();

      // deviceId가 nextClientIndex(0)으로 할당되어야 함
      const updateAction = result.actions.find(a => a.type === 'update_client');
      if (updateAction?.type === 'update_client') {
        expect(updateAction.updates.deviceId).toBe(0);
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
        0,  // envId
        0,  // nextClientIndex
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
        0,  // envId
        0,  // nextClientIndex
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
      const client = createClient(0, 'app', true);
      // to는 이제 숫자 배열만 허용
      const message: RelayMessage = { type: 'test', to: [1] };

      // handleRouting(clientId, client, message, envId, clients, devices)
      const result = handleRouting('client-app-0', client, message, 0, clients, testDevices);

      const broadcastAction = result.actions.find(a => a.type === 'broadcast');
      expect(broadcastAction).toBeDefined();
      if (broadcastAction?.type === 'broadcast') {
        expect(broadcastAction.clientIds).toContain('client-pylon-1');
        // from 정보가 주입되어야 함 - 인코딩된 deviceId 사용
        // envId=0, deviceType=app(1), deviceIndex=0 → 16
        expect(broadcastAction.message.from).toBeDefined();
        expect(broadcastAction.message.from?.deviceId).toBe(16); // 인코딩된 deviceId
      }
    });

    it('should not route for unauthenticated client', () => {
      const client = createClient(null, null, false);
      const message: RelayMessage = { type: 'test', broadcast: 'all' };

      // handleRouting(clientId, client, message, envId, clients, devices)
      const result = handleRouting('client-pending', client, message, 0, clients, testDevices);
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

      // handleMessage(clientId, client, data, envId, nextClientIndex, clients, devices)
      const result = handleMessage('client-1', client, data, 0, 0, clients, testDevices);

      const updateAction = result.actions.find(a => a.type === 'update_client');
      expect(updateAction).toBeDefined();
    });

    it('should reject unauthenticated client for non-auth messages', () => {
      const client = createClient(null, null, false);
      const data: RelayMessage = { type: 'get_devices' };

      const result = handleMessage('client-1', client, data, 0, 0, clients, testDevices);

      expect(result.actions).toHaveLength(1);
      if (result.actions[0].type === 'send') {
        expect(result.actions[0].message.type).toBe('error');
        expect((result.actions[0].message.payload as any).error).toContain('Not authenticated');
      }
    });

    it('should handle get_devices message', () => {
      const client = createClient(1, 'pylon', true);
      const data: RelayMessage = { type: 'get_devices' };

      const result = handleMessage('client-pylon-1', client, data, 0, 0, clients, testDevices);

      const sendAction = result.actions.find(a => a.type === 'send');
      if (sendAction?.type === 'send') {
        expect(sendAction.message.type).toBe('device_list');
      }
    });

    it('should handle ping message', () => {
      const client = createClient(1, 'pylon', true);
      const data: RelayMessage = { type: 'ping' };

      const result = handleMessage('client-pylon-1', client, data, 0, 0, clients, testDevices);

      const sendAction = result.actions.find(a => a.type === 'send');
      if (sendAction?.type === 'send') {
        expect(sendAction.message.type).toBe('pong');
      }
    });

    it('should route other messages with explicit routing', () => {
      const client = createClient(0, 'app', true);
      // 이제 to/broadcast가 없으면 라우팅 실패하므로 broadcast 추가
      const data: RelayMessage = { type: 'custom_event', payload: { data: 'test' }, broadcast: 'pylons' };

      const result = handleMessage('client-app-0', client, data, 0, 0, clients, testDevices);

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
      const client = createClient(0, 'app', true);
      // 클라이언트 제거 후 상태 시뮬레이션
      const remainingClients = new Map([
        ['client-pylon-1', createClient(1, 'pylon', true)],
      ]);

      const result = handleDisconnect('client-app-0', client, remainingClients);

      const disconnectNotification = result.actions.find(
        a => a.type === 'broadcast' && a.message.type === 'client_disconnect'
      );
      expect(disconnectNotification).toBeDefined();
    });

    it('should release clientIndex when app disconnects', () => {
      const client = createClient(0, 'app', true);
      // 모든 app 클라이언트 제거 후 상태
      const pylonOnly = new Map([
        ['client-pylon-1', createClient(1, 'pylon', true)],
      ]);

      const result = handleDisconnect('client-app-0', client, pylonOnly);

      const releaseAction = result.actions.find(a => a.type === 'release_client_index');
      expect(releaseAction).toBeDefined();
      if (releaseAction && 'deviceIndex' in releaseAction) {
        expect((releaseAction as any).deviceIndex).toBe(0);
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

// ============================================================================
// 새 체계 테스트 (ClientIndexAllocator 기반 마이그레이션)
// ============================================================================

import { ClientIndexAllocator } from '../src/device-id-validation.js';
import { isValidClientIndex } from '@estelle/core';

describe('[새 체계] handleAuth - ClientIndexAllocator 기반', () => {
  const testDevices: Record<number, DeviceConfig> = {
    1: { name: 'Office', icon: '🏢', role: 'office', allowedIps: ['*'] },
    2: { name: 'Home', icon: '🏠', role: 'home', allowedIps: ['192.168.1.100'] },
  };

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

  describe('App deviceId 할당 (allocator 기반)', () => {
    it('should_assign_deviceId_from_allocator_when_app_authenticates', () => {
      // Arrange
      const client = createClient(null, null, false);
      const allocator = new ClientIndexAllocator();
      const clients = new Map<string, Client>();

      // Act — handleAuth(clientId, client, payload, envId, nextClientIndex, clients, devices)
      const result = handleAuth(
        'client-1',
        client,
        { deviceType: 'app' },
        0,  // envId
        0,  // nextClientIndex (allocator가 0부터 시작)
        clients,
        testDevices
      );

      // Assert — 새 체계: deviceId가 0~15 범위여야 함
      const updateAction = result.actions.find(a => a.type === 'update_client');
      expect(updateAction).toBeDefined();
      if (updateAction?.type === 'update_client') {
        const assignedId = updateAction.updates.deviceId!;
        expect(isValidClientIndex(assignedId)).toBe(true);
      }

      // Assert — 새 체계: allocate_client_index 액션이 있어야 함 (increment_next_client_id 대신)
      const allocateAction = result.actions.find(a => a.type === 'allocate_client_index');
      expect(allocateAction).toBeDefined();
    });

    it('should_not_have_increment_next_client_id_action_when_app_authenticates', () => {
      // Arrange
      const client = createClient(null, null, false);
      const clients = new Map<string, Client>();

      // Act — handleAuth(clientId, client, payload, envId, nextClientIndex, clients, devices)
      const result = handleAuth(
        'client-1',
        client,
        { deviceType: 'app' },
        0,  // envId
        0,  // nextClientIndex
        clients,
        testDevices
      );

      // Assert — 새 체계: increment_next_client_id 액션이 없어야 함
      const incrementAction = result.actions.find(a => a.type === 'increment_next_client_id');
      expect(incrementAction).toBeUndefined();
    });

    it('should_assign_sequential_deviceIds_for_multiple_apps', () => {
      // Arrange
      const clients = new Map<string, Client>();

      // Act — 첫 번째 app
      // handleAuth(clientId, client, payload, envId, nextClientIndex, clients, devices)
      const client1 = createClient(null, null, false);
      const result1 = handleAuth('client-1', client1, { deviceType: 'app' }, 0, 0, clients, testDevices);
      const id1 = result1.actions.find(a => a.type === 'update_client');

      // Act — 두 번째 app (새 체계에서는 allocator가 자동으로 다음 번호 할당)
      const client2 = createClient(null, null, false);
      const result2 = handleAuth('client-2', client2, { deviceType: 'app' }, 0, 1, clients, testDevices);
      const id2 = result2.actions.find(a => a.type === 'update_client');

      // Assert — 둘 다 0~15 범위이고 서로 다름
      if (id1?.type === 'update_client' && id2?.type === 'update_client') {
        expect(isValidClientIndex(id1.updates.deviceId!)).toBe(true);
        expect(isValidClientIndex(id2.updates.deviceId!)).toBe(true);
        expect(id1.updates.deviceId).not.toBe(id2.updates.deviceId);
      }
    });
  });
});

describe('[새 체계] handleDisconnect - release_client_index 기반', () => {
  const testDevices: Record<number, DeviceConfig> = {
    1: { name: 'Office', icon: '🏢', role: 'office', allowedIps: ['*'] },
  };

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

  it('should_emit_release_client_index_when_app_disconnects', () => {
    // Arrange
    const client = createClient(3, 'app', true); // deviceIndex 3이 할당됨
    const remainingClients = new Map<string, Client>([
      ['client-pylon-1', createClient(1, 'pylon', true)],
    ]);

    // Act
    const result = handleDisconnect('client-app-3', client, remainingClients);

    // Assert — 새 체계: release_client_index 액션이 있어야 함
    const releaseAction = result.actions.find(a => a.type === 'release_client_index');
    expect(releaseAction).toBeDefined();
    if (releaseAction && 'deviceIndex' in releaseAction) {
      expect((releaseAction as any).deviceIndex).toBe(3);
    }
  });

  it('should_not_emit_reset_next_client_id_when_all_apps_disconnect', () => {
    // Arrange
    const client = createClient(0, 'app', true);
    const pylonOnly = new Map<string, Client>([
      ['client-pylon-1', createClient(1, 'pylon', true)],
    ]);

    // Act
    const result = handleDisconnect('client-app-0', client, pylonOnly);

    // Assert — 새 체계: reset_next_client_id 액션이 없어야 함
    // (allocator가 빈 번호 재활용하므로 리셋 불필요)
    const resetAction = result.actions.find(a => a.type === 'reset_next_client_id');
    expect(resetAction).toBeUndefined();
  });

  it('should_emit_release_client_index_even_with_remaining_apps', () => {
    // Arrange
    const client = createClient(1, 'app', true); // deviceIndex 1 해제
    const remainingClients = new Map<string, Client>([
      ['client-pylon-1', createClient(1, 'pylon', true)],
      ['client-app-0', createClient(0, 'app', true)], // 다른 app이 아직 있음
    ]);

    // Act
    const result = handleDisconnect('client-app-1', client, remainingClients);

    // Assert — 새 체계: 개별 release_client_index 액션이 있어야 함
    const releaseAction = result.actions.find(a => a.type === 'release_client_index');
    expect(releaseAction).toBeDefined();
    if (releaseAction && 'deviceIndex' in releaseAction) {
      expect((releaseAction as any).deviceIndex).toBe(1);
    }
  });

  it('should_not_emit_release_for_pylon_disconnect', () => {
    // Arrange
    const client = createClient(1, 'pylon', true);
    const remainingClients = new Map<string, Client>([
      ['client-app-0', createClient(0, 'app', true)],
    ]);

    // Act
    const result = handleDisconnect('client-pylon-1', client, remainingClients);

    // Assert — pylon 연결 해제 시 release_client_index가 없어야 함
    const releaseAction = result.actions.find(a => a.type === 'release_client_index');
    expect(releaseAction).toBeUndefined();
  });
});

describe('[새 체계] handleMessage - allocator 기반 시그니처', () => {
  const testDevices: Record<number, DeviceConfig> = {
    1: { name: 'Office', icon: '🏢', role: 'office', allowedIps: ['*'] },
  };

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

  it('should_assign_valid_client_index_when_auth_via_handleMessage', () => {
    // Arrange
    const client = createClient(null, null, false);
    const clients = new Map<string, Client>();
    const data: RelayMessage = {
      type: 'auth',
      payload: { deviceType: 'app' },
    };

    // Act - handleMessage(clientId, client, data, envId, nextClientIndex, clients, devices)
    const result = handleMessage('client-1', client, data, 0, 0, clients, testDevices);

    // Assert — 새 체계: 할당된 deviceId가 0~15 범위
    const updateAction = result.actions.find(a => a.type === 'update_client');
    expect(updateAction).toBeDefined();
    if (updateAction?.type === 'update_client') {
      expect(isValidClientIndex(updateAction.updates.deviceId!)).toBe(true);
    }

    // Assert — increment_next_client_id가 아닌 allocate_client_index
    const allocateAction = result.actions.find(a => a.type === 'allocate_client_index');
    expect(allocateAction).toBeDefined();
    const incrementAction = result.actions.find(a => a.type === 'increment_next_client_id');
    expect(incrementAction).toBeUndefined();
  });
});
