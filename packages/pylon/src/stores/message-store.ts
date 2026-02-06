/**
 * @file message-store.ts
 * @description MessageStore - 세션별 메시지 히스토리 저장
 *
 * 세션(conversationId)별 메시지 히스토리를 관리하는 순수 데이터 클래스입니다.
 * 파일 I/O는 외부에서 처리하여 테스트 용이성을 확보합니다.
 *
 * 저장 구조 (세션별 파일):
 * ```json
 * {
 *   "sessionId": "uuid",
 *   "messages": [
 *     {
 *       "id": "msg_1234567890",
 *       "role": "user",
 *       "type": "text",
 *       "content": "Hello",
 *       "timestamp": 1704067200000
 *     }
 *   ],
 *   "updatedAt": 1704067200000
 * }
 * ```
 *
 * @example
 * ```typescript
 * import { MessageStore } from './stores/message-store.js';
 * import fs from 'fs';
 *
 * // 스토어 생성
 * const store = new MessageStore();
 *
 * // 메시지 추가
 * store.addUserMessage('session-1', 'Hello, Claude!');
 * store.addAssistantText('session-1', 'Hi! How can I help?');
 *
 * // 세션 데이터 저장
 * const sessionData = store.getSessionData('session-1');
 * if (sessionData) {
 *   fs.writeFileSync('messages/session-1.json', JSON.stringify(sessionData, null, 2));
 * }
 * ```
 */

// ============================================================================
// Core 타입 import & re-export
// ============================================================================

import type {
  StoreMessage,
  UserTextMessage,
  AssistantTextMessage,
  ToolStartMessage,
  ToolCompleteMessage,
  ErrorMessage,
  ResultMessage,
  AbortedMessage,
  FileAttachmentMessage,
  Attachment,
  FileInfo,
  ResultInfo,
} from '@estelle/core';

// Core 타입 re-export (기존 import 경로 호환)
export type {
  StoreMessage,
  UserTextMessage,
  AssistantTextMessage,
  ToolStartMessage,
  ToolCompleteMessage,
  ErrorMessage,
  ResultMessage,
  AbortedMessage,
  FileAttachmentMessage,
  Attachment,
  FileInfo,
  ResultInfo,
};

// ============================================================================
// 상수 정의
// ============================================================================

/**
 * 세션당 최대 메시지 수
 * @description
 * 이 값을 초과하면 오래된 메시지가 제거됩니다.
 */
export const MAX_MESSAGES_PER_SESSION = 200;

/**
 * 도구 출력 최대 길이 (요약 시 사용)
 * @description
 * 이 길이를 초과하는 출력은 요약됩니다.
 */
export const MAX_OUTPUT_LENGTH = 500;

/**
 * 도구 입력 최대 길이 (요약 시 사용)
 * @description
 * 이 길이를 초과하는 입력은 요약됩니다.
 */
export const MAX_INPUT_LENGTH = 300;

// ============================================================================
// ID 생성
// ============================================================================

/**
 * 메시지 ID 카운터 (세션 내 고유성)
 */
let messageIdCounter = 0;

/**
 * 고유한 메시지 ID 생성
 *
 * @description
 * timestamp + counter 조합으로 고유 ID를 생성합니다.
 * 형식: msg_{timestamp}_{counter}
 *
 * @returns 고유 메시지 ID
 */
export function generateMessageId(): string {
  const timestamp = Date.now();
  const counter = messageIdCounter++;
  return `msg_${timestamp}_${counter}`;
}

// ============================================================================
// 세션/스토어 데이터 타입
// ============================================================================

/**
 * 세션 데이터 (파일 저장용)
 * @description
 * 개별 세션의 메시지를 파일에 저장할 때 사용되는 구조입니다.
 */
export interface SessionData {
  /** 세션 ID */
  sessionId: string;
  /** 메시지 목록 */
  messages: StoreMessage[];
  /** 마지막 업데이트 시각 */
  updatedAt: number;
}

/**
 * 메시지 스토어 전체 데이터 (직렬화용)
 * @description
 * 메모리에 있는 모든 세션 데이터를 포함합니다.
 */
export interface MessageStoreData {
  /** 세션별 데이터 맵 */
  sessions: Record<string, SessionData>;
}

/**
 * 메시지 조회 옵션
 */
export interface GetMessagesOptions {
  /** 반환할 최대 메시지 수 */
  limit?: number;
  /** 건너뛸 메시지 수 (끝에서부터) */
  offset?: number;
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 도구 입력 요약 (히스토리 저장용)
 *
 * @description
 * 도구별로 필요한 최소한의 정보만 유지합니다.
 * - 파일 관련 도구 (Read, Edit, Write, NotebookEdit): 경로만 유지
 * - Bash: description + command 첫 줄만
 * - Glob, Grep: pattern과 path만
 * - 기타: 긴 문자열 값은 truncate
 *
 * @param toolName - 도구 이름
 * @param input - 원본 입력
 * @returns 요약된 입력
 *
 * @example
 * ```typescript
 * const input = { file_path: 'file.ts', content: 'very long content...' };
 * const summarized = summarizeToolInput('Read', input);
 * // { file_path: 'file.ts' }
 * ```
 */
export function summarizeToolInput(
  toolName: string,
  input: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!input) return {} as Record<string, unknown>;

  // Read, NotebookEdit는 경로만 유지
  if (['Read', 'NotebookEdit'].includes(toolName)) {
    const result: Record<string, unknown> = {};
    if (input.file_path) result.file_path = input.file_path;
    if (input.notebook_path) result.notebook_path = input.notebook_path;
    return result;
  }

  // Edit은 경로 + old_string/new_string (요약)
  if (toolName === 'Edit') {
    const result: Record<string, unknown> = {};
    if (input.file_path) result.file_path = input.file_path;
    if (input.old_string) {
      const oldStr = input.old_string as string;
      result.old_string = oldStr.length > MAX_INPUT_LENGTH
        ? oldStr.slice(0, MAX_INPUT_LENGTH) + '...'
        : oldStr;
    }
    if (input.new_string) {
      const newStr = input.new_string as string;
      result.new_string = newStr.length > MAX_INPUT_LENGTH
        ? newStr.slice(0, MAX_INPUT_LENGTH) + '...'
        : newStr;
    }
    return result;
  }

  // Write는 경로 + content (요약)
  if (toolName === 'Write') {
    const result: Record<string, unknown> = {};
    if (input.file_path) result.file_path = input.file_path;
    if (input.content) {
      const content = input.content as string;
      result.content = content.length > MAX_INPUT_LENGTH
        ? content.slice(0, MAX_INPUT_LENGTH) + '...'
        : content;
    }
    return result;
  }

  // Bash는 description + command 첫 줄만
  if (toolName === 'Bash') {
    const result: Record<string, string> = {};
    if (input.description) result.description = input.description as string;
    if (input.command) {
      const command = input.command as string;
      const firstLine = command.split('\n')[0];
      result.command =
        firstLine.length > MAX_INPUT_LENGTH
          ? firstLine.slice(0, MAX_INPUT_LENGTH) + '...'
          : firstLine;
    }
    return result;
  }

  // Glob, Grep는 pattern과 path만
  if (['Glob', 'Grep'].includes(toolName)) {
    const result: Record<string, unknown> = {};
    if (input.pattern) result.pattern = input.pattern;
    if (input.path) result.path = input.path;
    return result;
  }

  // 기타는 값이 길면 truncate
  return truncateObjectValues(input, MAX_INPUT_LENGTH) as Record<
    string,
    unknown
  >;
}

/**
 * 객체의 문자열 값들을 truncate
 *
 * @description
 * 객체 내의 모든 문자열 값을 지정된 최대 길이로 자릅니다.
 * 중첩된 객체도 재귀적으로 처리합니다.
 *
 * @param obj - 처리할 객체
 * @param maxLength - 최대 문자열 길이
 * @returns 처리된 객체
 *
 * @example
 * ```typescript
 * const obj = { short: 'hi', long: 'x'.repeat(1000) };
 * const truncated = truncateObjectValues(obj, 100);
 * // { short: 'hi', long: 'xxxx...(truncated)' }
 * ```
 */
export function truncateObjectValues(
  obj: unknown,
  maxLength: number
): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value === 'string' && value.length > maxLength) {
      result[key] = value.slice(0, maxLength) + '...';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = truncateObjectValues(value, maxLength);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 출력 요약 (히스토리 저장용)
 *
 * @description
 * 긴 출력을 MAX_OUTPUT_LENGTH로 자르고 전체 길이를 표시합니다.
 *
 * @param output - 원본 출력
 * @returns 요약된 출력
 *
 * @example
 * ```typescript
 * const output = 'x'.repeat(1000);
 * const summarized = summarizeOutput(output);
 * // 'xxxx...\n... (1000 chars total)'
 * ```
 */
export function summarizeOutput(output: unknown): unknown {
  if (!output || typeof output !== 'string') return output;
  if (output.length <= MAX_OUTPUT_LENGTH) return output;
  return (
    output.slice(0, MAX_OUTPUT_LENGTH) + `\n... (${output.length} chars total)`
  );
}

// ============================================================================
// MessageStore 클래스
// ============================================================================

/**
 * MessageStore - 세션별 메시지 히스토리 관리
 *
 * @description
 * 세션(conversationId)별 메시지 히스토리를 관리하는 순수 데이터 클래스입니다.
 * 모든 상태 변경은 이 클래스를 통해 이루어지며,
 * 파일 I/O는 외부에서 getSessionData()/loadSessionData()를 통해 처리합니다.
 *
 * 설계 원칙:
 * - 순수 데이터 클래스: 외부 의존성 없음 (파일 I/O, 타이머 분리)
 * - 모킹 없이 테스트 가능
 * - Dirty 플래그로 변경 추적 (Debounced 저장 지원)
 *
 * @example
 * ```typescript
 * // 기본 사용
 * const store = new MessageStore();
 * store.addUserMessage('session-1', 'Hello!');
 * store.addAssistantText('session-1', 'Hi there!');
 *
 * // 외부에서 파일 저장
 * if (store.hasDirtyData()) {
 *   for (const sessionId of store.getDirtySessions()) {
 *     const data = store.getSessionData(sessionId);
 *     saveToFile(sessionId, data);
 *     store.markClean(sessionId);
 *   }
 * }
 * ```
 */
export class MessageStore {
  // ============================================================================
  // Private 필드
  // ============================================================================

  /**
   * 메모리 캐시: sessionId -> messages[]
   */
  private _cache: Map<string, StoreMessage[]>;

  /**
   * 저장 필요 세션 Set
   */
  private _dirty: Set<string>;

  // ============================================================================
  // 생성자
  // ============================================================================

  /**
   * MessageStore 생성자
   *
   * @param data - 초기 데이터 (없으면 빈 상태로 시작)
   */
  constructor(data?: MessageStoreData) {
    this._cache = new Map();
    this._dirty = new Set();

    // 초기 데이터 로드
    if (data?.sessions) {
      for (const [sessionId, sessionData] of Object.entries(data.sessions)) {
        this._cache.set(sessionId, sessionData.messages || []);
      }
    }
  }

  // ============================================================================
  // 정적 팩토리 메서드
  // ============================================================================

  /**
   * JSON 데이터에서 MessageStore 생성
   *
   * @param data - 직렬화된 스토어 데이터
   * @returns 새 MessageStore 인스턴스
   */
  static fromJSON(data: MessageStoreData): MessageStore {
    return new MessageStore(data);
  }

  // ============================================================================
  // 메시지 추가 메서드
  // ============================================================================

  /**
   * 내부: 메시지 타입 별 Omit<id | timestamp> 유니온
   *
   * @param sessionId - 세션 ID
   * @param message - 메시지 데이터 (id, timestamp 제외)
   * @param externalId - 외부에서 지정한 ID (선택적, 주로 toolUseId)
   */
  private _addMessageInternal<T extends StoreMessage>(
    sessionId: string,
    message: Omit<T, 'id' | 'timestamp'>,
    externalId?: string
  ): StoreMessage[] {
    const messages = this._ensureCache(sessionId);
    const fullMessage = {
      ...message,
      id: externalId || generateMessageId(),
      timestamp: Date.now(),
    } as T;
    messages.push(fullMessage);
    this._dirty.add(sessionId);
    return messages;
  }

  /**
   * 캐시 확보 (없으면 빈 배열 생성)
   *
   * @param sessionId - 세션 ID
   * @returns 메시지 배열 참조
   */
  private _ensureCache(sessionId: string): StoreMessage[] {
    if (!this._cache.has(sessionId)) {
      this._cache.set(sessionId, []);
    }
    return this._cache.get(sessionId)!;
  }

  /**
   * 사용자 메시지 추가
   *
   * @param sessionId - 세션 ID
   * @param content - 메시지 내용
   * @param attachments - 첨부 파일 목록 (선택)
   * @returns 업데이트된 메시지 배열
   */
  addUserMessage(
    sessionId: string,
    content: string,
    attachments?: Attachment[]
  ): StoreMessage[] {
    const message: Omit<UserTextMessage, 'id' | 'timestamp'> = {
      role: 'user',
      type: 'text',
      content,
      ...(attachments && { attachments }),
    };
    return this._addMessageInternal<UserTextMessage>(sessionId, message);
  }

  /**
   * 어시스턴트 텍스트 추가
   *
   * @param sessionId - 세션 ID
   * @param content - 텍스트 내용
   * @returns 업데이트된 메시지 배열
   */
  addAssistantText(sessionId: string, content: string): StoreMessage[] {
    const message: Omit<AssistantTextMessage, 'id' | 'timestamp'> = {
      role: 'assistant',
      type: 'text',
      content,
    };
    return this._addMessageInternal<AssistantTextMessage>(sessionId, message);
  }

  /**
   * 도구 시작 추가
   *
   * @description
   * toolInput은 자동으로 요약되어 저장됩니다.
   * toolUseId가 제공되면 메시지 id로 사용됩니다 (하위 툴 매핑용).
   *
   * @param sessionId - 세션 ID
   * @param toolName - 도구 이름
   * @param toolInput - 도구 입력
   * @param parentToolUseId - 부모 도구 ID (서브에이전트 내부 호출 시)
   * @param toolUseId - SDK에서 제공하는 도구 사용 ID (메시지 id로 사용)
   * @returns 업데이트된 메시지 배열
   */
  addToolStart(
    sessionId: string,
    toolName: string,
    toolInput: Record<string, unknown>,
    parentToolUseId?: string | null,
    toolUseId?: string
  ): StoreMessage[] {
    const message: Omit<ToolStartMessage, 'id' | 'timestamp'> = {
      role: 'assistant',
      type: 'tool_start',
      toolName,
      toolInput: summarizeToolInput(toolName, toolInput),
      ...(parentToolUseId ? { parentToolUseId } : {}),
    };
    return this._addMessageInternal<ToolStartMessage>(sessionId, message, toolUseId);
  }

  /**
   * 도구 완료로 업데이트
   *
   * @description
   * 가장 최근의 해당 도구 tool_start 메시지를 찾아 tool_complete로 변환합니다.
   * output과 error는 자동으로 요약됩니다.
   *
   * @param sessionId - 세션 ID
   * @param toolName - 도구 이름
   * @param success - 성공 여부
   * @param result - 실행 결과 (선택)
   * @param error - 에러 메시지 (선택)
   * @returns 업데이트된 메시지 배열
   */
  updateToolComplete(
    sessionId: string,
    toolName: string,
    success: boolean,
    result?: string,
    error?: string
  ): StoreMessage[] {
    const messages = this._ensureCache(sessionId);

    // 가장 최근의 해당 도구 찾기
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.type === 'tool_start' && (msg as ToolStartMessage).toolName === toolName) {
        const toolStartMsg = msg as ToolStartMessage;
        const completeMsg: ToolCompleteMessage = {
          id: toolStartMsg.id,
          role: 'assistant',
          type: 'tool_complete',
          toolName,
          toolInput: toolStartMsg.toolInput,
          success,
          output: summarizeOutput(result) as string | undefined,
          error: summarizeOutput(error) as string | undefined,
          timestamp: msg.timestamp,
          ...(toolStartMsg.parentToolUseId ? { parentToolUseId: toolStartMsg.parentToolUseId } : {}),
        };
        messages[i] = completeMsg;
        break;
      }
    }

    this._dirty.add(sessionId);
    return messages;
  }

  /**
   * 에러 메시지 추가
   *
   * @param sessionId - 세션 ID
   * @param errorMessage - 에러 메시지
   * @returns 업데이트된 메시지 배열
   */
  addError(sessionId: string, errorMessage: string): StoreMessage[] {
    const message: Omit<ErrorMessage, 'id' | 'timestamp'> = {
      role: 'system',
      type: 'error',
      content: errorMessage,
    };
    return this._addMessageInternal<ErrorMessage>(sessionId, message);
  }

  /**
   * 결과 정보 추가
   *
   * @param sessionId - 세션 ID
   * @param resultInfo - 결과 정보 (토큰 사용량, 소요 시간)
   * @returns 업데이트된 메시지 배열
   */
  addResult(
    sessionId: string,
    resultInfo: ResultInfo
  ): StoreMessage[] {
    const message: Omit<ResultMessage, 'id' | 'timestamp'> = {
      role: 'system',
      type: 'result',
      resultInfo,
    };
    return this._addMessageInternal<ResultMessage>(sessionId, message);
  }

  /**
   * 중단 메시지 추가
   *
   * @param sessionId - 세션 ID
   * @param reason - 중단 사유 (user, session_ended)
   * @returns 업데이트된 메시지 배열
   */
  addAborted(sessionId: string, reason: 'user' | 'session_ended'): StoreMessage[] {
    const message: Omit<AbortedMessage, 'id' | 'timestamp'> = {
      role: 'system',
      type: 'aborted',
      reason,
    };
    return this._addMessageInternal<AbortedMessage>(sessionId, message);
  }

  /**
   * 파일 첨부 추가 (send_file MCP 도구 결과)
   *
   * @param sessionId - 세션 ID
   * @param fileInfo - 파일 정보
   * @returns 업데이트된 메시지 배열
   */
  addFileAttachment(sessionId: string, fileInfo: FileInfo): StoreMessage[] {
    const message: Omit<FileAttachmentMessage, 'id' | 'timestamp'> = {
      role: 'assistant',
      type: 'file_attachment',
      file: fileInfo,
    };
    return this._addMessageInternal<FileAttachmentMessage>(sessionId, message);
  }

  // ============================================================================
  // 메시지 조회 메서드
  // ============================================================================

  /**
   * 세션의 메시지 조회 (페이징 지원)
   *
   * @description
   * limit과 offset을 사용하여 페이징할 수 있습니다.
   * 최신 메시지가 배열 끝에 위치합니다.
   *
   * @param sessionId - 세션 ID
   * @param options - 조회 옵션 (limit, offset)
   * @returns 메시지 배열
   *
   * @example
   * ```typescript
   * // 최근 10개 메시지
   * const recent = store.getMessages('session-1', { limit: 10 });
   *
   * // 11~20번째 최신 메시지 (페이징)
   * const page2 = store.getMessages('session-1', { limit: 10, offset: 10 });
   * ```
   */
  getMessages(sessionId: string, options: GetMessagesOptions = {}): StoreMessage[] {
    const { limit = MAX_MESSAGES_PER_SESSION, offset = 0 } = options;

    if (!this._cache.has(sessionId)) {
      return [];
    }

    const messages = this._cache.get(sessionId)!;

    if (offset === 0 && limit >= messages.length) {
      return [...messages];
    }

    // 끝에서부터 계산
    const start = Math.max(0, messages.length - limit - offset);
    const end = messages.length - offset;
    return messages.slice(start, end);
  }

  /**
   * 최근 N개 메시지 조회
   *
   * @param sessionId - 세션 ID
   * @param count - 조회할 메시지 수
   * @returns 최근 메시지 배열
   */
  getLatestMessages(sessionId: string, count: number): StoreMessage[] {
    return this.getMessages(sessionId, { limit: count });
  }

  /**
   * 메시지 개수 조회
   *
   * @param sessionId - 세션 ID
   * @returns 메시지 개수
   */
  getCount(sessionId: string): number {
    if (this._cache.has(sessionId)) {
      return this._cache.get(sessionId)!.length;
    }
    return 0;
  }

  // ============================================================================
  // 세션 관리 메서드
  // ============================================================================

  /**
   * 세션 메시지 초기화
   *
   * @param sessionId - 세션 ID
   */
  clear(sessionId: string): void {
    this._cache.delete(sessionId);
    this._dirty.delete(sessionId);
  }

  /**
   * 세션 삭제
   *
   * @description
   * clear()와 동일하지만 의미적으로 완전 삭제를 나타냅니다.
   *
   * @param sessionId - 세션 ID
   */
  delete(sessionId: string): void {
    this.clear(sessionId);
  }

  /**
   * 메시지 수 제한 적용
   *
   * @description
   * MAX_MESSAGES_PER_SESSION을 초과하는 오래된 메시지를 제거합니다.
   *
   * @param sessionId - 세션 ID
   * @returns trim 발생 여부
   */
  trimMessages(sessionId: string): boolean {
    if (!this._cache.has(sessionId)) {
      return false;
    }

    const messages = this._cache.get(sessionId)!;
    if (messages.length <= MAX_MESSAGES_PER_SESSION) {
      return false;
    }

    // 최신 메시지만 유지
    const trimmed = messages.slice(-MAX_MESSAGES_PER_SESSION);
    this._cache.set(sessionId, trimmed);
    this._dirty.add(sessionId);
    return true;
  }

  // ============================================================================
  // Dirty 추적 메서드
  // ============================================================================

  /**
   * 저장이 필요한 데이터가 있는지 확인
   *
   * @returns dirty 세션 존재 여부
   */
  hasDirtyData(): boolean {
    return this._dirty.size > 0;
  }

  /**
   * dirty 세션 목록 조회
   *
   * @returns dirty 세션 ID 배열
   */
  getDirtySessions(): string[] {
    return Array.from(this._dirty);
  }

  /**
   * 세션을 clean으로 표시
   *
   * @description
   * 파일 저장 후 호출하여 dirty 플래그를 제거합니다.
   *
   * @param sessionId - 세션 ID
   */
  markClean(sessionId: string): void {
    this._dirty.delete(sessionId);
  }

  /**
   * 모든 dirty 세션을 clean으로 표시
   */
  markAllClean(): void {
    this._dirty.clear();
  }

  // ============================================================================
  // 직렬화 메서드
  // ============================================================================

  /**
   * 전체 스토어 데이터 내보내기
   *
   * @description
   * 메모리에 있는 모든 세션 데이터를 반환합니다.
   *
   * @returns 전체 스토어 데이터
   */
  toJSON(): MessageStoreData {
    const sessions: Record<string, SessionData> = {};

    for (const [sessionId, messages] of this._cache) {
      sessions[sessionId] = {
        sessionId,
        messages,
        updatedAt: Date.now(),
      };
    }

    return { sessions };
  }

  /**
   * 단일 세션 데이터 조회 (파일 저장용)
   *
   * @description
   * 특정 세션의 데이터를 파일 저장 형식으로 반환합니다.
   * trim을 적용하여 최대 메시지 수를 제한합니다.
   *
   * @param sessionId - 세션 ID
   * @returns 세션 데이터 또는 null
   */
  getSessionData(sessionId: string): SessionData | null {
    if (!this._cache.has(sessionId)) {
      return null;
    }

    // 저장 전 trim 적용
    this.trimMessages(sessionId);

    const messages = this._cache.get(sessionId)!;
    return {
      sessionId,
      messages: [...messages],
      updatedAt: Date.now(),
    };
  }

  /**
   * 외부에서 세션 데이터 로드
   *
   * @description
   * 파일에서 읽어온 세션 데이터를 메모리에 로드합니다.
   *
   * @param sessionId - 세션 ID
   * @param data - 세션 데이터
   */
  loadSessionData(sessionId: string, data: SessionData): void {
    this._cache.set(sessionId, data.messages || []);
    // 로드된 데이터는 dirty가 아님
  }

  /**
   * 캐시된 세션 언로드
   *
   * @description
   * 메모리에서 세션을 제거합니다.
   * 시청자가 없는 세션의 메모리 해제에 사용합니다.
   * dirty 세션은 언로드 전에 저장해야 합니다.
   *
   * @param sessionId - 세션 ID
   * @returns 언로드 전 dirty 여부
   */
  unloadCache(sessionId: string): boolean {
    const wasDirty = this._dirty.has(sessionId);
    this._cache.delete(sessionId);
    this._dirty.delete(sessionId);
    return wasDirty;
  }

  /**
   * 캐시 여부 확인
   *
   * @param sessionId - 세션 ID
   * @returns 캐시 존재 여부
   */
  hasCache(sessionId: string): boolean {
    return this._cache.has(sessionId);
  }
}
