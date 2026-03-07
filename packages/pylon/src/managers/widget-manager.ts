/**
 * @file widget-manager.ts
 * @description Widget 세션 관리자
 *
 * CLI 프로세스를 spawn하고 stdin/stdout으로 Widget Protocol 통신을 관리합니다.
 *
 * ## 단순화된 핸드셰이크 프로토콜
 *
 * 1. prepareSession() - 세션 생성 (CLI 미시작, status: 'ready')
 * 2. Pylon이 전체에 widget_ready broadcast (preferredClientId 포함)
 * 3. preferredClient가 자동으로 widget_claim 전송 → owner가 됨
 * 4. 또는 다른 클라이언트가 widget_claim → 기존 owner 종료 후 새 owner
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
  process: ChildProcess | null; // 핸드셰이크 완료 전에는 null
  status: 'ready' | 'running' | 'completed' | 'error' | 'cancelled';
  ownerClientId: number | null;
  result?: unknown;
  error?: string;
  logger?: WidgetLogger;
  // CLI 시작에 필요한 정보 (prepareSession에서 저장, startSessionProcess에서 사용)
  command: string;
  cwd: string;
  args?: string[];
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
   * 세션 준비 (CLI 미시작)
   *
   * widget_ready broadcast 전 단계. 세션 정보만 저장하고 CLI는 시작하지 않음.
   * widget_claim 수신 후 startSessionProcess()로 CLI 시작.
   */
  prepareSession(options: WidgetStartOptions): string {
    const sessionId = `widget-${++this.sessionCounter}-${Date.now()}`;

    const logger = new WidgetLogger(options.cwd, sessionId);
    logger.sessionStart();

    const session: WidgetSession = {
      sessionId,
      conversationId: options.conversationId,
      toolUseId: options.toolUseId,
      process: null, // CLI 아직 시작 안 함
      status: 'ready',
      ownerClientId: null,
      logger,
      // CLI 시작에 필요한 정보 저장
      command: options.command,
      cwd: options.cwd,
      args: options.args,
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * CLI 프로세스 시작 (owner 설정 후)
   *
   * 핸드셰이크 성공 또는 claim 성공 후 호출.
   * owner를 설정하고 CLI 프로세스를 spawn.
   */
  startSessionProcess(sessionId: string, ownerClientId: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.process) return false; // 이미 시작됨

    session.ownerClientId = ownerClientId;
    session.status = 'running';

    const proc = spawn(session.command, session.args ?? [], {
      cwd: session.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    session.process = proc;

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

    return true;
  }

  /**
   * 세션 상태 변경
   */
  setSessionStatus(sessionId: string, status: WidgetSession['status']): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.status = status;
    return true;
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
        console.log(`[WidgetManager] CLI event received: sessionId=${sessionId}, data=`, message.data);
        this.emit('event', {
          sessionId,
          data: message.data,
        } as WidgetEventEvent);
        console.log(`[WidgetManager] event emitted`);
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
    if (!session || session.status !== 'running' || !session.process) {
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
    if (!session || session.status !== 'running' || !session.process) {
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
    if (!session) return false;

    // ready 상태면 CLI 없이 취소
    if (session.status === 'ready') {
      session.status = 'cancelled';
      session.logger?.sessionEnd();
      return true;
    }

    if (session.status !== 'running' || !session.process) {
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

    // waitForCompletion이 대기 중일 수 있으므로 error 이벤트 emit
    this.emit('error', { sessionId, error: 'cancelled by duplication' } as WidgetErrorEvent);

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
   * 소유권 요청 처리 (ready 또는 running 상태)
   *
   * - ready 상태: owner 설정 후 CLI 시작
   * - running 상태: 기존 owner 종료 후 { cancelled: true } 반환
   *
   * @returns { started: true } | { cancelled: true, reason: string } | null (실패)
   */
  claimOwnership(sessionId: string, clientId: number): { started: true } | { cancelled: true; reason: string } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // ready 상태: 첫 claim → owner가 되어 CLI 시작
    if (session.status === 'ready') {
      const started = this.startSessionProcess(sessionId, clientId);
      return started ? { started: true } : null;
    }

    // running 상태: 이미 owner가 있음 → 기존 세션 종료
    if (session.status === 'running') {
      this.cancelSession(sessionId);
      return { cancelled: true, reason: 'claimed_by_other' };
    }

    return null;
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
    for (const [, session] of this.sessions) {
      if (session.process && session.status === 'running') {
        session.process.kill('SIGTERM');
      }
      session.status = 'cancelled';
    }
    this.sessions.clear();
  }
}
