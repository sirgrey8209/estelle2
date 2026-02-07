/**
 * @file deploy.ts
 * @description deploy MCP 도구 구현
 *
 * Claude가 stage/release 빌드 및 배포를 실행할 때 사용하는 MCP 도구.
 * - detached 프로세스로 build-deploy.ps1 실행
 * - 로그 파일 경로 반환 (나중에 확인 가능)
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// ============================================================================
// 타입
// ============================================================================

interface DeployArgs {
  target?: string;
}

interface McpTextContent {
  type: 'text';
  text: string;
}

interface McpResponse {
  content: McpTextContent[];
  isError?: boolean;
}

// ============================================================================
// 메인 함수
// ============================================================================

/**
 * deploy MCP 도구 실행
 *
 * build-deploy.ps1을 detached 프로세스로 실행하여
 * Claude SDK 세션이 끊기지 않도록 합니다.
 */
export async function executeDeploy(
  args: DeployArgs,
): Promise<McpResponse> {
  const target = args.target;

  // 1. target 검증
  if (!target || (target !== 'stage' && target !== 'release')) {
    return {
      content: [{ type: 'text', text: 'target은 "stage" 또는 "release"여야 해요.' }],
      isError: true,
    };
  }

  // 2. 스크립트 경로 확인
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const scriptPath = path.join(repoRoot, 'scripts', 'build-deploy.ps1');

  if (!fs.existsSync(scriptPath)) {
    return {
      content: [{ type: 'text', text: `스크립트를 찾을 수 없어요: ${scriptPath}` }],
      isError: true,
    };
  }

  // 3. 로그 파일 경로
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const logDir = path.join(repoRoot, 'log');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFile = path.join(logDir, `build-${target}-${timestamp}.log`);

  // 4. detached PowerShell 프로세스로 실행
  try {
    const psCommand = `& '${scriptPath}' -Target ${target} *>&1 | Tee-Object -FilePath '${logFile}'`;

    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command', psCommand,
    ], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });

    child.unref();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `${target} 배포가 시작되었어요. (detached)`,
          target,
          logFile,
          pid: child.pid,
        }),
      }],
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `배포 시작 실패: ${errorMsg}` }],
      isError: true,
    };
  }
}
