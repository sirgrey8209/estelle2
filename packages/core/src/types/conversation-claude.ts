/**
 * @file conversation-claude.ts
 * @description 대화(Conversation)별 Claude 상태 타입 정의
 *
 * 각 대화는 독립적인 Claude 상태를 가집니다.
 * 이 상태는 Pylon에서 관리되고 Client에 동기화됩니다.
 */

import type { StoreMessage } from './store-message.js';

// ============================================================================
// Status Types
// ============================================================================

/**
 * Claude 상태
 *
 * @description
 * Claude SDK의 현재 상태를 나타냅니다.
 *
 * - `idle`: 대기 중 (입력 대기)
 * - `working`: 작업 중 (응답 생성 중)
 * - `permission`: 권한 요청 대기 중
 */
export type ClaudeStatus = 'idle' | 'working' | 'permission';

// ============================================================================
// Request Types
// ============================================================================

/**
 * 권한 요청
 *
 * @description
 * Claude가 특정 도구 사용 권한을 요청할 때 생성됩니다.
 */
export interface PermissionRequest {
  type: 'permission';
  toolUseId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
}

/**
 * 질문 항목
 *
 * @description
 * AskUserQuestion 도구의 개별 질문 항목입니다.
 */
export interface QuestionItem {
  question: string;
  header?: string;
  options: string[];
  multiSelect?: boolean;
}

/**
 * 질문 요청
 *
 * @description
 * Claude가 사용자에게 질문할 때 생성됩니다.
 */
export interface QuestionRequest {
  type: 'question';
  toolUseId: string;
  questions: QuestionItem[];
}

/**
 * 대기 중인 요청 유니온 타입
 */
export type PendingRequest = PermissionRequest | QuestionRequest;

// ============================================================================
// Usage Types
// ============================================================================

/**
 * 실시간 토큰 사용량
 *
 * @description
 * 현재 작업의 토큰 사용량을 실시간으로 추적합니다.
 */
export interface RealtimeUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  /** 마지막 업데이트 타입 */
  lastUpdateType: 'input' | 'output';
}

// ============================================================================
// Conversation Claude State
// ============================================================================

/**
 * 대화별 Claude 상태
 *
 * @description
 * 각 대화(Conversation)가 독립적으로 가지는 Claude 관련 상태입니다.
 * 이 상태는 대화 전환 시에도 유지됩니다.
 *
 * @example
 * ```typescript
 * const state: ConversationClaudeState = {
 *   status: 'working',
 *   messages: [...],
 *   textBuffer: 'Hello, I am...',
 *   pendingRequests: [],
 *   workStartTime: Date.now(),
 *   realtimeUsage: { inputTokens: 100, outputTokens: 50, ... },
 * };
 * ```
 */
export interface ConversationClaudeState {
  /** Claude 상태 (idle, working, permission) */
  status: ClaudeStatus;

  /** 메시지 목록 */
  messages: StoreMessage[];

  /** 스트리밍 텍스트 버퍼 (아직 완성되지 않은 응답) */
  textBuffer: string;

  /** 대기 중인 요청 (권한/질문) */
  pendingRequests: PendingRequest[];

  /** 작업 시작 시간 (Unix timestamp) */
  workStartTime: number | null;

  /** 실시간 토큰 사용량 */
  realtimeUsage: RealtimeUsage | null;

  // === 히스토리 페이징 ===

  /** 전체 메시지 수 */
  totalCount: number;

  /** 더 많은 히스토리가 있는지 */
  hasMore: boolean;

  /** 히스토리 추가 로딩 중 */
  isLoadingMore: boolean;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 초기 ConversationClaudeState 생성
 *
 * @description
 * 새 대화를 위한 초기 상태를 생성합니다.
 *
 * @returns 초기화된 ConversationClaudeState
 */
export function createInitialClaudeState(): ConversationClaudeState {
  return {
    status: 'idle',
    messages: [],
    textBuffer: '',
    pendingRequests: [],
    workStartTime: null,
    realtimeUsage: null,
    totalCount: 0,
    hasMore: false,
    isLoadingMore: false,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * ClaudeStatus 타입 가드
 *
 * @param value - 확인할 값
 * @returns ClaudeStatus 타입이면 true
 */
export function isClaudeStatus(value: unknown): value is ClaudeStatus {
  return value === 'idle' || value === 'working' || value === 'permission';
}

/**
 * PermissionRequest 타입 가드
 *
 * @param value - 확인할 값
 * @returns PermissionRequest 타입이면 true
 */
export function isPermissionRequest(value: unknown): value is PermissionRequest {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.type === 'permission' &&
    typeof obj.toolUseId === 'string' &&
    typeof obj.toolName === 'string' &&
    typeof obj.toolInput === 'object' &&
    obj.toolInput !== null
  );
}

/**
 * QuestionRequest 타입 가드
 *
 * @param value - 확인할 값
 * @returns QuestionRequest 타입이면 true
 */
export function isQuestionRequest(value: unknown): value is QuestionRequest {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.type === 'question' &&
    typeof obj.toolUseId === 'string' &&
    Array.isArray(obj.questions)
  );
}

/**
 * PendingRequest 타입 가드
 *
 * @param value - 확인할 값
 * @returns PendingRequest 타입이면 true
 */
export function isPendingRequest(value: unknown): value is PendingRequest {
  return isPermissionRequest(value) || isQuestionRequest(value);
}
