/**
 * @file claude-event.ts
 * @description Claude SDK에서 발생하는 이벤트 타입 정의
 *
 * Estelle 시스템에서 Claude Code SDK와 통신할 때 발생하는
 * 모든 이벤트 타입들을 정의합니다. 총 8개의 이벤트 타입이 있으며,
 * 각각 특정 상황에서 발생합니다.
 *
 * @see https://github.com/anthropics/claude-code-sdk
 */

/**
 * Claude 상태 변경 이벤트
 *
 * @description
 * Claude의 상태가 변경되었을 때 발생하는 이벤트입니다.
 * 상태는 문자열로 표현되며, 일반적으로 'idle', 'working' 등의 값을 가집니다.
 *
 * @property type - 이벤트 타입 ('state')
 * @property state - 현재 Claude 상태 (예: 'idle', 'working', 'waiting')
 *
 * @example
 * ```typescript
 * const event: ClaudeStateEvent = {
 *   type: 'state',
 *   state: 'working'
 * };
 * ```
 */
export interface ClaudeStateEvent {
  /** 이벤트 타입 식별자 */
  type: 'state';

  /** 현재 Claude 상태 */
  state: string;
}

/**
 * Claude 텍스트 출력 이벤트
 *
 * @description
 * Claude가 텍스트를 출력할 때 발생하는 이벤트입니다.
 * 스트리밍 응답 중에 여러 번 발생할 수 있습니다.
 *
 * @property type - 이벤트 타입 ('text')
 * @property content - 출력된 텍스트 내용
 *
 * @example
 * ```typescript
 * const event: ClaudeTextEvent = {
 *   type: 'text',
 *   content: '안녕하세요! 무엇을 도와드릴까요?'
 * };
 * ```
 */
export interface ClaudeTextEvent {
  /** 이벤트 타입 식별자 */
  type: 'text';

  /** 출력된 텍스트 내용 */
  content: string;
}

/**
 * 도구 실행 시작 이벤트
 *
 * @description
 * Claude가 도구(tool) 실행을 시작할 때 발생하는 이벤트입니다.
 * 도구 이름과 입력 파라미터를 포함합니다.
 *
 * @property type - 이벤트 타입 ('tool_start')
 * @property toolName - 실행할 도구 이름 (예: 'read_file', 'bash', 'write_file')
 * @property toolInput - 도구에 전달되는 입력 파라미터
 *
 * @example
 * ```typescript
 * const event: ClaudeToolStartEvent = {
 *   type: 'tool_start',
 *   toolName: 'read_file',
 *   toolInput: { path: '/home/user/project/README.md' }
 * };
 * ```
 */
export interface ClaudeToolStartEvent {
  /** 이벤트 타입 식별자 */
  type: 'tool_start';

  /** 실행할 도구 이름 */
  toolName: string;

  /** 도구에 전달되는 입력 파라미터 */
  toolInput: Record<string, unknown>;
}

/**
 * 도구 실행 완료 이벤트
 *
 * @description
 * Claude가 도구 실행을 완료했을 때 발생하는 이벤트입니다.
 * 도구 실행 결과를 포함합니다.
 *
 * @property type - 이벤트 타입 ('tool_complete')
 * @property toolName - 완료된 도구 이름
 * @property output - 도구 실행 결과 (다양한 타입 가능)
 *
 * @example
 * ```typescript
 * const event: ClaudeToolCompleteEvent = {
 *   type: 'tool_complete',
 *   toolName: 'read_file',
 *   output: '# README\n\nThis is a project...'
 * };
 * ```
 */
export interface ClaudeToolCompleteEvent {
  /** 이벤트 타입 식별자 */
  type: 'tool_complete';

  /** 완료된 도구 이름 */
  toolName: string;

  /** 도구 실행 결과 */
  output: unknown;
}

/**
 * 권한 요청 이벤트
 *
 * @description
 * Claude가 민감한 작업을 수행하기 전에 사용자 권한을 요청할 때 발생하는 이벤트입니다.
 * 파일 쓰기, 명령어 실행 등 잠재적으로 위험한 작업에 대해 발생합니다.
 *
 * @property type - 이벤트 타입 ('permission_request')
 * @property toolName - 권한이 필요한 도구 이름
 * @property toolInput - 도구에 전달될 입력 파라미터
 * @property toolUseId - 도구 사용 요청의 고유 식별자 (응답 시 사용)
 *
 * @example
 * ```typescript
 * const event: ClaudePermissionRequestEvent = {
 *   type: 'permission_request',
 *   toolName: 'write_file',
 *   toolInput: {
 *     path: '/home/user/config.json',
 *     content: '{"setting": true}'
 *   },
 *   toolUseId: 'toolu_01234567890abcdef'
 * };
 * ```
 */
export interface ClaudePermissionRequestEvent {
  /** 이벤트 타입 식별자 */
  type: 'permission_request';

  /** 권한이 필요한 도구 이름 */
  toolName: string;

  /** 도구에 전달될 입력 파라미터 */
  toolInput: Record<string, unknown>;

  /** 도구 사용 요청의 고유 식별자 */
  toolUseId: string;
}

/**
 * 질문 이벤트
 *
 * @description
 * Claude가 사용자에게 선택지를 제시하며 질문할 때 발생하는 이벤트입니다.
 * 사용자는 제시된 옵션 중 하나를 선택하거나 자유 입력을 할 수 있습니다.
 *
 * @property type - 이벤트 타입 ('ask_question')
 * @property question - 질문 내용
 * @property options - 선택 가능한 옵션 목록 (빈 배열일 수 있음)
 * @property toolUseId - 도구 사용 요청의 고유 식별자 (응답 시 사용)
 *
 * @example
 * ```typescript
 * const event: ClaudeAskQuestionEvent = {
 *   type: 'ask_question',
 *   question: '어떤 프레임워크를 사용하시겠습니까?',
 *   options: ['React', 'Vue', 'Angular', 'Svelte'],
 *   toolUseId: 'toolu_abcdef123456'
 * };
 * ```
 */
export interface ClaudeAskQuestionEvent {
  /** 이벤트 타입 식별자 */
  type: 'ask_question';

  /** 질문 내용 */
  question: string;

  /** 선택 가능한 옵션 목록 */
  options: string[];

  /** 도구 사용 요청의 고유 식별자 */
  toolUseId: string;
}

/**
 * 결과 이벤트
 *
 * @description
 * Claude가 작업을 완료하고 최종 결과를 반환할 때 발생하는 이벤트입니다.
 * 대화의 끝이나 특정 작업 완료 시점에 발생합니다.
 *
 * @property type - 이벤트 타입 ('result')
 * @property result - 작업 결과 (다양한 타입 가능)
 *
 * @example
 * ```typescript
 * const event: ClaudeResultEvent = {
 *   type: 'result',
 *   result: {
 *     success: true,
 *     message: '파일이 성공적으로 생성되었습니다.',
 *     filesCreated: ['index.ts', 'package.json']
 *   }
 * };
 * ```
 */
export interface ClaudeResultEvent {
  /** 이벤트 타입 식별자 */
  type: 'result';

  /** 작업 결과 */
  result: unknown;
}

/**
 * 오류 이벤트
 *
 * @description
 * Claude가 작업 중 오류를 만났을 때 발생하는 이벤트입니다.
 * 오류 메시지를 문자열로 포함합니다.
 *
 * @property type - 이벤트 타입 ('error')
 * @property error - 오류 메시지
 *
 * @example
 * ```typescript
 * const event: ClaudeErrorEvent = {
 *   type: 'error',
 *   error: '파일을 찾을 수 없습니다: /path/to/missing/file.txt'
 * };
 * ```
 */
export interface ClaudeErrorEvent {
  /** 이벤트 타입 식별자 */
  type: 'error';

  /** 오류 메시지 */
  error: string;
}

/**
 * Claude 이벤트 유니온 타입
 *
 * @description
 * Claude SDK에서 발생할 수 있는 모든 이벤트 타입의 유니온입니다.
 * discriminated union 패턴을 사용하여 `type` 필드로 구분됩니다.
 *
 * 지원되는 이벤트 타입:
 * - `state`: 상태 변경
 * - `text`: 텍스트 출력
 * - `tool_start`: 도구 실행 시작
 * - `tool_complete`: 도구 실행 완료
 * - `permission_request`: 권한 요청
 * - `ask_question`: 질문
 * - `result`: 결과
 * - `error`: 오류
 *
 * @example
 * ```typescript
 * function handleEvent(event: ClaudeEvent) {
 *   switch (event.type) {
 *     case 'text':
 *       console.log('Text:', event.content);
 *       break;
 *     case 'error':
 *       console.error('Error:', event.error);
 *       break;
 *     // ... 다른 이벤트 처리
 *   }
 * }
 * ```
 */
export type ClaudeEvent =
  | ClaudeStateEvent
  | ClaudeTextEvent
  | ClaudeToolStartEvent
  | ClaudeToolCompleteEvent
  | ClaudePermissionRequestEvent
  | ClaudeAskQuestionEvent
  | ClaudeResultEvent
  | ClaudeErrorEvent;

/**
 * Claude 이벤트 페이로드
 *
 * @description
 * 특정 대화에서 발생한 Claude 이벤트를 래핑하는 페이로드입니다.
 * 이벤트가 어떤 대화에서 발생했는지 식별하기 위해 사용됩니다.
 *
 * @property conversationId - 이벤트가 발생한 대화의 고유 식별자
 * @property event - 발생한 Claude 이벤트
 *
 * @example
 * ```typescript
 * const payload: ClaudeEventPayload = {
 *   conversationId: 'conv-001',
 *   event: {
 *     type: 'text',
 *     content: 'Working on your request...'
 *   }
 * };
 * ```
 */
export interface ClaudeEventPayload {
  /** 이벤트가 발생한 대화의 고유 식별자 */
  conversationId: string;

  /** 발생한 Claude 이벤트 */
  event: ClaudeEvent;
}

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
 * ClaudeStateEvent 타입 가드
 *
 * @description
 * 주어진 값이 ClaudeStateEvent 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns ClaudeStateEvent 타입이면 true
 *
 * @example
 * ```typescript
 * const event: unknown = JSON.parse(message);
 * if (isClaudeStateEvent(event)) {
 *   console.log('State:', event.state);
 * }
 * ```
 */
export function isClaudeStateEvent(value: unknown): value is ClaudeStateEvent {
  return (
    isObject(value) &&
    value.type === 'state' &&
    typeof value.state === 'string'
  );
}

/**
 * ClaudeTextEvent 타입 가드
 *
 * @description
 * 주어진 값이 ClaudeTextEvent 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns ClaudeTextEvent 타입이면 true
 *
 * @example
 * ```typescript
 * const event: unknown = JSON.parse(message);
 * if (isClaudeTextEvent(event)) {
 *   console.log('Content:', event.content);
 * }
 * ```
 */
export function isClaudeTextEvent(value: unknown): value is ClaudeTextEvent {
  return (
    isObject(value) &&
    value.type === 'text' &&
    typeof value.content === 'string'
  );
}

/**
 * ClaudeToolStartEvent 타입 가드
 *
 * @description
 * 주어진 값이 ClaudeToolStartEvent 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns ClaudeToolStartEvent 타입이면 true
 *
 * @example
 * ```typescript
 * const event: unknown = JSON.parse(message);
 * if (isClaudeToolStartEvent(event)) {
 *   console.log('Tool:', event.toolName);
 *   console.log('Input:', event.toolInput);
 * }
 * ```
 */
export function isClaudeToolStartEvent(value: unknown): value is ClaudeToolStartEvent {
  return (
    isObject(value) &&
    value.type === 'tool_start' &&
    typeof value.toolName === 'string' &&
    isObject(value.toolInput)
  );
}

/**
 * ClaudeToolCompleteEvent 타입 가드
 *
 * @description
 * 주어진 값이 ClaudeToolCompleteEvent 타입인지 확인합니다.
 * output 필드는 어떤 타입이든 가능합니다 (null 포함).
 *
 * @param value - 확인할 값
 * @returns ClaudeToolCompleteEvent 타입이면 true
 *
 * @example
 * ```typescript
 * const event: unknown = JSON.parse(message);
 * if (isClaudeToolCompleteEvent(event)) {
 *   console.log('Tool:', event.toolName);
 *   console.log('Output:', event.output);
 * }
 * ```
 */
export function isClaudeToolCompleteEvent(value: unknown): value is ClaudeToolCompleteEvent {
  return (
    isObject(value) &&
    value.type === 'tool_complete' &&
    typeof value.toolName === 'string' &&
    'output' in value
  );
}

/**
 * ClaudePermissionRequestEvent 타입 가드
 *
 * @description
 * 주어진 값이 ClaudePermissionRequestEvent 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns ClaudePermissionRequestEvent 타입이면 true
 *
 * @example
 * ```typescript
 * const event: unknown = JSON.parse(message);
 * if (isClaudePermissionRequestEvent(event)) {
 *   console.log('Requesting permission for:', event.toolName);
 *   // 사용자에게 권한 승인 UI 표시
 * }
 * ```
 */
export function isClaudePermissionRequestEvent(value: unknown): value is ClaudePermissionRequestEvent {
  return (
    isObject(value) &&
    value.type === 'permission_request' &&
    typeof value.toolName === 'string' &&
    isObject(value.toolInput) &&
    typeof value.toolUseId === 'string'
  );
}

/**
 * ClaudeAskQuestionEvent 타입 가드
 *
 * @description
 * 주어진 값이 ClaudeAskQuestionEvent 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns ClaudeAskQuestionEvent 타입이면 true
 *
 * @example
 * ```typescript
 * const event: unknown = JSON.parse(message);
 * if (isClaudeAskQuestionEvent(event)) {
 *   console.log('Question:', event.question);
 *   console.log('Options:', event.options);
 *   // 사용자에게 선택지 UI 표시
 * }
 * ```
 */
export function isClaudeAskQuestionEvent(value: unknown): value is ClaudeAskQuestionEvent {
  return (
    isObject(value) &&
    value.type === 'ask_question' &&
    typeof value.question === 'string' &&
    Array.isArray(value.options) &&
    typeof value.toolUseId === 'string'
  );
}

/**
 * ClaudeResultEvent 타입 가드
 *
 * @description
 * 주어진 값이 ClaudeResultEvent 타입인지 확인합니다.
 * result 필드는 어떤 타입이든 가능합니다 (null 포함).
 *
 * @param value - 확인할 값
 * @returns ClaudeResultEvent 타입이면 true
 *
 * @example
 * ```typescript
 * const event: unknown = JSON.parse(message);
 * if (isClaudeResultEvent(event)) {
 *   console.log('Result:', event.result);
 * }
 * ```
 */
export function isClaudeResultEvent(value: unknown): value is ClaudeResultEvent {
  return (
    isObject(value) &&
    value.type === 'result' &&
    'result' in value
  );
}

/**
 * ClaudeErrorEvent 타입 가드
 *
 * @description
 * 주어진 값이 ClaudeErrorEvent 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns ClaudeErrorEvent 타입이면 true
 *
 * @example
 * ```typescript
 * const event: unknown = JSON.parse(message);
 * if (isClaudeErrorEvent(event)) {
 *   console.error('Claude Error:', event.error);
 * }
 * ```
 */
export function isClaudeErrorEvent(value: unknown): value is ClaudeErrorEvent {
  return (
    isObject(value) &&
    value.type === 'error' &&
    typeof value.error === 'string'
  );
}

/**
 * ClaudeEvent 타입 가드
 *
 * @description
 * 주어진 값이 ClaudeEvent 유니온 타입 중 하나인지 확인합니다.
 * 8가지 이벤트 타입 중 하나라도 매칭되면 true를 반환합니다.
 *
 * @param value - 확인할 값
 * @returns ClaudeEvent 타입이면 true
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(message);
 * if (isClaudeEvent(data)) {
 *   handleClaudeEvent(data);  // 타입 안전하게 처리
 * }
 * ```
 */
export function isClaudeEvent(value: unknown): value is ClaudeEvent {
  return (
    isClaudeStateEvent(value) ||
    isClaudeTextEvent(value) ||
    isClaudeToolStartEvent(value) ||
    isClaudeToolCompleteEvent(value) ||
    isClaudePermissionRequestEvent(value) ||
    isClaudeAskQuestionEvent(value) ||
    isClaudeResultEvent(value) ||
    isClaudeErrorEvent(value)
  );
}
