/**
 * @file cli.ts
 * @description CLI 진입점
 *
 * CLI로 실행 시 main() 함수를 호출하여 릴레이 서버를 시작합니다.
 * - `node dist/cli.js` 실행 시 서버가 시작됨
 * - PORT 환경변수로 포트 지정 가능
 * - 시작 로그 출력
 */

import { DEFAULT_PORT } from './constants.js';

// ============================================================================
// 타입 정의
// ============================================================================

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
 * 현재 기본 포트를 가져옵니다.
 *
 * @description
 * 환경변수 DEFAULT_PORT가 설정되어 있으면 해당 값을 사용하고,
 * 그렇지 않으면 constants.ts의 DEFAULT_PORT를 사용합니다.
 * 테스트에서 포트 충돌을 방지하기 위해 런타임에 환경변수를 읽습니다.
 */
function getDefaultPort(): number {
  const envDefaultPort = process.env['DEFAULT_PORT'];
  if (envDefaultPort) {
    const parsed = parseInt(envDefaultPort, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return DEFAULT_PORT;
}

/**
 * 환경변수에서 포트를 파싱합니다.
 *
 * @returns 파싱된 포트 또는 기본 포트
 * @throws 포트가 유효하지 않으면 에러
 */
function parsePortFromEnv(): number {
  const envPort = process.env['PORT'];
  const defaultPort = getDefaultPort();

  // 환경변수가 없거나 빈 문자열이면 기본 포트 사용
  if (envPort === undefined || envPort === '') {
    return defaultPort;
  }

  const parsed = parseInt(envPort, 10);

  // 숫자가 아니면 기본 포트 사용
  if (isNaN(parsed)) {
    return defaultPort;
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
 * @returns CLI 실행 결과 (main() 사용 시 void)
 * @throws 포트가 유효하지 않으면 에러
 *
 * @example
 * ```typescript
 * await runCli();
 * ```
 */
export async function runCli(): Promise<void> {
  // 환경변수에서 포트 파싱
  const port = parsePortFromEnv();

  // main() 함수 사용 (STATIC_DIR 지원)
  const { main } = await import('./server.js');
  await main({ port });
}
