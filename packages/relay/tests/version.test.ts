/**
 * @file version.test.ts
 * @description 버전 로더 모듈 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { loadVersion, getVersion } from '../src/version.js';

// 캐시 초기화를 위한 모듈 리로드 헬퍼
async function reloadVersionModule() {
  // 모듈 캐시 초기화
  vi.resetModules();
  // 새로 import
  const module = await import('../src/version.js');
  return module;
}

describe('version', () => {
  describe('loadVersion', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return cached version on subsequent calls', async () => {
      // Arrange
      const module = await reloadVersionModule();
      const readFileSyncSpy = vi.spyOn(fs, 'readFileSync');

      // Act - 첫 번째 호출
      const version1 = module.loadVersion();
      // 두 번째 호출
      const version2 = module.loadVersion();

      // Assert - 캐싱으로 인해 readFileSync는 최대 1번만 호출됨
      // (첫 호출 시 파일이 있으면 1번, 없으면 0번(catch에서 기본값))
      expect(version1).toEqual(version2);
      expect(readFileSyncSpy).toHaveBeenCalledTimes(1);
    });

    it('should return fallback version when version.json does not exist', async () => {
      // Arrange - 파일 읽기 실패 시뮬레이션
      vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });
      const module = await reloadVersionModule();

      // Act
      const version = module.loadVersion();

      // Assert - fallback 값 반환
      expect(version.version).toBe('dev');
      expect(version.buildTime).toBeDefined();
    });

    it('should parse version.json correctly when file exists', async () => {
      // Arrange
      const mockVersionInfo = {
        version: 'v0303_1',
        buildTime: '2024-03-03T12:00:00Z',
      };
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockVersionInfo));
      const module = await reloadVersionModule();

      // Act
      const version = module.loadVersion();

      // Assert
      expect(version).toEqual(mockVersionInfo);
    });
  });

  describe('getVersion', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return version string from loadVersion', async () => {
      // Arrange
      const mockVersionInfo = {
        version: 'v0303_test',
        buildTime: '2024-03-03T12:00:00Z',
      };
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockVersionInfo));
      const module = await reloadVersionModule();

      // Act
      const versionStr = module.getVersion();

      // Assert
      expect(versionStr).toBe('v0303_test');
    });

    it('should return "dev" when version.json is not available', async () => {
      // Arrange
      vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const module = await reloadVersionModule();

      // Act
      const versionStr = module.getVersion();

      // Assert
      expect(versionStr).toBe('dev');
    });
  });

  describe('fallback behavior', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should use fallback when JSON parsing fails', async () => {
      // Arrange - 유효하지 않은 JSON
      vi.spyOn(fs, 'readFileSync').mockReturnValue('invalid json {{{');
      const module = await reloadVersionModule();

      // Act
      const version = module.loadVersion();

      // Assert
      expect(version.version).toBe('dev');
      expect(version.buildTime).toBeDefined();
    });

    it('should set buildTime to current time in fallback', async () => {
      // Arrange
      vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const beforeTime = new Date().toISOString();
      const module = await reloadVersionModule();

      // Act
      const version = module.loadVersion();
      const afterTime = new Date().toISOString();

      // Assert - buildTime이 현재 시간 범위 내에 있어야 함
      expect(version.buildTime >= beforeTime).toBe(true);
      expect(version.buildTime <= afterTime).toBe(true);
    });
  });
});
