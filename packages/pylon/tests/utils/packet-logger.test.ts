/**
 * PacketLogger 모듈 테스트
 *
 * 테스트 항목:
 * - JSON Lines 형식 로깅
 * - logRecv/logSend 방향 표시
 * - 타임스탬프 포함
 * - 패킷 타입 추출
 * - 파일 자동 생성 및 정리
 */

import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PacketLogger, createPacketLogger } from '../../src/utils/packet-logger.js';

/**
 * 각 테스트마다 고유한 디렉토리를 사용하여 파일 잠금 문제 방지
 */
function createTestDir(): string {
  const baseDir = path.join(process.cwd(), 'test-packet-logs');
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
  const baseDir = path.join(process.cwd(), 'test-packet-logs');
  safeCleanup(baseDir);
});

describe('PacketLogger', () => {
  describe('createPacketLogger', () => {
    it('should create a PacketLogger instance', () => {
      const testDir = createTestDir();
      const logger = createPacketLogger({ logDir: testDir });
      expect(logger).toBeInstanceOf(PacketLogger);
    });

    it('should create log directory if not exists', () => {
      const testDir = createTestDir();
      const logger = createPacketLogger({ logDir: testDir });
      logger.logRecv('test-source', { type: 'test' });
      logger.close();

      expect(fs.existsSync(testDir)).toBe(true);
      safeCleanup(testDir);
    });
  });

  describe('log file format', () => {
    it('should create log file with .jsonl extension', () => {
      const testDir = createTestDir();
      const logger = createPacketLogger({ logDir: testDir, prefix: 'packets-' });
      logger.logRecv('source', { type: 'test' });
      logger.close();

      const files = fs.readdirSync(testDir);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/^packets-.*\.jsonl$/);
      safeCleanup(testDir);
    });

    it('should write valid JSON Lines format', () => {
      const testDir = createTestDir();
      const logger = createPacketLogger({ logDir: testDir });
      logger.logRecv('source1', { type: 'test1' });
      logger.logSend('target1', { type: 'test2' });
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(2);

      // 각 라인이 유효한 JSON인지 확인
      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
      safeCleanup(testDir);
    });
  });

  describe('logRecv', () => {
    it('should log with direction "recv"', () => {
      const testDir = createTestDir();
      const logger = createPacketLogger({ logDir: testDir });
      logger.logRecv('app-client', { type: 'prompt', content: 'hello' });
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.direction).toBe('recv');
      expect(entry.source).toBe('app-client');
      safeCleanup(testDir);
    });

    it('should extract packet type from data', () => {
      const testDir = createTestDir();
      const logger = createPacketLogger({ logDir: testDir });
      logger.logRecv('source', { type: 'auth', token: 'xxx' });
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.type).toBe('auth');
      safeCleanup(testDir);
    });

    it('should use "unknown" type when data has no type field', () => {
      const testDir = createTestDir();
      const logger = createPacketLogger({ logDir: testDir });
      logger.logRecv('source', { content: 'no type field' });
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.type).toBe('unknown');
      safeCleanup(testDir);
    });

    it('should include original data in log entry', () => {
      const testDir = createTestDir();
      const logger = createPacketLogger({ logDir: testDir });
      const data = { type: 'test', payload: { nested: 'value' } };
      logger.logRecv('source', data);
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.data).toEqual(data);
      safeCleanup(testDir);
    });
  });

  describe('logSend', () => {
    it('should log with direction "send"', () => {
      const testDir = createTestDir();
      const logger = createPacketLogger({ logDir: testDir });
      logger.logSend('relay-server', { type: 'response', data: 'test' });
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.direction).toBe('send');
      expect(entry.target).toBe('relay-server');
      safeCleanup(testDir);
    });

    it('should extract packet type from data', () => {
      const testDir = createTestDir();
      const logger = createPacketLogger({ logDir: testDir });
      logger.logSend('target', { type: 'sync' });
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.type).toBe('sync');
      safeCleanup(testDir);
    });
  });

  describe('timestamp', () => {
    it('should include ISO timestamp in each log entry', () => {
      const testDir = createTestDir();
      const logger = createPacketLogger({ logDir: testDir });
      logger.logRecv('source', { type: 'test' });
      logger.close();

      const files = fs.readdirSync(testDir);
      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.timestamp).toBeDefined();
      // 타임스탬프가 유효한 ISO 형식인지 확인
      expect(() => new Date(entry.timestamp)).not.toThrow();
      expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
      safeCleanup(testDir);
    });
  });

  describe('old log cleanup', () => {
    it('should keep only maxLogFiles number of log files', () => {
      const testDir = createTestDir();
      fs.mkdirSync(testDir, { recursive: true });

      // 오래된 파일 5개 생성
      for (let i = 0; i < 5; i++) {
        const timestamp = new Date(Date.now() - i * 1000)
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, 19);
        const filename = `packets-${timestamp}.jsonl`;
        fs.writeFileSync(path.join(testDir, filename), '{"test":true}\n');
      }

      const logger = createPacketLogger({
        logDir: testDir,
        prefix: 'packets-',
        maxLogFiles: 3,
      });
      logger.logRecv('source', { type: 'test' });
      logger.close();

      const files = fs.readdirSync(testDir);
      expect(files.length).toBe(3);
      safeCleanup(testDir);
    });
  });

  describe('close', () => {
    it('should close write stream properly', () => {
      const testDir = createTestDir();
      const logger = createPacketLogger({ logDir: testDir });
      logger.logRecv('source', { type: 'test' });
      logger.close();

      // close 후에도 파일이 제대로 작성되었는지 확인
      const files = fs.readdirSync(testDir);
      expect(files.length).toBe(1);

      const content = fs.readFileSync(path.join(testDir, files[0]), 'utf-8');
      expect(content.trim()).not.toBe('');
      safeCleanup(testDir);
    });
  });
});
