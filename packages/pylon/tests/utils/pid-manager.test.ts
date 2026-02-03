/**
 * PidManager 모듈 테스트
 *
 * 테스트 항목:
 * - PID 파일 생성
 * - 기존 프로세스 감지
 * - PID 파일 정리 (cleanup)
 * - PID 파일 경로 반환
 * - 현재 PID 조회
 */

import { describe, it, expect, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PidManager, createPidManager } from '../../src/utils/pid-manager.js';

/**
 * 각 테스트마다 고유한 PID 파일을 사용
 */
function createTestPidFile(): string {
  const baseDir = path.join(process.cwd(), 'test-pid');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return path.join(baseDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.pid`);
}

/**
 * 파일 안전하게 정리
 */
function safeCleanupFile(file: string): void {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch {
    // 무시
  }
}

// 테스트 후 전체 정리
afterAll(() => {
  const baseDir = path.join(process.cwd(), 'test-pid');
  try {
    if (fs.existsSync(baseDir)) {
      fs.rmSync(baseDir, { recursive: true, force: true });
    }
  } catch {
    // 무시
  }
});

describe('PidManager', () => {
  describe('createPidManager', () => {
    it('should create a PidManager instance', () => {
      const testPidFile = createTestPidFile();
      const manager = createPidManager({ pidFile: testPidFile });
      expect(manager).toBeInstanceOf(PidManager);
    });
  });

  describe('initialize', () => {
    it('should create PID file with current process ID', () => {
      const testPidFile = createTestPidFile();
      const manager = createPidManager({ pidFile: testPidFile });
      const pid = manager.initialize();

      expect(fs.existsSync(testPidFile)).toBe(true);
      const content = fs.readFileSync(testPidFile, 'utf-8').trim();
      expect(content).toBe(String(process.pid));
      expect(pid).toBe(process.pid);
      safeCleanupFile(testPidFile);
    });

    it('should return current process ID', () => {
      const testPidFile = createTestPidFile();
      const manager = createPidManager({ pidFile: testPidFile });
      const pid = manager.initialize();

      expect(pid).toBe(process.pid);
      safeCleanupFile(testPidFile);
    });

    it('should detect existing PID file', () => {
      const testPidFile = createTestPidFile();
      // 기존 PID 파일 생성 (존재하지 않는 프로세스 ID)
      fs.writeFileSync(testPidFile, '99999999');

      const manager = createPidManager({ pidFile: testPidFile });

      // onExistingPid 콜백이 호출되는지 확인
      const onExistingPid = vi.fn();
      manager.initialize({ onExistingPid });

      expect(onExistingPid).toHaveBeenCalledWith(99999999);
      safeCleanupFile(testPidFile);
    });

    it('should overwrite existing PID file', () => {
      const testPidFile = createTestPidFile();
      // 기존 PID 파일 생성
      fs.writeFileSync(testPidFile, '12345');

      const manager = createPidManager({ pidFile: testPidFile });
      manager.initialize();

      const content = fs.readFileSync(testPidFile, 'utf-8').trim();
      expect(content).toBe(String(process.pid));
      safeCleanupFile(testPidFile);
    });
  });

  describe('cleanup', () => {
    it('should remove PID file', () => {
      const testPidFile = createTestPidFile();
      const manager = createPidManager({ pidFile: testPidFile });
      manager.initialize();

      expect(fs.existsSync(testPidFile)).toBe(true);

      manager.cleanup();

      expect(fs.existsSync(testPidFile)).toBe(false);
    });

    it('should not throw if PID file does not exist', () => {
      const testPidFile = createTestPidFile();
      const manager = createPidManager({ pidFile: testPidFile });

      expect(() => manager.cleanup()).not.toThrow();
    });
  });

  describe('getPid', () => {
    it('should return PID from file', () => {
      const testPidFile = createTestPidFile();
      const manager = createPidManager({ pidFile: testPidFile });
      manager.initialize();

      const pid = manager.getPid();
      expect(pid).toBe(String(process.pid));
      safeCleanupFile(testPidFile);
    });

    it('should return null if PID file does not exist', () => {
      const testPidFile = createTestPidFile();
      const manager = createPidManager({ pidFile: testPidFile });

      const pid = manager.getPid();
      expect(pid).toBeNull();
    });
  });

  describe('getPidFilePath', () => {
    it('should return PID file path', () => {
      const testPidFile = createTestPidFile();
      const manager = createPidManager({ pidFile: testPidFile });

      expect(manager.getPidFilePath()).toBe(testPidFile);
    });
  });

  describe('isProcessRunning', () => {
    it('should return true for current process', () => {
      const testPidFile = createTestPidFile();
      const manager = createPidManager({ pidFile: testPidFile });

      expect(manager.isProcessRunning(process.pid)).toBe(true);
    });

    it('should return false for non-existent process', () => {
      const testPidFile = createTestPidFile();
      const manager = createPidManager({ pidFile: testPidFile });

      // 존재하지 않을 가능성이 높은 PID
      expect(manager.isProcessRunning(99999999)).toBe(false);
    });
  });

  describe('killProcess', () => {
    it('should return false for non-existent process', () => {
      const testPidFile = createTestPidFile();
      const manager = createPidManager({ pidFile: testPidFile });

      // 존재하지 않는 프로세스는 kill 실패
      const result = manager.killProcess(99999999);
      expect(result).toBe(false);
    });

    // 실제 프로세스 kill 테스트는 위험하므로 생략
  });
});
