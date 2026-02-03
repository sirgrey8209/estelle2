/**
 * PacketLogger - 패킷을 JSON Lines 형식으로 기록
 *
 * 기능:
 * - 로그 디렉토리 자동 생성
 * - 타임스탬프 포함 파일명 (packets-YYYY-MM-DDTHH-MM-SS.jsonl)
 * - recv/send 방향 구분
 * - 패킷 타입 자동 추출
 * - JSON Lines 형식 (.jsonl)
 * - 오래된 로그 파일 자동 정리
 *
 * @module utils/packet-logger
 */

import fs from 'fs';
import path from 'path';

/**
 * 패킷 데이터 타입 (최소 요구사항)
 */
export interface PacketData {
  /** 패킷 타입 (선택적) */
  type?: string;
  /** 기타 모든 속성 허용 */
  [key: string]: unknown;
}

/**
 * 로그 엔트리 타입
 */
interface LogEntry {
  /** 로그 기록 시간 (ISO 8601) */
  timestamp: string;
  /** 패킷 방향 */
  direction: 'recv' | 'send';
  /** 패킷 출처 (recv 시) 또는 목적지 (send 시) */
  source?: string;
  target?: string;
  /** 패킷 타입 */
  type: string;
  /** 원본 패킷 데이터 */
  data: PacketData;
}

/**
 * PacketLogger 생성 옵션
 */
export interface PacketLoggerOptions {
  /** 로그 파일 저장 디렉토리 */
  logDir: string;
  /** 로그 파일 접두사 (기본: 'packets-') */
  prefix?: string;
  /** 보관할 최대 로그 파일 수 (기본: 50) */
  maxLogFiles?: number;
}

/**
 * PacketLogger 클래스
 *
 * 수신/송신 패킷을 JSON Lines 형식으로 로깅합니다.
 * 동기식 파일 쓰기를 사용하여 데이터 손실을 방지합니다.
 *
 * @example
 * ```typescript
 * const logger = createPacketLogger({ logDir: './logs' });
 * logger.logRecv('app-client', { type: 'prompt', content: 'hello' });
 * logger.logSend('relay-server', { type: 'response', data: '...' });
 * logger.close();
 * ```
 */
export class PacketLogger {
  /** 로그 디렉토리 경로 */
  private readonly logDir: string;
  /** 로그 파일 접두사 */
  private readonly prefix: string;
  /** 보관할 최대 로그 파일 수 */
  private readonly maxLogFiles: number;
  /** 현재 로그 파일 경로 */
  private currentFile: string | null = null;
  /** 파일 디스크립터 (동기 쓰기용) */
  private fd: number | null = null;
  /** 초기화 여부 */
  private initialized = false;

  /**
   * PacketLogger 인스턴스 생성
   *
   * @param options - PacketLogger 생성 옵션
   */
  constructor(options: PacketLoggerOptions) {
    this.logDir = options.logDir;
    this.prefix = options.prefix ?? 'packets-';
    this.maxLogFiles = options.maxLogFiles ?? 50;
  }

  /**
   * 로거 초기화 (필요시 자동 호출)
   *
   * - 로그 디렉토리 생성
   * - 새 로그 파일 생성
   * - 오래된 로그 파일 정리
   */
  private initialize(): void {
    if (this.initialized) return;

    // 로그 디렉토리 생성
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // 타임스탬프로 파일명 생성
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    this.currentFile = path.join(this.logDir, `${this.prefix}${timestamp}.jsonl`);

    // 동기식 파일 열기 (append 모드)
    this.fd = fs.openSync(this.currentFile, 'a');

    // 오래된 로그 정리
    this.cleanupOldLogs();
    this.initialized = true;
  }

  /**
   * 오래된 로그 파일 정리
   *
   * maxLogFiles 수를 초과하는 오래된 파일들을 삭제합니다.
   */
  private cleanupOldLogs(): void {
    try {
      const files = fs
        .readdirSync(this.logDir)
        .filter((f) => f.startsWith(this.prefix) && f.endsWith('.jsonl'))
        .sort()
        .reverse();

      if (files.length > this.maxLogFiles) {
        const toDelete = files.slice(this.maxLogFiles);
        toDelete.forEach((file) => {
          fs.unlinkSync(path.join(this.logDir, file));
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[PacketLogger] Cleanup error: ${message}`);
    }
  }

  /**
   * 파일 디스크립터 확보 (필요시 초기화)
   *
   * @returns 파일 디스크립터
   */
  private ensureFd(): number {
    if (!this.initialized) {
      this.initialize();
    }
    return this.fd!;
  }

  /**
   * 수신 패킷 로깅
   *
   * @param source - 패킷 출처 (예: 'app-client', 'relay')
   * @param data - 패킷 데이터
   *
   * @example
   * ```typescript
   * logger.logRecv('app-client', { type: 'prompt', content: 'hello' });
   * ```
   */
  logRecv(source: string, data: PacketData): void {
    this.write({
      timestamp: new Date().toISOString(),
      direction: 'recv',
      source,
      type: data?.type ?? 'unknown',
      data,
    });
  }

  /**
   * 송신 패킷 로깅
   *
   * @param target - 패킷 목적지 (예: 'relay', 'claude')
   * @param data - 패킷 데이터
   *
   * @example
   * ```typescript
   * logger.logSend('relay', { type: 'response', content: '...' });
   * ```
   */
  logSend(target: string, data: PacketData): void {
    this.write({
      timestamp: new Date().toISOString(),
      direction: 'send',
      target,
      type: data?.type ?? 'unknown',
      data,
    });
  }

  /**
   * 로그 엔트리 쓰기 (내부 메서드)
   *
   * @param logEntry - 로그 엔트리
   */
  private write(logEntry: LogEntry): void {
    try {
      const fd = this.ensureFd();
      fs.writeSync(fd, JSON.stringify(logEntry) + '\n');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[PacketLogger] Write error: ${message}`);
    }
  }

  /**
   * 현재 로그 파일 경로 반환
   *
   * @returns 현재 로그 파일의 전체 경로, 미초기화시 null
   */
  getCurrentFile(): string | null {
    return this.currentFile;
  }

  /**
   * 로거 종료 (파일 닫기)
   */
  close(): void {
    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
  }
}

/**
 * PacketLogger 인스턴스 생성 팩토리 함수
 *
 * @param options - PacketLogger 생성 옵션
 * @returns PacketLogger 인스턴스
 *
 * @example
 * ```typescript
 * const logger = createPacketLogger({
 *   logDir: './logs',
 *   prefix: 'packets-',
 *   maxLogFiles: 100
 * });
 * ```
 */
export function createPacketLogger(options: PacketLoggerOptions): PacketLogger {
  return new PacketLogger(options);
}
