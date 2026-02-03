/**
 * PidManager - 프로세스 ID 관리
 *
 * 기능:
 * - PID 파일 생성/삭제
 * - 기존 프로세스 감지 및 종료
 * - 프로세스 실행 상태 확인
 *
 * @module utils/pid-manager
 */

import fs from 'fs';

/**
 * 초기화 콜백 옵션
 */
export interface InitializeOptions {
  /** 기존 PID 발견시 호출되는 콜백 */
  onExistingPid?: (pid: number) => void;
}

/**
 * PidManager 생성 옵션
 */
export interface PidManagerOptions {
  /** PID 파일 경로 */
  pidFile: string;
}

/**
 * PidManager 클래스
 *
 * 단일 인스턴스 실행을 보장하기 위한 PID 파일 관리자입니다.
 *
 * @example
 * ```typescript
 * const manager = createPidManager({ pidFile: './pylon.pid' });
 * manager.initialize({
 *   onExistingPid: (pid) => console.log(`Found existing: ${pid}`)
 * });
 * // ... 앱 실행 ...
 * manager.cleanup();
 * ```
 */
export class PidManager {
  /** PID 파일 경로 */
  private readonly pidFile: string;

  /**
   * PidManager 인스턴스 생성
   *
   * @param options - PidManager 생성 옵션
   */
  constructor(options: PidManagerOptions) {
    this.pidFile = options.pidFile;
  }

  /**
   * PID 관리자 초기화
   *
   * - 기존 PID 파일 확인 및 콜백 호출
   * - 새 PID 파일 생성
   *
   * @param options - 초기화 옵션
   * @returns 현재 프로세스 ID
   *
   * @example
   * ```typescript
   * const pid = manager.initialize({
   *   onExistingPid: (oldPid) => {
   *     console.log(`기존 프로세스: ${oldPid}`);
   *     if (manager.isProcessRunning(oldPid)) {
   *       manager.killProcess(oldPid);
   *     }
   *   }
   * });
   * console.log(`현재 PID: ${pid}`);
   * ```
   */
  initialize(options: InitializeOptions = {}): number {
    const { onExistingPid } = options;

    // 기존 PID 파일 확인
    if (fs.existsSync(this.pidFile)) {
      const oldPidStr = fs.readFileSync(this.pidFile, 'utf-8').trim();
      const oldPid = parseInt(oldPidStr, 10);

      if (!isNaN(oldPid) && onExistingPid) {
        onExistingPid(oldPid);
      }
    }

    // 새 PID 파일 생성
    const currentPid = process.pid;
    fs.writeFileSync(this.pidFile, String(currentPid));

    return currentPid;
  }

  /**
   * PID 파일 정리 (삭제)
   *
   * 프로세스 종료시 호출하여 PID 파일을 삭제합니다.
   */
  cleanup(): void {
    try {
      if (fs.existsSync(this.pidFile)) {
        fs.unlinkSync(this.pidFile);
      }
    } catch {
      // 삭제 실패 무시
    }
  }

  /**
   * PID 파일에서 PID 읽기
   *
   * @returns PID 문자열, 파일 없으면 null
   */
  getPid(): string | null {
    if (fs.existsSync(this.pidFile)) {
      return fs.readFileSync(this.pidFile, 'utf-8').trim();
    }
    return null;
  }

  /**
   * PID 파일 경로 반환
   *
   * @returns PID 파일의 전체 경로
   */
  getPidFilePath(): string {
    return this.pidFile;
  }

  /**
   * 프로세스 실행 여부 확인
   *
   * @param pid - 확인할 프로세스 ID
   * @returns 프로세스 실행중이면 true
   *
   * @example
   * ```typescript
   * if (manager.isProcessRunning(1234)) {
   *   console.log('프로세스 1234가 실행 중');
   * }
   * ```
   */
  isProcessRunning(pid: number): boolean {
    try {
      // signal 0은 실제로 시그널을 보내지 않고 프로세스 존재 여부만 확인
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 프로세스 종료
   *
   * @param pid - 종료할 프로세스 ID
   * @param signal - 종료 시그널 (기본: SIGTERM)
   * @returns 종료 성공시 true
   *
   * @example
   * ```typescript
   * if (manager.killProcess(1234)) {
   *   console.log('프로세스 종료됨');
   * }
   * ```
   */
  killProcess(pid: number, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    try {
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 프로세스 종료 핸들러 등록
   *
   * exit, SIGINT, SIGTERM 이벤트에 cleanup을 등록합니다.
   *
   * @example
   * ```typescript
   * manager.initialize();
   * manager.registerExitHandlers();
   * // 이제 프로세스 종료시 자동으로 PID 파일 삭제
   * ```
   */
  registerExitHandlers(): void {
    process.on('exit', () => {
      this.cleanup();
    });

    process.on('SIGINT', () => {
      this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.cleanup();
      process.exit(0);
    });
  }
}

/**
 * PidManager 인스턴스 생성 팩토리 함수
 *
 * @param options - PidManager 생성 옵션
 * @returns PidManager 인스턴스
 *
 * @example
 * ```typescript
 * const manager = createPidManager({
 *   pidFile: path.join(__dirname, 'pylon.pid')
 * });
 * ```
 */
export function createPidManager(options: PidManagerOptions): PidManager {
  return new PidManager(options);
}
