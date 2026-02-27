/**
 * @file message-store.ts
 * @description MessageStore - 세션별 메시지 히스토리 저장 (SQLite 기반)
 *
 * 세션(conversationId)별 메시지 히스토리를 관리하는 SQLite 기반 저장소입니다.
 * 모든 변경은 즉시 DB에 저장되어 영속성을 보장합니다.
 *
 * @example
 * ```typescript
 * import { MessageStore } from './stores/message-store.js';
 *
 * // 스토어 생성 (DB 파일 경로)
 * const store = new MessageStore('data/messages.db');
 *
 * // 메시지 추가 (즉시 저장)
 * store.addUserMessage(1, 'Hello, Claude!');
 * store.addAssistantText(1, 'Hi! How can I help?');
 *
 * // 메시지 조회
 * const messages = store.getMessages(1);
 *
 * // DB 연결 종료
 * store.close();
 * ```
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

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
  SystemMessage,
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
  SystemMessage,
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
 * 세션 데이터 (파일 저장용 - 마이그레이션 전용)
 * @description
 * JSON 마이그레이션에 사용되는 구조입니다.
 */
export interface SessionData {
  /** 세션 ID */
  sessionId: number;
  /** 메시지 목록 */
  messages: StoreMessage[];
  /** 마지막 업데이트 시각 */
  updatedAt: number;
}

/**
 * 메시지 스토어 전체 데이터 (직렬화용 - 마이그레이션 전용)
 * @description
 * JSON 마이그레이션에 사용되는 구조입니다.
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
  /** 이 인덱스 이전의 메시지를 로드 (0이면 최신부터) */
  loadBefore?: number;
  /** 반환할 최대 바이트 수 (개수보다 우선) */
  maxBytes?: number;
}

// ============================================================================
// DB Row 타입
// ============================================================================

interface MessageRow {
  id: string;
  session_id: number;
  timestamp: number;
  role: string;
  type: string;
  content: string | null;
  tool_name: string | null;
  tool_input: string | null;
  tool_output: string | null;
  tool_error: string | null;
  success: number | null;
  parent_tool_use_id: string | null;
  attachments: string | null;
  file_info: string | null;
  result_info: string | null;
  reason: string | null;
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
 * MessageStore - 세션별 메시지 히스토리 관리 (SQLite 기반)
 *
 * @description
 * 세션(conversationId)별 메시지 히스토리를 SQLite DB에 저장합니다.
 * 모든 변경은 즉시 DB에 반영되어 영속성을 보장합니다.
 *
 * 설계 원칙:
 * - SQLite 기반: 즉시 저장, dirty 추적 불필요
 * - 쿼리 기반 조회: 필요한 메시지만 로드
 * - 마이그레이션 지원: 기존 JSON 파일 자동 마이그레이션
 *
 * @example
 * ```typescript
 * // 기본 사용
 * const store = new MessageStore('data/messages.db');
 * store.addUserMessage(1, 'Hello!');
 * store.addAssistantText(1, 'Hi there!');
 *
 * // 메시지 조회
 * const messages = store.getMessages(1);
 *
 * // 종료
 * store.close();
 * ```
 */
export class MessageStore {
  // ============================================================================
  // Private 필드
  // ============================================================================

  /**
   * SQLite 데이터베이스 연결
   */
  private db: Database.Database;

  /**
   * Prepared Statements
   */
  private stmtInsert: Database.Statement;
  private stmtUpdate: Database.Statement;
  private stmtSelectAll: Database.Statement;
  private stmtSelectWithLimit: Database.Statement;
  private stmtSelectWithOffset: Database.Statement;
  private stmtSelectCount: Database.Statement;
  private stmtDelete: Database.Statement;
  private stmtFindToolStart: Database.Statement;

  // ============================================================================
  // 생성자
  // ============================================================================

  /**
   * MessageStore 생성자
   *
   * @param dbPath - SQLite 데이터베이스 파일 경로 (또는 ':memory:')
   * @param migrationDir - JSON 파일 마이그레이션 소스 디렉토리 (선택)
   */
  constructor(dbPath: string, migrationDir?: string) {
    // DB 파일 경로의 부모 디렉토리 생성 (메모리 DB가 아닌 경우)
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // DB 연결
    this.db = new Database(dbPath);

    // 스키마 생성
    this._initSchema();

    // Prepared statements 초기화
    this.stmtInsert = this.db.prepare(`
      INSERT INTO messages (
        id, session_id, timestamp, role, type, content,
        tool_name, tool_input, tool_output, tool_error, success,
        parent_tool_use_id, attachments, file_info, result_info, reason
      ) VALUES (
        @id, @session_id, @timestamp, @role, @type, @content,
        @tool_name, @tool_input, @tool_output, @tool_error, @success,
        @parent_tool_use_id, @attachments, @file_info, @result_info, @reason
      )
    `);

    this.stmtUpdate = this.db.prepare(`
      UPDATE messages SET
        type = @type,
        tool_output = @tool_output,
        tool_error = @tool_error,
        success = @success
      WHERE id = @id
    `);

    this.stmtSelectAll = this.db.prepare(`
      SELECT * FROM messages WHERE session_id = @session_id ORDER BY timestamp ASC
    `);

    this.stmtSelectWithLimit = this.db.prepare(`
      SELECT * FROM (
        SELECT * FROM messages WHERE session_id = @session_id ORDER BY timestamp DESC LIMIT @limit
      ) ORDER BY timestamp ASC
    `);

    this.stmtSelectWithOffset = this.db.prepare(`
      SELECT * FROM (
        SELECT * FROM messages WHERE session_id = @session_id ORDER BY timestamp ASC LIMIT @offset
      ) ORDER BY timestamp ASC LIMIT @limit OFFSET @skip
    `);

    this.stmtSelectCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE session_id = @session_id
    `);

    this.stmtDelete = this.db.prepare(`
      DELETE FROM messages WHERE session_id = @session_id
    `);

    this.stmtFindToolStart = this.db.prepare(`
      SELECT id FROM messages
      WHERE session_id = @session_id AND type = 'tool_start' AND tool_name = @tool_name
      ORDER BY timestamp DESC LIMIT 1
    `);

    // 마이그레이션 실행 (필요한 경우)
    if (migrationDir) {
      this._runMigration(migrationDir);
    }
  }

  // ============================================================================
  // 스키마 초기화
  // ============================================================================

  /**
   * SQLite 스키마 초기화
   */
  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        role TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT,
        tool_name TEXT,
        tool_input TEXT,
        tool_output TEXT,
        tool_error TEXT,
        success INTEGER,
        parent_tool_use_id TEXT,
        attachments TEXT,
        file_info TEXT,
        result_info TEXT,
        reason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session_time ON messages(session_id, timestamp);

      CREATE TABLE IF NOT EXISTS migration_status (
        id INTEGER PRIMARY KEY,
        completed INTEGER NOT NULL DEFAULT 0,
        completed_at INTEGER
      );
    `);
  }

  // ============================================================================
  // 마이그레이션
  // ============================================================================

  /**
   * JSON 파일 마이그레이션 실행
   */
  private _runMigration(migrationDir: string): void {
    // 마이그레이션 완료 여부 확인
    const status = this.db.prepare(
      `SELECT completed FROM migration_status WHERE id = 1`
    ).get() as { completed: number } | undefined;

    if (status?.completed) {
      return; // 이미 마이그레이션 완료
    }

    // JSON 파일 목록 확인
    if (!fs.existsSync(migrationDir)) {
      // 마이그레이션 디렉토리가 없으면 완료로 표시
      this._markMigrationComplete();
      return;
    }

    const files = fs.readdirSync(migrationDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
      this._markMigrationComplete();
      return;
    }

    // 백업 디렉토리 생성
    const backupDir = migrationDir + '_backup';
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // JSON 파일 마이그레이션
    const insertMany = this.db.transaction((messages: StoreMessage[], sessionId: number) => {
      for (const msg of messages) {
        this._insertMessage(sessionId, msg);
      }
    });

    for (const file of files) {
      const filePath = path.join(migrationDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const sessionData = JSON.parse(content) as SessionData;

        if (sessionData.messages && sessionData.messages.length > 0) {
          insertMany(sessionData.messages, sessionData.sessionId);
        }

        // 백업 폴더로 이동
        fs.renameSync(filePath, path.join(backupDir, file));
      } catch {
        // 개별 파일 오류는 무시하고 계속
        console.error(`Migration error for ${file}`);
      }
    }

    this._markMigrationComplete();
  }

  /**
   * 마이그레이션 완료 표시
   */
  private _markMigrationComplete(): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO migration_status (id, completed, completed_at)
      VALUES (1, 1, @now)
    `).run({ now: Date.now() });
  }

  /**
   * 메시지 삽입 (마이그레이션용)
   */
  private _insertMessage(sessionId: number, msg: StoreMessage): void {
    const row = this._messageToRow(sessionId, msg);
    this.stmtInsert.run(row);
  }

  // ============================================================================
  // Row 변환
  // ============================================================================

  /**
   * StoreMessage -> DB Row 변환
   */
  private _messageToRow(sessionId: number, msg: StoreMessage): Record<string, unknown> {
    const base = {
      id: msg.id,
      session_id: sessionId,
      timestamp: msg.timestamp,
      role: msg.role,
      type: msg.type,
      content: null as string | null,
      tool_name: null as string | null,
      tool_input: null as string | null,
      tool_output: null as string | null,
      tool_error: null as string | null,
      success: null as number | null,
      parent_tool_use_id: null as string | null,
      attachments: null as string | null,
      file_info: null as string | null,
      result_info: null as string | null,
      reason: null as string | null,
    };

    switch (msg.type) {
      case 'text':
        base.content = (msg as UserTextMessage | AssistantTextMessage).content;
        if ('attachments' in msg && (msg as UserTextMessage).attachments) {
          base.attachments = JSON.stringify((msg as UserTextMessage).attachments);
        }
        break;

      case 'tool_start':
      case 'tool_complete': {
        const toolMsg = msg as ToolStartMessage | ToolCompleteMessage;
        base.tool_name = toolMsg.toolName;
        base.tool_input = JSON.stringify(toolMsg.toolInput);
        if ('parentToolUseId' in toolMsg && toolMsg.parentToolUseId) {
          base.parent_tool_use_id = toolMsg.parentToolUseId;
        }
        if (msg.type === 'tool_complete') {
          const completeMsg = msg as ToolCompleteMessage;
          base.success = completeMsg.success ? 1 : 0;
          if (completeMsg.output) {
            base.tool_output = completeMsg.output;
          }
          if (completeMsg.error) {
            base.tool_error = completeMsg.error;
          }
        }
        break;
      }

      case 'error':
        base.content = (msg as ErrorMessage).content;
        break;

      case 'result':
        base.result_info = JSON.stringify((msg as ResultMessage).resultInfo);
        break;

      case 'aborted':
        base.reason = (msg as AbortedMessage).reason;
        break;

      case 'file_attachment':
        base.file_info = JSON.stringify((msg as FileAttachmentMessage).file);
        break;

      case 'system':
        base.content = (msg as SystemMessage).content;
        break;
    }

    return base;
  }

  /**
   * DB Row -> StoreMessage 변환
   */
  private _rowToMessage(row: MessageRow): StoreMessage {
    // role을 제외한 base 속성 (각 case에서 명시적으로 role 지정)
    const id = row.id;
    const timestamp = row.timestamp;

    switch (row.type) {
      case 'text': {
        if (row.role === 'user') {
          const userMsg: UserTextMessage = {
            id,
            timestamp,
            role: 'user',
            type: 'text',
            content: row.content || '',
          };
          if (row.attachments) {
            userMsg.attachments = JSON.parse(row.attachments);
          }
          return userMsg;
        } else {
          return {
            id,
            timestamp,
            role: 'assistant',
            type: 'text',
            content: row.content || '',
          } as AssistantTextMessage;
        }
      }

      case 'tool_start': {
        const toolStartMsg: ToolStartMessage = {
          id,
          timestamp,
          role: 'assistant',
          type: 'tool_start',
          toolName: row.tool_name || '',
          toolInput: row.tool_input ? JSON.parse(row.tool_input) : {},
        };
        if (row.parent_tool_use_id) {
          toolStartMsg.parentToolUseId = row.parent_tool_use_id;
        }
        return toolStartMsg;
      }

      case 'tool_complete': {
        const toolCompleteMsg: ToolCompleteMessage = {
          id,
          timestamp,
          role: 'assistant',
          type: 'tool_complete',
          toolName: row.tool_name || '',
          toolInput: row.tool_input ? JSON.parse(row.tool_input) : {},
          success: row.success === 1,
        };
        if (row.tool_output) {
          toolCompleteMsg.output = row.tool_output;
        }
        if (row.tool_error) {
          toolCompleteMsg.error = row.tool_error;
        }
        if (row.parent_tool_use_id) {
          toolCompleteMsg.parentToolUseId = row.parent_tool_use_id;
        }
        return toolCompleteMsg;
      }

      case 'error':
        return {
          id,
          timestamp,
          role: 'system',
          type: 'error',
          content: row.content || '',
        } as ErrorMessage;

      case 'result':
        return {
          id,
          timestamp,
          role: 'system',
          type: 'result',
          resultInfo: row.result_info ? JSON.parse(row.result_info) : {},
        } as ResultMessage;

      case 'aborted':
        return {
          id,
          timestamp,
          role: 'system',
          type: 'aborted',
          reason: row.reason as 'user' | 'session_ended',
        } as AbortedMessage;

      case 'file_attachment':
        return {
          id,
          timestamp,
          role: 'assistant',
          type: 'file_attachment',
          file: row.file_info ? JSON.parse(row.file_info) : {},
        } as FileAttachmentMessage;

      case 'system':
        return {
          id,
          timestamp,
          role: 'system',
          type: 'system',
          content: row.content || '',
        } as SystemMessage;

      default:
        // Fallback
        return {
          id,
          timestamp,
          role: 'user',
          type: 'text',
          content: row.content || '',
        } as UserTextMessage;
    }
  }

  // ============================================================================
  // 메시지 추가 메서드
  // ============================================================================

  /**
   * 사용자 메시지 추가
   *
   * @param sessionId - 세션 ID
   * @param content - 메시지 내용
   * @param attachments - 첨부 파일 목록 (선택)
   * @returns 업데이트된 메시지 배열
   */
  addUserMessage(
    sessionId: number,
    content: string,
    attachments?: Attachment[]
  ): StoreMessage[] {
    const msg: UserTextMessage = {
      id: generateMessageId(),
      timestamp: Date.now(),
      role: 'user',
      type: 'text',
      content,
      ...(attachments && { attachments }),
    };

    this.stmtInsert.run(this._messageToRow(sessionId, msg));
    return this.getMessages(sessionId);
  }

  /**
   * 어시스턴트 텍스트 추가
   *
   * @param sessionId - 세션 ID
   * @param content - 텍스트 내용
   * @returns 업데이트된 메시지 배열
   */
  addAssistantText(sessionId: number, content: string): StoreMessage[] {
    const msg: AssistantTextMessage = {
      id: generateMessageId(),
      timestamp: Date.now(),
      role: 'assistant',
      type: 'text',
      content,
    };

    this.stmtInsert.run(this._messageToRow(sessionId, msg));
    return this.getMessages(sessionId);
  }

  /**
   * 시스템 메시지 추가
   *
   * @description
   * 시스템에서 생성하는 일반 메시지를 추가합니다.
   * 세션 재시작 등의 이벤트를 기록할 때 사용됩니다.
   *
   * @param sessionId - 세션 ID
   * @param content - 메시지 내용
   * @returns 업데이트된 메시지 배열
   */
  addSystemMessage(sessionId: number, content: string): StoreMessage[] {
    const msg: SystemMessage = {
      id: generateMessageId(),
      timestamp: Date.now(),
      role: 'system',
      type: 'system',
      content,
    };

    this.stmtInsert.run(this._messageToRow(sessionId, msg));
    return this.getMessages(sessionId);
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
    sessionId: number,
    toolName: string,
    toolInput: Record<string, unknown>,
    parentToolUseId?: string | null,
    toolUseId?: string
  ): StoreMessage[] {
    const msg: ToolStartMessage = {
      id: toolUseId || generateMessageId(),
      timestamp: Date.now(),
      role: 'assistant',
      type: 'tool_start',
      toolName,
      toolInput: summarizeToolInput(toolName, toolInput),
      ...(parentToolUseId ? { parentToolUseId } : {}),
    };

    this.stmtInsert.run(this._messageToRow(sessionId, msg));
    return this.getMessages(sessionId);
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
    sessionId: number,
    toolName: string,
    success: boolean,
    result?: string,
    error?: string
  ): StoreMessage[] {
    // 가장 최근의 해당 도구 찾기
    const row = this.stmtFindToolStart.get({
      session_id: sessionId,
      tool_name: toolName,
    }) as { id: string } | undefined;

    if (row) {
      this.stmtUpdate.run({
        id: row.id,
        type: 'tool_complete',
        tool_output: summarizeOutput(result) as string | null ?? null,
        tool_error: summarizeOutput(error) as string | null ?? null,
        success: success ? 1 : 0,
      });
    }

    return this.getMessages(sessionId);
  }

  /**
   * 에러 메시지 추가
   *
   * @param sessionId - 세션 ID
   * @param errorMessage - 에러 메시지
   * @returns 업데이트된 메시지 배열
   */
  addError(sessionId: number, errorMessage: string): StoreMessage[] {
    const msg: ErrorMessage = {
      id: generateMessageId(),
      timestamp: Date.now(),
      role: 'system',
      type: 'error',
      content: errorMessage,
    };

    this.stmtInsert.run(this._messageToRow(sessionId, msg));
    return this.getMessages(sessionId);
  }

  /**
   * 결과 정보 추가
   *
   * @param sessionId - 세션 ID
   * @param resultInfo - 결과 정보 (토큰 사용량, 소요 시간)
   * @returns 업데이트된 메시지 배열
   */
  addResult(
    sessionId: number,
    resultInfo: ResultInfo
  ): StoreMessage[] {
    const msg: ResultMessage = {
      id: generateMessageId(),
      timestamp: Date.now(),
      role: 'system',
      type: 'result',
      resultInfo,
    };

    this.stmtInsert.run(this._messageToRow(sessionId, msg));
    return this.getMessages(sessionId);
  }

  /**
   * 중단 메시지 추가
   *
   * @param sessionId - 세션 ID
   * @param reason - 중단 사유 (user, session_ended)
   * @returns 업데이트된 메시지 배열
   */
  addAborted(sessionId: number, reason: 'user' | 'session_ended'): StoreMessage[] {
    const msg: AbortedMessage = {
      id: generateMessageId(),
      timestamp: Date.now(),
      role: 'system',
      type: 'aborted',
      reason,
    };

    this.stmtInsert.run(this._messageToRow(sessionId, msg));
    return this.getMessages(sessionId);
  }

  /**
   * 파일 첨부 추가 (send_file MCP 도구 결과)
   *
   * @param sessionId - 세션 ID
   * @param fileInfo - 파일 정보
   * @returns 업데이트된 메시지 배열
   */
  addFileAttachment(sessionId: number, fileInfo: FileInfo): StoreMessage[] {
    const msg: FileAttachmentMessage = {
      id: generateMessageId(),
      timestamp: Date.now(),
      role: 'assistant',
      type: 'file_attachment',
      file: fileInfo,
    };

    this.stmtInsert.run(this._messageToRow(sessionId, msg));
    return this.getMessages(sessionId);
  }

  // ============================================================================
  // 메시지 조회 메서드
  // ============================================================================

  /**
   * 세션의 메시지 조회 (페이징 지원)
   *
   * @description
   * limit(개수) 기준으로 페이징할 수 있습니다.
   * 최신 메시지가 배열 끝에 위치합니다.
   *
   * @param sessionId - 세션 ID
   * @param options - 조회 옵션 (limit, loadBefore)
   * @returns 메시지 배열
   *
   * @example
   * ```typescript
   * // 최근 10개 메시지
   * const recent = store.getMessages(1, { limit: 10 });
   *
   * // 인덱스 80 이전 메시지 (60~79 반환)
   * const page2 = store.getMessages(1, { loadBefore: 80, limit: 20 });
   *
   * // 최근 100KB 이내 메시지
   * const bySize = store.getMessages(1, { maxBytes: 100 * 1024 });
   * ```
   */
  getMessages(sessionId: number, options: GetMessagesOptions = {}): StoreMessage[] {
    const { limit = MAX_MESSAGES_PER_SESSION, loadBefore = 0, maxBytes } = options;

    let rows: MessageRow[];

    if (loadBefore > 0) {
      // loadBefore 인덱스 이전의 메시지를 반환
      // 예: loadBefore=8, limit=3 -> 인덱스 5, 6, 7 (message 6, 7, 8)
      const skip = Math.max(0, loadBefore - limit);
      const actualLimit = Math.min(limit, loadBefore);

      rows = this.db.prepare(`
        SELECT * FROM (
          SELECT * FROM messages WHERE session_id = @session_id ORDER BY timestamp ASC LIMIT @offset
        ) ORDER BY timestamp ASC LIMIT @limit OFFSET @skip
      `).all({
        session_id: sessionId,
        offset: loadBefore,
        limit: actualLimit,
        skip: skip,
      }) as MessageRow[];
    } else {
      // 전체 카운트 확인
      const count = this.getCount(sessionId);

      if (limit >= count) {
        // 전체 반환
        rows = this.stmtSelectAll.all({ session_id: sessionId }) as MessageRow[];
      } else {
        // 최근 N개 반환
        rows = this.stmtSelectWithLimit.all({
          session_id: sessionId,
          limit: limit,
        }) as MessageRow[];
      }
    }

    // maxBytes 옵션 처리: 바이트 제한이 있으면 역순으로 누적
    if (maxBytes !== undefined && rows.length > 0) {
      const result: MessageRow[] = [];
      let totalBytes = 0;

      // 최신 메시지부터 역순으로 누적 (rows는 시간순이므로 뒤에서부터)
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        const rowBytes = this._estimateRowBytes(row);

        if (totalBytes + rowBytes > maxBytes && result.length > 0) {
          break;
        }

        totalBytes += rowBytes;
        result.unshift(row);
      }

      return result.map(row => this._rowToMessage(row));
    }

    return rows.map(row => this._rowToMessage(row));
  }

  /**
   * Row 크기 추정 (바이트)
   */
  private _estimateRowBytes(row: MessageRow): number {
    let bytes = 100; // 기본 오버헤드

    if (row.content) {
      bytes += row.content.length * 2; // UTF-16 가정
    }
    if (row.tool_input) {
      bytes += row.tool_input.length;
    }
    if (row.tool_output) {
      bytes += row.tool_output.length * 2;
    }
    if (row.tool_error) {
      bytes += row.tool_error.length * 2;
    }
    if (row.attachments) {
      bytes += row.attachments.length;
    }

    return bytes;
  }

  /**
   * 최근 N개 메시지 조회
   *
   * @param sessionId - 세션 ID
   * @param count - 조회할 메시지 수
   * @returns 최근 메시지 배열
   */
  getLatestMessages(sessionId: number, count: number): StoreMessage[] {
    return this.getMessages(sessionId, { limit: count });
  }

  /**
   * 메시지 개수 조회
   *
   * @param sessionId - 세션 ID
   * @returns 메시지 개수
   */
  getCount(sessionId: number): number {
    const row = this.stmtSelectCount.get({ session_id: sessionId }) as { count: number };
    return row.count;
  }

  // ============================================================================
  // 세션 관리 메서드
  // ============================================================================

  /**
   * 세션 메시지 초기화
   *
   * @param sessionId - 세션 ID
   */
  clear(sessionId: number): void {
    this.stmtDelete.run({ session_id: sessionId });
  }

  /**
   * 세션 삭제
   *
   * @description
   * clear()와 동일합니다.
   *
   * @param sessionId - 세션 ID
   */
  delete(sessionId: number): void {
    this.clear(sessionId);
  }

  // ============================================================================
  // Share 전용 메서드
  // ============================================================================

  /**
   * 공유용 메시지 히스토리 조회
   *
   * @description
   * 공유 페이지에서 사용할 전체 메시지를 시간순(과거->최신)으로 반환합니다.
   * 페이징 없이 전체 메시지를 반환합니다.
   *
   * @param sessionId - 세션 ID
   * @returns 시간순 정렬된 전체 메시지 배열
   */
  getSharedMessageHistory(sessionId: number): StoreMessage[] {
    const rows = this.stmtSelectAll.all({ session_id: sessionId }) as MessageRow[];
    return rows.map(row => this._rowToMessage(row));
  }

  // ============================================================================
  // 종료
  // ============================================================================

  /**
   * DB 연결 종료
   */
  close(): void {
    this.db.close();
  }
}
