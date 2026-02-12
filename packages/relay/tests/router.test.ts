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
  // deviceId는 내부 deviceIndex (0~15)
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

  // 인코딩된 deviceId 생성 헬퍼
  // deviceId = (envId << 5) | (deviceType << 4) | deviceIndex
  // envId=2 (dev), deviceType: pylon=1, app=0
  function encodeDeviceId(deviceIndex: number, isPylon: boolean): number {
    const envId = 2; // dev
    const deviceTypeBit = isPylon ? 1 : 0;
    return (envId << 5) | (deviceTypeBit << 4) | deviceIndex;
  }

  // 테스트용 클라이언트 맵
  // 내부 deviceIndex 사용: pylon-1 = index 1, app-0 = index 0
  let clients: Map<string, Client>;

  // 인코딩된 deviceId
  let pylonDeviceId1: number;
  let pylonDeviceId2: number;
  let appDeviceId0: number;
  let appDeviceId1: number;

  beforeEach(() => {
    // 내부 deviceIndex 기준으로 클라이언트 생성
    clients = new Map([
      ['client-pylon-1', createClient(1, 'pylon', true)],  // deviceIndex=1
      ['client-pylon-2', createClient(2, 'pylon', true)],  // deviceIndex=2
      ['client-app-0', createClient(0, 'app', true)],      // deviceIndex=0
      ['client-app-1', createClient(1, 'app', true)],      // deviceIndex=1
      ['client-pending', createClient(null, null, false)],
    ]);

    // 인코딩된 deviceId 계산
    // pylon: envId=2, type=1 → (2 << 5) | (1 << 4) | index
    // app: envId=2, type=0 → (2 << 5) | (0 << 4) | index
    pylonDeviceId1 = encodeDeviceId(1, true);  // = 64 + 16 + 1 = 81
    pylonDeviceId2 = encodeDeviceId(2, true);  // = 64 + 16 + 2 = 82
    appDeviceId0 = encodeDeviceId(0, false);   // = 64 + 0 + 0 = 64
    appDeviceId1 = encodeDeviceId(1, false);   // = 64 + 0 + 1 = 65
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
    it('should route to device by encoded deviceId', () => {
      // 인코딩된 deviceId를 전달하면 내부 deviceIndex=1인 클라이언트에 라우팅
      const result = routeToDevice(pylonDeviceId1, null, clients);
      expect(result.success).toBe(true);
      // deviceIndex=1인 클라이언트: pylon-1, app-1
      expect(result.targetClientIds).toContain('client-pylon-1');
    });

    it('should route to device by encoded deviceId and deviceType', () => {
      const result = routeToDevice(pylonDeviceId1, 'pylon', clients);
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toEqual(['client-pylon-1']);
    });

    it('should fail if deviceType does not match', () => {
      // pylon deviceId로 app 타입 찾기 → 실패
      const result = routeToDevice(pylonDeviceId1, 'app', clients);
      // deviceIndex=1에 app 타입인 client-app-1이 있음
      expect(result.targetClientIds).toEqual(['client-app-1']);
    });

    it('should fail for non-existent deviceIndex', () => {
      // deviceIndex=15 (존재하지 않음)
      const nonExistentId = encodeDeviceId(15, true);
      const result = routeToDevice(nonExistentId, null, clients);
      expect(result.success).toBe(false);
    });
  });

  describe('routeByTo', () => {
    it('should handle array with single encoded deviceId', () => {
      // to는 무조건 숫자 배열 (새 스펙)
      const result = routeByTo([pylonDeviceId1], clients);
      expect(result.success).toBe(true);
      // deviceIndex=1에 pylon-1, app-1 둘 다 있음
      expect(result.targetClientIds).toContain('client-pylon-1');
    });

    it('should handle array of encoded deviceIds', () => {
      const result = routeByTo([pylonDeviceId1, appDeviceId0], clients);
      expect(result.success).toBe(true);
      // pylonDeviceId1 → deviceIndex=1 (pylon-1, app-1)
      // appDeviceId0 → deviceIndex=0 (app-0)
      expect(result.targetClientIds).toContain('client-pylon-1');
      expect(result.targetClientIds).toContain('client-app-0');
    });

    it('should deduplicate targets', () => {
      const result = routeByTo([pylonDeviceId1, pylonDeviceId1], clients);
      // 중복 제거됨
      const uniqueCount = new Set(result.targetClientIds).size;
      expect(result.targetClientIds.length).toBe(uniqueCount);
    });
  });

  describe('broadcastAll', () => {
    it('should broadcast to all authenticated clients except sender', () => {
      const result = broadcastAll(clients, 'client-pylon-1');
      expect(result.success).toBe(true);
      // 전체 4개 - sender 1개 = 3개
      expect(result.targetClientIds).toHaveLength(3);
      expect(result.targetClientIds).not.toContain('client-pylon-1');
      expect(result.targetClientIds).not.toContain('client-pending');
    });

    it('should include all authenticated when no exclusion', () => {
      const result = broadcastAll(clients);
      // pylon-1, pylon-2, app-0, app-1 = 4개
      expect(result.targetClientIds).toHaveLength(4);
    });
  });

  describe('broadcastToType', () => {
    it('should broadcast to pylon type only', () => {
      const result = broadcastToType('pylon', clients, 'client-app-0');
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toHaveLength(2);
      expect(result.targetClientIds).toContain('client-pylon-1');
      expect(result.targetClientIds).toContain('client-pylon-2');
    });

    it('should broadcast to app type only', () => {
      const result = broadcastToType('app', clients, 'client-pylon-1');
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toHaveLength(2);
      expect(result.targetClientIds).toContain('client-app-0');
      expect(result.targetClientIds).toContain('client-app-1');
    });
  });

  describe('broadcastExceptType', () => {
    it('should exclude pylon type', () => {
      const result = broadcastExceptType('pylon', clients, 'client-app-0');
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toHaveLength(1);
      expect(result.targetClientIds).toContain('client-app-1');
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
      const result = routeByBroadcast('pylons', clients, 'client-app-0');
      expect(result.targetClientIds).toHaveLength(2);
      expect(result.targetClientIds).toContain('client-pylon-1');
    });

    it('should handle "clients"', () => {
      const result = routeByBroadcast('clients', clients, 'client-pylon-1');
      expect(result.targetClientIds).toHaveLength(2);
      expect(result.targetClientIds).toContain('client-app-0');
    });
  });

  describe('routeByDefault', () => {
    it('should route pylon messages to apps', () => {
      const result = routeByDefault('pylon', clients, 'client-pylon-1');
      expect(result.targetClientIds).toHaveLength(2);
      expect(result.targetClientIds).toContain('client-app-0');
      expect(result.targetClientIds).toContain('client-app-1');
    });

    it('should route app messages to pylons', () => {
      const result = routeByDefault('app', clients, 'client-app-0');
      expect(result.targetClientIds).toHaveLength(2);
      expect(result.targetClientIds).toContain('client-pylon-1');
      expect(result.targetClientIds).toContain('client-pylon-2');
    });
  });

  describe('routeMessage', () => {
    it('should route by to field (array)', () => {
      const result = routeMessage(
        { type: 'test', to: [pylonDeviceId1] },
        'client-app-0',
        'app',
        clients
      );
      // pylonDeviceId1 → deviceIndex=1 → pylon-1, app-1
      expect(result.success).toBe(true);
      expect(result.targetClientIds).toContain('client-pylon-1');
    });

    it('should use broadcast if no to field', () => {
      const result = routeMessage(
        { type: 'test', broadcast: 'pylons' },
        'client-app-0',
        'app',
        clients
      );
      expect(result.targetClientIds).toHaveLength(2);
    });

    it('should fail if no to or broadcast (app)', () => {
      const result = routeMessage(
        { type: 'test' },
        'client-app-0',
        'app',
        clients
      );
      // 기본 라우팅 없음 - 실패해야 함
      expect(result.success).toBe(false);
      expect(result.targetClientIds).toHaveLength(0);
    });

    it('should fail if no to or broadcast (pylon)', () => {
      const result = routeMessage(
        { type: 'test' },
        'client-pylon-1',
        'pylon',
        clients
      );
      // 기본 라우팅 없음 - 실패해야 함
      expect(result.success).toBe(false);
      expect(result.targetClientIds).toHaveLength(0);
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
