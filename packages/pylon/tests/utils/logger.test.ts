/**
 * Logger 모듈 테스트
 *
 * 테스트 항목:
 * - 로그 디렉토리 자동 생성
 * - 로그 파일명 형식 (타임스탬프)
 * - log/info/warn/error 레벨별 동작
 * - 파일 쓰기 동작
 * - 오래된 로그 파일 자동 정리
 */

import { describe, it, expect, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Logger, createLogger } from '../../src/utils/logger.js';

/**
 * 각 테스트마다 고유한 디렉토리를 사용하여 파일 잠금 문제 방지
 */
function createTestDir(): string {
  const baseDir = path.join(process.cwd(), 'test-logs');
  const uniqueDir = path.join(baseDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return uniqueDir;
}

/**
 * 디렉토리 안전하게 정리 (재시도 포함)
 */
function safeCleanup(dir: string, retries = 3): void {
  for (let i = 0; i < retries; i++) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      return;
    } catch {
      // 재시도
    }
  }
}

// 테스트 후 전체 정리
afterAll(() => {
  const baseDir = path.join(process.cwd(), 'test-logs');
  safeCleanup(baseDir);
});

describe('Logger', () => {
  describe('createLogger', () => {
    it('should create a logger instance with custom log directory', () => {
      const testDir = createTestDir();
      const logger = createLogger({ logDir: testDir });
      expect(logger).toBeInstanceOf(Logger);
      // 인스턴스만 생성하고 실제 쓰기는 안 했으므로 디렉토리 미생성
    });

    it('should create log directory if not exists', () => {
      const testDir = createTestDir();
      const logger = createLogger({ logDir: testDir });
      logger.log('test message');
      logger.close();

      expect(fs.existsSync(testDir)).toBe(true);
      safeCleanup(testDir);
    });
  });

  describe('log file creation', () => {
    it('should create log file with correct naming format', () => {
      const testDir = createTestDir();
      const logger = createLogger({ logDir: testDir, prefix: 'pylon-' });
      logger.log('test message');
      logger.close();

      const files = fs.readdirSync(testDir);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/^pylon-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.log$/);
      safeCleanup(testDir);
    });

    it('should return current log file path', () => {
      const testDir = createTestDir();
      const logger = createLogger({ logDir: testDir, prefix: 'pylon-' });
      logger.log('test message');

      const currentFile = logger.getCurrentFile();
      expect(currentFile).not.toBeNull();
      expect(currentFile).toContain('pylon-');
      expect(currentFile).toContain('.log');

      logger.close();
      safeCleanup(testDir);
    });
  });

  describe('log levels', () => {
    it('should write INFO level with log()', () => {
      const testDir = createTestDir();
      const logger = createLogger({ logDir: testDir });
      logger.log('info message');
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');

      expect(content).toContain('[INFO]');
      expect(content).toContain('info message');
      safeCleanup(testDir);
    });

    it('should write INFO level with info()', () => {
      const testDir = createTestDir();
      const logger = createLogger({ logDir: testDir });
      logger.info('info message');
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');

      expect(content).toContain('[INFO]');
      safeCleanup(testDir);
    });

    it('should write WARN level with warn()', () => {
      const testDir = createTestDir();
      const logger = createLogger({ logDir: testDir });
      logger.warn('warning message');
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');

      expect(content).toContain('[WARN]');
      expect(content).toContain('warning message');
      safeCleanup(testDir);
    });

    it('should write ERROR level with error()', () => {
      const testDir = createTestDir();
      const logger = createLogger({ logDir: testDir });
      logger.error('error message');
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');

      expect(content).toContain('[ERROR]');
      expect(content).toContain('error message');
      safeCleanup(testDir);
    });
  });

  describe('log format', () => {
    it('should include ISO timestamp in log entries', () => {
      const testDir = createTestDir();
      const logger = createLogger({ logDir: testDir });
      logger.log('test');
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');

      // ISO timestamp 형식: [2024-01-15T10:30:45.123Z]
      expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
      safeCleanup(testDir);
    });

    it('should serialize objects to JSON', () => {
      const testDir = createTestDir();
      const logger = createLogger({ logDir: testDir });
      logger.log('data:', { key: 'value', num: 42 });
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');

      expect(content).toContain('{"key":"value","num":42}');
      safeCleanup(testDir);
    });

    it('should handle multiple arguments', () => {
      const testDir = createTestDir();
      const logger = createLogger({ logDir: testDir });
      logger.log('arg1', 'arg2', 123);
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');

      expect(content).toContain('arg1 arg2 123');
      safeCleanup(testDir);
    });
  });

  describe('old log cleanup', () => {
    it('should keep only maxLogFiles number of log files', () => {
      const testDir = createTestDir();
      fs.mkdirSync(testDir, { recursive: true });

      // 먼저 오래된 파일들 생성
      for (let i = 0; i < 5; i++) {
        const timestamp = new Date(Date.now() - i * 1000)
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, 19);
        const filename = `pylon-${timestamp}.log`;
        fs.writeFileSync(path.join(testDir, filename), `old log ${i}`);
      }

      // maxLogFiles = 3으로 설정하여 새 로거 생성
      const logger = createLogger({
        logDir: testDir,
        prefix: 'pylon-',
        maxLogFiles: 3,
      });
      logger.log('new log');
      logger.close();

      // 3개만 남아야 함 (새 파일 포함)
      const files = fs.readdirSync(testDir);
      expect(files.length).toBe(3);
      safeCleanup(testDir);
    });
  });

  describe('console output', () => {
    it('should output to console.log for non-error levels', () => {
      const testDir = createTestDir();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const logger = createLogger({ logDir: testDir });
      logger.log('test message');
      logger.close();

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0][0];
      expect(call).toContain('[INFO]');
      expect(call).toContain('test message');

      consoleSpy.mockRestore();
      safeCleanup(testDir);
    });

    it('should output to console.error for ERROR level', () => {
      const testDir = createTestDir();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const logger = createLogger({ logDir: testDir });
      logger.error('error message');
      logger.close();

      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0][0];
      expect(call).toContain('[ERROR]');

      consoleSpy.mockRestore();
      safeCleanup(testDir);
    });
  });
});
