/**
 * @file cli.ts
 * @description CLI 진입점
 *
 * CLI로 실행 시 main() 함수를 호출하여 릴레이 서버를 시작합니다.
 * - `node dist/cli.js` 실행 시 서버가 시작됨
 * - PORT 환경변수로 포트 지정 가능
 * - 시작 로그 출력
 */

import type { RelayServer } from './server.js';
import { createRelayServer } from './server.js';
import { DEFAULT_PORT } from './constants.js';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * CLI 실행 결과
 */
export interface CliResult {
  /** 서버 시작 성공 여부 */
  started: boolean;

  /** 사용된 포트 */
  port: number;

  /** 서버 인스턴스 */
  server: RelayServer;
}

/**
 * CLI 인자 파싱 결과
 */
export interface CliArgs {
  /** 포트 번호 (지정되지 않으면 undefined) */
  port?: number;
}

// ============================================================================
// 유효성 검사
// ============================================================================

/**
 * 포트 번호가 유효한지 검사합니다.
 *
 * @param port - 검사할 포트 번호
 * @throws 포트가 1~65535 범위를 벗어나면 에러
 */
function validatePort(port: number): void {
  if (port < 1 || port > 65535) {
    throw new Error('Invalid port');
  }
}

/**
 * 환경변수에서 포트를 파싱합니다.
 *
 * @returns 파싱된 포트 또는 기본 포트
 * @throws 포트가 유효하지 않으면 에러
 */
function parsePortFromEnv(): number {
  const envPort = process.env['PORT'];

  // 환경변수가 없거나 빈 문자열이면 기본 포트 사용
  if (envPort === undefined || envPort === '') {
    return DEFAULT_PORT;
  }

  const parsed = parseInt(envPort, 10);

  // 숫자가 아니면 기본 포트 사용
  if (isNaN(parsed)) {
    return DEFAULT_PORT;
  }

  // 유효 범위 검사
  validatePort(parsed);

  return parsed;
}

// ============================================================================
// CLI 인자 파싱
// ============================================================================

/**
 * CLI 인자를 파싱합니다.
 *
 * @param args - CLI 인자 배열
 * @returns 파싱된 CLI 인자
 * @throws --port 플래그에 값이 없으면 에러
 * @throws --port 값이 숫자가 아니면 에러
 *
 * @example
 * ```typescript
 * parseCliArgs(['--port', '3000']); // { port: 3000 }
 * parseCliArgs(['-p', '4000']); // { port: 4000 }
 * parseCliArgs(['--port=5000']); // { port: 5000 }
 * parseCliArgs([]); // { port: undefined }
 * ```
 */
export function parseCliArgs(args: string[]): CliArgs {
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // --port=값 형식 처리
    if (arg.startsWith('--port=')) {
      const value = arg.slice('--port='.length);
      const parsed = parseInt(value, 10);

      if (isNaN(parsed)) {
        throw new Error('Invalid port value');
      }

      result.port = parsed;
      continue;
    }

    // --port 또는 -p 플래그 처리
    if (arg === '--port' || arg === '-p') {
      const nextArg = args[i + 1];

      // 다음 인자가 없거나 다른 플래그인 경우
      if (nextArg === undefined || nextArg.startsWith('-')) {
        throw new Error('Missing value for --port');
      }

      const parsed = parseInt(nextArg, 10);

      if (isNaN(parsed)) {
        throw new Error('Invalid port value');
      }

      result.port = parsed;
      i++; // 값을 소비했으므로 인덱스 증가
      continue;
    }
  }

  return result;
}

// ============================================================================
// CLI 실행
// ============================================================================

/**
 * CLI를 실행하여 서버를 시작합니다.
 *
 * @returns CLI 실행 결과
 * @throws 포트가 유효하지 않으면 에러
 *
 * @example
 * ```typescript
 * const result = await runCli();
 * console.log(`Server started on port ${result.port}`);
 * ```
 */
export async function runCli(): Promise<CliResult> {
  // 환경변수에서 포트 파싱
  const port = parsePortFromEnv();

  // WebSocketServer 동적 import
  const { WebSocketServer } = await import('ws');

  // WebSocket 서버 생성
  const wss = new WebSocketServer({ port });

  // Relay 서버 생성
  const server = createRelayServer(wss, { port });

  // 서버 시작
  server.start();

  // 시작 로그 출력
  console.log(`[Estelle Relay v2] Started on port ${port}`);

  // 시그널 핸들러 등록 (중복 호출 방지)
  let isShuttingDown = false;
  const handleShutdown = (): void => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    server.stop();
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  return {
    started: true,
    port,
    server,
  };
}
