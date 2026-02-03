/**
 * @file worker-manager.test.ts
 * @description WorkerManager 테스트
 *
 * 워커 프로세스 관리 기능을 테스트합니다.
 * TaskManager와의 연동을 통해 태스크 실행을 관리합니다.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkerManager, type WorkerState } from '../../src/managers/worker-manager.js';
import { TaskManager, type FileSystem } from '../../src/managers/task-manager.js';

// ============================================================================
// 테스트용 인메모리 파일 시스템
// ============================================================================

class InMemoryFileSystem implements FileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  constructor() {
    this.directories.add('C:\\workspace');
  }

  existsSync(path: string): boolean {
    return this.files.has(path) || this.directories.has(path);
  }

  mkdirSync(path: string): void {
    this.directories.add(path);
  }

  readdirSync(path: string): string[] {
    const prefix = path.endsWith('\\') ? path : path + '\\';
    const result: string[] = [];

    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(prefix)) {
        const relativePath = filePath.slice(prefix.length);
        if (!relativePath.includes('\\')) {
          result.push(relativePath);
        }
      }
    }

    return result;
  }

  readFileSync(path: string): string {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return content;
  }

  writeFileSync(path: string, content: string): void {
    this.files.set(path, content);
  }

  _setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  _setDirectory(path: string): void {
    this.directories.add(path);
  }

  _getFile(path: string): string | undefined {
    return this.files.get(path);
  }
}

// ============================================================================
// WorkerManager 테스트
// ============================================================================

describe('WorkerManager', () => {
  let fs: InMemoryFileSystem;
  let taskManager: TaskManager;
  let workerManager: WorkerManager;
  const workspaceId = 'ws-123';
  const workingDir = 'C:\\workspace\\project';

  beforeEach(() => {
    fs = new InMemoryFileSystem();
    fs._setDirectory(workingDir);
    taskManager = new TaskManager(fs);
    workerManager = new WorkerManager(taskManager);
  });

  // ============================================================================
  // 워커 상태 관리 테스트
  // ============================================================================
  describe('워커 상태 관리', () => {
    it('should create initial worker state', () => {
      const state = workerManager.getWorkerState(workspaceId);

      expect(state.status).toBe('idle');
      expect(state.currentTaskId).toBeNull();
      expect(state.currentTaskTitle).toBeNull();
      expect(state.startedAt).toBeNull();
    });

    it('should return same state for same workspace', () => {
      const state1 = workerManager.getWorkerState(workspaceId);
      const state2 = workerManager.getWorkerState(workspaceId);

      expect(state1).toBe(state2);
    });

    it('should return different states for different workspaces', () => {
      const state1 = workerManager.getWorkerState('ws-1');
      const state2 = workerManager.getWorkerState('ws-2');

      expect(state1).not.toBe(state2);
    });
  });

  // ============================================================================
  // 워커 상태 요약 테스트
  // ============================================================================
  describe('getWorkerStatus', () => {
    it('should return worker status with queue info', () => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-task.md`,
        `---
id: task-1
title: Task 1
status: pending
createdAt: 2026-01-24T10:00:00Z
startedAt:
completedAt:
error:
---
content`
      );

      const status = workerManager.getWorkerStatus(workspaceId, workingDir);

      expect(status.workspaceId).toBe(workspaceId);
      expect(status.status).toBe('idle');
      expect(status.currentTask).toBeNull();
      expect(status.queue.pending).toBe(1);
      expect(status.queue.total).toBe(1);
    });

    it('should include current task when running', () => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-running.md`,
        `---
id: running-task
title: Running Task
status: running
createdAt: 2026-01-24T10:00:00Z
startedAt: 2026-01-24T11:00:00Z
completedAt:
error:
---
content`
      );

      // 워커 상태를 수동으로 설정
      const state = workerManager.getWorkerState(workspaceId);
      state.status = 'running';
      state.currentTaskId = 'running-task';
      state.currentTaskTitle = 'Running Task';

      const status = workerManager.getWorkerStatus(workspaceId, workingDir);

      expect(status.currentTask).not.toBeNull();
      expect(status.currentTask?.id).toBe('running-task');
    });
  });

  // ============================================================================
  // 워커 시작 가능 여부 테스트
  // ============================================================================
  describe('canStartWorker', () => {
    it('should return true when idle and pending tasks exist', () => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-pending.md`,
        `---
id: pending-task
title: Pending Task
status: pending
createdAt: 2026-01-24T10:00:00Z
startedAt:
completedAt:
error:
---
content`
      );

      const result = workerManager.canStartWorker(workspaceId, workingDir);

      expect(result.canStart).toBe(true);
      expect(result.nextTask).toBeDefined();
      expect(result.nextTask?.id).toBe('pending-task');
    });

    it('should return false when worker is already running', () => {
      const state = workerManager.getWorkerState(workspaceId);
      state.status = 'running';

      const result = workerManager.canStartWorker(workspaceId, workingDir);

      expect(result.canStart).toBe(false);
      expect(result.reason).toContain('실행 중');
    });

    it('should return false when no pending tasks', () => {
      fs._setDirectory(`${workingDir}\\task`);
      // pending 태스크 없음

      const result = workerManager.canStartWorker(workspaceId, workingDir);

      expect(result.canStart).toBe(false);
      expect(result.reason).toContain('pending');
    });
  });

  // ============================================================================
  // 워커 시작 테스트
  // ============================================================================
  describe('startWorker', () => {
    const pendingTaskContent = `---
id: pending-task
title: Pending Task
status: pending
createdAt: 2026-01-24T10:00:00Z
startedAt:
completedAt:
error:
---
Task content`;

    beforeEach(() => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(`${workingDir}\\task\\20260124-pending.md`, pendingTaskContent);
    });

    it('should start worker with next pending task', async () => {
      const mockCallback = vi.fn().mockResolvedValue({
        process: {},
        conversationId: 'conv-123',
      });

      const result = await workerManager.startWorker(
        workspaceId,
        workingDir,
        mockCallback
      );

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('pending-task');
      expect(result.taskTitle).toBe('Pending Task');
    });

    it('should update task status to running', async () => {
      const mockCallback = vi.fn().mockResolvedValue({
        process: {},
        conversationId: 'conv-123',
      });

      await workerManager.startWorker(workspaceId, workingDir, mockCallback);

      // 태스크 상태 확인
      const task = taskManager.getTask(workingDir, 'pending-task');
      expect(task.task?.status).toBe('running');
    });

    it('should update worker state to running', async () => {
      const mockCallback = vi.fn().mockResolvedValue({
        process: {},
        conversationId: 'conv-123',
      });

      await workerManager.startWorker(workspaceId, workingDir, mockCallback);

      const state = workerManager.getWorkerState(workspaceId);
      expect(state.status).toBe('running');
      expect(state.currentTaskId).toBe('pending-task');
      expect(state.startedAt).toBeDefined();
    });

    it('should call callback with correct prompt', async () => {
      const mockCallback = vi.fn().mockResolvedValue({
        process: {},
        conversationId: 'conv-123',
      });

      await workerManager.startWorker(workspaceId, workingDir, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        workspaceId,
        workingDir,
        expect.stringContaining('/es-task-worker')
      );
    });

    it('should rollback on callback failure', async () => {
      const mockCallback = vi.fn().mockRejectedValue(new Error('Claude failed'));

      const result = await workerManager.startWorker(
        workspaceId,
        workingDir,
        mockCallback
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Claude failed');

      // 워커 상태 롤백 확인
      const state = workerManager.getWorkerState(workspaceId);
      expect(state.status).toBe('idle');

      // 태스크 상태가 failed로 변경됨
      const task = taskManager.getTask(workingDir, 'pending-task');
      expect(task.task?.status).toBe('failed');
    });

    it('should return error when already running', async () => {
      const state = workerManager.getWorkerState(workspaceId);
      state.status = 'running';

      const mockCallback = vi.fn();

      const result = await workerManager.startWorker(
        workspaceId,
        workingDir,
        mockCallback
      );

      expect(result.success).toBe(false);
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 워커 완료 테스트
  // ============================================================================
  describe('completeWorker', () => {
    beforeEach(() => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-running.md`,
        `---
id: running-task
title: Running Task
status: running
createdAt: 2026-01-24T10:00:00Z
startedAt: 2026-01-24T11:00:00Z
completedAt:
error:
---
content`
      );

      // 워커를 running 상태로 설정
      const state = workerManager.getWorkerState(workspaceId);
      state.status = 'running';
      state.currentTaskId = 'running-task';
      state.currentTaskTitle = 'Running Task';
      state.startedAt = '2026-01-24T11:00:00Z';
    });

    it('should complete worker with done status', () => {
      workerManager.completeWorker(workspaceId, workingDir, 'done');

      // 워커 상태 확인
      const state = workerManager.getWorkerState(workspaceId);
      expect(state.status).toBe('idle');
      expect(state.currentTaskId).toBeNull();

      // 태스크 상태 확인
      const task = taskManager.getTask(workingDir, 'running-task');
      expect(task.task?.status).toBe('done');
      expect(task.task?.completedAt).toBeDefined();
    });

    it('should complete worker with failed status and error', () => {
      workerManager.completeWorker(
        workspaceId,
        workingDir,
        'failed',
        'Task execution failed'
      );

      const task = taskManager.getTask(workingDir, 'running-task');
      expect(task.task?.status).toBe('failed');
      expect(task.task?.error).toBe('Task execution failed');
    });

    it('should reset all worker state fields', () => {
      workerManager.completeWorker(workspaceId, workingDir, 'done');

      const state = workerManager.getWorkerState(workspaceId);
      expect(state.status).toBe('idle');
      expect(state.currentTaskId).toBeNull();
      expect(state.currentTaskTitle).toBeNull();
      expect(state.startedAt).toBeNull();
      expect(state.claudeProcess).toBeNull();
      expect(state.conversationId).toBeNull();
    });
  });

  // ============================================================================
  // 다음 태스크 자동 시작 테스트
  // ============================================================================
  describe('checkAndStartNext', () => {
    it('should start next task when available', async () => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-pending.md`,
        `---
id: pending-task
title: Pending Task
status: pending
createdAt: 2026-01-24T10:00:00Z
startedAt:
completedAt:
error:
---
content`
      );

      const mockCallback = vi.fn().mockResolvedValue({
        process: {},
        conversationId: 'conv-123',
      });

      const started = await workerManager.checkAndStartNext(
        workspaceId,
        workingDir,
        mockCallback
      );

      expect(started).toBe(true);
      expect(mockCallback).toHaveBeenCalled();
    });

    it('should not start when no pending tasks', async () => {
      fs._setDirectory(`${workingDir}\\task`);
      // pending 태스크 없음

      const mockCallback = vi.fn();

      const started = await workerManager.checkAndStartNext(
        workspaceId,
        workingDir,
        mockCallback
      );

      expect(started).toBe(false);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should not start when worker already running', async () => {
      const state = workerManager.getWorkerState(workspaceId);
      state.status = 'running';

      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-pending.md`,
        `---
id: pending-task
title: Pending Task
status: pending
createdAt: 2026-01-24T10:00:00Z
startedAt:
completedAt:
error:
---
content`
      );

      const mockCallback = vi.fn();

      const started = await workerManager.checkAndStartNext(
        workspaceId,
        workingDir,
        mockCallback
      );

      expect(started).toBe(false);
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 워커 강제 중지 테스트
  // ============================================================================
  describe('stopWorker', () => {
    beforeEach(() => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-running.md`,
        `---
id: running-task
title: Running Task
status: running
createdAt: 2026-01-24T10:00:00Z
startedAt: 2026-01-24T11:00:00Z
completedAt:
error:
---
content`
      );

      const state = workerManager.getWorkerState(workspaceId);
      state.status = 'running';
      state.currentTaskId = 'running-task';
      state.currentTaskTitle = 'Running Task';
    });

    it('should stop running worker', () => {
      const result = workerManager.stopWorker(workspaceId, workingDir);

      expect(result.success).toBe(true);

      const state = workerManager.getWorkerState(workspaceId);
      expect(state.status).toBe('idle');
    });

    it('should revert task status to pending', () => {
      workerManager.stopWorker(workspaceId, workingDir);

      const task = taskManager.getTask(workingDir, 'running-task');
      expect(task.task?.status).toBe('pending');
    });

    it('should return error when no running worker', () => {
      const state = workerManager.getWorkerState(workspaceId);
      state.status = 'idle';

      const result = workerManager.stopWorker(workspaceId, workingDir);

      expect(result.success).toBe(false);
      expect(result.error).toContain('실행 중인 워커가 없습니다');
    });
  });

  // ============================================================================
  // 전체 워커 상태 조회 테스트
  // ============================================================================
  describe('getAllWorkerStatuses', () => {
    it('should return all worker statuses', () => {
      // 여러 워크스페이스의 워커 상태 생성
      workerManager.getWorkerState('ws-1');
      workerManager.getWorkerState('ws-2');

      const state2 = workerManager.getWorkerState('ws-2');
      state2.status = 'running';
      state2.currentTaskId = 'task-123';
      state2.currentTaskTitle = 'Task 123';

      const statuses = workerManager.getAllWorkerStatuses();

      expect(statuses).toHaveLength(2);
      expect(statuses.find((s) => s.workspaceId === 'ws-1')?.status).toBe('idle');
      expect(statuses.find((s) => s.workspaceId === 'ws-2')?.status).toBe('running');
    });

    it('should return empty array when no workers', () => {
      const statuses = workerManager.getAllWorkerStatuses();

      expect(statuses).toHaveLength(0);
    });
  });
});
