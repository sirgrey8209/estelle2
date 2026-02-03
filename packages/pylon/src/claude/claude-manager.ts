/**
 * @file claude-manager.ts
 * @description ClaudeManager - Claude Agent SDK 연동 핵심 모듈
 *
 * Claude Agent SDK(@anthropic-ai/claude-agent-sdk)를 사용하여
 * Claude와 대화하고 도구 실행을 관리하는 모듈입니다.
 *
 * 주요 기능:
 * - 세션 관리 (sessionId -> query, abortController, state)
 * - 권한 처리 (자동 허용/거부 규칙 기반)
 * - 대기 중인 권한/질문 요청 관리
 * - 이벤트 기반 상태 전달
 *
 * 설계 원칙:
 * - SDK는 외부 의존성이므로 ClaudeAdapter 인터페이스로 추상화
 * - 권한 규칙은 permission-rules.ts로 분리
 * - 테스트 가능한 순수 로직과 I/O 분리
 *
 * @example
 * ```typescript
 * import { ClaudeManager } from './claude/index.js';
 *
 * const manager = new ClaudeManager({
 *   onEvent: (sessionId, event) => {
 *     console.log(`[${sessionId}]`, event);
 *   },
 *   getPermissionMode: (sessionId) => 'default',
 * });
 *
 * // 메시지 전송
 * await manager.sendMessage('session-1', 'Hello', {
 *   workingDir: '/project',
 * });
 *
 * // 중지
 * manager.stop('session-1');
 * ```
 */

import type { PermissionModeValue } from '@estelle/core';
import { PermissionMode } from '@estelle/core';
import {
  checkPermission,
  isPermissionAllow,
  isPermissionDeny,
} from './permission-rules.js';
import type { PermissionResult } from './permission-rules.js';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * Claude 이벤트 타입
 *
 * @description
 * ClaudeManager가 외부로 전달하는 이벤트 타입입니다.
 * 원본 claudeManager.js의 이벤트 목록과 동일합니다.
 *
 * 이벤트 목록:
 * - init: 세션 초기화
 * - stateUpdate: 상태 변경 (thinking, responding, tool)
 * - text: 텍스트 스트리밍
 * - textComplete: 텍스트 완료
 * - toolInfo: 도구 시작 정보
 * - toolComplete: 도구 완료
 * - askQuestion: 사용자 질문
 * - permission_request: 권한 요청
 * - result: 처리 완료
 * - error: 에러 발생
 * - state: 상태 변경 (idle, working, waiting)
 * - claudeAborted: 중단됨
 */
export type ClaudeManagerEventType =
  | 'init'
  | 'stateUpdate'
  | 'text'
  | 'textComplete'
  | 'toolInfo'
  | 'toolComplete'
  | 'askQuestion'
  | 'permission_request'
  | 'result'
  | 'error'
  | 'state'
  | 'claudeAborted';

/**
 * Claude 상태 정보
 *
 * @description
 * Claude의 현재 작업 상태를 나타냅니다.
 * - thinking: 생각 중 (다음 응답 준비)
 * - responding: 텍스트 응답 중
 * - tool: 도구 실행 중
 */
export interface ClaudeState {
  /** 상태 타입 */
  type: 'thinking' | 'responding' | 'tool';

  /** 도구 이름 (tool 상태일 때만) */
  toolName?: string;
}

/**
 * Claude 토큰 사용량
 *
 * @description
 * API 호출에 사용된 토큰 수를 추적합니다.
 */
export interface TokenUsage {
  /** 입력 토큰 수 */
  inputTokens: number;

  /** 출력 토큰 수 */
  outputTokens: number;

  /** 캐시에서 읽은 입력 토큰 수 */
  cacheReadInputTokens: number;

  /** 캐시 생성에 사용된 입력 토큰 수 */
  cacheCreationInputTokens: number;
}

/**
 * Claude 세션 정보
 *
 * @description
 * 활성 세션의 상태를 관리합니다.
 */
export interface ClaudeSession {
  /** AbortController (중지용) */
  abortController: AbortController;

  /** Claude 세션 ID (SDK에서 제공) */
  claudeSessionId: string | null;

  /** 현재 상태 */
  state: ClaudeState;

  /** 부분 텍스트 (스트리밍 중) */
  partialText: string;

  /** 시작 시간 */
  startTime: number;

  /** 대기 중인 도구 (toolUseId -> toolName) */
  pendingTools: Map<string, string>;

  /** 토큰 사용량 */
  usage: TokenUsage;
}

/**
 * 대기 중인 권한 요청
 */
export interface PendingPermission {
  /** 권한 응답을 위한 resolve 함수 */
  resolve: (result: PermissionCallbackResult) => void;

  /** 도구 이름 */
  toolName: string;

  /** 도구 입력 */
  input: Record<string, unknown>;

  /** 세션 ID */
  sessionId: string;
}

/**
 * 대기 중인 질문 요청
 */
export interface PendingQuestion {
  /** 질문 응답을 위한 resolve 함수 */
  resolve: (result: PermissionCallbackResult) => void;

  /** 질문 입력 */
  input: Record<string, unknown>;
}

/**
 * 대기 중인 이벤트 (재연결 시 전송용)
 */
export interface PendingEvent {
  /** 이벤트 타입 */
  type: 'permission_request' | 'askQuestion';

  /** 추가 데이터 */
  [key: string]: unknown;
}

/**
 * 권한 콜백 결과 (SDK canUseTool 반환값)
 *
 * @description
 * Claude SDK의 canUseTool 콜백이 반환해야 하는 형식입니다.
 */
export interface PermissionCallbackResult {
  /** 동작: 'allow' 또는 'deny' */
  behavior: 'allow' | 'deny';

  /** 허용 시 업데이트된 입력 */
  updatedInput?: Record<string, unknown>;

  /** 거부 시 메시지 */
  message?: string;
}

/**
 * 메시지 전송 옵션
 */
export interface SendMessageOptions {
  /** 작업 디렉토리 */
  workingDir: string;

  /** Claude 세션 ID (재개용) */
  claudeSessionId?: string;
}

/**
 * Claude 이벤트 핸들러
 */
export type ClaudeEventHandler = (
  sessionId: string,
  event: ClaudeManagerEvent
) => void;

/**
 * 권한 모드 조회 함수
 */
export type GetPermissionModeFn = (sessionId: string) => PermissionModeValue;

/**
 * MCP 설정 로드 함수
 */
export type LoadMcpConfigFn = (
  workingDir: string
) => Record<string, unknown> | null;

/**
 * Claude 이벤트 (모든 이벤트의 유니온 타입)
 */
export interface ClaudeManagerEvent {
  /** 이벤트 타입 */
  type: ClaudeManagerEventType;

  /** 추가 데이터 */
  [key: string]: unknown;
}

/**
 * ClaudeAdapter 인터페이스
 *
 * @description
 * Claude SDK를 추상화한 인터페이스입니다.
 * 테스트 시 모킹하거나 다른 구현으로 교체할 수 있습니다.
 */
export interface ClaudeAdapter {
  /**
   * Claude에 쿼리 실행
   *
   * @param options - 쿼리 옵션
   * @returns 메시지 스트림 (AsyncIterable)
   */
  query(options: ClaudeQueryOptions): AsyncIterable<ClaudeMessage>;
}

/**
 * Claude 쿼리 옵션
 */
export interface ClaudeQueryOptions {
  /** 프롬프트 메시지 */
  prompt: string;

  /** 작업 디렉토리 */
  cwd: string;

  /** 중단용 AbortController */
  abortController: AbortController;

  /** 부분 메시지 포함 여부 */
  includePartialMessages?: boolean;

  /** 설정 소스 */
  settingSources?: string[];

  /** 재개할 세션 ID */
  resume?: string;

  /** MCP 서버 설정 */
  mcpServers?: Record<string, unknown>;

  /** 도구 사용 가능 여부 콜백 */
  canUseTool?: (
    toolName: string,
    input: Record<string, unknown>
  ) => Promise<PermissionCallbackResult>;
}

/**
 * Claude 메시지 (SDK에서 반환되는 메시지)
 *
 * @description
 * 실제 SDK 메시지 타입을 간소화한 형태입니다.
 * 필요한 필드만 포함합니다.
 */
export interface ClaudeMessage {
  /** 메시지 타입 */
  type: string;

  /** 서브타입 */
  subtype?: string;

  /** 세션 ID (init 메시지) */
  session_id?: string;

  /** 모델 이름 (init 메시지) */
  model?: string;

  /** 도구 목록 (init 메시지) */
  tools?: string[];

  /** 메시지 객체 */
  message?: {
    content: Array<{
      type: string;
      text?: string;
      name?: string;
      id?: string;
      input?: Record<string, unknown>;
      tool_use_id?: string;
      is_error?: boolean;
      content?: string | Array<{ type: string; text?: string }>;
    }>;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };

  /** 스트림 이벤트 */
  event?: {
    type: string;
    content_block?: {
      type: string;
      name?: string;
      id?: string;
    };
    delta?: {
      type: string;
      text?: string;
    };
    message?: {
      usage?: {
        input_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
    };
    usage?: {
      output_tokens?: number;
    };
  };

  /** 도구 진행 상황 */
  tool_name?: string;
  elapsed_time_seconds?: number;

  /** 결과 정보 */
  total_cost_usd?: number;
  num_turns?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

/**
 * ClaudeManager 옵션
 */
export interface ClaudeManagerOptions {
  /** 이벤트 핸들러 */
  onEvent: ClaudeEventHandler;

  /** 권한 모드 조회 함수 */
  getPermissionMode: GetPermissionModeFn;

  /** MCP 설정 로드 함수 (선택) */
  loadMcpConfig?: LoadMcpConfigFn;

  /** Claude 어댑터 (테스트용, 미지정 시 기본 SDK 사용) */
  adapter?: ClaudeAdapter;
}

// ============================================================================
// ClaudeManager 클래스
// ============================================================================

/**
 * ClaudeManager - Claude Agent SDK 연동 핵심 클래스
 *
 * @description
 * Claude SDK를 사용하여 대화를 관리하고 도구 실행 권한을 처리합니다.
 *
 * 특징:
 * - 세션별 상태 관리 (Map 기반)
 * - 자동 허용/거부 규칙 적용
 * - 대기 중인 권한/질문 요청 관리
 * - 이벤트 기반 상태 전달
 * - 재연결 시 대기 이벤트 복원
 *
 * @example
 * ```typescript
 * const manager = new ClaudeManager({
 *   onEvent: (sessionId, event) => {
 *     // 이벤트 처리
 *   },
 *   getPermissionMode: (sessionId) => {
 *     return workspaceStore.getConversationPermissionMode(sessionId);
 *   },
 * });
 *
 * await manager.sendMessage('session-1', 'Hello', {
 *   workingDir: '/project',
 * });
 * ```
 */
export class ClaudeManager {
  // ============================================================================
  // Private 필드
  // ============================================================================

  /** 이벤트 핸들러 */
  private readonly onEvent: ClaudeEventHandler;

  /** 권한 모드 조회 함수 */
  private readonly getPermissionMode: GetPermissionModeFn;

  /** MCP 설정 로드 함수 */
  private readonly loadMcpConfig?: LoadMcpConfigFn;

  /** Claude 어댑터 */
  private readonly adapter?: ClaudeAdapter;

  /** 활성 세션 (sessionId -> ClaudeSession) */
  private readonly sessions: Map<string, ClaudeSession> = new Map();

  /** 대기 중인 권한 요청 (toolUseId -> PendingPermission) */
  private readonly pendingPermissions: Map<string, PendingPermission> =
    new Map();

  /** 대기 중인 질문 요청 (toolUseId -> PendingQuestion) */
  private readonly pendingQuestions: Map<string, PendingQuestion> = new Map();

  /** 재연결 시 전송할 대기 이벤트 (sessionId -> PendingEvent) */
  private readonly pendingEvents: Map<string, PendingEvent> = new Map();

  // ============================================================================
  // 생성자
  // ============================================================================

  /**
   * ClaudeManager 생성자
   *
   * @param options - 설정 옵션
   */
  constructor(options: ClaudeManagerOptions) {
    this.onEvent = options.onEvent;
    this.getPermissionMode = options.getPermissionMode;
    this.loadMcpConfig = options.loadMcpConfig;
    this.adapter = options.adapter;
  }

  // ============================================================================
  // Public 메서드 - 메시지 전송
  // ============================================================================

  /**
   * Claude에게 메시지 전송
   *
   * @description
   * 지정된 세션으로 메시지를 전송하고 응답을 처리합니다.
   * 이미 실행 중인 세션이 있으면 먼저 중지합니다.
   *
   * @param sessionId - 세션 ID (보통 conversationId)
   * @param message - 사용자 메시지
   * @param options - 전송 옵션
   *
   * @example
   * ```typescript
   * await manager.sendMessage('conv-123', 'Hello', {
   *   workingDir: '/project',
   *   claudeSessionId: 'existing-session', // 재개용
   * });
   * ```
   */
  async sendMessage(
    sessionId: string,
    message: string,
    options: SendMessageOptions
  ): Promise<void> {
    const { workingDir, claudeSessionId } = options;

    // 작업 디렉토리 필수
    if (!workingDir) {
      this.emitEvent(sessionId, {
        type: 'error',
        error: `Working directory not found for: ${sessionId}`,
      });
      return;
    }

    // 이미 실행 중이면 중지
    if (this.sessions.has(sessionId)) {
      this.stop(sessionId);
      await this.delay(200);
    }

    this.emitEvent(sessionId, { type: 'state', state: 'working' });

    try {
      await this.runQuery(sessionId, { workingDir, claudeSessionId }, message);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      this.emitEvent(sessionId, { type: 'error', error: errorMessage });
    } finally {
      this.sessions.delete(sessionId);
      this.pendingEvents.delete(sessionId);
      this.emitEvent(sessionId, { type: 'state', state: 'idle' });
    }
  }

  // ============================================================================
  // Public 메서드 - 세션 제어
  // ============================================================================

  /**
   * 실행 중지 (강제 종료)
   *
   * @description
   * 세션을 강제로 중지합니다.
   * 세션 유무와 관계없이 항상 idle 상태로 전환됩니다.
   * abort 실패해도 세션을 정리합니다.
   *
   * @param sessionId - 중지할 세션 ID
   *
   * @example
   * ```typescript
   * manager.stop('conv-123');
   * ```
   */
  stop(sessionId: string): void {
    const session = this.sessions.get(sessionId);

    // 1. abort 시도 (실패해도 계속 진행)
    if (session?.abortController) {
      try {
        session.abortController.abort();
      } catch {
        // abort 실패 무시
      }
    }

    // 2. 세션 강제 삭제
    this.sessions.delete(sessionId);

    // 3. pending 이벤트 삭제
    this.pendingEvents.delete(sessionId);

    // 4. 중단 메시지 전송
    this.emitEvent(sessionId, { type: 'claudeAborted', reason: 'user' });

    // 5. 상태 강제 변경
    this.emitEvent(sessionId, { type: 'state', state: 'idle' });

    // 6. 대기 중인 권한 요청 모두 거부
    for (const [id, pending] of this.pendingPermissions) {
      if (pending.sessionId === sessionId) {
        try {
          pending.resolve({ behavior: 'deny', message: 'Stopped' });
        } catch {
          // resolve 실패 무시
        }
        this.pendingPermissions.delete(id);
      }
    }

    // 7. 대기 중인 질문 요청 모두 거부
    for (const [id, pending] of this.pendingQuestions) {
      try {
        pending.resolve({ behavior: 'deny', message: 'Stopped' });
      } catch {
        // resolve 실패 무시
      }
      this.pendingQuestions.delete(id);
    }
  }

  /**
   * 새 세션 시작
   *
   * @description
   * 기존 세션을 중지하고 새 세션을 시작합니다.
   *
   * @param sessionId - 세션 ID
   */
  newSession(sessionId: string): void {
    this.stop(sessionId);
    this.emitEvent(sessionId, { type: 'state', state: 'idle' });
  }

  // ============================================================================
  // Public 메서드 - 권한/질문 응답
  // ============================================================================

  /**
   * 권한 응답 처리
   *
   * @description
   * 대기 중인 권한 요청에 응답합니다.
   *
   * @param sessionId - 세션 ID
   * @param toolUseId - 도구 사용 ID
   * @param decision - 권한 결정 ('allow', 'deny', 'allowAll')
   *
   * @example
   * ```typescript
   * manager.respondPermission('conv-123', 'tool-456', 'allow');
   * ```
   */
  respondPermission(
    sessionId: string,
    toolUseId: string,
    decision: 'allow' | 'deny' | 'allowAll'
  ): void {
    const pending = this.pendingPermissions.get(toolUseId);
    if (!pending) return;

    this.pendingPermissions.delete(toolUseId);
    this.pendingEvents.delete(sessionId);

    if (decision === 'allow' || decision === 'allowAll') {
      pending.resolve({ behavior: 'allow', updatedInput: pending.input });
    } else {
      pending.resolve({ behavior: 'deny', message: 'User denied' });
    }

    this.emitEvent(sessionId, { type: 'state', state: 'working' });
  }

  /**
   * 질문 응답 처리
   *
   * @description
   * 대기 중인 질문에 응답합니다.
   * toolUseId로 찾지 못하면 첫 번째 대기 중인 질문을 사용합니다.
   *
   * @param sessionId - 세션 ID
   * @param toolUseId - 도구 사용 ID
   * @param answer - 사용자 답변
   *
   * @example
   * ```typescript
   * manager.respondQuestion('conv-123', 'tool-456', 'Yes, proceed');
   * ```
   */
  respondQuestion(sessionId: string, toolUseId: string, answer: string): void {
    // toolUseId로 찾기
    let pending = this.pendingQuestions.get(toolUseId);
    let foundId = toolUseId;

    // 못 찾으면 첫 번째 pending question 사용
    if (!pending && this.pendingQuestions.size > 0) {
      const firstEntry = this.pendingQuestions.entries().next();
      if (!firstEntry.done) {
        [foundId, pending] = firstEntry.value;
      }
    }

    if (!pending) return;

    this.pendingQuestions.delete(foundId);
    this.pendingEvents.delete(sessionId);

    // 답변을 포함한 업데이트된 입력
    const updatedInput = {
      ...pending.input,
      answers: { '0': answer },
    };
    pending.resolve({ behavior: 'allow', updatedInput });
  }

  // ============================================================================
  // Public 메서드 - 상태 조회
  // ============================================================================

  /**
   * 특정 세션의 대기 이벤트 가져오기
   *
   * @param sessionId - 세션 ID
   * @returns 대기 중인 이벤트 또는 null
   */
  getPendingEvent(sessionId: string): PendingEvent | null {
    return this.pendingEvents.get(sessionId) || null;
  }

  /**
   * 모든 대기 이벤트 가져오기
   *
   * @returns 세션별 대기 이벤트 목록
   */
  getAllPendingEvents(): Array<{ sessionId: string; event: PendingEvent }> {
    const result: Array<{ sessionId: string; event: PendingEvent }> = [];
    for (const [sessionId, event] of this.pendingEvents) {
      result.push({ sessionId, event });
    }
    return result;
  }

  /**
   * 활성 세션 존재 여부 확인
   *
   * @param sessionId - 세션 ID
   * @returns 활성 세션 존재 여부
   */
  hasActiveSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * 세션 시작 시간 가져오기
   *
   * @param sessionId - 세션 ID
   * @returns 시작 시간 또는 null
   */
  getSessionStartTime(sessionId: string): number | null {
    return this.sessions.get(sessionId)?.startTime ?? null;
  }

  /**
   * 모든 활성 세션 ID 목록
   *
   * @returns 세션 ID 배열
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  // ============================================================================
  // Public 메서드 - 정리
  // ============================================================================

  /**
   * 모든 세션 정리
   *
   * @description
   * 모든 활성 세션을 중지하고 리소스를 정리합니다.
   */
  cleanup(): void {
    for (const sessionId of this.sessions.keys()) {
      this.stop(sessionId);
    }
  }

  // ============================================================================
  // Private 메서드 - 쿼리 실행
  // ============================================================================

  /**
   * SDK query 실행
   *
   * @param sessionId - 세션 ID
   * @param sessionInfo - 세션 정보
   * @param message - 사용자 메시지
   */
  private async runQuery(
    sessionId: string,
    sessionInfo: { workingDir: string; claudeSessionId?: string },
    message: string
  ): Promise<void> {
    const abortController = new AbortController();

    // 세션 상태 초기화
    const session: ClaudeSession = {
      abortController,
      claudeSessionId: null,
      state: { type: 'thinking' },
      partialText: '',
      startTime: Date.now(),
      pendingTools: new Map(),
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      },
    };
    this.sessions.set(sessionId, session);

    // 초기 thinking 상태 전송
    this.emitEvent(sessionId, {
      type: 'stateUpdate',
      state: session.state,
      partialText: '',
    });

    // 쿼리 옵션 구성
    const queryOptions: ClaudeQueryOptions = {
      prompt: message,
      cwd: sessionInfo.workingDir,
      abortController,
      includePartialMessages: true,
      settingSources: ['project'],
      canUseTool: async (toolName, input) => {
        return this.handlePermission(sessionId, toolName, input);
      },
    };

    // MCP 서버 설정 로드
    if (this.loadMcpConfig) {
      const mcpServers = this.loadMcpConfig(sessionInfo.workingDir);
      if (mcpServers) {
        queryOptions.mcpServers = mcpServers;
      }
    }

    // 세션 재개
    if (sessionInfo.claudeSessionId) {
      queryOptions.resume = sessionInfo.claudeSessionId;
    }

    // 어댑터가 없으면 실제 SDK 호출 불가 (테스트용)
    if (!this.adapter) {
      this.emitEvent(sessionId, {
        type: 'error',
        error: 'Claude adapter not configured',
      });
      return;
    }

    // 쿼리 실행
    const query = this.adapter.query(queryOptions);

    for await (const msg of query) {
      this.handleMessage(sessionId, session, msg);
    }
  }

  /**
   * SDK 메시지 처리
   *
   * @param sessionId - 세션 ID
   * @param session - 세션 상태
   * @param msg - SDK 메시지
   */
  private handleMessage(
    sessionId: string,
    session: ClaudeSession,
    msg: ClaudeMessage
  ): void {
    switch (msg.type) {
      case 'system':
        this.handleSystemMessage(sessionId, session, msg);
        break;

      case 'assistant':
        this.handleAssistantMessage(sessionId, session, msg);
        break;

      case 'user':
        this.handleUserMessage(sessionId, session, msg);
        break;

      case 'stream_event':
        this.handleStreamEvent(sessionId, session, msg);
        break;

      case 'tool_progress':
        this.handleToolProgress(sessionId, session, msg);
        break;

      case 'result':
        this.handleResult(sessionId, session, msg);
        break;
    }
  }

  /**
   * system 메시지 처리 (init)
   */
  private handleSystemMessage(
    sessionId: string,
    session: ClaudeSession,
    msg: ClaudeMessage
  ): void {
    if (msg.subtype === 'init') {
      session.claudeSessionId = msg.session_id || null;

      this.emitEvent(sessionId, {
        type: 'init',
        session_id: msg.session_id,
        model: msg.model,
        tools: msg.tools,
      });
    }
  }

  /**
   * assistant 메시지 처리
   */
  private handleAssistantMessage(
    sessionId: string,
    session: ClaudeSession,
    msg: ClaudeMessage
  ): void {
    const content = msg.message?.content;
    if (!content) return;

    for (const block of content) {
      if (block.type === 'text' && block.text) {
        this.emitEvent(sessionId, {
          type: 'textComplete',
          text: block.text,
        });
        session.partialText = '';
      } else if (block.type === 'tool_use' && block.name && block.id) {
        session.pendingTools.set(block.id, block.name);

        if (block.name === 'AskUserQuestion') {
          // 질문 이벤트
          const askEvent: PendingEvent = {
            type: 'askQuestion',
            questions: (block.input as Record<string, unknown>)?.questions,
            toolUseId: block.id,
          };
          this.pendingEvents.set(sessionId, askEvent);
          this.emitEvent(sessionId, askEvent);
        } else {
          // 도구 정보 이벤트
          this.emitEvent(sessionId, {
            type: 'toolInfo',
            toolName: block.name,
            input: block.input,
          });
        }
      }
    }
  }

  /**
   * user 메시지 처리 (도구 실행 결과)
   */
  private handleUserMessage(
    sessionId: string,
    session: ClaudeSession,
    msg: ClaudeMessage
  ): void {
    const content = msg.message?.content;
    if (!Array.isArray(content)) return;

    for (const block of content) {
      if (block.type === 'tool_result' && block.tool_use_id) {
        const toolUseId = block.tool_use_id;
        const toolName = session.pendingTools.get(toolUseId) || 'Unknown';
        const isError = block.is_error === true;

        let resultContent = '';
        if (typeof block.content === 'string') {
          resultContent = block.content;
        } else if (Array.isArray(block.content)) {
          resultContent = block.content
            .filter((c) => c.type === 'text')
            .map((c) => c.text || '')
            .join('\n');
        }

        session.pendingTools.delete(toolUseId);

        this.emitEvent(sessionId, {
          type: 'toolComplete',
          toolName,
          success: !isError,
          result: resultContent.substring(0, 1000),
          error: isError ? resultContent.substring(0, 200) : undefined,
        });
      }
    }
  }

  /**
   * stream_event 처리
   */
  private handleStreamEvent(
    sessionId: string,
    session: ClaudeSession,
    msg: ClaudeMessage
  ): void {
    const event = msg.event;
    if (!event) return;

    // 메시지 시작 - 토큰 정보
    if (event.type === 'message_start' && event.message?.usage) {
      session.usage.inputTokens += event.message.usage.input_tokens || 0;
      session.usage.cacheReadInputTokens +=
        event.message.usage.cache_read_input_tokens || 0;
      session.usage.cacheCreationInputTokens +=
        event.message.usage.cache_creation_input_tokens || 0;
    }

    // 콘텐츠 블록 시작
    if (event.type === 'content_block_start') {
      const block = event.content_block;
      if (block?.type === 'text') {
        session.partialText = '';
        session.state = { type: 'responding' };
        this.emitEvent(sessionId, {
          type: 'stateUpdate',
          state: session.state,
          partialText: '',
        });
      } else if (block?.type === 'tool_use' && block.name) {
        session.partialText = '';
        session.state = { type: 'tool', toolName: block.name };
        if (block.id) {
          session.pendingTools.set(block.id, block.name);
        }
        this.emitEvent(sessionId, {
          type: 'stateUpdate',
          state: session.state,
          partialText: '',
        });
      }
    }

    // 텍스트 델타
    if (event.type === 'content_block_delta') {
      const delta = event.delta;
      if (delta?.type === 'text_delta' && delta.text) {
        session.partialText += delta.text;
        this.emitEvent(sessionId, { type: 'text', text: delta.text });
      }
    }

    // 블록 종료
    if (event.type === 'content_block_stop') {
      session.state = { type: 'thinking' };
      this.emitEvent(sessionId, {
        type: 'stateUpdate',
        state: session.state,
        partialText: session.partialText,
      });
    }

    // 메시지 델타 - 출력 토큰
    if (event.type === 'message_delta' && event.usage) {
      session.usage.outputTokens += event.usage.output_tokens || 0;
    }
  }

  /**
   * tool_progress 처리
   */
  private handleToolProgress(
    sessionId: string,
    session: ClaudeSession,
    msg: ClaudeMessage
  ): void {
    if (msg.tool_name) {
      session.state = { type: 'tool', toolName: msg.tool_name };
      this.emitEvent(sessionId, {
        type: 'stateUpdate',
        state: session.state,
        partialText: '',
      });
    }
  }

  /**
   * result 처리
   */
  private handleResult(
    sessionId: string,
    session: ClaudeSession,
    msg: ClaudeMessage
  ): void {
    const duration = Date.now() - session.startTime;

    // 토큰 사용량 업데이트
    if (msg.usage) {
      session.usage.inputTokens =
        msg.usage.input_tokens || session.usage.inputTokens;
      session.usage.outputTokens =
        msg.usage.output_tokens || session.usage.outputTokens;
      session.usage.cacheReadInputTokens =
        msg.usage.cache_read_input_tokens || session.usage.cacheReadInputTokens;
      session.usage.cacheCreationInputTokens =
        msg.usage.cache_creation_input_tokens ||
        session.usage.cacheCreationInputTokens;
    }

    this.emitEvent(sessionId, {
      type: 'result',
      subtype: msg.subtype,
      duration_ms: duration,
      total_cost_usd: msg.total_cost_usd,
      num_turns: msg.num_turns,
      usage: session.usage,
    });
  }

  // ============================================================================
  // Private 메서드 - 권한 처리
  // ============================================================================

  /**
   * 권한 핸들러
   *
   * @description
   * 도구 실행 권한을 결정합니다.
   * 자동 허용/거부 규칙을 먼저 확인하고,
   * 해당되지 않으면 사용자에게 권한을 요청합니다.
   */
  private async handlePermission(
    sessionId: string,
    toolName: string,
    input: Record<string, unknown>
  ): Promise<PermissionCallbackResult> {
    const mode = this.getPermissionMode(sessionId);

    // 권한 규칙 확인
    const result: PermissionResult = checkPermission(toolName, input, mode);

    // 자동 허용
    if (isPermissionAllow(result)) {
      return { behavior: 'allow', updatedInput: result.updatedInput };
    }

    // 자동 거부
    if (isPermissionDeny(result)) {
      return { behavior: 'deny', message: result.message };
    }

    // 사용자에게 권한 요청
    const toolUseId = `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // AskUserQuestion 특별 처리
    if (toolName === 'AskUserQuestion') {
      return new Promise((resolve) => {
        this.pendingQuestions.set(toolUseId, { resolve, input });
      });
    }

    // 일반 권한 요청
    return new Promise((resolve) => {
      this.pendingPermissions.set(toolUseId, {
        resolve,
        toolName,
        input,
        sessionId,
      });

      const permEvent: PendingEvent = {
        type: 'permission_request',
        toolName,
        toolInput: input,
        toolUseId,
      };
      this.pendingEvents.set(sessionId, permEvent);
      this.emitEvent(sessionId, { type: 'state', state: 'waiting' });
      this.emitEvent(sessionId, permEvent);
    });
  }

  // ============================================================================
  // Private 유틸리티
  // ============================================================================

  /**
   * 이벤트 발생
   */
  private emitEvent(sessionId: string, event: ClaudeManagerEvent): void {
    this.onEvent(sessionId, event);
  }

  /**
   * 지연 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
