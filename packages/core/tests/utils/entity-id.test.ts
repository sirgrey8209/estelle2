/**
 * @file entity-id.test.ts
 * @description EntityId 인코딩/디코딩 테스트
 *
 * 비트 레이아웃 (21비트):
 * [pylonId: 4비트][workspaceId: 7비트][conversationId: 10비트]
 *      1~10            1~127              1~1023
 */

import { describe, it, expect } from 'vitest';
import {
  // 새로운 EntityId API
  encodeEntityId,
  decodeEntityId,
  entityIdToString,
  EntityId,
  MAX_PYLON_ID,
  MAX_WORKSPACE_ID,
  MAX_CONVERSATION_ID,
  PYLON_ID_BITS,
  WORKSPACE_ID_BITS,
  CONVERSATION_ID_BITS,
  // 레벨별 팩토리 함수
  encodePylonId,
  encodeWorkspaceId,
  // 레벨 판별 함수
  isPylonEntity,
  isWorkspaceEntity,
  isConversationEntity,
  // EntityLevel 타입
  EntityLevel,
  getEntityLevel,
  // 레거시 호환 (deprecated) - 기존 테스트 호환용
  encodeConversationPath,
  decodeConversationPath,
  conversationPathToString,
  encodePylonPath,
  encodeWorkspacePath,
  isPylonPath,
  isWorkspacePath,
  isConversationPathFull,
  PathLevel,
  getPathLevel,
} from '../../src/utils/entity-id.js';

describe('ConversationPath 상수', () => {
  it('should_define_bit_constants', () => {
    // Arrange & Act & Assert
    expect(PYLON_ID_BITS).toBe(4);
    expect(WORKSPACE_ID_BITS).toBe(7);
    expect(CONVERSATION_ID_BITS).toBe(10);
  });

  it('should_define_max_value_constants', () => {
    // Arrange & Act & Assert
    expect(MAX_PYLON_ID).toBe(10);
    expect(MAX_WORKSPACE_ID).toBe(127);
    expect(MAX_CONVERSATION_ID).toBe(1023);
  });
});

describe('encodeConversationPath', () => {
  describe('정상 케이스', () => {
    it('should_encode_minimum_values_when_all_ids_are_1', () => {
      // Arrange
      const pylonId = 1;
      const workspaceId = 1;
      const conversationId = 1;

      // Act
      const path = encodeConversationPath(pylonId, workspaceId, conversationId);

      // Assert
      expect(path).toBeDefined();
      expect(typeof path).toBe('number');
    });

    it('should_encode_maximum_values_when_all_ids_are_at_max', () => {
      // Arrange
      const pylonId = 10;
      const workspaceId = 127;
      const conversationId = 1023;

      // Act
      const path = encodeConversationPath(pylonId, workspaceId, conversationId);

      // Assert
      expect(path).toBeDefined();
      expect(typeof path).toBe('number');
    });

    it('should_encode_mixed_values_correctly', () => {
      // Arrange
      const pylonId = 5;
      const workspaceId = 50;
      const conversationId = 500;

      // Act
      const path = encodeConversationPath(pylonId, workspaceId, conversationId);

      // Assert
      expect(path).toBeDefined();
    });

    it('should_produce_different_paths_for_different_inputs', () => {
      // Arrange & Act
      const path1 = encodeConversationPath(1, 1, 1);
      const path2 = encodeConversationPath(1, 1, 2);
      const path3 = encodeConversationPath(1, 2, 1);
      const path4 = encodeConversationPath(2, 1, 1);

      // Assert
      expect(path1).not.toBe(path2);
      expect(path1).not.toBe(path3);
      expect(path1).not.toBe(path4);
      expect(path2).not.toBe(path3);
      expect(path2).not.toBe(path4);
      expect(path3).not.toBe(path4);
    });
  });

  describe('에러 케이스 - pylonId 범위 초과', () => {
    it('should_throw_when_pylonId_is_0', () => {
      // Arrange
      const pylonId = 0;
      const workspaceId = 1;
      const conversationId = 1;

      // Act & Assert
      expect(() => encodeConversationPath(pylonId, workspaceId, conversationId))
        .toThrow();
    });

    it('should_throw_when_pylonId_exceeds_max', () => {
      // Arrange
      const pylonId = 11;
      const workspaceId = 1;
      const conversationId = 1;

      // Act & Assert
      expect(() => encodeConversationPath(pylonId, workspaceId, conversationId))
        .toThrow();
    });

    it('should_throw_when_pylonId_is_negative', () => {
      // Arrange
      const pylonId = -1;
      const workspaceId = 1;
      const conversationId = 1;

      // Act & Assert
      expect(() => encodeConversationPath(pylonId, workspaceId, conversationId))
        .toThrow();
    });
  });

  describe('에러 케이스 - workspaceId 범위 초과', () => {
    it('should_throw_when_workspaceId_is_0', () => {
      // Arrange
      const pylonId = 1;
      const workspaceId = 0;
      const conversationId = 1;

      // Act & Assert
      expect(() => encodeConversationPath(pylonId, workspaceId, conversationId))
        .toThrow();
    });

    it('should_throw_when_workspaceId_exceeds_max', () => {
      // Arrange
      const pylonId = 1;
      const workspaceId = 128;
      const conversationId = 1;

      // Act & Assert
      expect(() => encodeConversationPath(pylonId, workspaceId, conversationId))
        .toThrow();
    });

    it('should_throw_when_workspaceId_is_negative', () => {
      // Arrange
      const pylonId = 1;
      const workspaceId = -5;
      const conversationId = 1;

      // Act & Assert
      expect(() => encodeConversationPath(pylonId, workspaceId, conversationId))
        .toThrow();
    });
  });

  describe('에러 케이스 - conversationId 범위 초과', () => {
    it('should_throw_when_conversationId_is_0', () => {
      // Arrange
      const pylonId = 1;
      const workspaceId = 1;
      const conversationId = 0;

      // Act & Assert
      expect(() => encodeConversationPath(pylonId, workspaceId, conversationId))
        .toThrow();
    });

    it('should_throw_when_conversationId_exceeds_max', () => {
      // Arrange
      const pylonId = 1;
      const workspaceId = 1;
      const conversationId = 1024;

      // Act & Assert
      expect(() => encodeConversationPath(pylonId, workspaceId, conversationId))
        .toThrow();
    });

    it('should_throw_when_conversationId_is_negative', () => {
      // Arrange
      const pylonId = 1;
      const workspaceId = 1;
      const conversationId = -10;

      // Act & Assert
      expect(() => encodeConversationPath(pylonId, workspaceId, conversationId))
        .toThrow();
    });
  });
});

describe('decodeConversationPath', () => {
  describe('정상 케이스', () => {
    it('should_decode_and_return_original_values_for_minimum', () => {
      // Arrange
      const original = { pylonId: 1, workspaceId: 1, conversationId: 1 };
      const path = encodeConversationPath(original.pylonId, original.workspaceId, original.conversationId);

      // Act
      const decoded = decodeConversationPath(path);

      // Assert
      expect(decoded.pylonId).toBe(original.pylonId);
      expect(decoded.workspaceId).toBe(original.workspaceId);
      expect(decoded.conversationId).toBe(original.conversationId);
    });

    it('should_decode_and_return_original_values_for_maximum', () => {
      // Arrange
      const original = { pylonId: 10, workspaceId: 127, conversationId: 1023 };
      const path = encodeConversationPath(original.pylonId, original.workspaceId, original.conversationId);

      // Act
      const decoded = decodeConversationPath(path);

      // Assert
      expect(decoded.pylonId).toBe(original.pylonId);
      expect(decoded.workspaceId).toBe(original.workspaceId);
      expect(decoded.conversationId).toBe(original.conversationId);
    });

    it('should_decode_and_return_original_values_for_mixed', () => {
      // Arrange
      const original = { pylonId: 7, workspaceId: 42, conversationId: 789 };
      const path = encodeConversationPath(original.pylonId, original.workspaceId, original.conversationId);

      // Act
      const decoded = decodeConversationPath(path);

      // Assert
      expect(decoded.pylonId).toBe(original.pylonId);
      expect(decoded.workspaceId).toBe(original.workspaceId);
      expect(decoded.conversationId).toBe(original.conversationId);
    });

    it('should_roundtrip_all_boundary_combinations', () => {
      // Arrange - 모든 경계값 조합
      const testCases = [
        { pylonId: 1, workspaceId: 1, conversationId: 1 },
        { pylonId: 10, workspaceId: 1, conversationId: 1 },
        { pylonId: 1, workspaceId: 127, conversationId: 1 },
        { pylonId: 1, workspaceId: 1, conversationId: 1023 },
        { pylonId: 10, workspaceId: 127, conversationId: 1023 },
      ];

      for (const original of testCases) {
        // Act
        const path = encodeConversationPath(original.pylonId, original.workspaceId, original.conversationId);
        const decoded = decodeConversationPath(path);

        // Assert
        expect(decoded).toEqual(original);
      }
    });
  });

  describe('엣지 케이스', () => {
    it('should_return_object_with_correct_shape', () => {
      // Arrange
      const path = encodeConversationPath(1, 1, 1);

      // Act
      const decoded = decodeConversationPath(path);

      // Assert
      expect(decoded).toHaveProperty('pylonId');
      expect(decoded).toHaveProperty('workspaceId');
      expect(decoded).toHaveProperty('conversationId');
      expect(Object.keys(decoded)).toHaveLength(3);
    });
  });
});

describe('conversationPathToString', () => {
  describe('정상 케이스', () => {
    it('should_format_path_as_colon_separated_string', () => {
      // Arrange
      const path = encodeConversationPath(1, 5, 42);

      // Act
      const str = conversationPathToString(path);

      // Assert
      expect(str).toBe('1:5:42');
    });

    it('should_format_minimum_values_correctly', () => {
      // Arrange
      const path = encodeConversationPath(1, 1, 1);

      // Act
      const str = conversationPathToString(path);

      // Assert
      expect(str).toBe('1:1:1');
    });

    it('should_format_maximum_values_correctly', () => {
      // Arrange
      const path = encodeConversationPath(10, 127, 1023);

      // Act
      const str = conversationPathToString(path);

      // Assert
      expect(str).toBe('10:127:1023');
    });

    it('should_format_mixed_values_correctly', () => {
      // Arrange
      const path = encodeConversationPath(3, 25, 456);

      // Act
      const str = conversationPathToString(path);

      // Assert
      expect(str).toBe('3:25:456');
    });
  });
});

describe('인코딩/디코딩 일관성', () => {
  it('should_maintain_consistency_across_all_valid_pylonId_values', () => {
    // Arrange & Act & Assert
    for (let pylonId = 1; pylonId <= 10; pylonId++) {
      const path = encodeConversationPath(pylonId, 50, 500);
      const decoded = decodeConversationPath(path);
      expect(decoded.pylonId).toBe(pylonId);
    }
  });

  it('should_maintain_consistency_across_sample_workspaceId_values', () => {
    // Arrange - 샘플 workspaceId 값들
    const sampleWorkspaceIds = [1, 10, 25, 50, 75, 100, 127];

    for (const workspaceId of sampleWorkspaceIds) {
      // Act
      const path = encodeConversationPath(5, workspaceId, 500);
      const decoded = decodeConversationPath(path);

      // Assert
      expect(decoded.workspaceId).toBe(workspaceId);
    }
  });

  it('should_maintain_consistency_across_sample_conversationId_values', () => {
    // Arrange - 샘플 conversationId 값들
    const sampleConversationIds = [1, 10, 100, 250, 500, 750, 1000, 1023];

    for (const conversationId of sampleConversationIds) {
      // Act
      const path = encodeConversationPath(5, 50, conversationId);
      const decoded = decodeConversationPath(path);

      // Assert
      expect(decoded.conversationId).toBe(conversationId);
    }
  });
});

// ============================================================================
// 레벨별 팩토리 함수 테스트
// ============================================================================

describe('encodePylonPath', () => {
  it('should_encode_pylon_only_path_with_zeros', () => {
    // Arrange
    const pylonId = 3;

    // Act
    const path = encodePylonPath(pylonId);
    const decoded = decodeConversationPath(path);

    // Assert
    expect(decoded.pylonId).toBe(3);
    expect(decoded.workspaceId).toBe(0);
    expect(decoded.conversationId).toBe(0);
  });

  it('should_format_as_x_0_0', () => {
    // Arrange
    const path = encodePylonPath(5);

    // Act
    const str = conversationPathToString(path);

    // Assert
    expect(str).toBe('5:0:0');
  });

  it('should_throw_when_pylonId_is_0', () => {
    // Act & Assert
    expect(() => encodePylonPath(0)).toThrow();
  });

  it('should_throw_when_pylonId_exceeds_max', () => {
    // Act & Assert
    expect(() => encodePylonPath(11)).toThrow();
  });
});

describe('encodeWorkspacePath', () => {
  it('should_encode_workspace_path_with_zero_conversation', () => {
    // Arrange
    const pylonId = 2;
    const workspaceId = 42;

    // Act
    const path = encodeWorkspacePath(pylonId, workspaceId);
    const decoded = decodeConversationPath(path);

    // Assert
    expect(decoded.pylonId).toBe(2);
    expect(decoded.workspaceId).toBe(42);
    expect(decoded.conversationId).toBe(0);
  });

  it('should_format_as_x_y_0', () => {
    // Arrange
    const path = encodeWorkspacePath(3, 25);

    // Act
    const str = conversationPathToString(path);

    // Assert
    expect(str).toBe('3:25:0');
  });

  it('should_throw_when_pylonId_is_0', () => {
    // Act & Assert
    expect(() => encodeWorkspacePath(0, 1)).toThrow();
  });

  it('should_throw_when_workspaceId_is_0', () => {
    // Act & Assert
    expect(() => encodeWorkspacePath(1, 0)).toThrow();
  });

  it('should_throw_when_workspaceId_exceeds_max', () => {
    // Act & Assert
    expect(() => encodeWorkspacePath(1, 128)).toThrow();
  });
});

// ============================================================================
// 레벨 판별 함수 테스트
// ============================================================================

describe('isPylonPath', () => {
  it('should_return_true_for_pylon_only_path', () => {
    // Arrange
    const path = encodePylonPath(3);

    // Act & Assert
    expect(isPylonPath(path)).toBe(true);
  });

  it('should_return_false_for_workspace_path', () => {
    // Arrange
    const path = encodeWorkspacePath(3, 5);

    // Act & Assert
    expect(isPylonPath(path)).toBe(false);
  });

  it('should_return_false_for_conversation_path', () => {
    // Arrange
    const path = encodeConversationPath(3, 5, 10);

    // Act & Assert
    expect(isPylonPath(path)).toBe(false);
  });
});

describe('isWorkspacePath', () => {
  it('should_return_true_for_workspace_path', () => {
    // Arrange
    const path = encodeWorkspacePath(3, 5);

    // Act & Assert
    expect(isWorkspacePath(path)).toBe(true);
  });

  it('should_return_false_for_pylon_only_path', () => {
    // Arrange
    const path = encodePylonPath(3);

    // Act & Assert
    expect(isWorkspacePath(path)).toBe(false);
  });

  it('should_return_false_for_conversation_path', () => {
    // Arrange
    const path = encodeConversationPath(3, 5, 10);

    // Act & Assert
    expect(isWorkspacePath(path)).toBe(false);
  });
});

describe('isConversationPathFull', () => {
  it('should_return_true_for_full_conversation_path', () => {
    // Arrange
    const path = encodeConversationPath(3, 5, 10);

    // Act & Assert
    expect(isConversationPathFull(path)).toBe(true);
  });

  it('should_return_false_for_pylon_only_path', () => {
    // Arrange
    const path = encodePylonPath(3);

    // Act & Assert
    expect(isConversationPathFull(path)).toBe(false);
  });

  it('should_return_false_for_workspace_path', () => {
    // Arrange
    const path = encodeWorkspacePath(3, 5);

    // Act & Assert
    expect(isConversationPathFull(path)).toBe(false);
  });
});

describe('getPathLevel', () => {
  it('should_return_pylon_for_pylon_only_path', () => {
    // Arrange
    const path = encodePylonPath(3);

    // Act
    const level = getPathLevel(path);

    // Assert
    expect(level).toBe('pylon');
  });

  it('should_return_workspace_for_workspace_path', () => {
    // Arrange
    const path = encodeWorkspacePath(3, 5);

    // Act
    const level = getPathLevel(path);

    // Assert
    expect(level).toBe('workspace');
  });

  it('should_return_conversation_for_full_path', () => {
    // Arrange
    const path = encodeConversationPath(3, 5, 10);

    // Act
    const level = getPathLevel(path);

    // Assert
    expect(level).toBe('conversation');
  });
});

describe('PathLevel 타입', () => {
  it('should_have_correct_literal_types', () => {
    // Arrange
    const pylonLevel: PathLevel = 'pylon';
    const workspaceLevel: PathLevel = 'workspace';
    const conversationLevel: PathLevel = 'conversation';

    // Assert
    expect(pylonLevel).toBe('pylon');
    expect(workspaceLevel).toBe('workspace');
    expect(conversationLevel).toBe('conversation');
  });
});

describe('encodePylonPath 에러 케이스', () => {
  it('should_throw_when_pylonId_is_negative', () => {
    expect(() => encodePylonPath(-1)).toThrow();
  });
});

describe('encodeWorkspacePath 에러 케이스', () => {
  it('should_throw_when_pylonId_is_negative', () => {
    expect(() => encodeWorkspacePath(-1, 1)).toThrow();
  });

  it('should_throw_when_workspaceId_is_negative', () => {
    expect(() => encodeWorkspacePath(1, -1)).toThrow();
  });
});
