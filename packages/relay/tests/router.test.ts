/**
 * @file router.test.ts
 * @description 라우팅 함수 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Client } from '../src/types.js';
import {
  routeToClient,
  routeToDevice,
  routeByTo,
  broadcastAll,
  broadcastToType,
  broadcastExceptType,
  routeByBroadcast,
  routeByDefault,
  routeMessage,
  hasConnectedDeviceType,
  hasAppClients,
} from '../src/router.js';

describe('router', () => {
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

  // 테스트용 클라이언트 맵
  let clients: Map<string, Client>;

  beforeEach(() => {
    clients = new Map([
      ['client-pylon-1', createClient(1, 'pylon', true)],
      ['client-pylon-2', createClient(2, 'pylon', true)],
      ['client-app-100', createClient(100, 'app', true)],
      ['client-app-101', createClient(101, 'app', true)],
      ['client-pending', createClient(null, null, false)],
    ]);
  });

  describe('routeToClient', () => {
    it('should route to authenticated client', () => {
      const result = routeToClient('client-pylon-1', clients);
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toEqual(['client-pylon-1']);
    });

    it('should fail for unauthenticated client', () => {
      const result = routeToClient('client-pending', clients);
      expect(result.success).toBe(false);
      expect(result.targetClientIds).toHaveLength(0);
    });

    it('should fail for non-existent client', () => {
      const result = routeToClient('non-existent', clients);
      expect(result.success).toBe(false);
      expect(result.targetClientIds).toHaveLength(0);
    });
  });

  describe('routeToDevice', () => {
    it('should route to device by deviceId', () => {
      const result = routeToDevice(1, null, clients);
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toEqual(['client-pylon-1']);
    });

    it('should route to device by deviceId and deviceType', () => {
      const result = routeToDevice(1, 'pylon', clients);
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toEqual(['client-pylon-1']);
    });

    it('should fail if deviceType does not match', () => {
      const result = routeToDevice(1, 'app', clients);
      expect(result.success).toBe(false);
    });

    it('should fail for non-existent deviceId', () => {
      const result = routeToDevice(999, null, clients);
      expect(result.success).toBe(false);
    });
  });

  describe('routeByTo', () => {
    it('should handle single deviceId', () => {
      const result = routeByTo(1, clients);
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toEqual(['client-pylon-1']);
    });

    it('should handle object with deviceId', () => {
      const result = routeByTo({ deviceId: 1 }, clients);
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toEqual(['client-pylon-1']);
    });

    it('should handle object with deviceId and deviceType', () => {
      const result = routeByTo({ deviceId: 100, deviceType: 'app' }, clients);
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toEqual(['client-app-100']);
    });

    it('should handle array of deviceIds', () => {
      const result = routeByTo([1, 100], clients);
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toHaveLength(2);
      expect(result.targetClientIds).toContain('client-pylon-1');
      expect(result.targetClientIds).toContain('client-app-100');
    });

    it('should handle mixed array', () => {
      const result = routeByTo([1, { deviceId: 100, deviceType: 'app' }], clients);
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toHaveLength(2);
    });

    it('should deduplicate targets', () => {
      const result = routeByTo([1, 1, { deviceId: 1 }], clients);
      expect(result.targetClientIds).toHaveLength(1);
    });
  });

  describe('broadcastAll', () => {
    it('should broadcast to all authenticated clients except sender', () => {
      const result = broadcastAll(clients, 'client-pylon-1');
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toHaveLength(3);
      expect(result.targetClientIds).not.toContain('client-pylon-1');
      expect(result.targetClientIds).not.toContain('client-pending');
    });

    it('should include all authenticated when no exclusion', () => {
      const result = broadcastAll(clients);
      expect(result.targetClientIds).toHaveLength(4);
    });
  });

  describe('broadcastToType', () => {
    it('should broadcast to pylon type only', () => {
      const result = broadcastToType('pylon', clients, 'client-app-100');
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toHaveLength(2);
      expect(result.targetClientIds).toContain('client-pylon-1');
      expect(result.targetClientIds).toContain('client-pylon-2');
    });

    it('should broadcast to app type only', () => {
      const result = broadcastToType('app', clients, 'client-pylon-1');
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toHaveLength(2);
      expect(result.targetClientIds).toContain('client-app-100');
      expect(result.targetClientIds).toContain('client-app-101');
    });
  });

  describe('broadcastExceptType', () => {
    it('should exclude pylon type', () => {
      const result = broadcastExceptType('pylon', clients, 'client-app-100');
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toHaveLength(1);
      expect(result.targetClientIds).toContain('client-app-101');
    });

    it('should exclude app type', () => {
      const result = broadcastExceptType('app', clients, 'client-pylon-1');
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toHaveLength(1);
      expect(result.targetClientIds).toContain('client-pylon-2');
    });
  });

  describe('routeByBroadcast', () => {
    it('should handle true as all', () => {
      const result = routeByBroadcast(true, clients, 'client-pylon-1');
      expect(result.targetClientIds).toHaveLength(3);
    });

    it('should handle "all"', () => {
      const result = routeByBroadcast('all', clients, 'client-pylon-1');
      expect(result.targetClientIds).toHaveLength(3);
    });

    it('should handle "pylons"', () => {
      const result = routeByBroadcast('pylons', clients, 'client-app-100');
      expect(result.targetClientIds).toHaveLength(2);
      expect(result.targetClientIds).toContain('client-pylon-1');
    });

    it('should handle "clients"', () => {
      const result = routeByBroadcast('clients', clients, 'client-pylon-1');
      expect(result.targetClientIds).toHaveLength(2);
      expect(result.targetClientIds).toContain('client-app-100');
    });
  });

  describe('routeByDefault', () => {
    it('should route pylon messages to apps', () => {
      const result = routeByDefault('pylon', clients, 'client-pylon-1');
      expect(result.targetClientIds).toHaveLength(2);
      expect(result.targetClientIds).toContain('client-app-100');
      expect(result.targetClientIds).toContain('client-app-101');
    });

    it('should route app messages to pylons', () => {
      const result = routeByDefault('app', clients, 'client-app-100');
      expect(result.targetClientIds).toHaveLength(2);
      expect(result.targetClientIds).toContain('client-pylon-1');
      expect(result.targetClientIds).toContain('client-pylon-2');
    });
  });

  describe('routeMessage', () => {
    it('should prioritize to field', () => {
      const result = routeMessage(
        { type: 'test', to: 1 },
        'client-app-100',
        'app',
        clients
      );
      expect(result.targetClientIds).toEqual(['client-pylon-1']);
    });

    it('should use broadcast if no to field', () => {
      const result = routeMessage(
        { type: 'test', broadcast: 'pylons' },
        'client-app-100',
        'app',
        clients
      );
      expect(result.targetClientIds).toHaveLength(2);
    });

    it('should use default routing if no to or broadcast', () => {
      const result = routeMessage(
        { type: 'test' },
        'client-app-100',
        'app',
        clients
      );
      // app -> pylons
      expect(result.targetClientIds).toHaveLength(2);
      expect(result.targetClientIds).toContain('client-pylon-1');
    });
  });

  describe('hasConnectedDeviceType', () => {
    it('should return true when type exists', () => {
      expect(hasConnectedDeviceType('pylon', clients)).toBe(true);
      expect(hasConnectedDeviceType('app', clients)).toBe(true);
    });

    it('should return false when type does not exist', () => {
      const pylonOnly = new Map([
        ['client-1', createClient(1, 'pylon', true)],
      ]);
      expect(hasConnectedDeviceType('app', pylonOnly)).toBe(false);
    });
  });

  describe('hasAppClients', () => {
    it('should return true when app clients exist', () => {
      expect(hasAppClients(clients)).toBe(true);
    });

    it('should return false when no app clients', () => {
      const pylonOnly = new Map([
        ['client-1', createClient(1, 'pylon', true)],
      ]);
      expect(hasAppClients(pylonOnly)).toBe(false);
    });
  });
});
