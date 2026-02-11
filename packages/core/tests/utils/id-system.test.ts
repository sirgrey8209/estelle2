/**
 * @file id-system.test.ts
 * @description 24비트 통합 ID 체계 테스트
 *
 * 비트 레이아웃 (24비트):
 * ┌─────────┬─────┬─────────────┬───────────────┬──────────────────┐
 * │ envId   │ DT  │ deviceIndex │ workspaceIndex│ conversationIndex│
 * │ 2비트   │1bit │ 4비트       │ 7비트         │ 10비트           │
 * └─────────┴─────┴─────────────┴───────────────┴──────────────────┘
 *
 * 계층:
 * - DeviceId (7비트) = envId(2) + deviceType(1) + deviceIndex(4)
 *   - PylonId: deviceType=0, deviceIndex=1~15
 *   - ClientId: deviceType=1, deviceIndex=0~15
 * - WorkspaceId (14비트) = pylonId(7) + workspaceIndex(7)
 * - ConversationId (24비트) = workspaceId(14) + conversationIndex(10)
 */

import { describe, it, expect } from 'vitest';
import {
  // 상수
  ENV_ID_BITS,
  DEVICE_TYPE_BITS,
  DEVICE_INDEX_BITS,
  WORKSPACE_INDEX_BITS,
  CONVERSATION_INDEX_BITS,
  MAX_ENV_ID,
  MAX_DEVICE_INDEX,
  MAX_WORKSPACE_INDEX,
  MAX_CONVERSATION_INDEX,
  // 인코딩 함수
  encodePylonId,
  encodeClientId,
  encodeWorkspaceId,
  encodeConversationId,
  // 디코딩 함수
  decodePylonId,
  decodeClientId,
  decodeDeviceId,
  decodeWorkspaceId,
  decodeConversationId,
  decodeConversationIdFull,
  // 유틸리티 함수
  isPylonId,
  isClientId,
  conversationIdToString,
  // 타입
  type EnvId,
  type DeviceType,
  type PylonId,
  type ClientId,
  type DeviceId,
  type WorkspaceId,
  type ConversationId,
} from '../../src/utils/id-system.js';

// ============================================================================
// 상수 테스트
// ============================================================================

describe('ID System 상수', () => {
  describe('비트 상수', () => {
    it('should_define_ENV_ID_BITS_as_2', () => {
      // Assert
      expect(ENV_ID_BITS).toBe(2);
    });

    it('should_define_DEVICE_TYPE_BITS_as_1', () => {
      // Assert
      expect(DEVICE_TYPE_BITS).toBe(1);
    });

    it('should_define_DEVICE_INDEX_BITS_as_4', () => {
      // Assert
      expect(DEVICE_INDEX_BITS).toBe(4);
    });

    it('should_define_WORKSPACE_INDEX_BITS_as_7', () => {
      // Assert
      expect(WORKSPACE_INDEX_BITS).toBe(7);
    });

    it('should_define_CONVERSATION_INDEX_BITS_as_10', () => {
      // Assert
      expect(CONVERSATION_INDEX_BITS).toBe(10);
    });
  });

  describe('최대값 상수', () => {
    it('should_define_MAX_ENV_ID_as_2', () => {
      // 0=release, 1=stage, 2=dev
      expect(MAX_ENV_ID).toBe(2);
    });

    it('should_define_MAX_DEVICE_INDEX_as_15', () => {
      // 4비트 = 0~15
      expect(MAX_DEVICE_INDEX).toBe(15);
    });

    it('should_define_MAX_WORKSPACE_INDEX_as_127', () => {
      // 7비트 = 0~127, 사용 범위 1~127
      expect(MAX_WORKSPACE_INDEX).toBe(127);
    });

    it('should_define_MAX_CONVERSATION_INDEX_as_1023', () => {
      // 10비트 = 0~1023, 사용 범위 1~1023
      expect(MAX_CONVERSATION_INDEX).toBe(1023);
    });
  });
});

// ============================================================================
// encodePylonId 테스트
// ============================================================================

describe('encodePylonId', () => {
  describe('정상 케이스', () => {
    it('should_encode_release_pylon_1_when_envId_0_deviceIndex_1', () => {
      // Arrange
      const envId = 0 as EnvId; // release
      const deviceIndex = 1;

      // Act
      const pylonId = encodePylonId(envId, deviceIndex);

      // Assert
      expect(pylonId).toBeDefined();
      expect(typeof pylonId).toBe('number');
    });

    it('should_encode_stage_pylon_when_envId_1', () => {
      // Arrange
      const envId = 1 as EnvId; // stage
      const deviceIndex = 5;

      // Act
      const pylonId = encodePylonId(envId, deviceIndex);

      // Assert
      expect(pylonId).toBeDefined();
      // stage(1)가 release(0)보다 상위 비트이므로 값이 더 커야 함
      const releasePylon = encodePylonId(0 as EnvId, deviceIndex);
      expect(pylonId).toBeGreaterThan(releasePylon);
    });

    it('should_encode_dev_pylon_when_envId_2', () => {
      // Arrange
      const envId = 2 as EnvId; // dev
      const deviceIndex = 10;

      // Act
      const pylonId = encodePylonId(envId, deviceIndex);

      // Assert
      expect(pylonId).toBeDefined();
      // dev(2)가 stage(1)보다 상위 비트이므로 값이 더 커야 함
      const stagePylon = encodePylonId(1 as EnvId, deviceIndex);
      expect(pylonId).toBeGreaterThan(stagePylon);
    });

    it('should_encode_maximum_pylon_when_deviceIndex_15', () => {
      // Arrange
      const envId = 0 as EnvId;
      const deviceIndex = 15;

      // Act
      const pylonId = encodePylonId(envId, deviceIndex);

      // Assert
      expect(pylonId).toBeDefined();
    });

    it('should_produce_different_ids_for_different_deviceIndex', () => {
      // Arrange
      const envId = 0 as EnvId;

      // Act
      const pylon1 = encodePylonId(envId, 1);
      const pylon2 = encodePylonId(envId, 2);
      const pylon3 = encodePylonId(envId, 15);

      // Assert
      expect(pylon1).not.toBe(pylon2);
      expect(pylon2).not.toBe(pylon3);
      expect(pylon1).not.toBe(pylon3);
    });
  });

  describe('에러 케이스 - envId 범위', () => {
    it('should_throw_when_envId_is_negative', () => {
      // Arrange
      const envId = -1 as EnvId;
      const deviceIndex = 1;

      // Act & Assert
      expect(() => encodePylonId(envId, deviceIndex)).toThrow();
    });

    it('should_throw_when_envId_is_3', () => {
      // Arrange
      const envId = 3 as EnvId; // 2비트 최대는 3이지만 유효 범위는 0~2
      const deviceIndex = 1;

      // Act & Assert
      expect(() => encodePylonId(envId, deviceIndex)).toThrow();
    });
  });

  describe('에러 케이스 - deviceIndex 범위', () => {
    it('should_throw_when_pylon_deviceIndex_is_0', () => {
      // Pylon deviceIndex는 1~15
      const envId = 0 as EnvId;
      const deviceIndex = 0;

      // Act & Assert
      expect(() => encodePylonId(envId, deviceIndex)).toThrow();
    });

    it('should_throw_when_deviceIndex_exceeds_15', () => {
      // Arrange
      const envId = 0 as EnvId;
      const deviceIndex = 16;

      // Act & Assert
      expect(() => encodePylonId(envId, deviceIndex)).toThrow();
    });

    it('should_throw_when_deviceIndex_is_negative', () => {
      // Arrange
      const envId = 0 as EnvId;
      const deviceIndex = -1;

      // Act & Assert
      expect(() => encodePylonId(envId, deviceIndex)).toThrow();
    });
  });
});

// ============================================================================
// encodeClientId 테스트
// ============================================================================

describe('encodeClientId', () => {
  describe('정상 케이스', () => {
    it('should_encode_client_0_when_deviceIndex_0', () => {
      // Client는 deviceIndex 0~15 허용
      const envId = 0 as EnvId;
      const deviceIndex = 0;

      // Act
      const clientId = encodeClientId(envId, deviceIndex);

      // Assert
      expect(clientId).toBeDefined();
      expect(typeof clientId).toBe('number');
    });

    it('should_encode_client_with_envId_1', () => {
      // Arrange
      const envId = 1 as EnvId;
      const deviceIndex = 5;

      // Act
      const clientId = encodeClientId(envId, deviceIndex);

      // Assert
      expect(clientId).toBeDefined();
    });

    it('should_encode_maximum_client_when_deviceIndex_15', () => {
      // Arrange
      const envId = 2 as EnvId;
      const deviceIndex = 15;

      // Act
      const clientId = encodeClientId(envId, deviceIndex);

      // Assert
      expect(clientId).toBeDefined();
    });

    it('should_produce_different_id_from_pylon_with_same_indices', () => {
      // Arrange
      const envId = 0 as EnvId;
      const deviceIndex = 5;

      // Act
      const pylonId = encodePylonId(envId, deviceIndex);
      const clientId = encodeClientId(envId, deviceIndex);

      // Assert - deviceType 비트가 다르므로 다른 값
      expect(pylonId).not.toBe(clientId);
    });
  });

  describe('에러 케이스', () => {
    it('should_throw_when_envId_is_negative', () => {
      // Act & Assert
      expect(() => encodeClientId(-1 as EnvId, 0)).toThrow();
    });

    it('should_throw_when_envId_exceeds_2', () => {
      // Act & Assert
      expect(() => encodeClientId(3 as EnvId, 0)).toThrow();
    });

    it('should_throw_when_deviceIndex_exceeds_15', () => {
      // Act & Assert
      expect(() => encodeClientId(0 as EnvId, 16)).toThrow();
    });

    it('should_throw_when_deviceIndex_is_negative', () => {
      // Act & Assert
      expect(() => encodeClientId(0 as EnvId, -1)).toThrow();
    });
  });
});

// ============================================================================
// encodeWorkspaceId 테스트
// ============================================================================

describe('encodeWorkspaceId', () => {
  describe('정상 케이스', () => {
    it('should_encode_workspace_1_for_pylon', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceIndex = 1;

      // Act
      const workspaceId = encodeWorkspaceId(pylonId, workspaceIndex);

      // Assert
      expect(workspaceId).toBeDefined();
      expect(typeof workspaceId).toBe('number');
    });

    it('should_encode_maximum_workspace_127', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceIndex = 127;

      // Act
      const workspaceId = encodeWorkspaceId(pylonId, workspaceIndex);

      // Assert
      expect(workspaceId).toBeDefined();
    });

    it('should_produce_different_ids_for_different_workspaceIndex', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);

      // Act
      const ws1 = encodeWorkspaceId(pylonId, 1);
      const ws2 = encodeWorkspaceId(pylonId, 50);
      const ws3 = encodeWorkspaceId(pylonId, 127);

      // Assert
      expect(ws1).not.toBe(ws2);
      expect(ws2).not.toBe(ws3);
    });

    it('should_produce_different_ids_for_different_pylons', () => {
      // Arrange
      const pylon1 = encodePylonId(0 as EnvId, 1);
      const pylon2 = encodePylonId(0 as EnvId, 2);
      const workspaceIndex = 10;

      // Act
      const ws1 = encodeWorkspaceId(pylon1, workspaceIndex);
      const ws2 = encodeWorkspaceId(pylon2, workspaceIndex);

      // Assert
      expect(ws1).not.toBe(ws2);
    });
  });

  describe('에러 케이스', () => {
    it('should_throw_when_workspaceIndex_is_0', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);

      // Act & Assert
      expect(() => encodeWorkspaceId(pylonId, 0)).toThrow();
    });

    it('should_throw_when_workspaceIndex_exceeds_127', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);

      // Act & Assert
      expect(() => encodeWorkspaceId(pylonId, 128)).toThrow();
    });

    it('should_throw_when_workspaceIndex_is_negative', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);

      // Act & Assert
      expect(() => encodeWorkspaceId(pylonId, -1)).toThrow();
    });
  });
});

// ============================================================================
// encodeConversationId 테스트
// ============================================================================

describe('encodeConversationId', () => {
  describe('정상 케이스', () => {
    it('should_encode_conversation_1', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 1);
      const conversationIndex = 1;

      // Act
      const convId = encodeConversationId(workspaceId, conversationIndex);

      // Assert
      expect(convId).toBeDefined();
      expect(typeof convId).toBe('number');
    });

    it('should_encode_maximum_conversation_1023', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 1);
      const conversationIndex = 1023;

      // Act
      const convId = encodeConversationId(workspaceId, conversationIndex);

      // Assert
      expect(convId).toBeDefined();
    });

    it('should_fit_in_24_bits', () => {
      // Arrange - 모든 최대값 사용
      const pylonId = encodePylonId(2 as EnvId, 15); // envId=2, deviceIndex=15
      const workspaceId = encodeWorkspaceId(pylonId, 127);
      const conversationIndex = 1023;

      // Act
      const convId = encodeConversationId(workspaceId, conversationIndex);

      // Assert - 24비트 = 16777215 (0xFFFFFF)
      expect(convId).toBeLessThanOrEqual(0xFFFFFF);
    });

    it('should_produce_different_ids_for_different_conversationIndex', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 1);

      // Act
      const conv1 = encodeConversationId(workspaceId, 1);
      const conv2 = encodeConversationId(workspaceId, 500);
      const conv3 = encodeConversationId(workspaceId, 1023);

      // Assert
      expect(conv1).not.toBe(conv2);
      expect(conv2).not.toBe(conv3);
    });
  });

  describe('에러 케이스', () => {
    it('should_throw_when_conversationIndex_is_0', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 1);

      // Act & Assert
      expect(() => encodeConversationId(workspaceId, 0)).toThrow();
    });

    it('should_throw_when_conversationIndex_exceeds_1023', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 1);

      // Act & Assert
      expect(() => encodeConversationId(workspaceId, 1024)).toThrow();
    });

    it('should_throw_when_conversationIndex_is_negative', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 1);

      // Act & Assert
      expect(() => encodeConversationId(workspaceId, -1)).toThrow();
    });
  });
});

// ============================================================================
// decodePylonId 테스트
// ============================================================================

describe('decodePylonId', () => {
  describe('정상 케이스', () => {
    it('should_decode_envId_correctly', () => {
      // Arrange
      const envId = 1 as EnvId;
      const deviceIndex = 5;
      const pylonId = encodePylonId(envId, deviceIndex);

      // Act
      const decoded = decodePylonId(pylonId);

      // Assert
      expect(decoded.envId).toBe(envId);
    });

    it('should_decode_deviceType_as_0', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);

      // Act
      const decoded = decodePylonId(pylonId);

      // Assert
      expect(decoded.deviceType).toBe(0);
    });

    it('should_decode_deviceIndex_correctly', () => {
      // Arrange
      const envId = 0 as EnvId;
      const deviceIndex = 10;
      const pylonId = encodePylonId(envId, deviceIndex);

      // Act
      const decoded = decodePylonId(pylonId);

      // Assert
      expect(decoded.deviceIndex).toBe(deviceIndex);
    });

    it('should_roundtrip_all_boundary_values', () => {
      // Arrange
      const testCases = [
        { envId: 0 as EnvId, deviceIndex: 1 },
        { envId: 0 as EnvId, deviceIndex: 15 },
        { envId: 1 as EnvId, deviceIndex: 1 },
        { envId: 2 as EnvId, deviceIndex: 15 },
      ];

      for (const tc of testCases) {
        // Act
        const pylonId = encodePylonId(tc.envId, tc.deviceIndex);
        const decoded = decodePylonId(pylonId);

        // Assert
        expect(decoded.envId).toBe(tc.envId);
        expect(decoded.deviceType).toBe(0);
        expect(decoded.deviceIndex).toBe(tc.deviceIndex);
      }
    });
  });
});

// ============================================================================
// decodeClientId 테스트
// ============================================================================

describe('decodeClientId', () => {
  describe('정상 케이스', () => {
    it('should_decode_deviceType_as_1', () => {
      // Arrange
      const clientId = encodeClientId(0 as EnvId, 0);

      // Act
      const decoded = decodeClientId(clientId);

      // Assert
      expect(decoded.deviceType).toBe(1);
    });

    it('should_decode_envId_correctly', () => {
      // Arrange
      const envId = 2 as EnvId;
      const clientId = encodeClientId(envId, 5);

      // Act
      const decoded = decodeClientId(clientId);

      // Assert
      expect(decoded.envId).toBe(envId);
    });

    it('should_decode_deviceIndex_correctly', () => {
      // Arrange
      const deviceIndex = 10;
      const clientId = encodeClientId(0 as EnvId, deviceIndex);

      // Act
      const decoded = decodeClientId(clientId);

      // Assert
      expect(decoded.deviceIndex).toBe(deviceIndex);
    });

    it('should_roundtrip_all_boundary_values', () => {
      // Arrange
      const testCases = [
        { envId: 0 as EnvId, deviceIndex: 0 },
        { envId: 0 as EnvId, deviceIndex: 15 },
        { envId: 1 as EnvId, deviceIndex: 0 },
        { envId: 2 as EnvId, deviceIndex: 15 },
      ];

      for (const tc of testCases) {
        // Act
        const clientId = encodeClientId(tc.envId, tc.deviceIndex);
        const decoded = decodeClientId(clientId);

        // Assert
        expect(decoded.envId).toBe(tc.envId);
        expect(decoded.deviceType).toBe(1);
        expect(decoded.deviceIndex).toBe(tc.deviceIndex);
      }
    });
  });
});

// ============================================================================
// decodeDeviceId 테스트
// ============================================================================

describe('decodeDeviceId', () => {
  describe('PylonId 디코딩', () => {
    it('should_decode_pylonId_correctly', () => {
      // Arrange
      const pylonId = encodePylonId(1 as EnvId, 5);

      // Act
      const decoded = decodeDeviceId(pylonId);

      // Assert
      expect(decoded.envId).toBe(1);
      expect(decoded.deviceType).toBe(0);
      expect(decoded.deviceIndex).toBe(5);
    });
  });

  describe('ClientId 디코딩', () => {
    it('should_decode_clientId_correctly', () => {
      // Arrange
      const clientId = encodeClientId(2 as EnvId, 10);

      // Act
      const decoded = decodeDeviceId(clientId);

      // Assert
      expect(decoded.envId).toBe(2);
      expect(decoded.deviceType).toBe(1);
      expect(decoded.deviceIndex).toBe(10);
    });
  });

  describe('디코딩 결과 구조', () => {
    it('should_return_object_with_correct_shape', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);

      // Act
      const decoded = decodeDeviceId(pylonId);

      // Assert
      expect(decoded).toHaveProperty('envId');
      expect(decoded).toHaveProperty('deviceType');
      expect(decoded).toHaveProperty('deviceIndex');
      expect(Object.keys(decoded)).toHaveLength(3);
    });
  });
});

// ============================================================================
// decodeWorkspaceId 테스트
// ============================================================================

describe('decodeWorkspaceId', () => {
  describe('정상 케이스', () => {
    it('should_decode_pylonId_correctly', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 3);
      const workspaceId = encodeWorkspaceId(pylonId, 25);

      // Act
      const decoded = decodeWorkspaceId(workspaceId);

      // Assert
      expect(decoded.pylonId).toBe(pylonId);
    });

    it('should_decode_workspaceIndex_correctly', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceIndex = 42;
      const workspaceId = encodeWorkspaceId(pylonId, workspaceIndex);

      // Act
      const decoded = decodeWorkspaceId(workspaceId);

      // Assert
      expect(decoded.workspaceIndex).toBe(workspaceIndex);
    });

    it('should_roundtrip_all_boundary_values', () => {
      // Arrange
      const testCases = [
        { envId: 0 as EnvId, deviceIndex: 1, workspaceIndex: 1 },
        { envId: 0 as EnvId, deviceIndex: 15, workspaceIndex: 127 },
        { envId: 2 as EnvId, deviceIndex: 10, workspaceIndex: 64 },
      ];

      for (const tc of testCases) {
        // Act
        const pylonId = encodePylonId(tc.envId, tc.deviceIndex);
        const workspaceId = encodeWorkspaceId(pylonId, tc.workspaceIndex);
        const decoded = decodeWorkspaceId(workspaceId);

        // Assert
        expect(decoded.pylonId).toBe(pylonId);
        expect(decoded.workspaceIndex).toBe(tc.workspaceIndex);
      }
    });
  });
});

// ============================================================================
// decodeConversationId 테스트
// ============================================================================

describe('decodeConversationId', () => {
  describe('정상 케이스', () => {
    it('should_decode_workspaceId_correctly', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 10);
      const convId = encodeConversationId(workspaceId, 100);

      // Act
      const decoded = decodeConversationId(convId);

      // Assert
      expect(decoded.workspaceId).toBe(workspaceId);
    });

    it('should_decode_conversationIndex_correctly', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 1);
      const conversationIndex = 789;
      const convId = encodeConversationId(workspaceId, conversationIndex);

      // Act
      const decoded = decodeConversationId(convId);

      // Assert
      expect(decoded.conversationIndex).toBe(conversationIndex);
    });

    it('should_roundtrip_all_boundary_values', () => {
      // Arrange
      const testCases = [
        { envId: 0 as EnvId, deviceIndex: 1, wsIndex: 1, convIndex: 1 },
        { envId: 2 as EnvId, deviceIndex: 15, wsIndex: 127, convIndex: 1023 },
        { envId: 1 as EnvId, deviceIndex: 5, wsIndex: 50, convIndex: 500 },
      ];

      for (const tc of testCases) {
        // Act
        const pylonId = encodePylonId(tc.envId, tc.deviceIndex);
        const workspaceId = encodeWorkspaceId(pylonId, tc.wsIndex);
        const convId = encodeConversationId(workspaceId, tc.convIndex);
        const decoded = decodeConversationId(convId);

        // Assert
        expect(decoded.workspaceId).toBe(workspaceId);
        expect(decoded.conversationIndex).toBe(tc.convIndex);
      }
    });
  });
});

// ============================================================================
// decodeConversationIdFull 테스트
// ============================================================================

describe('decodeConversationIdFull', () => {
  describe('정상 케이스', () => {
    it('should_decode_all_components', () => {
      // Arrange
      const envId = 1 as EnvId;
      const deviceIndex = 5;
      const workspaceIndex = 25;
      const conversationIndex = 100;

      const pylonId = encodePylonId(envId, deviceIndex);
      const workspaceId = encodeWorkspaceId(pylonId, workspaceIndex);
      const convId = encodeConversationId(workspaceId, conversationIndex);

      // Act
      const decoded = decodeConversationIdFull(convId);

      // Assert
      expect(decoded.envId).toBe(envId);
      expect(decoded.deviceType).toBe(0);
      expect(decoded.deviceIndex).toBe(deviceIndex);
      expect(decoded.workspaceIndex).toBe(workspaceIndex);
      expect(decoded.conversationIndex).toBe(conversationIndex);
    });

    it('should_include_intermediate_ids', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 10);
      const convId = encodeConversationId(workspaceId, 50);

      // Act
      const decoded = decodeConversationIdFull(convId);

      // Assert
      expect(decoded.pylonId).toBe(pylonId);
      expect(decoded.workspaceId).toBe(workspaceId);
    });

    it('should_return_object_with_correct_shape', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 1);
      const convId = encodeConversationId(workspaceId, 1);

      // Act
      const decoded = decodeConversationIdFull(convId);

      // Assert
      expect(decoded).toHaveProperty('envId');
      expect(decoded).toHaveProperty('deviceType');
      expect(decoded).toHaveProperty('deviceIndex');
      expect(decoded).toHaveProperty('workspaceIndex');
      expect(decoded).toHaveProperty('conversationIndex');
      expect(decoded).toHaveProperty('pylonId');
      expect(decoded).toHaveProperty('workspaceId');
    });

    it('should_roundtrip_all_boundary_combinations', () => {
      // Arrange
      const testCases = [
        { envId: 0 as EnvId, di: 1, wi: 1, ci: 1 },
        { envId: 2 as EnvId, di: 15, wi: 127, ci: 1023 },
        { envId: 1 as EnvId, di: 8, wi: 64, ci: 512 },
      ];

      for (const tc of testCases) {
        // Act
        const pylonId = encodePylonId(tc.envId, tc.di);
        const workspaceId = encodeWorkspaceId(pylonId, tc.wi);
        const convId = encodeConversationId(workspaceId, tc.ci);
        const decoded = decodeConversationIdFull(convId);

        // Assert
        expect(decoded.envId).toBe(tc.envId);
        expect(decoded.deviceIndex).toBe(tc.di);
        expect(decoded.workspaceIndex).toBe(tc.wi);
        expect(decoded.conversationIndex).toBe(tc.ci);
      }
    });
  });
});

// ============================================================================
// isPylonId / isClientId 테스트
// ============================================================================

describe('isPylonId', () => {
  it('should_return_true_for_pylonId', () => {
    // Arrange
    const pylonId = encodePylonId(0 as EnvId, 1);

    // Act & Assert
    expect(isPylonId(pylonId)).toBe(true);
  });

  it('should_return_false_for_clientId', () => {
    // Arrange
    const clientId = encodeClientId(0 as EnvId, 0);

    // Act & Assert
    expect(isPylonId(clientId)).toBe(false);
  });

  it('should_return_true_for_all_env_pylons', () => {
    // Arrange & Act & Assert
    for (let envId = 0; envId <= 2; envId++) {
      const pylonId = encodePylonId(envId as EnvId, 5);
      expect(isPylonId(pylonId)).toBe(true);
    }
  });
});

describe('isClientId', () => {
  it('should_return_true_for_clientId', () => {
    // Arrange
    const clientId = encodeClientId(0 as EnvId, 0);

    // Act & Assert
    expect(isClientId(clientId)).toBe(true);
  });

  it('should_return_false_for_pylonId', () => {
    // Arrange
    const pylonId = encodePylonId(0 as EnvId, 1);

    // Act & Assert
    expect(isClientId(pylonId)).toBe(false);
  });

  it('should_return_true_for_all_env_clients', () => {
    // Arrange & Act & Assert
    for (let envId = 0; envId <= 2; envId++) {
      const clientId = encodeClientId(envId as EnvId, 5);
      expect(isClientId(clientId)).toBe(true);
    }
  });
});

// ============================================================================
// conversationIdToString 테스트
// ============================================================================

describe('conversationIdToString', () => {
  describe('정상 케이스', () => {
    it('should_format_as_colon_separated_string', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 5);
      const convId = encodeConversationId(workspaceId, 42);

      // Act
      const str = conversationIdToString(convId);

      // Assert
      // 형식: "env:dt:device:ws:conv"
      expect(str).toBe('0:0:1:5:42');
    });

    it('should_format_stage_env_correctly', () => {
      // Arrange
      const pylonId = encodePylonId(1 as EnvId, 3);
      const workspaceId = encodeWorkspaceId(pylonId, 10);
      const convId = encodeConversationId(workspaceId, 100);

      // Act
      const str = conversationIdToString(convId);

      // Assert
      expect(str).toBe('1:0:3:10:100');
    });

    it('should_format_dev_env_correctly', () => {
      // Arrange
      const pylonId = encodePylonId(2 as EnvId, 15);
      const workspaceId = encodeWorkspaceId(pylonId, 127);
      const convId = encodeConversationId(workspaceId, 1023);

      // Act
      const str = conversationIdToString(convId);

      // Assert
      expect(str).toBe('2:0:15:127:1023');
    });

    it('should_format_minimum_values_correctly', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 1);
      const convId = encodeConversationId(workspaceId, 1);

      // Act
      const str = conversationIdToString(convId);

      // Assert
      expect(str).toBe('0:0:1:1:1');
    });
  });
});

// ============================================================================
// 비트 레이아웃 검증 테스트
// ============================================================================

describe('비트 레이아웃 검증', () => {
  describe('PylonId 비트 구조 (7비트)', () => {
    it('should_have_correct_bit_layout_envId_deviceType_deviceIndex', () => {
      // Arrange
      const envId = 2 as EnvId; // 10 (2비트)
      const deviceIndex = 5;     // 0101 (4비트)
      // 예상: 10_0_0101 = 0b1000101 = 69

      // Act
      const pylonId = encodePylonId(envId, deviceIndex);
      const decoded = decodePylonId(pylonId);

      // Assert
      expect(decoded.envId).toBe(2);
      expect(decoded.deviceType).toBe(0);
      expect(decoded.deviceIndex).toBe(5);
    });
  });

  describe('ClientId 비트 구조 (7비트)', () => {
    it('should_have_correct_bit_layout_with_deviceType_1', () => {
      // Arrange
      const envId = 1 as EnvId; // 01 (2비트)
      const deviceIndex = 10;    // 1010 (4비트)
      // 예상: 01_1_1010 (deviceType=1)

      // Act
      const clientId = encodeClientId(envId, deviceIndex);
      const decoded = decodeClientId(clientId);

      // Assert
      expect(decoded.envId).toBe(1);
      expect(decoded.deviceType).toBe(1);
      expect(decoded.deviceIndex).toBe(10);
    });
  });

  describe('WorkspaceId 비트 구조 (14비트)', () => {
    it('should_combine_pylonId_and_workspaceIndex_correctly', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1); // 7비트
      const workspaceIndex = 64; // 1000000 (7비트)

      // Act
      const workspaceId = encodeWorkspaceId(pylonId, workspaceIndex);
      const decoded = decodeWorkspaceId(workspaceId);

      // Assert
      expect(decoded.pylonId).toBe(pylonId);
      expect(decoded.workspaceIndex).toBe(64);
    });
  });

  describe('ConversationId 비트 구조 (24비트)', () => {
    it('should_combine_all_components_in_24_bits', () => {
      // Arrange - 모든 최대값
      const pylonId = encodePylonId(2 as EnvId, 15);
      const workspaceId = encodeWorkspaceId(pylonId, 127);
      const convId = encodeConversationId(workspaceId, 1023);

      // Act
      const decoded = decodeConversationIdFull(convId);

      // Assert
      expect(decoded.envId).toBe(2);
      expect(decoded.deviceType).toBe(0);
      expect(decoded.deviceIndex).toBe(15);
      expect(decoded.workspaceIndex).toBe(127);
      expect(decoded.conversationIndex).toBe(1023);

      // 24비트 이하인지 확인
      expect(convId).toBeLessThanOrEqual(0xFFFFFF);
    });

    it('should_have_total_24_bits', () => {
      // Assert - 비트 합계 검증
      const totalBits =
        ENV_ID_BITS +
        DEVICE_TYPE_BITS +
        DEVICE_INDEX_BITS +
        WORKSPACE_INDEX_BITS +
        CONVERSATION_INDEX_BITS;

      expect(totalBits).toBe(24);
    });
  });
});

// ============================================================================
// 환경별 예시값 검증
// ============================================================================

describe('환경별 ID 예시값', () => {
  describe('release 환경 (envId=0)', () => {
    it('should_encode_release_pylon_1_workspace_1_conv_1', () => {
      // Arrange
      const pylonId = encodePylonId(0 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 1);
      const convId = encodeConversationId(workspaceId, 1);

      // Act
      const str = conversationIdToString(convId);

      // Assert
      expect(str).toBe('0:0:1:1:1');
    });
  });

  describe('stage 환경 (envId=1)', () => {
    it('should_encode_stage_pylon_1_workspace_1_conv_1', () => {
      // Arrange
      const pylonId = encodePylonId(1 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 1);
      const convId = encodeConversationId(workspaceId, 1);

      // Act
      const str = conversationIdToString(convId);

      // Assert
      expect(str).toBe('1:0:1:1:1');
    });
  });

  describe('dev 환경 (envId=2)', () => {
    it('should_encode_dev_pylon_1_workspace_1_conv_1', () => {
      // Arrange
      const pylonId = encodePylonId(2 as EnvId, 1);
      const workspaceId = encodeWorkspaceId(pylonId, 1);
      const convId = encodeConversationId(workspaceId, 1);

      // Act
      const str = conversationIdToString(convId);

      // Assert
      expect(str).toBe('2:0:1:1:1');
    });
  });
});
