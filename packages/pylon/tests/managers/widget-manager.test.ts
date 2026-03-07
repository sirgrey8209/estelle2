/**
 * @file widget-manager.test.ts
 * @description WidgetManager 테스트
 *
 * Widget 세션 관리 기능을 테스트합니다.
 * 실제 CLI 프로세스 대신 mock을 사용하여 테스트합니다.
 */

import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WidgetManager,
  type WidgetSession,
  type WidgetRenderEvent,
  type WidgetCompleteEvent,
  type WidgetErrorEvent,
} from '../../src/managers/widget-manager.js';

// ============================================================================
// Mock Process
// ============================================================================

/**
 * 테스트용 Mock ChildProcess
 */
class MockChildProcess extends EventEmitter {
  stdin = {
    write: vi.fn(),
  };
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  pid = 12345;
  killed = false;

  kill(signal?: string): boolean {
    this.killed = true;
    this.emit('close', signal === 'SIGTERM' ? 0 : 1);
    return true;
  }

  // stdout에 라인을 출력하는 헬퍼
  emitLine(line: string): void {
    // readline은 'line' 이벤트를 발생시키므로, data 이벤트로 라인+개행 전송
    this.stdout.emit('data', Buffer.from(line + '\n'));
  }
}

// ============================================================================
// Spawn Mock
// ============================================================================

let mockProcess: MockChildProcess;
let spawnMock: ReturnType<typeof vi.fn>;

// spawn을 모킹
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawn: (...args: unknown[]) => {
      spawnMock?.(...args);
      return mockProcess;
    },
  };
});

// readline을 모킹하여 stdout 라인 파싱 시뮬레이션
vi.mock('readline', () => {
  return {
    default: {
      createInterface: ({ input }: { input: EventEmitter }) => {
        const rl = new EventEmitter();
        // data 이벤트를 line 이벤트로 변환
        input.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter(Boolean);
          for (const line of lines) {
            rl.emit('line', line);
          }
        });
        return rl;
      },
    },
  };
});

// ============================================================================
// WidgetManager 테스트
// ============================================================================

describe('WidgetManager', () => {
  let manager: WidgetManager;

  // 테스트 헬퍼: prepareSession + startSessionProcess를 한 번에 호출
  const startSession = (options: {
    command: string;
    cwd: string;
    args?: string[];
    conversationId?: number;
    toolUseId?: string;
  }): string => {
    const sessionId = manager.prepareSession({
      command: options.command,
      cwd: options.cwd,
      args: options.args,
      conversationId: options.conversationId ?? 123,
      toolUseId: options.toolUseId ?? 'tool-test',
    });
    manager.startSessionProcess(sessionId, 1); // ownerClientId = 1
    return sessionId;
  };

  beforeEach(() => {
    mockProcess = new MockChildProcess();
    spawnMock = vi.fn();
    manager = new WidgetManager();
    // cancelSession이 error 이벤트를 emit하므로 unhandled error 방지
    manager.on('error', () => {});
  });

  afterEach(() => {
    manager.cleanup();
    vi.clearAllMocks();
  });

  // ============================================================================
  // prepareSession 테스트
  // ============================================================================
  describe('prepareSession', () => {
    it('should return sessionId on prepare', () => {
      const sessionId = manager.prepareSession({
        command: 'node',
        cwd: '/workspace',
        args: ['widget.js'],
        conversationId: 123,
        toolUseId: 'tool-1',
      });

      expect(sessionId).toMatch(/^widget-\d+-\d+$/);
    });

    it('should create session with ready status', () => {
      const sessionId = manager.prepareSession({
        command: 'node',
        cwd: '/workspace',
        conversationId: 123,
        toolUseId: 'tool-1',
      });

      const session = manager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.status).toBe('ready');
      expect(session?.sessionId).toBe(sessionId);
      expect(session?.process).toBeNull(); // CLI 아직 미시작
    });

    it('should increment session counter', () => {
      const id1 = manager.prepareSession({ command: 'cmd1', cwd: '/', conversationId: 1, toolUseId: 't1' });
      const id2 = manager.prepareSession({ command: 'cmd2', cwd: '/', conversationId: 2, toolUseId: 't2' });

      const num1 = parseInt(id1.split('-')[1]);
      const num2 = parseInt(id2.split('-')[1]);
      expect(num2).toBe(num1 + 1);
    });
  });

  // ============================================================================
  // startSessionProcess 테스트
  // ============================================================================
  describe('startSessionProcess', () => {
    it('should start CLI and set status to running', () => {
      const sessionId = manager.prepareSession({
        command: 'node',
        cwd: '/workspace',
        conversationId: 123,
        toolUseId: 'tool-1',
      });

      const started = manager.startSessionProcess(sessionId, 42);

      expect(started).toBe(true);
      const session = manager.getSession(sessionId);
      expect(session?.status).toBe('running');
      expect(session?.ownerClientId).toBe(42);
      expect(session?.process).not.toBeNull();
    });

    it('should spawn process with correct arguments', () => {
      const sessionId = manager.prepareSession({
        command: 'python',
        cwd: '/project',
        args: ['script.py', '--option'],
        conversationId: 123,
        toolUseId: 'tool-1',
      });

      manager.startSessionProcess(sessionId, 1);

      expect(spawnMock).toHaveBeenCalledWith(
        'python',
        ['script.py', '--option'],
        expect.objectContaining({
          cwd: '/project',
          shell: true,
        })
      );
    });

    it('should return false for non-existent session', () => {
      const result = manager.startSessionProcess('non-existent', 1);
      expect(result).toBe(false);
    });

    it('should return false if already started', () => {
      const sessionId = manager.prepareSession({
        command: 'node',
        cwd: '/workspace',
        conversationId: 123,
        toolUseId: 'tool-1',
      });

      manager.startSessionProcess(sessionId, 1);
      const secondStart = manager.startSessionProcess(sessionId, 2);

      expect(secondStart).toBe(false);
    });
  });

  // ============================================================================
  // render 이벤트 테스트
  // ============================================================================
  describe('render event', () => {
    it('should emit render event when CLI outputs render message', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const renderPromise = new Promise<WidgetRenderEvent>((resolve) => {
        manager.on('render', resolve);
      });

      // CLI가 render 메시지 출력 (v2: inputs 필드 없음)
      const renderMessage = JSON.stringify({
        type: 'render',
        view: { type: 'text', content: 'Hello' },
      });
      mockProcess.emitLine(renderMessage);

      const event = await renderPromise;
      expect(event.sessionId).toBe(sessionId);
      expect(event.view).toEqual({ type: 'text', content: 'Hello' });
    });

    it('should correctly parse complex view structure', async () => {
      startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const renderPromise = new Promise<WidgetRenderEvent>((resolve) => {
        manager.on('render', resolve);
      });

      const complexView = {
        type: 'column',
        children: [
          { type: 'text', content: 'Title', style: 'title' },
          { type: 'spacer', size: 10 },
          {
            type: 'row',
            children: [
              { type: 'image', src: 'data:image/png;base64,...' },
              { type: 'text', content: 'Description' },
            ],
          },
        ],
      };

      const renderMessage = JSON.stringify({
        type: 'render',
        view: complexView,
      });
      mockProcess.emitLine(renderMessage);

      const event = await renderPromise;
      expect(event.view).toEqual(complexView);
    });

    it('should emit render event for ScriptViewNode', async () => {
      startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const renderPromise = new Promise<WidgetRenderEvent>((resolve) => {
        manager.on('render', resolve);
      });

      const scriptView = {
        type: 'script',
        code: 'console.log("hello")',
        html: '<div id="root"></div>',
        height: 300,
      };

      mockProcess.emitLine(JSON.stringify({
        type: 'render',
        view: scriptView,
      }));

      const event = await renderPromise;
      expect(event.view).toEqual(scriptView);
    });
  });

  // ============================================================================
  // complete 이벤트 테스트
  // ============================================================================
  describe('complete event', () => {
    it('should emit complete event when CLI outputs complete message', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const completePromise = new Promise<WidgetCompleteEvent>((resolve) => {
        manager.on('complete', resolve);
      });

      mockProcess.emitLine(JSON.stringify({
        type: 'complete',
        result: { selected: 'option1', value: 42 },
      }));

      const event = await completePromise;
      expect(event.sessionId).toBe(sessionId);
      expect(event.result).toEqual({ selected: 'option1', value: 42 });
    });

    it('should update session status to completed', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      mockProcess.emitLine(JSON.stringify({
        type: 'complete',
        result: 'done',
      }));

      // 이벤트 처리 대기
      await new Promise((resolve) => setTimeout(resolve, 10));

      const session = manager.getSession(sessionId);
      expect(session?.status).toBe('completed');
      expect(session?.result).toBe('done');
    });

    it('should handle null result', async () => {
      startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const completePromise = new Promise<WidgetCompleteEvent>((resolve) => {
        manager.on('complete', resolve);
      });

      mockProcess.emitLine(JSON.stringify({
        type: 'complete',
        result: null,
      }));

      const event = await completePromise;
      expect(event.result).toBeNull();
    });
  });

  // ============================================================================
  // error 이벤트 테스트
  // ============================================================================
  describe('error event', () => {
    it('should emit error event when CLI outputs error message', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const errorPromise = new Promise<WidgetErrorEvent>((resolve) => {
        manager.on('error', resolve);
      });

      mockProcess.emitLine(JSON.stringify({
        type: 'error',
        message: 'Something went wrong',
      }));

      const event = await errorPromise;
      expect(event.sessionId).toBe(sessionId);
      expect(event.error).toBe('Something went wrong');
    });

    it('should update session status to error', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      mockProcess.emitLine(JSON.stringify({
        type: 'error',
        message: 'Fatal error',
      }));

      await new Promise((resolve) => setTimeout(resolve, 10));

      const session = manager.getSession(sessionId);
      expect(session?.status).toBe('error');
      expect(session?.error).toBe('Fatal error');
    });

    it('should emit error on process error', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const errorPromise = new Promise<WidgetErrorEvent>((resolve) => {
        manager.on('error', resolve);
      });

      mockProcess.emit('error', new Error('spawn ENOENT'));

      const event = await errorPromise;
      expect(event.sessionId).toBe(sessionId);
      expect(event.error).toBe('spawn ENOENT');
    });

    it('should emit error on non-zero exit code', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const errorPromise = new Promise<WidgetErrorEvent>((resolve) => {
        manager.on('error', resolve);
      });

      mockProcess.emit('close', 1);

      const event = await errorPromise;
      expect(event.sessionId).toBe(sessionId);
      expect(event.error).toContain('exited with code 1');
    });
  });

  // ============================================================================
  // sendInput 테스트
  // ============================================================================
  describe('sendInput', () => {
    it('should send input to stdin', () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const result = manager.sendInput(sessionId, { choice: 'option1' });

      expect(result).toBe(true);
      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        JSON.stringify({ type: 'input', data: { choice: 'option1' } }) + '\n'
      );
    });

    it('should return false for non-existent session', () => {
      const result = manager.sendInput('non-existent', { data: 'test' });

      expect(result).toBe(false);
    });

    it('should return false for completed session', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      // 세션 완료
      mockProcess.emitLine(JSON.stringify({ type: 'complete', result: null }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = manager.sendInput(sessionId, { data: 'test' });
      expect(result).toBe(false);
    });

    it('should send complex input data', () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const inputData = {
        name: 'John',
        age: 30,
        preferences: ['A', 'B'],
        nested: { key: 'value' },
      };

      manager.sendInput(sessionId, inputData);

      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        JSON.stringify({ type: 'input', data: inputData }) + '\n'
      );
    });
  });

  // ============================================================================
  // cancelSession 테스트
  // ============================================================================
  describe('cancelSession', () => {
    it('should cancel running session', () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const result = manager.cancelSession(sessionId);

      expect(result).toBe(true);
    });

    it('should update session status to cancelled', () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      manager.cancelSession(sessionId);

      const session = manager.getSession(sessionId);
      expect(session?.status).toBe('cancelled');
    });

    it('should send cancel message to stdin', () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      manager.cancelSession(sessionId);

      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        JSON.stringify({ type: 'cancel' }) + '\n'
      );
    });

    it('should kill the process', () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      manager.cancelSession(sessionId);

      expect(mockProcess.killed).toBe(true);
    });

    it('should return false for non-existent session', () => {
      const result = manager.cancelSession('non-existent');

      expect(result).toBe(false);
    });

    it('should return false for already completed session', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      mockProcess.emitLine(JSON.stringify({ type: 'complete', result: null }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = manager.cancelSession(sessionId);
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // waitForCompletion 테스트
  // ============================================================================
  describe('waitForCompletion', () => {
    it('should resolve with result on completion', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const waitPromise = manager.waitForCompletion(sessionId);

      mockProcess.emitLine(JSON.stringify({
        type: 'complete',
        result: { answer: 42 },
      }));

      const result = await waitPromise;
      expect(result).toEqual({ answer: 42 });
    });

    it('should reject with error on error event', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const waitPromise = manager.waitForCompletion(sessionId);

      mockProcess.emitLine(JSON.stringify({
        type: 'error',
        message: 'Widget failed',
      }));

      await expect(waitPromise).rejects.toThrow('Widget failed');
    });

    it('should reject for non-existent session', async () => {
      await expect(
        manager.waitForCompletion('non-existent')
      ).rejects.toThrow('Session not found');
    });

    it('should resolve immediately if already completed', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      // 먼저 완료
      mockProcess.emitLine(JSON.stringify({ type: 'complete', result: 'done' }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await manager.waitForCompletion(sessionId);
      expect(result).toBe('done');
    });

    it('should reject immediately if already errored', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      mockProcess.emitLine(JSON.stringify({ type: 'error', message: 'Failed' }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      await expect(
        manager.waitForCompletion(sessionId)
      ).rejects.toThrow('Failed');
    });

    it('should reject if cancelled', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      manager.cancelSession(sessionId);

      await expect(
        manager.waitForCompletion(sessionId)
      ).rejects.toThrow('Session cancelled');
    });
  });

  // ============================================================================
  // getSession 테스트
  // ============================================================================
  describe('getSession', () => {
    it('should return session by id', () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const session = manager.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
    });

    it('should return undefined for non-existent session', () => {
      const session = manager.getSession('non-existent');

      expect(session).toBeUndefined();
    });
  });

  // ============================================================================
  // cleanup 테스트
  // ============================================================================
  describe('cleanup', () => {
    it('should cancel all running sessions', () => {
      startSession({ command: 'cmd1', cwd: '/' });
      startSession({ command: 'cmd2', cwd: '/' });

      manager.cleanup();

      // 모든 세션이 취소되어야 함
      expect(mockProcess.killed).toBe(true);
    });

    it('should clear all sessions', () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      manager.cleanup();

      const session = manager.getSession(sessionId);
      expect(session).toBeUndefined();
    });
  });

  // ============================================================================
  // Ownership 테스트
  // ============================================================================
  describe('ownership', () => {
    describe('claimOwnership', () => {
      it('should reject claim for non-existent session', () => {
        const result = manager.claimOwnership('non-existent', 1);
        expect(result).toBeNull();
      });

      it('should claim ready session and start it', () => {
        // prepareSession만 호출 (ready 상태)
        const sessionId = manager.prepareSession({
          command: 'node',
          cwd: '/workspace',
          conversationId: 123,
          toolUseId: 'tool-1',
        });

        const result = manager.claimOwnership(sessionId, 42);

        expect(result).toEqual({ started: true });
        const session = manager.getSession(sessionId);
        expect(session?.status).toBe('running');
        expect(session?.ownerClientId).toBe(42);
      });

      it('should cancel running session when claimed by another', () => {
        // 먼저 시작 (running 상태)
        const sessionId = startSession({
          command: 'node',
          cwd: '/workspace',
          conversationId: 123,
          toolUseId: 'tool-1',
        });

        // cancelSession이 error 이벤트를 emit하므로 리스너 등록
        manager.on('error', () => {});

        // 다른 클라이언트가 claim
        const result = manager.claimOwnership(sessionId, 999);

        expect(result).toEqual({ cancelled: true, reason: 'claimed_by_other' });
      });
    });

    describe('isOwner', () => {
      it('should return false for non-existent session', () => {
        const result = manager.isOwner('non-existent', 1);
        expect(result).toBe(false);
      });

      it('should return true when clientId matches owner', () => {
        const sessionId = startSession({
          command: 'node',
          cwd: '/workspace',
          conversationId: 123,
          toolUseId: 'tool-1',
        });

        // startSession 헬퍼는 ownerClientId = 1로 설정
        const result = manager.isOwner(sessionId, 1);
        expect(result).toBe(true);
      });

      it('should return false when clientId does not match', () => {
        const sessionId = startSession({
          command: 'node',
          cwd: '/workspace',
          conversationId: 123,
          toolUseId: 'tool-1',
        });

        const result = manager.isOwner(sessionId, 999);
        expect(result).toBe(false);
      });
    });

    describe('getSessionsByOwner', () => {
      it('should return empty array when no sessions exist', () => {
        const result = manager.getSessionsByOwner(1);
        expect(result).toEqual([]);
      });

      it('should return sessions owned by clientId', () => {
        const sessionId = startSession({
          command: 'node',
          cwd: '/workspace',
          conversationId: 123,
          toolUseId: 'tool-1',
        });

        // startSession 헬퍼는 ownerClientId = 1로 설정
        const result = manager.getSessionsByOwner(1);
        expect(result.length).toBe(1);
        expect(result[0].sessionId).toBe(sessionId);
      });

      it('should return empty array when no matching owner', () => {
        startSession({
          command: 'node',
          cwd: '/workspace',
          conversationId: 123,
          toolUseId: 'tool-1',
        });

        const result = manager.getSessionsByOwner(999);
        expect(result).toEqual([]);
      });
    });

  });

  // ============================================================================
  // 비정상 입력 처리 테스트
  // ============================================================================
  describe('invalid input handling', () => {
    it('should ignore non-JSON output', async () => {
      startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const renderSpy = vi.fn();
      manager.on('render', renderSpy);

      // 일반 텍스트 출력 (JSON이 아님)
      mockProcess.emitLine('Starting widget...');
      mockProcess.emitLine('Processing...');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(renderSpy).not.toHaveBeenCalled();
    });

    it('should ignore unknown message types', async () => {
      startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const renderSpy = vi.fn();
      const completeSpy = vi.fn();
      const errorSpy = vi.fn();

      manager.on('render', renderSpy);
      manager.on('complete', completeSpy);
      manager.on('error', errorSpy);

      mockProcess.emitLine(JSON.stringify({ type: 'unknown', data: 'test' }));

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(renderSpy).not.toHaveBeenCalled();
      expect(completeSpy).not.toHaveBeenCalled();
      // error는 프로세스 에러 시에만 발생
    });

    it('should handle malformed JSON gracefully', async () => {
      const sessionId = startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const renderSpy = vi.fn();
      manager.on('render', renderSpy);

      // 잘못된 JSON
      mockProcess.emitLine('{ invalid json }');

      await new Promise((resolve) => setTimeout(resolve, 10));

      // 에러 없이 무시되어야 함
      expect(renderSpy).not.toHaveBeenCalled();

      // 세션은 여전히 running 상태
      const session = manager.getSession(sessionId);
      expect(session?.status).toBe('running');
    });
  });
});
