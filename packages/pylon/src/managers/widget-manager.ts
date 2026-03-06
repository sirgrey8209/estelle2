/**
 * @file widget-manager.ts
 * @description Widget 세션 관리자
 *
 * CLI 프로세스를 spawn하고 stdin/stdout으로 Widget Protocol 통신을 관리합니다.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import readline from 'readline';
import {
  ViewNode,
  WidgetCliMessage,
  isWidgetCliRenderMessage,
  isWidgetCliCompleteMessage,
  isWidgetCliErrorMessage,
  isWidgetCliEventMessage,
} from '@estelle/core';
import { WidgetLogger } from '../utils/widget-logger.js';

// ============================================================================
// Types
// ============================================================================

export interface WidgetSession {
  sessionId: string;
  conversationId: number;
  toolUseId: string;
  process: ChildProcess;
  status: 'handshaking' | 'pending' | 'running' | 'completed' | 'error' | 'cancelled';
  ownerClientId: number | null;
  result?: unknown;
  error?: string;
  logger?: WidgetLogger;
}

export interface WidgetStartOptions {
  command: string;
  cwd: string;
  args?: string[];
  conversationId: number;
  toolUseId: string;
}

export interface WidgetRenderEvent {
  sessionId: string;
  view: ViewNode;
}

export interface WidgetCompleteEvent {
  sessionId: string;
  result: unknown;
}

export interface WidgetErrorEvent {
  sessionId: string;
  error: string;
}

export interface WidgetEventEvent {
  sessionId: string;
  data: unknown;
}

// ============================================================================
// WidgetManager
// ============================================================================

export class WidgetManager extends EventEmitter {
  private sessions: Map<string, WidgetSession> = new Map();
  private sessionCounter = 0;

  /**
   * 새 Widget 세션 시작
   */
  async startSession(options: WidgetStartOptions): Promise<string> {
    const sessionId = `widget-${++this.sessionCounter}-${Date.now()}`;

    // 로거 생성 및 세션 시작 로깅
    const logger = new WidgetLogger(options.cwd, sessionId);
    logger.sessionStart();

    const proc = spawn(options.command, options.args ?? [], {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    const session: WidgetSession = {
      sessionId,
      conversationId: options.conversationId,
      toolUseId: options.toolUseId,
      process: proc,
      status: 'running',
      ownerClientId: null,
      logger,
    };

    this.sessions.set(sessionId, session);

    // stdout 라인 파싱
    const rl = readline.createInterface({
      input: proc.stdout!,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      this.handleCliOutput(sessionId, line);
    });

    // stderr 로깅
    proc.stderr?.on('data', (data) => {
      console.error(`[Widget ${sessionId}] stderr:`, data.toString());
    });

    // 프로세스 종료 처리
    proc.on('close', (code) => {
      const sess = this.sessions.get(sessionId);
      if (sess && sess.status === 'running') {
        if (code === 0) {
          sess.status = 'completed';
          sess.logger?.sessionEnd();
        } else {
          sess.status = 'error';
          sess.error = `Process exited with code ${code}`;
          sess.logger?.error(`Process exited with code ${code}`);
          sess.logger?.sessionEnd();
          this.emit('error', { sessionId, error: sess.error });
        }
      }
    });

    proc.on('error', (err) => {
      const sess = this.sessions.get(sessionId);
      if (sess) {
        sess.status = 'error';
        sess.error = err.message;
        sess.logger?.error('Process error', err.message);
        sess.logger?.sessionEnd();
        this.emit('error', { sessionId, error: err.message });
      }
    });

    return sessionId;
  }

  /**
   * CLI stdout 라인 처리
   */
  private handleCliOutput(sessionId: string, line: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const message: WidgetCliMessage = JSON.parse(line);

      // CLI → Pylon 메시지 로깅
      session.logger?.cliToPylon(message.type, message);

      if (isWidgetCliRenderMessage(message)) {
        this.emit('render', {
          sessionId,
          view: message.view,
        } as WidgetRenderEvent);
      } else if (isWidgetCliCompleteMessage(message)) {
        session.status = 'completed';
        session.result = message.result;
        session.logger?.sessionEnd();
        this.emit('complete', {
          sessionId,
          result: message.result,
        } as WidgetCompleteEvent);
      } else if (isWidgetCliErrorMessage(message)) {
        session.status = 'error';
        session.error = message.message;
        session.logger?.error(message.message);
        session.logger?.sessionEnd();
        this.emit('error', {
          sessionId,
          error: message.message,
        } as WidgetErrorEvent);
      } else if (isWidgetCliEventMessage(message)) {
        this.emit('event', {
          sessionId,
          data: message.data,
        } as WidgetEventEvent);
      }
    } catch (err) {
      // JSON 파싱 실패 - 일반 로그로 처리
      console.log(`[Widget ${sessionId}] output:`, line);
    }
  }

  /**
   * 유저 인풋 전송
   */
  sendInput(sessionId: string, data: Record<string, unknown>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') {
      return false;
    }

    const message = JSON.stringify({ type: 'input', data }) + '\n';
    session.logger?.pylonToCli('input', data);
    session.process.stdin?.write(message);
    return true;
  }

  /**
   * CLI로 이벤트 전송
   */
  sendEvent(sessionId: string, data: unknown): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') {
      return false;
    }

    const message = JSON.stringify({ type: 'event', data }) + '\n';
    session.logger?.pylonToCli('event', data);
    session.process.stdin?.write(message);
    return true;
  }

  /**
   * 세션 취소
   */
  cancelSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') {
      return false;
    }

    // 취소 메시지 전송
    const message = JSON.stringify({ type: 'cancel' }) + '\n';
    session.logger?.pylonToCli('cancel');
    session.process.stdin?.write(message);

    // 프로세스 종료
    session.process.kill('SIGTERM');
    session.status = 'cancelled';
    session.logger?.sessionEnd();

    return true;
  }

  /**
   * 세션 조회
   */
  getSession(sessionId: string): WidgetSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 완료 대기 (MCP 도구용)
   */
  waitForCompletion(sessionId: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        reject(new Error('Session not found'));
        return;
      }

      if (session.status === 'completed') {
        resolve(session.result);
        return;
      }

      if (session.status === 'error') {
        reject(new Error(session.error));
        return;
      }

      if (session.status === 'cancelled') {
        reject(new Error('Session cancelled'));
        return;
      }

      const onComplete = (event: WidgetCompleteEvent) => {
        if (event.sessionId === sessionId) {
          cleanup();
          resolve(event.result);
        }
      };

      const onError = (event: WidgetErrorEvent) => {
        if (event.sessionId === sessionId) {
          cleanup();
          reject(new Error(event.error));
        }
      };

      const cleanup = () => {
        this.off('complete', onComplete);
        this.off('error', onError);
      };

      this.on('complete', onComplete);
      this.on('error', onError);
    });
  }

  /**
   * 핸드셰이크 시작 (소유권 할당 전 단계)
   */
  startHandshake(
    sessionId: string,
    targetClientId: number,
    timeout: number,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        resolve(false);
        return;
      }

      session.status = 'handshaking';

      // handler를 hoisting하기 위해 let으로 선언
      let handler: (ack: { sessionId: string; visible: boolean; clientId: number }) => void;

      const timeoutId = setTimeout(() => {
        if (session.status === 'handshaking') {
          session.status = 'pending';
          this.off('handshake_ack', handler);  // 타임아웃 시에도 리스너 제거
          resolve(false);
        }
      }, timeout);

      // 핸드셰이크 응답 대기
      handler = (ack: { sessionId: string; visible: boolean; clientId: number }) => {
        if (ack.sessionId === sessionId && ack.clientId === targetClientId) {
          clearTimeout(timeoutId);
          this.off('handshake_ack', handler);

          if (ack.visible) {
            session.status = 'running';
            session.ownerClientId = targetClientId;
            resolve(true);
          } else {
            session.status = 'pending';
            resolve(false);
          }
        }
      };

      this.on('handshake_ack', handler);
    });
  }

  /**
   * 핸드셰이크 응답 처리
   */
  handleHandshakeAck(sessionId: string, visible: boolean, clientId: number): void {
    this.emit('handshake_ack', { sessionId, visible, clientId });
  }

  /**
   * 소유권 요청 처리 (first-come-first-served)
   * @returns 성공 여부
   */
  claimOwnership(sessionId: string, clientId: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // pending 상태일 때만 claim 가능
    if (session.status !== 'pending') return false;

    session.status = 'running';
    session.ownerClientId = clientId;
    return true;
  }

  /**
   * 소유자 확인
   */
  isOwner(sessionId: string, clientId: number): boolean {
    const session = this.sessions.get(sessionId);
    return session?.ownerClientId === clientId;
  }

  /**
   * 특정 클라이언트가 소유한 세션 목록 조회
   */
  getSessionsByOwner(clientId: number): WidgetSession[] {
    const result: WidgetSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.ownerClientId === clientId && session.status === 'running') {
        result.push(session);
      }
    }
    return result;
  }

  /**
   * 모든 세션 정리
   */
  cleanup(): void {
    for (const [sessionId, session] of this.sessions) {
      if (session.status === 'running') {
        session.process.kill('SIGTERM');
        session.status = 'cancelled';
      }
    }
    this.sessions.clear();
  }
}
