#!/usr/bin/env npx tsx
/**
 * @file build-mcp.ts
 * @description MCP 서버 빌드 스크립트 (esbuild)
 *
 * 환경별로 다른 TCP 포트를 주입하여 MCP 서버를 빌드합니다.
 *
 * 사용법:
 *   npx tsx scripts/build-mcp.ts dev      # 9878 포트
 *   npx tsx scripts/build-mcp.ts stage    # 9877 포트
 *   npx tsx scripts/build-mcp.ts release  # 9876 포트
 *
 * 출력:
 *   dist/mcp/server.js (단일 번들 파일)
 */

import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// ============================================================================
// 설정
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');

/** 환경별 포트 매핑 */
const PORTS: Record<string, number> = {
  dev: 9878,
  stage: 9877,
  release: 9876,
};

// ============================================================================
// 메인
// ============================================================================

async function main(): Promise<void> {
  // 환경 인자 확인
  const env = process.argv[2] as string | undefined;

  if (!env || !PORTS[env]) {
    console.error('Usage: npx tsx scripts/build-mcp.ts <dev|stage|release>');
    console.error('');
    console.error('Environments:');
    console.error('  dev     - Port 9878');
    console.error('  stage   - Port 9877');
    console.error('  release - Port 9876');
    process.exit(1);
  }

  const port = PORTS[env];
  const entryPoint = path.join(packageRoot, 'src/mcp/server.ts');
  const outfile = path.join(packageRoot, 'dist/mcp/server.js');

  // 엔트리 포인트 존재 확인
  if (!fs.existsSync(entryPoint)) {
    console.error(`Entry point not found: ${entryPoint}`);
    process.exit(1);
  }

  // 출력 디렉토리 생성
  const outDir = path.dirname(outfile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`[MCP Build] Building for ${env} environment...`);
  console.log(`  Entry: ${entryPoint}`);
  console.log(`  Output: ${outfile}`);
  console.log(`  Port: ${port}`);

  try {
    await esbuild.build({
      entryPoints: [entryPoint],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node18',
      sourcemap: true,

      // 환경별 상수 주입
      define: {
        '__MCP_PORT__': String(port),
        '__MCP_ENV__': JSON.stringify(env),
      },

      // 외부 의존성 (번들에 포함하지 않음)
      external: [
        '@modelcontextprotocol/sdk',
        '@estelle/core',
        'net',
        'fs',
        'path',
        'url',
      ],

      // 배너 (환경 정보 주석)
      banner: {
        js: `// MCP Server - Built for ${env} environment (port ${port})
// Generated at ${new Date().toISOString()}
`,
      },
    });

    console.log(`[MCP Build] Success! Built MCP server for ${env} (port ${port})`);
  } catch (error) {
    console.error(`[MCP Build] Failed:`, error);
    process.exit(1);
  }
}

main();
