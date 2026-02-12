/**
 * @file deploy.ts
 * @description deploy MCP 도구 구현
 *
 * Claude가 stage/release 빌드 및 배포를 실행할 때 사용하는 MCP 도구.
 * - detached 프로세스로 build-deploy.ps1 실행
 * - 로그 파일 경로 반환 (나중에 확인 가능)
 *
 * 개선사항 (v2):
 * - ESM 호환 (__dirname 대체)
 * - release/release-stage 폴더에서 실행 시 경로 보정
 * - UTF-8 인코딩 명시
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ESM에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
// 도구 정의
// ============================================================================

export const deployToolDefinition = {
  name: 'deploy',
  description: 'stage 또는 release 환경에 빌드 및 배포합니다. detached 프로세스로 실행되어 현재 세션에 영향을 주지 않습니다.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      target: {
        type: 'string',
        description: '배포 대상 환경: stage 또는 release',
        enum: ['stage', 'release'],
      },
    },
    required: ['target'],
  },
};

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 저장소 루트 경로를 찾습니다.
 * release/ 또는 release-stage/ 폴더 안에서 실행될 수 있으므로 경로를 보정합니다.
 *
 * claude-beacon/src/mcp/tools/deploy.ts -> claude-beacon -> packages -> estelle2
 */
function findRepoRoot(): string {
  // mcp/tools/deploy.ts -> mcp -> src -> claude-beacon -> packages -> estelle2
  let repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');

  // release/, release-stage/ 폴더 안에서 실행되는 경우 상위로 이동
  const baseName = path.basename(repoRoot);
  if (baseName === 'release' || baseName === 'release-stage') {
    repoRoot = path.dirname(repoRoot);
  }

  return repoRoot;
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
export async function executeDeploy(args: DeployArgs): Promise<McpResponse> {
  const target = args.target;

  // 1. target 검증
  if (!target || (target !== 'stage' && target !== 'release')) {
    return {
      content: [{ type: 'text', text: 'target은 "stage" 또는 "release"여야 해요.' }],
      isError: true,
    };
  }

  // 2. 스크립트 경로 확인
  const repoRoot = findRepoRoot();
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
  // UTF-8 출력을 위해 chcp 65001 사용, Out-File로 인코딩 명시
  try {
    const psCommand = `chcp 65001 | Out-Null; & '${scriptPath}' -Target ${target} 2>&1 | Out-File -FilePath '${logFile}' -Encoding utf8`;

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
