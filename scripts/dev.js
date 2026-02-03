#!/usr/bin/env node
/**
 * @file dev.js
 * @description 올인원 개발 서버 실행 스크립트
 *
 * 실행 시:
 * - 현재 터미널: Relay + Pylon (concurrently)
 * - 새 터미널: Flutter App (Windows에서만)
 */

import { spawn, exec } from 'child_process';
import { platform } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// ============================================================================
// Flutter 앱 실행 (새 터미널)
// ============================================================================

function launchFlutterApp() {
  const appDir = join(rootDir, 'packages', 'app');

  if (platform() === 'win32') {
    // Windows: 새 cmd 창에서 실행
    const cmd = `cd /d "${appDir}" && flutter run -d chrome`;
    exec(`cmd /c "start cmd /k ${cmd}"`, (error) => {
      if (error) {
        console.error('[dev] Failed to launch Flutter app:', error.message);
      }
    });
    console.log('[dev] Flutter app launching in new terminal...');
  } else {
    // macOS/Linux: 지원 안함 (필요시 추가)
    console.log('[dev] Auto-launch not supported on this platform.');
    console.log('[dev] Run manually: cd packages/app && flutter run -d chrome');
  }
}

// ============================================================================
// Backend 실행 (Relay + Pylon)
// ============================================================================

function launchBackend() {
  const backend = spawn('pnpm', ['dev:backend'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  });

  backend.on('error', (error) => {
    console.error('[dev] Failed to start backend:', error.message);
    process.exit(1);
  });

  backend.on('close', (code) => {
    console.log(`[dev] Backend exited with code ${code}`);
    process.exit(code ?? 0);
  });

  // Ctrl+C 처리
  process.on('SIGINT', () => {
    backend.kill('SIGINT');
  });
}

// ============================================================================
// 메인
// ============================================================================

console.log('');
console.log('========================================');
console.log('  Estelle v2 Development Server');
console.log('========================================');
console.log('');
console.log('  Relay:  http://localhost:8080');
console.log('  Pylon:  ws://localhost:9000 (local)');
console.log('  App:    Flutter (new terminal)');
console.log('');
console.log('========================================');
console.log('');

// Flutter 앱 먼저 실행 (새 터미널)
launchFlutterApp();

// Backend 실행 (현재 터미널)
launchBackend();
