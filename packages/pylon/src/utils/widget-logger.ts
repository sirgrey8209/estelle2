/**
 * @file widget-logger.ts
 * @description 위젯 세션 로깅
 */

import { appendFile, mkdir } from 'fs/promises';
import path from 'path';

export class WidgetLogger {
  private logPath: string;
  private sessionId: string;

  constructor(cwd: string, sessionId: string) {
    this.sessionId = sessionId;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logDir = path.join(cwd, 'logs');
    this.logPath = path.join(logDir, `widget-${timestamp}.log`);

    // 로그 디렉토리 생성
    mkdir(logDir, { recursive: true }).catch(() => {});
  }

  private async write(level: string, message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const line = data
      ? `[${timestamp}] ${level} ${message} ${JSON.stringify(data)}\n`
      : `[${timestamp}] ${level} ${message}\n`;

    await appendFile(this.logPath, line).catch(() => {});
  }

  sessionStart() {
    this.write('SESSION_START', this.sessionId);
  }

  sessionEnd() {
    this.write('SESSION_END', this.sessionId);
  }

  cliToPylon(type: string, data?: unknown) {
    this.write('CLI→PYLON', type, data);
  }

  pylonToCli(type: string, data?: unknown) {
    this.write('PYLON→CLI', type, data);
  }

  pylonToClient(type: string, data?: unknown) {
    this.write('PYLON→CLIENT', type, data);
  }

  clientToPylon(type: string, data?: unknown) {
    this.write('CLIENT→PYLON', type, data);
  }

  error(message: string, error?: unknown) {
    this.write('ERROR', message, error);
  }
}
