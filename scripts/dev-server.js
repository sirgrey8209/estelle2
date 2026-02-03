#!/usr/bin/env node
/**
 * @file dev-server.js
 * @description 개발 서버 프로세스 관리자
 *
 * 명령어:
 *   node scripts/dev-server.js start   - 서버 시작
 *   node scripts/dev-server.js stop    - 서버 종료
 *   node scripts/dev-server.js status  - 상태 확인
 *   node scripts/dev-server.js restart - 재시작
 */

import { spawn, exec } from 'child_process';
import { platform } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { createRequire } from 'module';
import { config as loadEnv } from 'dotenv';

const require = createRequire(import.meta.url);
const treeKill = require('tree-kill');

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const pidFile = join(rootDir, '.dev-server.pid');

// .env 파일 로드
loadEnv({ path: join(rootDir, '.env') });

// ============================================================================
// PID 파일 관리
// ============================================================================

function savePids(pids) {
  writeFileSync(pidFile, JSON.stringify(pids, null, 2));
}

function loadPids() {
  if (!existsSync(pidFile)) return null;
  try {
    return JSON.parse(readFileSync(pidFile, 'utf-8'));
  } catch {
    return null;
  }
}

function clearPids() {
  if (existsSync(pidFile)) {
    unlinkSync(pidFile);
  }
}

// ============================================================================
// 프로세스 확인
// ============================================================================

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// 프로세스 종료
// ============================================================================

function killProcess(pid) {
  return new Promise((resolve) => {
    treeKill(pid, 'SIGTERM', (err) => {
      if (err) {
        // SIGTERM 실패 시 SIGKILL 시도
        treeKill(pid, 'SIGKILL', () => resolve());
      } else {
        resolve();
      }
    });
  });
}

// ============================================================================
// 명령어: start
// ============================================================================

async function start() {
  const existingPids = loadPids();

  if (existingPids) {
    const running = Object.entries(existingPids).filter(([, pid]) => isProcessRunning(pid));
    if (running.length > 0) {
      console.log('[dev] Server already running. Use "pnpm dev:stop" to stop.');
      console.log('[dev] Running processes:', running.map(([name]) => name).join(', '));
      return;
    }
    clearPids();
  }

  console.log('');
  console.log('========================================');
  console.log('  Estelle v2 Development Server');
  console.log('========================================');
  console.log('');

  const pids = {};

  // Relay 시작
  const relay = spawn('pnpm', ['dev:relay'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    detached: false,
  });
  pids.relay = relay.pid;

  relay.stdout.on('data', (data) => {
    process.stdout.write(`[relay] ${data}`);
  });
  relay.stderr.on('data', (data) => {
    process.stderr.write(`[relay] ${data}`);
  });

  // Pylon 시작
  const pylon = spawn('pnpm', ['dev:pylon'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    detached: false,
  });
  pids.pylon = pylon.pid;

  pylon.stdout.on('data', (data) => {
    process.stdout.write(`[pylon] ${data}`);
  });
  pylon.stderr.on('data', (data) => {
    process.stderr.write(`[pylon] ${data}`);
  });

  // Expo 앱 (새 터미널)
  if (platform() === 'win32') {
    const appDir = join(rootDir, 'packages', 'client').replace(/\//g, '\\');
    // PowerShell로 새 터미널 열고 PID 얻기
    const expoCmd = `cd /d "${appDir}" && pnpm start`;
    const psScript = `$p = Start-Process cmd -ArgumentList '/k','${expoCmd.replace(/'/g, "''")}' -PassThru; $p.Id`;
    exec(`powershell -Command "${psScript}"`, { cwd: rootDir }, (err, stdout) => {
      if (!err && stdout.trim()) {
        pids.expo = parseInt(stdout.trim());
        savePids(pids);  // PID 다시 저장
        console.log(`[dev] Expo PID: ${pids.expo}`);
      }
    });
    console.log('[dev] Expo app launching in new terminal...');
  } else {
    console.log('[dev] Run Expo manually: cd packages/client && pnpm start');
  }

  // PID 저장
  savePids(pids);

  console.log('');
  console.log('  Relay:  http://localhost:8080');
  console.log('  Pylon:  ws://localhost:9000 (local)');
  console.log('  App:    Expo (new terminal)');
  console.log('');
  console.log('  Stop:   pnpm dev:stop');
  console.log('');
  console.log('========================================');
  console.log('');

  // 프로세스 종료 감지
  relay.on('close', (code) => {
    console.log(`[relay] Exited with code ${code}`);
  });

  pylon.on('close', (code) => {
    console.log(`[pylon] Exited with code ${code}`);
  });

  // Ctrl+C 처리 (포그라운드 실행 시)
  process.on('SIGINT', async () => {
    console.log('\n[dev] Shutting down...');
    await stop();
    process.exit(0);
  });

  // 프로세스 유지
  await new Promise(() => {});
}

// ============================================================================
// 명령어: stop
// ============================================================================

async function stop() {
  const pids = loadPids();

  if (!pids) {
    console.log('[dev] No server running.');
    return;
  }

  console.log('[dev] Stopping dev server...');

  for (const [name, pid] of Object.entries(pids)) {
    if (isProcessRunning(pid)) {
      console.log(`[dev] Killing ${name} (PID: ${pid})...`);
      await killProcess(pid);
    }
  }

  // Expo는 pids에 포함되어 위에서 함께 종료됨

  clearPids();
  console.log('[dev] Server stopped.');
}

// ============================================================================
// 명령어: status
// ============================================================================

function status() {
  const pids = loadPids();

  if (!pids) {
    console.log('[dev] No server running.');
    return;
  }

  console.log('[dev] Server status:');
  for (const [name, pid] of Object.entries(pids)) {
    const running = isProcessRunning(pid);
    console.log(`  ${name}: ${running ? '✅ running' : '❌ stopped'} (PID: ${pid})`);
  }
}

// ============================================================================
// 명령어: restart
// ============================================================================

async function restart() {
  await stop();
  await new Promise(r => setTimeout(r, 1000));
  await start();
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
  default:
    console.log('Usage: node scripts/dev-server.js [start|stop|status|restart]');
    process.exit(1);
}
