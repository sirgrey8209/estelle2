/**
 * @file managers/index.ts
 * @description Managers 모듈 진입점
 *
 * 태스크, 워커, 폴더 관리 모듈을 re-export 합니다.
 *
 * @example
 * ```typescript
 * import {
 *   TaskManager,
 *   WorkerManager,
 *   FolderManager,
 *   type Task,
 *   type TaskMeta,
 *   type TaskStatus,
 *   type WorkerState,
 *   type WorkerStatus,
 * } from './managers/index.js';
 * ```
 */

// ============================================================================
// TaskManager
// ============================================================================

export {
  TaskManager,
  type Task,
  type TaskMeta,
  type TaskStatus,
  type CreateTaskResult,
  type GetTaskResult,
  type ListTasksResult,
  type UpdateTaskResult,
  type FileSystem,
} from './task-manager.js';

// ============================================================================
// WorkerManager
// ============================================================================

export {
  WorkerManager,
  type WorkerState,
  type WorkerStatus,
  type CanStartWorkerResult,
  type StartWorkerResult,
  type StopWorkerResult,
  type StartClaudeCallback,
  type WorkerStatusSummary,
} from './worker-manager.js';

// ============================================================================
// FolderManager
// ============================================================================

export {
  FolderManager,
  type FolderFileSystem,
  type ListFoldersResult,
  type FolderOperationResult,
} from './folder-manager.js';
