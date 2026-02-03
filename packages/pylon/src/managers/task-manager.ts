/**
 * @file task-manager.ts
 * @description TaskManager - 태스크 파일 관리
 *
 * task/ 폴더의 MD 파일을 스캔하고 관리합니다.
 * 파일 I/O는 FileSystem 인터페이스로 추상화하여 테스트 용이성을 확보합니다.
 *
 * 태스크 파일 형식 (Frontmatter + Markdown):
 * ```markdown
 * ---
 * id: 550e8400-e29b-41d4-a716-446655440000
 * title: 버튼 색상 변경
 * status: pending
 * createdAt: 2026-01-24T10:00:00Z
 * startedAt:
 * completedAt:
 * error:
 * ---
 *
 * ## 목표
 * 버튼을 파란색으로 변경합니다.
 * ```
 *
 * @example
 * ```typescript
 * import fs from 'fs';
 * import { TaskManager } from './managers/task-manager.js';
 *
 * // 실제 파일 시스템으로 초기화
 * const taskManager = new TaskManager(fs);
 *
 * // 태스크 생성
 * const result = taskManager.createTask(
 *   'C:\\workspace\\project',
 *   '버튼 색상 변경',
 *   '## 목표\n버튼을 파란색으로 변경'
 * );
 *
 * // 태스크 목록 조회
 * const tasks = taskManager.listTasks('C:\\workspace\\project');
 * ```
 */

import { randomUUID } from 'crypto';
import path from 'path';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 태스크 상태
 *
 * @description
 * - pending: 대기 중 (아직 시작하지 않음)
 * - running: 실행 중 (워커가 처리 중)
 * - done: 완료 (성공적으로 완료됨)
 * - failed: 실패 (에러 발생으로 중단됨)
 */
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

/**
 * 태스크 메타데이터
 *
 * @description
 * Frontmatter에서 파싱된 태스크 정보입니다.
 * 태스크 목록 조회 시 반환됩니다.
 */
export interface TaskMeta {
  /** 태스크 고유 식별자 (UUID) */
  id: string;

  /** 태스크 제목 */
  title: string;

  /** 태스크 상태 */
  status: TaskStatus;

  /** 생성 시각 (ISO 8601 형식) */
  createdAt: string;

  /** 시작 시각 (ISO 8601 형식, 시작 전 null) */
  startedAt: string | null;

  /** 완료 시각 (ISO 8601 형식, 완료 전 null) */
  completedAt: string | null;

  /** 에러 메시지 (실패 시) */
  error: string | null;

  /** 파일 이름 */
  fileName: string;
}

/**
 * 태스크 상세 정보
 *
 * @description
 * 메타데이터와 본문 내용을 포함한 태스크 전체 정보입니다.
 * 태스크 상세 조회 시 반환됩니다.
 */
export interface Task extends TaskMeta {
  /** 태스크 본문 (마크다운) */
  content: string;

  /** 내용이 잘렸는지 여부 */
  truncated: boolean;
}

/**
 * 태스크 생성 결과
 */
export interface CreateTaskResult {
  /** 성공 여부 */
  success: boolean;

  /** 생성된 태스크 정보 */
  task?: {
    id: string;
    title: string;
    status: TaskStatus;
    createdAt: string;
    fileName: string;
    filePath: string;
  };

  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 태스크 조회 결과
 */
export interface GetTaskResult {
  /** 성공 여부 */
  success: boolean;

  /** 태스크 정보 */
  task?: Task;

  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 태스크 목록 조회 결과
 */
export interface ListTasksResult {
  /** 성공 여부 */
  success: boolean;

  /** 태스크 목록 */
  tasks: TaskMeta[];

  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 태스크 상태 업데이트 결과
 */
export interface UpdateTaskResult {
  /** 성공 여부 */
  success: boolean;

  /** 업데이트된 태스크 정보 */
  task?: TaskMeta;

  /** 에러 메시지 (실패 시) */
  error?: string;
}

/**
 * 파일 시스템 인터페이스
 *
 * @description
 * 파일 I/O를 추상화하여 테스트 시 인메모리 구현으로 대체할 수 있습니다.
 * Node.js fs 모듈과 호환되는 인터페이스입니다.
 */
export interface FileSystem {
  /** 경로 존재 여부 확인 */
  existsSync(path: string): boolean;

  /** 디렉토리 생성 */
  mkdirSync(path: string, options?: { recursive?: boolean }): void;

  /** 디렉토리 내용 조회 */
  readdirSync(path: string): string[];

  /** 파일 읽기 */
  readFileSync(path: string, encoding?: string): string;

  /** 파일 쓰기 */
  writeFileSync(path: string, content: string, encoding?: string): void;
}

// ============================================================================
// 상수
// ============================================================================

/** 태스크 폴더 이름 */
const TASK_FOLDER = 'task';

/** 내용 truncate 기준 (10,000자) */
const MAX_CONTENT_LENGTH = 10000;

// ============================================================================
// Frontmatter 파싱 유틸리티
// ============================================================================

/**
 * Frontmatter 파싱 결과
 */
interface ParsedFrontmatter {
  /** 메타데이터 객체 */
  meta: Record<string, string | null>;

  /** 본문 내용 */
  body: string;
}

/**
 * Frontmatter 파싱
 *
 * @description
 * YAML 형식의 Frontmatter를 파싱합니다.
 * Windows 줄바꿈(\r\n)도 처리합니다.
 *
 * @param content - 파일 전체 내용
 * @returns 메타데이터와 본문
 */
function parseFrontmatter(content: string): ParsedFrontmatter {
  // --- 로 시작하는 Frontmatter 찾기
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return { meta: {}, body: content };
  }

  const frontmatter = match[1];
  const body = content.slice(match[0].length).trim();

  // YAML 파싱 (간단한 key: value 형식)
  const meta: Record<string, string | null> = {};
  for (const line of frontmatter.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      // 빈 값은 null로 처리
      meta[key] = value === '' ? null : value;
    }
  }

  return { meta, body };
}

/**
 * Frontmatter 생성
 *
 * @description
 * 메타데이터 객체를 YAML Frontmatter 문자열로 변환합니다.
 *
 * @param meta - 메타데이터 객체
 * @returns Frontmatter 문자열 (--- 포함)
 */
function buildFrontmatter(meta: Record<string, string | null>): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(meta)) {
    // null은 빈 값으로 출력
    lines.push(`${key}: ${value ?? ''}`);
  }
  lines.push('---');
  return lines.join('\n');
}

/**
 * 파일명 생성
 *
 * @description
 * YYYYMMDD-title-kebab.md 형식의 파일명을 생성합니다.
 * 한글도 지원합니다.
 *
 * @param title - 태스크 제목
 * @returns 파일명
 */
function generateFileName(title: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

  // kebab-case 변환 (한글 포함)
  const kebab = title
    .toLowerCase()
    .replace(/\s+/g, '-')              // 공백 -> 하이픈
    .replace(/[^a-z0-9가-힣-]/g, '')   // 허용된 문자만 유지
    .replace(/-+/g, '-')               // 연속 하이픈 제거
    .replace(/^-|-$/g, '');            // 앞뒤 하이픈 제거

  return `${dateStr}-${kebab}.md`;
}

// ============================================================================
// TaskManager 클래스
// ============================================================================

/**
 * TaskManager - 태스크 파일 관리
 *
 * @description
 * task/ 폴더의 마크다운 파일을 통해 태스크를 관리합니다.
 * 파일 I/O는 FileSystem 인터페이스로 추상화하여 테스트 용이성을 확보합니다.
 *
 * 설계 원칙:
 * - 파일 시스템 추상화: 테스트 시 인메모리 구현 사용 가능
 * - 순수 함수형 설계: 부작용 최소화
 * - Frontmatter 기반: 태스크 메타데이터를 마크다운 파일에 저장
 *
 * @example
 * ```typescript
 * import fs from 'fs';
 * import { TaskManager } from './managers/task-manager.js';
 *
 * // 실제 파일 시스템 사용
 * const taskManager = new TaskManager(fs);
 *
 * // 또는 테스트용 인메모리 파일 시스템
 * const testFs = new InMemoryFileSystem();
 * const testTaskManager = new TaskManager(testFs);
 * ```
 */
export class TaskManager {
  /** 파일 시스템 인터페이스 */
  private readonly fs: FileSystem;

  /**
   * TaskManager 생성자
   *
   * @param fileSystem - 파일 시스템 구현체
   */
  constructor(fileSystem: FileSystem) {
    this.fs = fileSystem;
  }

  // ============================================================================
  // 폴더 관리
  // ============================================================================

  /**
   * 워크스페이스의 task 폴더 경로 반환
   *
   * @param workingDir - 워크스페이스 경로
   * @returns task 폴더 절대 경로
   */
  getTaskFolderPath(workingDir: string): string {
    return path.join(workingDir, TASK_FOLDER);
  }

  /**
   * task 폴더 확인 및 생성
   *
   * @description
   * task 폴더가 없으면 생성합니다.
   *
   * @param workingDir - 워크스페이스 경로
   * @returns task 폴더 절대 경로
   */
  ensureTaskFolder(workingDir: string): string {
    const taskPath = this.getTaskFolderPath(workingDir);
    if (!this.fs.existsSync(taskPath)) {
      this.fs.mkdirSync(taskPath, { recursive: true });
      console.log(`[TaskManager] Created task folder: ${taskPath}`);
    }
    return taskPath;
  }

  // ============================================================================
  // 태스크 CRUD
  // ============================================================================

  /**
   * 태스크 목록 조회
   *
   * @description
   * task 폴더의 모든 .md 파일을 읽어 태스크 목록을 반환합니다.
   * 파일명 기준 내림차순 정렬 (최신순)됩니다.
   *
   * @param workingDir - 워크스페이스 경로
   * @returns 태스크 메타데이터 목록
   */
  listTasks(workingDir: string): ListTasksResult {
    const taskPath = this.getTaskFolderPath(workingDir);

    // 폴더가 없으면 빈 목록 반환
    if (!this.fs.existsSync(taskPath)) {
      return { success: true, tasks: [] };
    }

    try {
      // .md 파일만 필터링, 최신순 정렬
      const files = this.fs
        .readdirSync(taskPath)
        .filter((f) => f.endsWith('.md'))
        .sort((a, b) => b.localeCompare(a)); // 파일명 내림차순 (최신순)

      const tasks: TaskMeta[] = [];

      for (const file of files) {
        const filePath = path.join(taskPath, file);
        const content = this.fs.readFileSync(filePath, 'utf-8');
        const { meta } = parseFrontmatter(content);

        tasks.push({
          id: meta.id || '',
          title: meta.title || '',
          status: (meta.status as TaskStatus) || 'pending',
          createdAt: meta.createdAt || '',
          startedAt: meta.startedAt,
          completedAt: meta.completedAt,
          error: meta.error,
          fileName: file,
        });
      }

      return { success: true, tasks };
    } catch (err) {
      const error = err as Error;
      console.error('[TaskManager] listTasks error:', error.message);
      return { success: false, tasks: [], error: error.message };
    }
  }

  /**
   * 태스크 상세 조회
   *
   * @description
   * 태스크 ID로 태스크를 찾아 메타데이터와 본문을 반환합니다.
   * 본문이 10,000자를 초과하면 truncate됩니다.
   *
   * @param workingDir - 워크스페이스 경로
   * @param taskId - 태스크 ID
   * @returns 태스크 상세 정보
   */
  getTask(workingDir: string, taskId: string): GetTaskResult {
    const taskPath = this.getTaskFolderPath(workingDir);

    // 폴더 존재 확인
    if (!this.fs.existsSync(taskPath)) {
      return { success: false, error: '태스크 폴더가 없습니다.' };
    }

    try {
      // taskId로 파일 찾기
      const files = this.fs.readdirSync(taskPath).filter((f) => f.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(taskPath, file);
        const content = this.fs.readFileSync(filePath, 'utf-8');
        const { meta, body } = parseFrontmatter(content);

        if (meta.id === taskId) {
          // 긴 내용은 truncate
          const truncated = body.length > MAX_CONTENT_LENGTH;
          const displayBody = truncated
            ? body.slice(0, MAX_CONTENT_LENGTH) + '\n\n... (내용이 잘렸습니다)'
            : body;

          return {
            success: true,
            task: {
              id: meta.id || '',
              title: meta.title || '',
              status: (meta.status as TaskStatus) || 'pending',
              createdAt: meta.createdAt || '',
              startedAt: meta.startedAt,
              completedAt: meta.completedAt,
              error: meta.error,
              fileName: file,
              content: displayBody,
              truncated,
            },
          };
        }
      }

      return { success: false, error: '태스크를 찾을 수 없습니다.' };
    } catch (err) {
      const error = err as Error;
      console.error('[TaskManager] getTask error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 태스크 생성
   *
   * @description
   * 새 태스크를 생성하고 파일로 저장합니다.
   * 파일명은 YYYYMMDD-title-kebab.md 형식입니다.
   *
   * @param workingDir - 워크스페이스 경로
   * @param title - 태스크 제목
   * @param body - 태스크 본문 (마크다운)
   * @returns 생성된 태스크 정보
   */
  createTask(workingDir: string, title: string, body: string): CreateTaskResult {
    const taskPath = this.ensureTaskFolder(workingDir);

    try {
      const id = randomUUID();
      const now = new Date().toISOString();

      // 메타데이터 생성
      const meta: Record<string, string | null> = {
        id,
        title,
        status: 'pending',
        createdAt: now,
        startedAt: null,
        completedAt: null,
        error: null,
      };

      // 파일 내용 생성
      const content = buildFrontmatter(meta) + '\n\n' + body;
      const fileName = generateFileName(title);
      const filePath = path.join(taskPath, fileName);

      // 파일 저장
      this.fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`[TaskManager] Created task: ${title} (${id})`);

      return {
        success: true,
        task: {
          id,
          title,
          status: 'pending',
          createdAt: now,
          fileName,
          filePath,
        },
      };
    } catch (err) {
      const error = err as Error;
      console.error('[TaskManager] createTask error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 태스크 상태 업데이트
   *
   * @description
   * 태스크의 상태를 변경하고 관련 타임스탬프를 업데이트합니다.
   * - running으로 변경 시 startedAt 설정
   * - done/failed로 변경 시 completedAt 설정
   *
   * @param workingDir - 워크스페이스 경로
   * @param taskId - 태스크 ID
   * @param status - 새 상태
   * @param error - 에러 메시지 (failed 상태 시)
   * @returns 업데이트 결과
   */
  updateTaskStatus(
    workingDir: string,
    taskId: string,
    status: TaskStatus,
    error: string | null = null
  ): UpdateTaskResult {
    const taskPath = this.getTaskFolderPath(workingDir);

    // 폴더 존재 확인
    if (!this.fs.existsSync(taskPath)) {
      return { success: false, error: '태스크 폴더가 없습니다.' };
    }

    try {
      const files = this.fs.readdirSync(taskPath).filter((f) => f.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(taskPath, file);
        const content = this.fs.readFileSync(filePath, 'utf-8');
        const { meta, body } = parseFrontmatter(content);

        if (meta.id === taskId) {
          const now = new Date().toISOString();

          // 상태 업데이트
          meta.status = status;

          // running으로 변경 시 startedAt 설정 (처음 시작할 때만)
          if (status === 'running' && !meta.startedAt) {
            meta.startedAt = now;
          }

          // 완료/실패 시 completedAt 설정
          if (status === 'done' || status === 'failed') {
            meta.completedAt = now;
          }

          // 에러 메시지 설정
          if (error) {
            meta.error = error;
          }

          // 파일 저장
          const newContent = buildFrontmatter(meta) + '\n\n' + body;
          this.fs.writeFileSync(filePath, newContent, 'utf-8');

          console.log(`[TaskManager] Updated task status: ${meta.title} -> ${status}`);

          return {
            success: true,
            task: {
              id: meta.id || '',
              title: meta.title || '',
              status: meta.status as TaskStatus,
              createdAt: meta.createdAt || '',
              startedAt: meta.startedAt,
              completedAt: meta.completedAt,
              error: meta.error,
              fileName: file,
            },
          };
        }
      }

      return { success: false, error: '태스크를 찾을 수 없습니다.' };
    } catch (err) {
      const errorObj = err as Error;
      console.error('[TaskManager] updateTaskStatus error:', errorObj.message);
      return { success: false, error: errorObj.message };
    }
  }

  // ============================================================================
  // 유틸리티 메서드
  // ============================================================================

  /**
   * 다음 pending 태스크 조회 (FIFO)
   *
   * @description
   * pending 상태인 태스크 중 가장 오래된 것을 반환합니다.
   * 파일명 기준으로 정렬하여 FIFO 순서를 보장합니다.
   *
   * @param workingDir - 워크스페이스 경로
   * @returns 다음 pending 태스크 또는 null
   */
  getNextPendingTask(workingDir: string): TaskMeta | null {
    const result = this.listTasks(workingDir);
    if (!result.success) return null;

    // pending 상태 태스크 중 파일명 기준 가장 오래된 것 (FIFO)
    const pendingTasks = result.tasks
      .filter((t) => t.status === 'pending')
      .sort((a, b) => a.fileName.localeCompare(b.fileName)); // 오름차순 (오래된 것 먼저)

    return pendingTasks[0] || null;
  }

  /**
   * 현재 실행 중인 태스크 조회
   *
   * @param workingDir - 워크스페이스 경로
   * @returns running 상태 태스크 또는 null
   */
  getRunningTask(workingDir: string): TaskMeta | null {
    const result = this.listTasks(workingDir);
    if (!result.success) return null;

    return result.tasks.find((t) => t.status === 'running') || null;
  }

  /**
   * 태스크 파일 경로 조회
   *
   * @param workingDir - 워크스페이스 경로
   * @param taskId - 태스크 ID
   * @returns 파일 절대 경로 또는 null
   */
  getTaskFilePath(workingDir: string, taskId: string): string | null {
    const taskPath = this.getTaskFolderPath(workingDir);

    if (!this.fs.existsSync(taskPath)) return null;

    const files = this.fs.readdirSync(taskPath).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(taskPath, file);
      const content = this.fs.readFileSync(filePath, 'utf-8');
      const { meta } = parseFrontmatter(content);

      if (meta.id === taskId) {
        return filePath;
      }
    }

    return null;
  }
}
