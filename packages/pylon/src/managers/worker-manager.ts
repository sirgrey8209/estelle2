/**
 * @file worker-manager.ts
 * @description WorkerManager - 워커 프로세스 관리
 *
 * 워크스페이스당 워커 1개를 관리합니다.
 * pending 태스크를 자동으로 시작하며, FIFO 순서로 처리합니다.
 *
 * 워커 상태 흐름:
 * ```
 * idle -> running -> idle
 *           |
 *           v
 *        (태스크 완료/실패)
 * ```
 *
 * @example
 * ```typescript
 * import { WorkerManager } from './managers/worker-manager.js';
 * import { TaskManager } from './managers/task-manager.js';
 * import fs from 'fs';
 *
 * const taskManager = new TaskManager(fs);
 * const workerManager = new WorkerManager(taskManager);
 *
 * // 워커 시작
 * const result = await workerManager.startWorker(
 *   'workspace-id',
 *   'C:\\workspace\\project',
 *   async (wsId, workDir, prompt) => {
 *     // Claude 프로세스 시작 로직
 *     return { process: claudeProcess, conversationId: 'conv-123' };
 *   }
 * );
 * ```
 */

import type { TaskManager, TaskMeta, TaskStatus } from './task-manager.js';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 워커 상태
 *
 * @description
 * 워크스페이스별 워커의 현재 상태를 나타냅니다.
 */
export interface WorkerState {
  /** 워커 상태 (idle: 대기, running: 실행 중) */
  status: 'idle' | 'running';

  /** 현재 실행 중인 태스크 ID */
  currentTaskId: string | null;

  /** 현재 실행 중인 태스크 제목 */
  currentTaskTitle: string | null;

  /** 워커 시작 시각 (ISO 8601 형식) */
  startedAt: string | null;

  /** Claude 프로세스 참조 */
  claudeProcess: unknown | null;

  /** 워커용 대화 ID */
  conversationId: string | null;
}

/**
 * 워커 상태 요약 (API 응답용)
 */
export interface WorkerStatus {
  /** 워크스페이스 ID */
  workspaceId: string;

  /** 워커 상태 */
  status: 'idle' | 'running';

  /** 현재 태스크 정보 */
  currentTask: {
    id: string;
    title: string;
    startedAt: string | null;
  } | null;

  /** 태스크 큐 정보 */
  queue: {
    /** pending 태스크 수 */
    pending: number;
    /** 전체 태스크 수 */
    total: number;
  };
}

/**
 * 워커 시작 가능 여부 체크 결과
 */
export interface CanStartWorkerResult {
  /** 시작 가능 여부 */
  canStart: boolean;

  /** 시작 불가 사유 (canStart가 false일 때) */
  reason?: string;

  /** 다음 pending 태스크 (canStart가 true일 때) */
  nextTask?: TaskMeta;
}

/**
 * 워커 시작 결과
 */
export interface StartWorkerResult {
  /** 성공 여부 */
  success: boolean;

  /** 시작된 태스크 ID */
  taskId?: string;

  /** 시작된 태스크 제목 */
  taskTitle?: string;

  /** 에러 메시지 */
  error?: string;
}

/**
 * 워커 중지 결과
 */
export interface StopWorkerResult {
  /** 성공 여부 */
  success: boolean;

  /** 에러 메시지 */
  error?: string;
}

/**
 * Claude 프로세스 시작 콜백
 *
 * @description
 * 워커가 태스크를 실행할 때 호출되는 콜백입니다.
 * Claude 프로세스를 시작하고 결과를 반환해야 합니다.
 *
 * @param workspaceId - 워크스페이스 ID
 * @param workingDir - 작업 디렉토리
 * @param prompt - Claude에 전달할 프롬프트
 * @returns Claude 프로세스 정보
 */
export type StartClaudeCallback = (
  workspaceId: string,
  workingDir: string,
  prompt: string
) => Promise<{
  process: unknown;
  conversationId: string;
}>;

/**
 * 워커 상태 요약 (브로드캐스트용)
 */
export interface WorkerStatusSummary {
  /** 워크스페이스 ID */
  workspaceId: string;

  /** 워커 상태 */
  status: 'idle' | 'running';

  /** 현재 태스크 ID */
  currentTaskId: string | null;

  /** 현재 태스크 제목 */
  currentTaskTitle: string | null;

  /** 시작 시각 */
  startedAt: string | null;
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 새 워커 상태 생성
 *
 * @returns 초기화된 워커 상태
 */
function createWorkerState(): WorkerState {
  return {
    status: 'idle',
    currentTaskId: null,
    currentTaskTitle: null,
    startedAt: null,
    claudeProcess: null,
    conversationId: null,
  };
}

// ============================================================================
// WorkerManager 클래스
// ============================================================================

/**
 * WorkerManager - 워커 프로세스 관리
 *
 * @description
 * 워크스페이스당 워커 1개를 관리합니다.
 * pending 태스크를 FIFO 순서로 자동 처리합니다.
 *
 * 설계 원칙:
 * - TaskManager 의존성 주입: 테스트 용이성 확보
 * - 상태 불변성: 각 워크스페이스의 워커 상태 격리
 * - 콜백 기반: Claude 프로세스 시작 로직을 외부에서 주입
 *
 * @example
 * ```typescript
 * const workerManager = new WorkerManager(taskManager);
 *
 * // 워커 상태 조회
 * const status = workerManager.getWorkerStatus('ws-1', 'C:\\workspace');
 *
 * // 워커 시작
 * await workerManager.startWorker('ws-1', 'C:\\workspace', startClaudeCallback);
 *
 * // 워커 완료
 * workerManager.completeWorker('ws-1', 'C:\\workspace', 'done');
 * ```
 */
export class WorkerManager {
  /** 워크스페이스별 워커 상태 */
  private workerStates: Map<string, WorkerState> = new Map();

  /** TaskManager 인스턴스 */
  private readonly taskManager: TaskManager;

  /**
   * WorkerManager 생성자
   *
   * @param taskManager - TaskManager 인스턴스
   */
  constructor(taskManager: TaskManager) {
    this.taskManager = taskManager;
  }

  // ============================================================================
  // 워커 상태 조회
  // ============================================================================

  /**
   * 워커 상태 조회
   *
   * @description
   * 워크스페이스의 워커 상태를 반환합니다.
   * 상태가 없으면 새로 생성합니다.
   *
   * @param workspaceId - 워크스페이스 ID
   * @returns 워커 상태
   */
  getWorkerState(workspaceId: string): WorkerState {
    if (!this.workerStates.has(workspaceId)) {
      this.workerStates.set(workspaceId, createWorkerState());
    }
    return this.workerStates.get(workspaceId)!;
  }

  /**
   * 워커 상태 요약 조회 (API 응답용)
   *
   * @description
   * 워커 상태와 태스크 큐 정보를 포함한 요약을 반환합니다.
   *
   * @param workspaceId - 워크스페이스 ID
   * @param workingDir - 작업 디렉토리
   * @returns 워커 상태 요약
   */
  getWorkerStatus(workspaceId: string, workingDir: string): WorkerStatus {
    const state = this.getWorkerState(workspaceId);

    // 태스크 큐 정보 조회
    const taskResult = this.taskManager.listTasks(workingDir);
    const tasks = taskResult.success ? taskResult.tasks : [];

    const pendingCount = tasks.filter((t) => t.status === 'pending').length;
    const runningTask = tasks.find((t) => t.status === 'running');

    return {
      workspaceId,
      status: state.status,
      currentTask: runningTask
        ? {
            id: runningTask.id,
            title: runningTask.title,
            startedAt: runningTask.startedAt,
          }
        : null,
      queue: {
        pending: pendingCount,
        total: tasks.length,
      },
    };
  }

  // ============================================================================
  // 워커 시작/종료
  // ============================================================================

  /**
   * 워커 시작 가능 여부 확인
   *
   * @param workspaceId - 워크스페이스 ID
   * @param workingDir - 작업 디렉토리
   * @returns 시작 가능 여부 및 다음 태스크
   */
  canStartWorker(workspaceId: string, workingDir: string): CanStartWorkerResult {
    const state = this.getWorkerState(workspaceId);

    // 이미 실행 중이면 불가
    if (state.status === 'running') {
      return { canStart: false, reason: '워커가 이미 실행 중입니다.' };
    }

    // pending 태스크 확인
    const nextTask = this.taskManager.getNextPendingTask(workingDir);
    if (!nextTask) {
      return { canStart: false, reason: 'pending 태스크가 없습니다.' };
    }

    return { canStart: true, nextTask };
  }

  /**
   * 워커 시작
   *
   * @description
   * 다음 pending 태스크를 가져와 워커를 시작합니다.
   * Claude 프로세스 시작은 콜백으로 위임합니다.
   *
   * @param workspaceId - 워크스페이스 ID
   * @param workingDir - 작업 디렉토리
   * @param startClaudeCallback - Claude 프로세스 시작 콜백
   * @returns 시작 결과
   */
  async startWorker(
    workspaceId: string,
    workingDir: string,
    startClaudeCallback: StartClaudeCallback
  ): Promise<StartWorkerResult> {
    // 시작 가능 여부 확인
    const check = this.canStartWorker(workspaceId, workingDir);
    if (!check.canStart) {
      return { success: false, error: check.reason };
    }

    const task = check.nextTask!;
    const state = this.getWorkerState(workspaceId);

    // 태스크 상태를 running으로 변경
    const updateResult = this.taskManager.updateTaskStatus(
      workingDir,
      task.id,
      'running'
    );
    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }

    // 워커 상태 업데이트
    state.status = 'running';
    state.currentTaskId = task.id;
    state.currentTaskTitle = task.title;
    state.startedAt = new Date().toISOString();

    // 태스크 파일 경로
    const taskFilePath = this.taskManager.getTaskFilePath(workingDir, task.id);

    // Claude 프로세스 시작 프롬프트
    // /es-task-worker {path}를 꼼꼼히 구현 부탁해.
    const prompt = `/es-task-worker ${taskFilePath}를 꼼꼼히 구현 부탁해.`;

    try {
      // Claude 프로세스 시작 (콜백으로 위임)
      const claudeResult = await startClaudeCallback(workspaceId, workingDir, prompt);
      state.claudeProcess = claudeResult.process;
      state.conversationId = claudeResult.conversationId;

      console.log(`[WorkerManager] Started worker for task: ${task.title}`);
      return { success: true, taskId: task.id, taskTitle: task.title };
    } catch (err) {
      // 시작 실패 시 롤백
      state.status = 'idle';
      state.currentTaskId = null;
      state.currentTaskTitle = null;
      state.startedAt = null;

      // 태스크를 failed 상태로 변경
      this.taskManager.updateTaskStatus(
        workingDir,
        task.id,
        'failed',
        (err as Error).message
      );

      console.error('[WorkerManager] Failed to start worker:', (err as Error).message);
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * 워커 완료 처리
   *
   * @description
   * 워커가 완료(또는 실패)되었을 때 호출합니다.
   * 태스크 상태를 업데이트하고 워커 상태를 초기화합니다.
   *
   * @param workspaceId - 워크스페이스 ID
   * @param workingDir - 작업 디렉토리
   * @param status - 완료 상태 (done 또는 failed)
   * @param error - 에러 메시지 (실패 시)
   */
  completeWorker(
    workspaceId: string,
    workingDir: string,
    status: 'done' | 'failed',
    error: string | null = null
  ): void {
    const state = this.getWorkerState(workspaceId);

    // 현재 태스크가 있으면 상태 업데이트
    if (state.currentTaskId) {
      this.taskManager.updateTaskStatus(
        workingDir,
        state.currentTaskId,
        status,
        error
      );
      console.log(`[WorkerManager] Task ${status}: ${state.currentTaskTitle}`);
    }

    // 워커 상태 초기화
    state.status = 'idle';
    state.currentTaskId = null;
    state.currentTaskTitle = null;
    state.startedAt = null;
    state.claudeProcess = null;
    state.conversationId = null;
  }

  /**
   * 다음 태스크 자동 시작 체크
   *
   * @description
   * pending 태스크가 있고 워커가 idle이면 자동으로 시작합니다.
   *
   * @param workspaceId - 워크스페이스 ID
   * @param workingDir - 작업 디렉토리
   * @param startClaudeCallback - Claude 프로세스 시작 콜백
   * @returns 시작 여부
   */
  async checkAndStartNext(
    workspaceId: string,
    workingDir: string,
    startClaudeCallback: StartClaudeCallback
  ): Promise<boolean> {
    const check = this.canStartWorker(workspaceId, workingDir);

    if (check.canStart) {
      const result = await this.startWorker(
        workspaceId,
        workingDir,
        startClaudeCallback
      );
      return result.success;
    }

    return false;
  }

  /**
   * 워커 강제 중지
   *
   * @description
   * 실행 중인 워커를 강제로 중지합니다.
   * 태스크는 pending 상태로 되돌려 재시도할 수 있게 합니다.
   * Claude 프로세스 종료는 호출자가 처리해야 합니다.
   *
   * @param workspaceId - 워크스페이스 ID
   * @param workingDir - 작업 디렉토리
   * @returns 중지 결과
   */
  stopWorker(workspaceId: string, workingDir: string): StopWorkerResult {
    const state = this.getWorkerState(workspaceId);

    // 실행 중인 워커가 없으면 에러
    if (state.status !== 'running') {
      return { success: false, error: '실행 중인 워커가 없습니다.' };
    }

    // 태스크를 pending으로 되돌리기 (재시도 가능하도록)
    if (state.currentTaskId) {
      this.taskManager.updateTaskStatus(
        workingDir,
        state.currentTaskId,
        'pending'
      );
    }

    // 워커 상태 초기화
    state.status = 'idle';
    state.currentTaskId = null;
    state.currentTaskTitle = null;
    state.startedAt = null;
    // claudeProcess 종료는 호출자가 처리

    console.log(`[WorkerManager] Stopped worker for workspace: ${workspaceId}`);
    return { success: true };
  }

  // ============================================================================
  // 유틸리티 메서드
  // ============================================================================

  /**
   * 모든 워커 상태 조회 (브로드캐스트용)
   *
   * @returns 모든 워커 상태 요약 목록
   */
  getAllWorkerStatuses(): WorkerStatusSummary[] {
    const statuses: WorkerStatusSummary[] = [];

    for (const [workspaceId, state] of this.workerStates) {
      statuses.push({
        workspaceId,
        status: state.status,
        currentTaskId: state.currentTaskId,
        currentTaskTitle: state.currentTaskTitle,
        startedAt: state.startedAt,
      });
    }

    return statuses;
  }
}
