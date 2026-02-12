/**
 * @file pylon-registry.test.ts
 * @description PylonRegistry 테스트
 *
 * pylonId -> PylonConnection 매핑을 관리하는 클래스 테스트.
 * Beacon에서 여러 Pylon의 MCP 연결 정보를 추적하고 조회한다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PylonRegistry,
  type PylonConnection,
  getEnvName,
  extractPylonId,
} from '../src/pylon-registry.js';

describe('PylonRegistry', () => {
  let registry: PylonRegistry;

  beforeEach(() => {
    registry = new PylonRegistry();
  });

  // ============================================================================
  // set / get 테스트
  // ============================================================================
  describe('set / get', () => {
    it('should store and retrieve pylon connection', () => {
      // Arrange
      const connection: PylonConnection = {
        pylonId: 65, // dev: (2 << 5) | 1 = 65
        mcpHost: '127.0.0.1',
        mcpPort: 9878,
      };

      // Act
      registry.set(65, connection);
      const result = registry.get(65);

      // Assert
      expect(result).toBeDefined();
      expect(result?.pylonId).toBe(65);
      expect(result?.mcpHost).toBe('127.0.0.1');
      expect(result?.mcpPort).toBe(9878);
    });

    it('should overwrite existing connection', () => {
      // Arrange
      const conn1: PylonConnection = { pylonId: 65, mcpHost: '127.0.0.1', mcpPort: 9878 };
      const conn2: PylonConnection = { pylonId: 65, mcpHost: '192.168.1.1', mcpPort: 9999 };

      // Act
      registry.set(65, conn1);
      registry.set(65, conn2);

      // Assert
      const result = registry.get(65);
      expect(result?.mcpHost).toBe('192.168.1.1');
      expect(result?.mcpPort).toBe(9999);
    });

    it('should store multiple pylon connections', () => {
      // Arrange - 3개 환경 (dev, stage, release)
      registry.set(65, { pylonId: 65, mcpHost: '127.0.0.1', mcpPort: 9878 }); // dev
      registry.set(33, { pylonId: 33, mcpHost: '127.0.0.1', mcpPort: 9877 }); // stage
      registry.set(1, { pylonId: 1, mcpHost: '127.0.0.1', mcpPort: 9876 }); // release

      // Assert
      expect(registry.get(65)?.mcpPort).toBe(9878);
      expect(registry.get(33)?.mcpPort).toBe(9877);
      expect(registry.get(1)?.mcpPort).toBe(9876);
      expect(registry.size).toBe(3);
    });

    it('should return undefined for non-existent pylonId', () => {
      // Act
      const result = registry.get(999);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  // ============================================================================
  // delete 테스트
  // ============================================================================
  describe('delete', () => {
    it('should remove pylon connection', () => {
      // Arrange
      registry.set(65, { pylonId: 65, mcpHost: '127.0.0.1', mcpPort: 9878 });

      // Act
      const deleted = registry.delete(65);

      // Assert
      expect(deleted).toBe(true);
      expect(registry.get(65)).toBeUndefined();
      expect(registry.size).toBe(0);
    });

    it('should return false when pylonId not found', () => {
      // Act
      const deleted = registry.delete(999);

      // Assert
      expect(deleted).toBe(false);
    });
  });

  // ============================================================================
  // has 테스트
  // ============================================================================
  describe('has', () => {
    it('should return true when pylonId exists', () => {
      // Arrange
      registry.set(65, { pylonId: 65, mcpHost: '127.0.0.1', mcpPort: 9878 });

      // Assert
      expect(registry.has(65)).toBe(true);
    });

    it('should return false when pylonId not found', () => {
      // Assert
      expect(registry.has(999)).toBe(false);
    });
  });

  // ============================================================================
  // getAll 테스트
  // ============================================================================
  describe('getAll', () => {
    it('should return all connections', () => {
      // Arrange
      registry.set(65, { pylonId: 65, mcpHost: '127.0.0.1', mcpPort: 9878 });
      registry.set(33, { pylonId: 33, mcpHost: '127.0.0.1', mcpPort: 9877 });

      // Act
      const all = registry.getAll();

      // Assert
      expect(all).toHaveLength(2);
      expect(all.map((c) => c.pylonId).sort()).toEqual([33, 65]);
    });

    it('should return empty array when no connections', () => {
      // Assert
      expect(registry.getAll()).toEqual([]);
    });
  });

  // ============================================================================
  // clear 테스트
  // ============================================================================
  describe('clear', () => {
    it('should remove all connections', () => {
      // Arrange
      registry.set(65, { pylonId: 65, mcpHost: '127.0.0.1', mcpPort: 9878 });
      registry.set(33, { pylonId: 33, mcpHost: '127.0.0.1', mcpPort: 9877 });

      // Act
      registry.clear();

      // Assert
      expect(registry.size).toBe(0);
      expect(registry.get(65)).toBeUndefined();
    });
  });

  // ============================================================================
  // getByConversationId 테스트
  // ============================================================================
  describe('getByConversationId', () => {
    it('should find connection by conversationId', () => {
      // Arrange
      // pylonId=65 (dev), conversationId = 65 << 17 | 1 = 8519681
      registry.set(65, { pylonId: 65, mcpHost: '127.0.0.1', mcpPort: 9878 });
      const conversationId = (65 << 17) | 1;

      // Act
      const result = registry.getByConversationId(conversationId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.pylonId).toBe(65);
      expect(result?.mcpPort).toBe(9878);
    });

    it('should return undefined when pylon not registered', () => {
      // Arrange
      const conversationId = (65 << 17) | 1;

      // Act
      const result = registry.getByConversationId(conversationId);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});

// ============================================================================
// 유틸 함수 테스트
// ============================================================================
describe('getEnvName', () => {
  it('should return release for envId=0', () => {
    // pylonId=1 → envId = 1 >> 5 = 0
    expect(getEnvName(1)).toBe('release');
  });

  it('should return stage for envId=1', () => {
    // pylonId=33 → envId = 33 >> 5 = 1
    expect(getEnvName(33)).toBe('stage');
  });

  it('should return dev for envId=2', () => {
    // pylonId=65 → envId = 65 >> 5 = 2
    expect(getEnvName(65)).toBe('dev');
  });

  it('should return release for unknown envId', () => {
    // pylonId=97 → envId = 97 >> 5 = 3 (없음)
    expect(getEnvName(97)).toBe('release');
  });
});

describe('extractPylonId', () => {
  it('should extract pylonId from conversationId', () => {
    // conversationId = pylonId << 17 | seq
    // 65 << 17 = 8519680, seq=1 → 8519681
    const conversationId = (65 << 17) | 1;
    expect(extractPylonId(conversationId)).toBe(65);
  });

  it('should extract pylonId regardless of seq', () => {
    // 같은 pylonId, 다른 seq
    expect(extractPylonId((65 << 17) | 0)).toBe(65);
    expect(extractPylonId((65 << 17) | 100)).toBe(65);
    expect(extractPylonId((65 << 17) | 131071)).toBe(65); // max seq (2^17 - 1)
  });

  it('should work for all environments', () => {
    expect(extractPylonId((1 << 17) | 1)).toBe(1); // release
    expect(extractPylonId((33 << 17) | 1)).toBe(33); // stage
    expect(extractPylonId((65 << 17) | 1)).toBe(65); // dev
  });
});
