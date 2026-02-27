/**
 * @file store-message.ts
 * @description Pylon과 Client가 공유하는 StoreMessage 타입 정의
 *
 * 메시지 저장소에 저장되는 모든 메시지 타입들을 정의합니다.
 * discriminated union 패턴을 사용하여 `type` 필드로 구분됩니다.
 */

// ============================================================================
// Message Type Literals
// ============================================================================

/**
 * StoreMessage 타입 리터럴
 *
 * @description
 * 저장소에 저장되는 메시지의 모든 타입을 정의합니다.
 *
 * - `text`: 사용자 또는 어시스턴트의 텍스트 메시지
 * - `tool_start`: 도구 실행 시작
 * - `tool_complete`: 도구 실행 완료
 * - `error`: 시스템 에러 메시지
 * - `result`: 작업 완료 결과
 * - `aborted`: 작업 중단
 * - `file_attachment`: 파일 첨부
 * - `user_response`: 사용자 응답 (권한/질문)
 * - `system`: 시스템 메시지 (세션 재시작 등)
 */
export type StoreMessageType =
  | 'text'
  | 'tool_start'
  | 'tool_complete'
  | 'error'
  | 'result'
  | 'aborted'
  | 'file_attachment'
  | 'user_response'
  | 'system';

// ============================================================================
// Base Interface
// ============================================================================

/**
 * 모든 StoreMessage의 기본 인터페이스
 *
 * @property id - 메시지의 고유 식별자
 * @property role - 메시지 발신자 역할 ('user', 'assistant', 'system')
 * @property type - 메시지 타입
 * @property timestamp - 메시지 생성 시간 (Unix timestamp)
 */
export interface BaseStoreMessage {
  /** 메시지의 고유 식별자 */
  id: string;

  /** 메시지 발신자 역할 */
  role: 'user' | 'assistant' | 'system';

  /** 메시지 타입 */
  type: StoreMessageType;

  /** 메시지 생성 시간 (Unix timestamp) */
  timestamp: number;
}

// ============================================================================
// Attachment Types
// ============================================================================

/**
 * 첨부 파일 정보
 *
 * @description
 * 사용자가 메시지에 첨부한 파일 정보입니다.
 *
 * @property filename - 파일명
 * @property path - 파일 경로
 * @property thumbnail - 썸네일 이미지 (선택적, base64 데이터 URI)
 */
export interface Attachment {
  /** 파일명 */
  filename: string;

  /** 파일 경로 */
  path: string;

  /** 썸네일 이미지 (선택적) */
  thumbnail?: string;
}

/**
 * 파일 상세 정보
 *
 * @description
 * 어시스턴트가 생성하거나 첨부한 파일의 상세 정보입니다.
 *
 * @property path - 파일 경로
 * @property filename - 파일명
 * @property mimeType - MIME 타입
 * @property fileType - 파일 종류 (image, markdown, text 등)
 * @property size - 파일 크기 (bytes)
 * @property description - 파일 설명 (선택적)
 */
export interface FileInfo {
  /** 파일 경로 */
  path: string;

  /** 파일명 */
  filename: string;

  /** MIME 타입 */
  mimeType: string;

  /** 파일 종류 */
  fileType: string;

  /** 파일 크기 (bytes) */
  size: number;

  /** 파일 설명 (선택적) */
  description?: string;
}

/**
 * 작업 결과 정보
 *
 * @description
 * 작업 완료 시 토큰 사용량 및 소요 시간 정보입니다.
 *
 * @property durationMs - 작업 소요 시간 (밀리초)
 * @property inputTokens - 입력 토큰 수
 * @property outputTokens - 출력 토큰 수
 * @property cacheReadTokens - 캐시 읽기 토큰 수
 */
export interface ResultInfo {
  /** 작업 소요 시간 (밀리초) */
  durationMs: number;

  /** 입력 토큰 수 */
  inputTokens: number;

  /** 출력 토큰 수 */
  outputTokens: number;

  /** 캐시 읽기 토큰 수 */
  cacheReadTokens: number;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * 사용자 텍스트 메시지
 *
 * @description
 * 사용자가 입력한 텍스트 메시지입니다.
 * 첨부 파일을 포함할 수 있습니다.
 */
export interface UserTextMessage extends BaseStoreMessage {
  /** 역할: 항상 'user' */
  role: 'user';

  /** 타입: 항상 'text' */
  type: 'text';

  /** 메시지 내용 */
  content: string;

  /** 첨부 파일 목록 (선택적) */
  attachments?: Attachment[];
}

/**
 * 어시스턴트 텍스트 메시지
 *
 * @description
 * Claude가 출력한 텍스트 메시지입니다.
 */
export interface AssistantTextMessage extends BaseStoreMessage {
  /** 역할: 항상 'assistant' */
  role: 'assistant';

  /** 타입: 항상 'text' */
  type: 'text';

  /** 메시지 내용 */
  content: string;
}

/**
 * 도구 실행 시작 메시지
 *
 * @description
 * Claude가 도구 실행을 시작할 때 생성되는 메시지입니다.
 */
export interface ToolStartMessage extends BaseStoreMessage {
  /** 역할: 항상 'assistant' */
  role: 'assistant';

  /** 타입: 항상 'tool_start' */
  type: 'tool_start';

  /** 도구 이름 */
  toolName: string;

  /** 도구 입력 파라미터 */
  toolInput: Record<string, unknown>;

  /** 실행 경과 시간 (초) - toolProgress 이벤트에서 업데이트 */
  elapsedSeconds?: number;

  /** 부모 도구 사용 ID (서브에이전트 내부 호출 시) */
  parentToolUseId?: string | null;
}

/**
 * 도구 실행 완료 메시지
 *
 * @description
 * Claude가 도구 실행을 완료했을 때 생성되는 메시지입니다.
 * 성공 시 output, 실패 시 error를 포함합니다.
 */
export interface ToolCompleteMessage extends BaseStoreMessage {
  /** 역할: 항상 'assistant' */
  role: 'assistant';

  /** 타입: 항상 'tool_complete' */
  type: 'tool_complete';

  /** 도구 이름 */
  toolName: string;

  /** 도구 입력 파라미터 */
  toolInput: Record<string, unknown>;

  /** 실행 성공 여부 */
  success: boolean;

  /** 도구 실행 결과 (성공 시) */
  output?: string;

  /** 에러 메시지 (실패 시) */
  error?: string;

  /** 부모 도구 사용 ID (서브에이전트 내부 호출 시) */
  parentToolUseId?: string | null;
}

/**
 * 에러 메시지
 *
 * @description
 * 시스템 에러가 발생했을 때 생성되는 메시지입니다.
 */
export interface ErrorMessage extends BaseStoreMessage {
  /** 역할: 항상 'system' */
  role: 'system';

  /** 타입: 항상 'error' */
  type: 'error';

  /** 에러 내용 */
  content: string;
}

/**
 * 결과 메시지
 *
 * @description
 * 작업이 완료되었을 때 생성되는 메시지입니다.
 * 토큰 사용량 및 소요 시간 정보를 포함합니다.
 */
export interface ResultMessage extends BaseStoreMessage {
  /** 역할: 항상 'system' */
  role: 'system';

  /** 타입: 항상 'result' */
  type: 'result';

  /** 결과 정보 */
  resultInfo: ResultInfo;
}

/**
 * 중단 메시지
 *
 * @description
 * 작업이 중단되었을 때 생성되는 메시지입니다.
 */
export interface AbortedMessage extends BaseStoreMessage {
  /** 역할: 항상 'system' */
  role: 'system';

  /** 타입: 항상 'aborted' */
  type: 'aborted';

  /** 중단 이유 */
  reason: 'user' | 'session_ended';
}

/**
 * 파일 첨부 메시지
 *
 * @description
 * Claude가 파일을 첨부했을 때 생성되는 메시지입니다.
 */
export interface FileAttachmentMessage extends BaseStoreMessage {
  /** 역할: 항상 'assistant' */
  role: 'assistant';

  /** 타입: 항상 'file_attachment' */
  type: 'file_attachment';

  /** 파일 정보 */
  file: FileInfo;
}

/**
 * 사용자 응답 메시지
 *
 * @description
 * 권한 요청이나 질문에 대한 사용자의 응답입니다.
 */
export interface UserResponseMessage extends BaseStoreMessage {
  /** 역할: 항상 'user' */
  role: 'user';

  /** 타입: 항상 'user_response' */
  type: 'user_response';

  /** 응답 종류 */
  responseType: 'permission' | 'question';

  /** 도구 사용 ID */
  toolUseId: string;

  /** 사용자 응답 */
  response: string;
}

/**
 * 시스템 메시지
 *
 * @description
 * 시스템에서 생성하는 일반 메시지입니다.
 * 세션 재시작 등의 이벤트를 기록합니다.
 */
export interface SystemMessage extends BaseStoreMessage {
  /** 역할: 항상 'system' */
  role: 'system';

  /** 타입: 항상 'system' */
  type: 'system';

  /** 메시지 내용 */
  content: string;
}

// ============================================================================
// Union Type
// ============================================================================

/**
 * StoreMessage 유니온 타입
 *
 * @description
 * 저장소에 저장될 수 있는 모든 메시지 타입의 유니온입니다.
 * discriminated union 패턴을 사용하여 `type` 필드로 구분됩니다.
 */
export type StoreMessage =
  | UserTextMessage
  | AssistantTextMessage
  | ToolStartMessage
  | ToolCompleteMessage
  | ErrorMessage
  | ResultMessage
  | AbortedMessage
  | FileAttachmentMessage
  | UserResponseMessage
  | SystemMessage;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * 값이 객체이고 null이 아닌지 확인하는 헬퍼 함수
 *
 * @param value - 확인할 값
 * @returns 객체이고 null이 아니면 true
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * UserTextMessage 타입 가드
 *
 * @param value - 확인할 값
 * @returns UserTextMessage 타입이면 true
 */
export function isUserTextMessage(value: unknown): value is UserTextMessage {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.role === 'user' &&
    value.type === 'text' &&
    typeof value.timestamp === 'number' &&
    typeof value.content === 'string'
  );
}

/**
 * AssistantTextMessage 타입 가드
 *
 * @param value - 확인할 값
 * @returns AssistantTextMessage 타입이면 true
 */
export function isAssistantTextMessage(value: unknown): value is AssistantTextMessage {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.role === 'assistant' &&
    value.type === 'text' &&
    typeof value.timestamp === 'number' &&
    typeof value.content === 'string'
  );
}

/**
 * ToolStartMessage 타입 가드
 *
 * @param value - 확인할 값
 * @returns ToolStartMessage 타입이면 true
 */
export function isToolStartMessage(value: unknown): value is ToolStartMessage {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.role === 'assistant' &&
    value.type === 'tool_start' &&
    typeof value.timestamp === 'number' &&
    typeof value.toolName === 'string' &&
    isObject(value.toolInput)
  );
}

/**
 * ToolCompleteMessage 타입 가드
 *
 * @param value - 확인할 값
 * @returns ToolCompleteMessage 타입이면 true
 */
export function isToolCompleteMessage(value: unknown): value is ToolCompleteMessage {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.role === 'assistant' &&
    value.type === 'tool_complete' &&
    typeof value.timestamp === 'number' &&
    typeof value.toolName === 'string' &&
    isObject(value.toolInput) &&
    typeof value.success === 'boolean'
  );
}

/**
 * ErrorMessage 타입 가드 (StoreMessage용)
 *
 * @description
 * 주어진 값이 시스템 에러 메시지인지 확인합니다.
 * helpers의 isErrorMessage와 구분하기 위해 isStoreErrorMessage로 명명되었습니다.
 *
 * @param value - 확인할 값
 * @returns ErrorMessage 타입이면 true
 */
export function isStoreErrorMessage(value: unknown): value is ErrorMessage {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.role === 'system' &&
    value.type === 'error' &&
    typeof value.timestamp === 'number' &&
    typeof value.content === 'string'
  );
}

/**
 * ResultMessage 타입 가드
 *
 * @param value - 확인할 값
 * @returns ResultMessage 타입이면 true
 */
export function isResultMessage(value: unknown): value is ResultMessage {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.role === 'system' &&
    value.type === 'result' &&
    typeof value.timestamp === 'number' &&
    isObject(value.resultInfo)
  );
}

/**
 * AbortedMessage 타입 가드
 *
 * @param value - 확인할 값
 * @returns AbortedMessage 타입이면 true
 */
export function isAbortedMessage(value: unknown): value is AbortedMessage {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.role === 'system' &&
    value.type === 'aborted' &&
    typeof value.timestamp === 'number' &&
    typeof value.reason === 'string'
  );
}

/**
 * FileAttachmentMessage 타입 가드
 *
 * @param value - 확인할 값
 * @returns FileAttachmentMessage 타입이면 true
 */
export function isFileAttachmentMessage(value: unknown): value is FileAttachmentMessage {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.role === 'assistant' &&
    value.type === 'file_attachment' &&
    typeof value.timestamp === 'number' &&
    isObject(value.file)
  );
}

/**
 * UserResponseMessage 타입 가드
 *
 * @param value - 확인할 값
 * @returns UserResponseMessage 타입이면 true
 */
export function isUserResponseMessage(value: unknown): value is UserResponseMessage {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.role === 'user' &&
    value.type === 'user_response' &&
    typeof value.timestamp === 'number' &&
    typeof value.responseType === 'string' &&
    typeof value.toolUseId === 'string' &&
    typeof value.response === 'string'
  );
}

/**
 * SystemMessage 타입 가드
 *
 * @param value - 확인할 값
 * @returns SystemMessage 타입이면 true
 */
export function isSystemMessage(value: unknown): value is SystemMessage {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.role === 'system' &&
    value.type === 'system' &&
    typeof value.timestamp === 'number' &&
    typeof value.content === 'string'
  );
}

/**
 * StoreMessage 타입 가드
 *
 * @description
 * 주어진 값이 StoreMessage 유니온 타입 중 하나인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns StoreMessage 타입이면 true
 */
export function isStoreMessage(value: unknown): value is StoreMessage {
  return (
    isUserTextMessage(value) ||
    isAssistantTextMessage(value) ||
    isToolStartMessage(value) ||
    isToolCompleteMessage(value) ||
    isStoreErrorMessage(value) ||
    isResultMessage(value) ||
    isAbortedMessage(value) ||
    isFileAttachmentMessage(value) ||
    isUserResponseMessage(value) ||
    isSystemMessage(value)
  );
}
