#!/usr/bin/env node
/**
 * @file beacon.js
 * @description PM2 기반 Beacon 서버 관리자
 *
 * 명령어:
 *   node scripts/beacon.js start   - 서버 시작
 *   node scripts/beacon.js stop    - 서버 종료
 *   node scripts/beacon.js status  - 상태 확인
 *   node scripts/beacon.js restart - 재시작
 *   node scripts/beacon.js logs    - 로그 보기
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const configPath = join(rootDir, 'config', 'environments.json');
const beaconDir = join(rootDir, 'packages', 'claude-beacon');
const ecosystemPath = join(beaconDir, 'ecosystem.config.cjs');

// 환경 설정 로드
const envConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
const beaconConfig = envConfig.beacon;

/**
 * PM2 명령 실행
 */
function pm2(args, options = {}) {
  const result = spawn('pm2', args, {
    cwd: beaconDir,
    stdio: options.silent ? 'pipe' : 'inherit',
    shell: true,
  });

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    if (options.silent) {
      result.stdout?.on('data', (data) => { stdout += data; });
      result.stderr?.on('data', (data) => { stderr += data; });
    }

    result.on('close', (code) => {
      if (code === 0 || options.ignoreError) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`PM2 exited with code ${code}`));
      }
    });
  });
}

/**
 * PM2 프로세스 존재 여부 확인
 */
async function isRunning(name) {
  try {
    const result = await pm2(['describe', name], { silent: true, ignoreError: true });
    return result.code === 0 && !result.stderr.includes('not found');
  } catch {
    return false;
  }
}

// ============================================================================
// 명령어
// ============================================================================

async function start() {
  const name = beaconConfig.pm2Name;

  if (await isRunning(name)) {
    console.log(`[beacon] ${name} is already running. Use "pnpm beacon:restart" to restart.`);
    return;
  }

  console.log('');
  console.log('========================================');
  console.log('  Estelle Beacon Server (PM2)');
  console.log('========================================');
  console.log('');
  console.log(`  Port: ${beaconConfig.port}`);
  console.log('');
  console.log('  Logs:   pnpm beacon:logs');
  console.log('  Stop:   pnpm beacon:stop');
  console.log('');
  console.log('========================================');
  console.log('');

  console.log('[beacon] Starting with PM2...');
  await pm2(['start', ecosystemPath]);

  console.log('');
  console.log('[beacon] Started.');
}

async function stop() {
  const name = beaconConfig.pm2Name;

  console.log('[beacon] Stopping...');

  if (await isRunning(name)) {
    await pm2(['delete', name], { ignoreError: true });
  }

  console.log('[beacon] Stopped.');
}

async function status() {
  const name = beaconConfig.pm2Name;
  const running = await isRunning(name);
  const statusText = running ? '✅ running' : '❌ stopped';
  console.log(`[beacon] ${name}: ${statusText}`);
}

async function restart() {
  const name = beaconConfig.pm2Name;

  console.log('[beacon] Restarting...');

  if (await isRunning(name)) {
    await pm2(['restart', name]);
  } else {
    await start();
  }

  console.log('[beacon] Restarted.');
}

async function logs() {
  const name = beaconConfig.pm2Name;

  if (!(await isRunning(name))) {
    console.log('[beacon] Not running.');
    return;
  }

  console.log('[beacon] Showing logs... (Ctrl+C to exit)');
  console.log('');

  await pm2(['logs', name, '--lines', '50']);
}

// ============================================================================
// 메인
// ============================================================================

const command = process.argv[2] || 'start';

switch (command) {
  case 'start':
    start();
    break;
  case 'stop':
    stop();
    break;
  case 'status':
    status();
    break;
  case 'restart':
    restart();
    break;
  case 'logs':
    logs();
    break;
  default:
    console.log('Usage: node scripts/beacon.js [start|stop|status|restart|logs]');
    process.exit(1);
}
