/**
 * @file message-type.ts
 * @description 메시지 타입 상수 정의
 *
 * Relay와 Pylon, App 간에 주고받는 모든 메시지의 타입을 정의합니다.
 * WebSocket을 통해 전송되는 메시지의 type 필드에 사용됩니다.
 */

/**
 * 메시지 타입 상수
 *
 * @description
 * 시스템에서 사용하는 모든 메시지 타입을 정의합니다.
 *
 * 카테고리:
 * - Auth: 인증 관련 (AUTH, AUTH_RESULT)
 * - Connection: 연결 상태 (CONNECTED, REGISTERED, DEVICE_STATUS)
 * - Workspace: 워크스페이스 관리
 * - Conversation: 대화 관리
 * - Claude: Claude SDK 관련
 * - Blob: 파일 전송
 * - Folder: 폴더 관리
 * - Task: 태스크 관리
 * - Worker: 워커 관리
 * - Utility: 기타 (PING, PONG, ERROR)
 *
 * @example
 * ```typescript
 * import { MessageType } from '@estelle/core';
 *
 * const message = {
 *   type: MessageType.AUTH,
 *   token: 'secret'
 * };
 * ```
 */
export const MessageType = {
  // === Auth ===
  /** 인증 요청 */
  AUTH: 'auth',
  /** 인증 결과 응답 */
  AUTH_RESULT: 'auth_result',

  // === Connection ===
  /** 연결 완료 (초기 연결 시) */
  CONNECTED: 'connected',
  /** 등록 완료 (인증 후) */
  REGISTERED: 'registered',
  /** 디바이스 상태 변경 알림 */
  DEVICE_STATUS: 'device_status',
  /** Relay 연결 상태 (로컬서버 전용) */
  RELAY_STATUS: 'relay_status',
  /** 상태 조회 응답 */
  STATUS: 'status',

  // === Workspace ===
  /** 워크스페이스 목록 요청 */
  WORKSPACE_LIST: 'workspace_list',
  /** 워크스페이스 목록 응답 */
  WORKSPACE_LIST_RESULT: 'workspace_list_result',
  /** 워크스페이스 생성 요청 */
  WORKSPACE_CREATE: 'workspace_create',
  /** 워크스페이스 생성 응답 */
  WORKSPACE_CREATE_RESULT: 'workspace_create_result',
  /** 워크스페이스 삭제 요청 */
  WORKSPACE_DELETE: 'workspace_delete',
  /** 워크스페이스 삭제 응답 */
  WORKSPACE_DELETE_RESULT: 'workspace_delete_result',

  // === Conversation ===
  /** 대화 생성 요청 */
  CONVERSATION_CREATE: 'conversation_create',
  /** 대화 생성 응답 */
  CONVERSATION_CREATE_RESULT: 'conversation_create_result',
  /** 대화 선택 요청 */
  CONVERSATION_SELECT: 'conversation_select',
  /** 대화 상태 변경 알림 */
  CONVERSATION_STATUS: 'conversation_status',
  /** 메시지 히스토리 응답 */
  HISTORY_RESULT: 'history_result',

  // === Claude ===
  /** Claude에 메시지 전송 */
  CLAUDE_SEND: 'claude_send',
  /** Claude 이벤트 (텍스트, 도구 사용 등) */
  CLAUDE_EVENT: 'claude_event',
  /** Claude 권한 응답 */
  CLAUDE_PERMISSION: 'claude_permission',
  /** Claude 질문에 대한 응답 */
  CLAUDE_ANSWER: 'claude_answer',
  /** Claude 제어 (중단, 재시작 등) */
  CLAUDE_CONTROL: 'claude_control',
  /** Claude 권한 모드 설정 */
  CLAUDE_SET_PERMISSION_MODE: 'claude_set_permission_mode',
  /** Pylon 상태 (Claude 사용량 등) */
  PYLON_STATUS: 'pylon_status',

  // === Blob (파일 전송) ===
  /** 파일 전송 시작 */
  BLOB_START: 'blob_start',
  /** 파일 청크 전송 */
  BLOB_CHUNK: 'blob_chunk',
  /** 파일 전송 완료 */
  BLOB_END: 'blob_end',
  /** 파일 전송 확인 응답 */
  BLOB_ACK: 'blob_ack',
  /** 파일 요청 */
  BLOB_REQUEST: 'blob_request',
  /** 파일 업로드 완료 알림 */
  BLOB_UPLOAD_COMPLETE: 'blob_upload_complete',

  // === Folder ===
  /** 폴더 목록 요청 */
  FOLDER_LIST: 'folder_list',
  /** 폴더 목록 응답 */
  FOLDER_LIST_RESULT: 'folder_list_result',
  /** 폴더 생성 요청 */
  FOLDER_CREATE: 'folder_create',
  /** 폴더 생성 응답 */
  FOLDER_CREATE_RESULT: 'folder_create_result',
  /** 폴더 이름 변경 요청 */
  FOLDER_RENAME: 'folder_rename',
  /** 폴더 이름 변경 응답 */
  FOLDER_RENAME_RESULT: 'folder_rename_result',

  // === Task ===
  /** 태스크 목록 요청 */
  TASK_LIST: 'task_list',
  /** 태스크 목록 응답 */
  TASK_LIST_RESULT: 'task_list_result',
  /** 태스크 조회 요청 */
  TASK_GET: 'task_get',
  /** 태스크 조회 응답 */
  TASK_GET_RESULT: 'task_get_result',
  /** 태스크 생성 요청 */
  TASK_CREATE: 'task_create',
  /** 태스크 상태 업데이트 요청 */
  TASK_UPDATE: 'task_update',
  /** 태스크 상태 업데이트 응답 */
  TASK_STATUS_RESULT: 'task_status_result',

  // === Worker ===
  /** 워커 상태 조회 요청 */
  WORKER_STATUS: 'worker_status',
  /** 워커 상태 조회 응답 */
  WORKER_STATUS_RESULT: 'worker_status_result',
  /** 워커 시작 요청 */
  WORKER_START: 'worker_start',
  /** 워커 시작 응답 */
  WORKER_START_RESULT: 'worker_start_result',
  /** 워커 정지 요청 */
  WORKER_STOP: 'worker_stop',
  /** 워커 정지 응답 */
  WORKER_STOP_RESULT: 'worker_stop_result',

  // === Utility ===
  /** 연결 유지 확인 요청 */
  PING: 'ping',
  /** 연결 유지 확인 응답 */
  PONG: 'pong',
  /** 에러 */
  ERROR: 'error',
  /** 버그 리포트 */
  BUG_REPORT: 'bug_report',
  /** Relay에서 온 메시지 통과 (로컬서버 전용) */
  FROM_RELAY: 'from_relay',

  // === Legacy (호환성 유지용, deprecated) ===
  /** @deprecated WORKSPACE_LIST 사용 권장 */
  DESK_LIST: 'desk_list',
  /** @deprecated WORKSPACE_LIST_RESULT 사용 권장 */
  DESK_LIST_RESULT: 'desk_list_result',
  /** @deprecated CONVERSATION_SELECT 사용 권장 */
  DESK_SWITCH: 'desk_switch',
  /** @deprecated WORKSPACE_CREATE 사용 권장 */
  DESK_CREATE: 'desk_create',
  /** @deprecated WORKSPACE_DELETE 사용 권장 */
  DESK_DELETE: 'desk_delete',
  /** @deprecated 제거 예정 */
  DESK_RENAME: 'desk_rename',
  /** @deprecated CONVERSATION_STATUS 사용 권장 */
  DESK_STATUS: 'desk_status',
} as const;

/**
 * 메시지 타입 값의 유니온 타입
 *
 * @description
 * MessageType 객체의 모든 값들의 유니온 타입입니다.
 * 메시지 타입을 받는 함수의 파라미터 타입으로 사용합니다.
 *
 * @example
 * ```typescript
 * function handleMessage(type: MessageTypeValue) {
 *   switch (type) {
 *     case 'auth':
 *       // ...
 *   }
 * }
 * ```
 */
export type MessageTypeValue = typeof MessageType[keyof typeof MessageType];
