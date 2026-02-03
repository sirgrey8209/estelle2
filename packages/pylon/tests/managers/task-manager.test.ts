/**
 * @file task-manager.test.ts
 * @description TaskManager 테스트
 *
 * 태스크 파일 관리 기능을 테스트합니다.
 * 파일 I/O는 FileSystem 인터페이스로 추상화하여 모킹 없이 테스트합니다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskManager,
  type Task,
  type TaskMeta,
  type TaskStatus,
  type FileSystem,
} from '../../src/managers/task-manager.js';

// ============================================================================
// 테스트용 인메모리 파일 시스템
// ============================================================================

/**
 * 테스트용 인메모리 파일 시스템
 * 실제 파일 I/O 없이 TaskManager를 테스트할 수 있게 합니다.
 */
class InMemoryFileSystem implements FileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  constructor() {
    // 기본 루트 디렉토리
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
        // 직접 하위 파일만 (하위 디렉토리의 파일은 제외)
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

  // 테스트 헬퍼: 파일 직접 설정
  _setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  // 테스트 헬퍼: 디렉토리 직접 설정
  _setDirectory(path: string): void {
    this.directories.add(path);
  }

  // 테스트 헬퍼: 파일 개수
  _getFileCount(): number {
    return this.files.size;
  }

  // 테스트 헬퍼: 파일 내용 가져오기
  _getFile(path: string): string | undefined {
    return this.files.get(path);
  }
}

// ============================================================================
// TaskManager 테스트
// ============================================================================

describe('TaskManager', () => {
  let fs: InMemoryFileSystem;
  let taskManager: TaskManager;
  const workingDir = 'C:\\workspace\\project';

  beforeEach(() => {
    fs = new InMemoryFileSystem();
    fs._setDirectory(workingDir);
    taskManager = new TaskManager(fs);
  });

  // ============================================================================
  // Frontmatter 파싱 테스트
  // ============================================================================
  describe('Frontmatter 파싱', () => {
    it('should parse frontmatter correctly', () => {
      const content = `---
id: test-id-123
title: Test Task
status: pending
createdAt: 2026-01-24T10:00:00Z
startedAt:
completedAt:
error:
---

## 목표
테스트 본문입니다.`;

      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(`${workingDir}\\task\\20260124-test-task.md`, content);

      const result = taskManager.getTask(workingDir, 'test-id-123');

      expect(result.success).toBe(true);
      expect(result.task).toBeDefined();
      expect(result.task?.id).toBe('test-id-123');
      expect(result.task?.title).toBe('Test Task');
      expect(result.task?.status).toBe('pending');
    });

    it('should handle frontmatter without body', () => {
      const content = `---
id: test-id
title: No Body Task
status: pending
createdAt: 2026-01-24T10:00:00Z
startedAt:
completedAt:
error:
---`;

      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(`${workingDir}\\task\\20260124-no-body.md`, content);

      const result = taskManager.getTask(workingDir, 'test-id');

      expect(result.success).toBe(true);
      expect(result.task?.content).toBe('');
    });
  });

  // ============================================================================
  // Task 폴더 관리 테스트
  // ============================================================================
  describe('Task 폴더 관리', () => {
    it('should return correct task folder path', () => {
      const path = taskManager.getTaskFolderPath(workingDir);
      expect(path).toBe(`${workingDir}\\task`);
    });

    it('should create task folder if not exists', () => {
      const path = taskManager.ensureTaskFolder(workingDir);

      expect(path).toBe(`${workingDir}\\task`);
      expect(fs.existsSync(`${workingDir}\\task`)).toBe(true);
    });

    it('should not recreate existing task folder', () => {
      fs._setDirectory(`${workingDir}\\task`);

      const path = taskManager.ensureTaskFolder(workingDir);

      expect(path).toBe(`${workingDir}\\task`);
    });
  });

  // ============================================================================
  // Task 목록 조회 테스트
  // ============================================================================
  describe('listTasks', () => {
    it('should return empty list when no task folder', () => {
      const result = taskManager.listTasks(workingDir);

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(0);
    });

    it('should return empty list when task folder is empty', () => {
      fs._setDirectory(`${workingDir}\\task`);

      const result = taskManager.listTasks(workingDir);

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(0);
    });

    it('should list tasks sorted by filename (newest first)', () => {
      fs._setDirectory(`${workingDir}\\task`);

      // 오래된 태스크
      fs._setFile(
        `${workingDir}\\task\\20260120-old-task.md`,
        `---
id: old-id
title: Old Task
status: done
createdAt: 2026-01-20T10:00:00Z
startedAt:
completedAt:
error:
---

Old content`
      );

      // 새 태스크
      fs._setFile(
        `${workingDir}\\task\\20260124-new-task.md`,
        `---
id: new-id
title: New Task
status: pending
createdAt: 2026-01-24T10:00:00Z
startedAt:
completedAt:
error:
---

New content`
      );

      const result = taskManager.listTasks(workingDir);

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(2);
      // 최신순 정렬
      expect(result.tasks[0].id).toBe('new-id');
      expect(result.tasks[1].id).toBe('old-id');
    });

    it('should only include .md files', () => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-task.md`,
        `---
id: task-id
title: Task
status: pending
createdAt: 2026-01-24T10:00:00Z
startedAt:
completedAt:
error:
---

content`
      );
      fs._setFile(`${workingDir}\\task\\readme.txt`, 'This is not a task');

      const result = taskManager.listTasks(workingDir);

      expect(result.success).toBe(true);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('task-id');
    });
  });

  // ============================================================================
  // Task 상세 조회 테스트
  // ============================================================================
  describe('getTask', () => {
    it('should return task with content', () => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-test.md`,
        `---
id: test-id
title: Test Task
status: running
createdAt: 2026-01-24T10:00:00Z
startedAt: 2026-01-24T11:00:00Z
completedAt:
error:
---

## 목표
테스트 본문입니다.`
      );

      const result = taskManager.getTask(workingDir, 'test-id');

      expect(result.success).toBe(true);
      expect(result.task).toBeDefined();
      expect(result.task?.id).toBe('test-id');
      expect(result.task?.title).toBe('Test Task');
      expect(result.task?.status).toBe('running');
      expect(result.task?.content).toContain('## 목표');
    });

    it('should return error for non-existent task', () => {
      fs._setDirectory(`${workingDir}\\task`);

      const result = taskManager.getTask(workingDir, 'non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error when task folder not exists', () => {
      const result = taskManager.getTask(workingDir, 'any-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('폴더');
    });

    it('should truncate long content', () => {
      const longContent = 'A'.repeat(15000);
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-long.md`,
        `---
id: long-id
title: Long Task
status: pending
createdAt: 2026-01-24T10:00:00Z
startedAt:
completedAt:
error:
---

${longContent}`
      );

      const result = taskManager.getTask(workingDir, 'long-id');

      expect(result.success).toBe(true);
      expect(result.task?.truncated).toBe(true);
      expect(result.task?.content?.length).toBeLessThan(15000);
    });
  });

  // ============================================================================
  // Task 생성 테스트
  // ============================================================================
  describe('createTask', () => {
    it('should create task file with correct structure', () => {
      const result = taskManager.createTask(
        workingDir,
        '버튼 색상 변경',
        '## 목표\n버튼을 파란색으로 변경'
      );

      expect(result.success).toBe(true);
      expect(result.task).toBeDefined();
      expect(result.task?.title).toBe('버튼 색상 변경');
      expect(result.task?.status).toBe('pending');
      expect(result.task?.id).toBeDefined();
    });

    it('should generate correct filename', () => {
      const result = taskManager.createTask(
        workingDir,
        'Test Task Name',
        'content'
      );

      expect(result.success).toBe(true);
      expect(result.task?.fileName).toMatch(/^\d{8}-test-task-name\.md$/);
    });

    it('should handle Korean title in filename', () => {
      const result = taskManager.createTask(
        workingDir,
        '한글 제목 테스트',
        'content'
      );

      expect(result.success).toBe(true);
      expect(result.task?.fileName).toMatch(/^\d{8}-한글-제목-테스트\.md$/);
    });

    it('should create task folder if not exists', () => {
      taskManager.createTask(workingDir, 'New Task', 'content');

      expect(fs.existsSync(`${workingDir}\\task`)).toBe(true);
    });

    it('should write task file with correct content', () => {
      const result = taskManager.createTask(
        workingDir,
        'Test',
        '## 본문'
      );

      const filePath = `${workingDir}\\task\\${result.task?.fileName}`;
      const content = fs._getFile(filePath);

      expect(content).toContain('id:');
      expect(content).toContain('title: Test');
      expect(content).toContain('status: pending');
      expect(content).toContain('## 본문');
    });
  });

  // ============================================================================
  // Task 상태 업데이트 테스트
  // ============================================================================
  describe('updateTaskStatus', () => {
    const taskContent = `---
id: task-123
title: Update Test
status: pending
createdAt: 2026-01-24T10:00:00Z
startedAt:
completedAt:
error:
---

본문`;

    beforeEach(() => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(`${workingDir}\\task\\20260124-update-test.md`, taskContent);
    });

    it('should update status to running', () => {
      const result = taskManager.updateTaskStatus(
        workingDir,
        'task-123',
        'running'
      );

      expect(result.success).toBe(true);
      expect(result.task?.status).toBe('running');
      expect(result.task?.startedAt).toBeDefined();
    });

    it('should update status to done', () => {
      // 먼저 running으로 변경
      taskManager.updateTaskStatus(workingDir, 'task-123', 'running');

      const result = taskManager.updateTaskStatus(
        workingDir,
        'task-123',
        'done'
      );

      expect(result.success).toBe(true);
      expect(result.task?.status).toBe('done');
      expect(result.task?.completedAt).toBeDefined();
    });

    it('should update status to failed with error', () => {
      const result = taskManager.updateTaskStatus(
        workingDir,
        'task-123',
        'failed',
        'Something went wrong'
      );

      expect(result.success).toBe(true);
      expect(result.task?.status).toBe('failed');
      expect(result.task?.error).toBe('Something went wrong');
    });

    it('should return error for non-existent task', () => {
      const result = taskManager.updateTaskStatus(
        workingDir,
        'non-existent',
        'running'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should preserve body content when updating status', () => {
      taskManager.updateTaskStatus(workingDir, 'task-123', 'running');

      const getResult = taskManager.getTask(workingDir, 'task-123');
      expect(getResult.task?.content).toContain('본문');
    });
  });

  // ============================================================================
  // Pending/Running 태스크 조회 테스트
  // ============================================================================
  describe('getNextPendingTask', () => {
    it('should return oldest pending task (FIFO)', () => {
      fs._setDirectory(`${workingDir}\\task`);

      // 나중에 생성된 pending 태스크
      fs._setFile(
        `${workingDir}\\task\\20260125-newer.md`,
        `---
id: newer-id
title: Newer Task
status: pending
createdAt: 2026-01-25T10:00:00Z
startedAt:
completedAt:
error:
---
content`
      );

      // 먼저 생성된 pending 태스크
      fs._setFile(
        `${workingDir}\\task\\20260120-older.md`,
        `---
id: older-id
title: Older Task
status: pending
createdAt: 2026-01-20T10:00:00Z
startedAt:
completedAt:
error:
---
content`
      );

      const task = taskManager.getNextPendingTask(workingDir);

      // 파일명 기준으로 가장 오래된 것 (FIFO)
      expect(task).not.toBeNull();
      expect(task?.id).toBe('older-id');
    });

    it('should return null when no pending tasks', () => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-done.md`,
        `---
id: done-id
title: Done Task
status: done
createdAt: 2026-01-24T10:00:00Z
startedAt:
completedAt: 2026-01-24T12:00:00Z
error:
---
content`
      );

      const task = taskManager.getNextPendingTask(workingDir);

      expect(task).toBeNull();
    });

    it('should skip running tasks', () => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-running.md`,
        `---
id: running-id
title: Running Task
status: running
createdAt: 2026-01-24T10:00:00Z
startedAt: 2026-01-24T11:00:00Z
completedAt:
error:
---
content`
      );

      const task = taskManager.getNextPendingTask(workingDir);

      expect(task).toBeNull();
    });
  });

  describe('getRunningTask', () => {
    it('should return currently running task', () => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-running.md`,
        `---
id: running-id
title: Running Task
status: running
createdAt: 2026-01-24T10:00:00Z
startedAt: 2026-01-24T11:00:00Z
completedAt:
error:
---
content`
      );

      const task = taskManager.getRunningTask(workingDir);

      expect(task).not.toBeNull();
      expect(task?.id).toBe('running-id');
      expect(task?.status).toBe('running');
    });

    it('should return null when no running task', () => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-pending.md`,
        `---
id: pending-id
title: Pending Task
status: pending
createdAt: 2026-01-24T10:00:00Z
startedAt:
completedAt:
error:
---
content`
      );

      const task = taskManager.getRunningTask(workingDir);

      expect(task).toBeNull();
    });
  });

  // ============================================================================
  // Task 파일 경로 조회 테스트
  // ============================================================================
  describe('getTaskFilePath', () => {
    it('should return file path for existing task', () => {
      fs._setDirectory(`${workingDir}\\task`);
      fs._setFile(
        `${workingDir}\\task\\20260124-test.md`,
        `---
id: test-id
title: Test
status: pending
createdAt: 2026-01-24T10:00:00Z
startedAt:
completedAt:
error:
---
content`
      );

      const path = taskManager.getTaskFilePath(workingDir, 'test-id');

      expect(path).toBe(`${workingDir}\\task\\20260124-test.md`);
    });

    it('should return null for non-existent task', () => {
      fs._setDirectory(`${workingDir}\\task`);

      const path = taskManager.getTaskFilePath(workingDir, 'non-existent');

      expect(path).toBeNull();
    });

    it('should return null when task folder not exists', () => {
      const path = taskManager.getTaskFilePath(workingDir, 'any-id');

      expect(path).toBeNull();
    });
  });
});
