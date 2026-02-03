/**
 * Logger - 일반 로그를 텍스트 형식으로 기록
 *
 * 기능:
 * - 로그 디렉토리 자동 생성
 * - 타임스탬프 포함 로그 파일명 (pylon-YYYY-MM-DDTHH-MM-SS.log)
 * - log/info/warn/error 레벨 지원
 * - 콘솔 및 파일 동시 출력
 * - 오래된 로그 파일 자동 정리
 *
 * @module utils/logger
 */

import fs from 'fs';
import path from 'path';

/**
 * 로그 레벨 타입
 */
type LogLevel = 'INFO' | 'WARN' | 'ERROR';

/**
 * Logger 생성 옵션
 */
export interface LoggerOptions {
  /** 로그 파일 저장 디렉토리 */
  logDir: string;
  /** 로그 파일 접두사 (기본: 'pylon-') */
  prefix?: string;
  /** 보관할 최대 로그 파일 수 (기본: 50) */
  maxLogFiles?: number;
}

/**
 * Logger 클래스
 *
 * 텍스트 형식으로 로그를 파일과 콘솔에 기록합니다.
 * 동기식 파일 쓰기를 사용하여 데이터 손실을 방지합니다.
 *
 * @example
 * ```typescript
 * const logger = createLogger({ logDir: './logs' });
 * logger.log('Server started');
 * logger.warn('Connection slow');
 * logger.error('Failed to connect');
 * logger.close();
 * ```
 */
export class Logger {
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
   * Logger 인스턴스 생성
   *
   * @param options - Logger 생성 옵션
   */
  constructor(options: LoggerOptions) {
    this.logDir = options.logDir;
    this.prefix = options.prefix ?? 'pylon-';
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

    // 타임스탬프로 파일명 생성 (ISO 형식에서 : 과 . 을 - 로 변환)
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    this.currentFile = path.join(this.logDir, `${this.prefix}${timestamp}.log`);

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
        .filter((f) => f.startsWith(this.prefix) && f.endsWith('.log'))
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
      console.error(`[Logger] Cleanup error: ${message}`);
    }
  }

  /**
   * 현재 시간을 ISO 형식으로 반환
   */
  private formatTime(): string {
    return new Date().toISOString();
  }

  /**
   * 로그 작성 (내부 메서드)
   *
   * @param level - 로그 레벨
   * @param args - 로그 메시지 및 데이터
   */
  private writeLog(level: LogLevel, ...args: unknown[]): void {
    this.initialize();

    // 인자들을 문자열로 변환 (객체는 JSON)
    const message = args
      .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ');

    const line = `[${this.formatTime()}] [${level}] ${message}\n`;

    // 콘솔 출력 (ERROR는 console.error, 나머지는 console.log)
    if (level === 'ERROR') {
      console.error(line.trim());
    } else {
      console.log(line.trim());
    }

    // 동기식 파일 쓰기
    if (this.fd !== null) {
      fs.writeSync(this.fd, line);
    }
  }

  /**
   * INFO 레벨 로그 기록
   *
   * @param args - 로그 메시지 및 데이터
   */
  log(...args: unknown[]): void {
    this.writeLog('INFO', ...args);
  }

  /**
   * INFO 레벨 로그 기록 (log의 별칭)
   *
   * @param args - 로그 메시지 및 데이터
   */
  info(...args: unknown[]): void {
    this.writeLog('INFO', ...args);
  }

  /**
   * WARN 레벨 로그 기록
   *
   * @param args - 로그 메시지 및 데이터
   */
  warn(...args: unknown[]): void {
    this.writeLog('WARN', ...args);
  }

  /**
   * ERROR 레벨 로그 기록
   *
   * @param args - 로그 메시지 및 데이터
   */
  error(...args: unknown[]): void {
    this.writeLog('ERROR', ...args);
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
 * Logger 인스턴스 생성 팩토리 함수
 *
 * @param options - Logger 생성 옵션
 * @returns Logger 인스턴스
 *
 * @example
 * ```typescript
 * const logger = createLogger({
 *   logDir: './logs',
 *   prefix: 'app-',
 *   maxLogFiles: 10
 * });
 * ```
 */
export function createLogger(options: LoggerOptions): Logger {
  return new Logger(options);
}
