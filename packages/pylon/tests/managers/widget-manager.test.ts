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

  beforeEach(() => {
    mockProcess = new MockChildProcess();
    spawnMock = vi.fn();
    manager = new WidgetManager();
  });

  afterEach(() => {
    manager.cleanup();
    vi.clearAllMocks();
  });

  // ============================================================================
  // startSession 테스트
  // ============================================================================
  describe('startSession', () => {
    it('should return sessionId on start', async () => {
      const sessionId = await manager.startSession({
        command: 'node',
        cwd: '/workspace',
        args: ['widget.js'],
      });

      expect(sessionId).toMatch(/^widget-\d+-\d+$/);
    });

    it('should create session with running status', async () => {
      const sessionId = await manager.startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const session = manager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.status).toBe('running');
      expect(session?.sessionId).toBe(sessionId);
    });

    it('should spawn process with correct arguments', async () => {
      await manager.startSession({
        command: 'python',
        cwd: '/project',
        args: ['script.py', '--option'],
      });

      expect(spawnMock).toHaveBeenCalledWith(
        'python',
        ['script.py', '--option'],
        expect.objectContaining({
          cwd: '/project',
          shell: true,
        })
      );
    });

    it('should increment session counter', async () => {
      const id1 = await manager.startSession({ command: 'cmd1', cwd: '/' });
      const id2 = await manager.startSession({ command: 'cmd2', cwd: '/' });

      // 세션 번호가 증가해야 함
      const num1 = parseInt(id1.split('-')[1]);
      const num2 = parseInt(id2.split('-')[1]);
      expect(num2).toBe(num1 + 1);
    });
  });

  // ============================================================================
  // render 이벤트 테스트
  // ============================================================================
  describe('render event', () => {
    it('should emit render event when CLI outputs render message', async () => {
      const sessionId = await manager.startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const renderPromise = new Promise<WidgetRenderEvent>((resolve) => {
        manager.on('render', resolve);
      });

      // CLI가 render 메시지 출력
      const renderMessage = JSON.stringify({
        type: 'render',
        view: { type: 'text', content: 'Hello' },
        inputs: [{ type: 'buttons', id: 'btn', options: ['OK', 'Cancel'] }],
      });
      mockProcess.emitLine(renderMessage);

      const event = await renderPromise;
      expect(event.sessionId).toBe(sessionId);
      expect(event.view).toEqual({ type: 'text', content: 'Hello' });
      expect(event.inputs).toHaveLength(1);
      expect(event.inputs[0]).toEqual({
        type: 'buttons',
        id: 'btn',
        options: ['OK', 'Cancel'],
      });
    });

    it('should correctly parse complex view structure', async () => {
      const sessionId = await manager.startSession({
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
        inputs: [],
      });
      mockProcess.emitLine(renderMessage);

      const event = await renderPromise;
      expect(event.view).toEqual(complexView);
    });

    it('should parse multiple input types correctly', async () => {
      await manager.startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const renderPromise = new Promise<WidgetRenderEvent>((resolve) => {
        manager.on('render', resolve);
      });

      const inputs = [
        { type: 'buttons', id: 'choice', options: ['A', 'B'], disabled: ['B'] },
        { type: 'text', id: 'name', placeholder: 'Enter name' },
        { type: 'slider', id: 'volume', min: 0, max: 100, step: 5 },
        { type: 'confirm', id: 'submit', label: 'Submit' },
      ];

      mockProcess.emitLine(JSON.stringify({
        type: 'render',
        view: { type: 'text', content: 'Form' },
        inputs,
      }));

      const event = await renderPromise;
      expect(event.inputs).toEqual(inputs);
    });
  });

  // ============================================================================
  // complete 이벤트 테스트
  // ============================================================================
  describe('complete event', () => {
    it('should emit complete event when CLI outputs complete message', async () => {
      const sessionId = await manager.startSession({
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
      const sessionId = await manager.startSession({
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
      const sessionId = await manager.startSession({
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
      const sessionId = await manager.startSession({
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
      const sessionId = await manager.startSession({
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
      const sessionId = await manager.startSession({
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
      const sessionId = await manager.startSession({
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
    it('should send input to stdin', async () => {
      const sessionId = await manager.startSession({
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
      const sessionId = await manager.startSession({
        command: 'node',
        cwd: '/workspace',
      });

      // 세션 완료
      mockProcess.emitLine(JSON.stringify({ type: 'complete', result: null }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = manager.sendInput(sessionId, { data: 'test' });
      expect(result).toBe(false);
    });

    it('should send complex input data', async () => {
      const sessionId = await manager.startSession({
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
    it('should cancel running session', async () => {
      const sessionId = await manager.startSession({
        command: 'node',
        cwd: '/workspace',
      });

      const result = manager.cancelSession(sessionId);

      expect(result).toBe(true);
    });

    it('should update session status to cancelled', async () => {
      const sessionId = await manager.startSession({
        command: 'node',
        cwd: '/workspace',
      });

      manager.cancelSession(sessionId);

      const session = manager.getSession(sessionId);
      expect(session?.status).toBe('cancelled');
    });

    it('should send cancel message to stdin', async () => {
      const sessionId = await manager.startSession({
        command: 'node',
        cwd: '/workspace',
      });

      manager.cancelSession(sessionId);

      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        JSON.stringify({ type: 'cancel' }) + '\n'
      );
    });

    it('should kill the process', async () => {
      const sessionId = await manager.startSession({
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
      const sessionId = await manager.startSession({
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
      const sessionId = await manager.startSession({
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
      const sessionId = await manager.startSession({
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
      const sessionId = await manager.startSession({
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
      const sessionId = await manager.startSession({
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
      const sessionId = await manager.startSession({
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
    it('should return session by id', async () => {
      const sessionId = await manager.startSession({
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
    it('should cancel all running sessions', async () => {
      await manager.startSession({ command: 'cmd1', cwd: '/' });
      await manager.startSession({ command: 'cmd2', cwd: '/' });

      manager.cleanup();

      // 모든 세션이 취소되어야 함
      expect(mockProcess.killed).toBe(true);
    });

    it('should clear all sessions', async () => {
      const sessionId = await manager.startSession({
        command: 'node',
        cwd: '/workspace',
      });

      manager.cleanup();

      const session = manager.getSession(sessionId);
      expect(session).toBeUndefined();
    });
  });

  // ============================================================================
  // 비정상 입력 처리 테스트
  // ============================================================================
  describe('invalid input handling', () => {
    it('should ignore non-JSON output', async () => {
      await manager.startSession({
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
      await manager.startSession({
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
      const sessionId = await manager.startSession({
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
