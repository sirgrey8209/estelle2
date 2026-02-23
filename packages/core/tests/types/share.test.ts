/**
 * @file share.test.ts
 * @description 대화 공유 관련 타입 테스트
 */

import { describe, it, expect } from 'vitest';
// 아직 존재하지 않는 모듈 - 의도적으로 실패하는 import
import {
  generateShareId,
  isShareInfo,
  type ShareInfo,
} from '../../src/types/share.js';
import type { DeviceType } from '../../src/types/device.js';

describe('ShareInfo', () => {
  it('should_have_all_required_properties_when_creating_share_info', () => {
    // Arrange & Act
    const shareInfo: ShareInfo = {
      shareId: 'abc123XYZ789',
      conversationId: 42,
      createdAt: Date.now(),
      accessCount: 0,
    };

    // Assert
    expect(shareInfo.shareId).toBe('abc123XYZ789');
    expect(shareInfo.conversationId).toBe(42);
    expect(typeof shareInfo.createdAt).toBe('number');
    expect(shareInfo.accessCount).toBe(0);
  });

  it('should_accept_zero_access_count_when_newly_created', () => {
    // Arrange & Act
    const shareInfo: ShareInfo = {
      shareId: 'newShare12345',
      conversationId: 1,
      createdAt: 1700000000000,
      accessCount: 0,
    };

    // Assert
    expect(shareInfo.accessCount).toBe(0);
  });

  it('should_track_access_count_when_share_is_viewed', () => {
    // Arrange & Act
    const shareInfo: ShareInfo = {
      shareId: 'popular12345',
      conversationId: 100,
      createdAt: 1700000000000,
      accessCount: 9999,
    };

    // Assert
    expect(shareInfo.accessCount).toBe(9999);
  });

  it('should_support_unicode_free_share_id_when_base62_encoded', () => {
    // Arrange - Base62는 a-z, A-Z, 0-9만 포함
    const shareInfo: ShareInfo = {
      shareId: 'AbCdEf123456',
      conversationId: 1,
      createdAt: Date.now(),
      accessCount: 0,
    };

    // Assert - ASCII 문자만 포함
    expect(shareInfo.shareId).toMatch(/^[a-zA-Z0-9]+$/);
  });
});

describe('generateShareId', () => {
  it('should_return_12_character_string_when_called', () => {
    // Act
    const shareId = generateShareId();

    // Assert
    expect(shareId).toHaveLength(12);
    expect(typeof shareId).toBe('string');
  });

  it('should_return_base62_characters_only_when_generated', () => {
    // Arrange
    const base62Pattern = /^[a-zA-Z0-9]+$/;

    // Act
    const shareId = generateShareId();

    // Assert
    expect(shareId).toMatch(base62Pattern);
  });

  it('should_return_unique_ids_when_called_multiple_times', () => {
    // Act
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateShareId());
    }

    // Assert - 100번 호출 시 모두 고유해야 함
    expect(ids.size).toBe(100);
  });

  it('should_not_contain_special_characters_when_generated', () => {
    // Act
    const shareId = generateShareId();

    // Assert
    expect(shareId).not.toMatch(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/);
    expect(shareId).not.toMatch(/[\s]/); // 공백 없음
  });

  it('should_be_url_safe_when_used_in_path', () => {
    // Act
    const shareId = generateShareId();
    const url = `https://example.com/share/${shareId}`;

    // Assert - URL에 그대로 사용 가능해야 함
    expect(url).not.toMatch(/%[0-9A-F]{2}/); // URL 인코딩 필요 없음
    expect(encodeURIComponent(shareId)).toBe(shareId);
  });
});

describe('isShareInfo', () => {
  it('should_return_true_when_valid_share_info_provided', () => {
    // Arrange
    const validShareInfo = {
      shareId: 'valid1234567',
      conversationId: 1,
      createdAt: Date.now(),
      accessCount: 0,
    };

    // Act
    const result = isShareInfo(validShareInfo);

    // Assert
    expect(result).toBe(true);
  });

  it('should_return_false_when_null_provided', () => {
    // Act
    const result = isShareInfo(null);

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_false_when_undefined_provided', () => {
    // Act
    const result = isShareInfo(undefined);

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_false_when_missing_shareId', () => {
    // Arrange
    const missingShareId = {
      conversationId: 1,
      createdAt: Date.now(),
      accessCount: 0,
    };

    // Act
    const result = isShareInfo(missingShareId);

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_false_when_missing_conversationId', () => {
    // Arrange
    const missingConversationId = {
      shareId: 'abc123XYZ789',
      createdAt: Date.now(),
      accessCount: 0,
    };

    // Act
    const result = isShareInfo(missingConversationId);

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_false_when_missing_createdAt', () => {
    // Arrange
    const missingCreatedAt = {
      shareId: 'abc123XYZ789',
      conversationId: 1,
      accessCount: 0,
    };

    // Act
    const result = isShareInfo(missingCreatedAt);

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_false_when_missing_accessCount', () => {
    // Arrange
    const missingAccessCount = {
      shareId: 'abc123XYZ789',
      conversationId: 1,
      createdAt: Date.now(),
    };

    // Act
    const result = isShareInfo(missingAccessCount);

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_false_when_shareId_is_not_string', () => {
    // Arrange
    const invalidShareId = {
      shareId: 12345,
      conversationId: 1,
      createdAt: Date.now(),
      accessCount: 0,
    };

    // Act
    const result = isShareInfo(invalidShareId);

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_false_when_conversationId_is_not_number', () => {
    // Arrange
    const invalidConversationId = {
      shareId: 'abc123XYZ789',
      conversationId: '1',
      createdAt: Date.now(),
      accessCount: 0,
    };

    // Act
    const result = isShareInfo(invalidConversationId);

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_false_when_createdAt_is_not_number', () => {
    // Arrange
    const invalidCreatedAt = {
      shareId: 'abc123XYZ789',
      conversationId: 1,
      createdAt: '2024-01-01',
      accessCount: 0,
    };

    // Act
    const result = isShareInfo(invalidCreatedAt);

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_false_when_accessCount_is_not_number', () => {
    // Arrange
    const invalidAccessCount = {
      shareId: 'abc123XYZ789',
      conversationId: 1,
      createdAt: Date.now(),
      accessCount: '0',
    };

    // Act
    const result = isShareInfo(invalidAccessCount);

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_false_when_empty_object_provided', () => {
    // Act
    const result = isShareInfo({});

    // Assert
    expect(result).toBe(false);
  });

  it('should_return_false_when_primitive_value_provided', () => {
    // Act & Assert
    expect(isShareInfo('string')).toBe(false);
    expect(isShareInfo(123)).toBe(false);
    expect(isShareInfo(true)).toBe(false);
  });

  it('should_return_true_when_extra_properties_exist', () => {
    // Arrange - 추가 속성이 있어도 필수 속성이 있으면 OK
    const shareInfoWithExtra = {
      shareId: 'abc123XYZ789',
      conversationId: 1,
      createdAt: Date.now(),
      accessCount: 0,
      extraField: 'ignored',
    };

    // Act
    const result = isShareInfo(shareInfoWithExtra);

    // Assert
    expect(result).toBe(true);
  });
});

describe('DeviceType with viewer', () => {
  it('should_accept_viewer_as_valid_device_type', () => {
    // Arrange & Act
    const viewer: DeviceType = 'viewer';

    // Assert
    expect(viewer).toBe('viewer');
  });

  it('should_include_viewer_in_type_guard', () => {
    // Arrange
    const validTypes: DeviceType[] = ['pylon', 'desktop', 'viewer'];

    const isValidDeviceType = (value: string): value is DeviceType => {
      return validTypes.includes(value as DeviceType);
    };

    // Act & Assert
    expect(isValidDeviceType('viewer')).toBe(true);
    expect(isValidDeviceType('pylon')).toBe(true);
    expect(isValidDeviceType('desktop')).toBe(true);
    expect(isValidDeviceType('invalid')).toBe(false);
  });

  it('should_be_usable_with_DeviceId_for_viewer', () => {
    // Arrange & Act
    const viewerDeviceId = {
      pcId: 'share-viewer-abc123',
      deviceType: 'viewer' as DeviceType,
    };

    // Assert
    expect(viewerDeviceId.deviceType).toBe('viewer');
  });
});
