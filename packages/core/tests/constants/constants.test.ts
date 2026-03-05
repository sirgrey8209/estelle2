/**
 * @file constants.test.ts
 * @description 상수 정의 테스트
 *
 * 모든 상수가 올바르게 정의되어 있는지 검증합니다.
 */

import { describe, it, expect } from 'vitest';
import {
  MessageType,
  type MessageTypeValue,
  ConversationStatus,
  type ConversationStatusValue,
  ClaudeEventType,
  type ClaudeEventTypeValue,
  PermissionMode,
  type PermissionModeValue,
  BlobConfig,
  Characters,
  type CharacterId,
  type CharacterInfo,
} from '../../src/constants/index.js';

describe('MessageType', () => {
  it('should have all message types (84 total)', () => {
    const messageTypes = Object.keys(MessageType);
    expect(messageTypes).toHaveLength(84);
  });

  it('should have correct auth message types', () => {
    expect(MessageType.AUTH).toBe('auth');
    expect(MessageType.AUTH_RESULT).toBe('auth_result');
  });

  it('should have correct connection message types', () => {
    expect(MessageType.CONNECTED).toBe('connected');
    expect(MessageType.REGISTERED).toBe('registered');
    expect(MessageType.DEVICE_STATUS).toBe('device_status');
    expect(MessageType.RELAY_STATUS).toBe('relay_status');
    expect(MessageType.STATUS).toBe('status');
  });

  it('should have correct workspace message types', () => {
    expect(MessageType.WORKSPACE_LIST).toBe('workspace_list');
    expect(MessageType.WORKSPACE_LIST_RESULT).toBe('workspace_list_result');
    expect(MessageType.WORKSPACE_CREATE).toBe('workspace_create');
    expect(MessageType.WORKSPACE_CREATE_RESULT).toBe('workspace_create_result');
    expect(MessageType.WORKSPACE_DELETE).toBe('workspace_delete');
    expect(MessageType.WORKSPACE_DELETE_RESULT).toBe('workspace_delete_result');
  });

  it('should have correct conversation message types', () => {
    expect(MessageType.CONVERSATION_CREATE).toBe('conversation_create');
    expect(MessageType.CONVERSATION_CREATE_RESULT).toBe('conversation_create_result');
    expect(MessageType.CONVERSATION_SELECT).toBe('conversation_select');
    expect(MessageType.CONVERSATION_STATUS).toBe('conversation_status');
    expect(MessageType.HISTORY_RESULT).toBe('history_result');
  });

  it('should have correct claude message types', () => {
    expect(MessageType.CLAUDE_SEND).toBe('claude_send');
    expect(MessageType.CLAUDE_EVENT).toBe('claude_event');
    expect(MessageType.CLAUDE_PERMISSION).toBe('claude_permission');
    expect(MessageType.CLAUDE_ANSWER).toBe('claude_answer');
    expect(MessageType.CLAUDE_CONTROL).toBe('claude_control');
    expect(MessageType.CLAUDE_SET_PERMISSION_MODE).toBe('claude_set_permission_mode');
    expect(MessageType.PYLON_STATUS).toBe('pylon_status');
  });

  it('should have correct blob message types', () => {
    expect(MessageType.BLOB_START).toBe('blob_start');
    expect(MessageType.BLOB_CHUNK).toBe('blob_chunk');
    expect(MessageType.BLOB_END).toBe('blob_end');
    expect(MessageType.BLOB_ACK).toBe('blob_ack');
    expect(MessageType.BLOB_REQUEST).toBe('blob_request');
    expect(MessageType.BLOB_UPLOAD_COMPLETE).toBe('blob_upload_complete');
  });

  it('should have correct folder message types', () => {
    expect(MessageType.FOLDER_LIST).toBe('folder_list');
    expect(MessageType.FOLDER_LIST_RESULT).toBe('folder_list_result');
    expect(MessageType.FOLDER_CREATE).toBe('folder_create');
    expect(MessageType.FOLDER_CREATE_RESULT).toBe('folder_create_result');
    expect(MessageType.FOLDER_RENAME).toBe('folder_rename');
    expect(MessageType.FOLDER_RENAME_RESULT).toBe('folder_rename_result');
  });

  it('should have correct task message types', () => {
    expect(MessageType.TASK_LIST).toBe('task_list');
    expect(MessageType.TASK_LIST_RESULT).toBe('task_list_result');
    expect(MessageType.TASK_GET).toBe('task_get');
    expect(MessageType.TASK_GET_RESULT).toBe('task_get_result');
    expect(MessageType.TASK_CREATE).toBe('task_create');
    expect(MessageType.TASK_UPDATE).toBe('task_update');
    expect(MessageType.TASK_STATUS_RESULT).toBe('task_status_result');
  });

  it('should have correct worker message types', () => {
    expect(MessageType.WORKER_STATUS).toBe('worker_status');
    expect(MessageType.WORKER_STATUS_RESULT).toBe('worker_status_result');
    expect(MessageType.WORKER_START).toBe('worker_start');
    expect(MessageType.WORKER_START_RESULT).toBe('worker_start_result');
    expect(MessageType.WORKER_STOP).toBe('worker_stop');
    expect(MessageType.WORKER_STOP_RESULT).toBe('worker_stop_result');
  });

  it('should have correct utility message types', () => {
    expect(MessageType.PING).toBe('ping');
    expect(MessageType.PONG).toBe('pong');
    expect(MessageType.ERROR).toBe('error');
    expect(MessageType.BUG_REPORT).toBe('bug_report');
    expect(MessageType.FROM_RELAY).toBe('from_relay');
  });

  it('should have correct usage message types', () => {
    expect(MessageType.USAGE_REQUEST).toBe('usage_request');
    expect(MessageType.USAGE_RESPONSE).toBe('usage_response');
  });

  it('should have correct account message types', () => {
    expect(MessageType.ACCOUNT_SWITCH).toBe('account_switch');
    expect(MessageType.ACCOUNT_STATUS).toBe('account_status');
  });

  it('should have correct widget message types', () => {
    expect(MessageType.WIDGET_CHECK).toBe('widget_check');
    expect(MessageType.WIDGET_CHECK_RESULT).toBe('widget_check_result');
    expect(MessageType.WIDGET_RENDER).toBe('widget_render');
    expect(MessageType.WIDGET_CLOSE).toBe('widget_close');
    expect(MessageType.WIDGET_INPUT).toBe('widget_input');
    expect(MessageType.WIDGET_CANCEL).toBe('widget_cancel');
    expect(MessageType.WIDGET_EVENT).toBe('widget_event');
  });

  it('should have legacy desk types for backward compatibility', () => {
    expect(MessageType.DESK_LIST).toBe('desk_list');
    expect(MessageType.DESK_LIST_RESULT).toBe('desk_list_result');
    expect(MessageType.DESK_SWITCH).toBe('desk_switch');
    expect(MessageType.DESK_CREATE).toBe('desk_create');
    expect(MessageType.DESK_DELETE).toBe('desk_delete');
    expect(MessageType.DESK_RENAME).toBe('desk_rename');
    expect(MessageType.DESK_STATUS).toBe('desk_status');
  });

  it('should be readonly (as const)', () => {
    // TypeScript에서 as const로 정의되면 값을 변경할 수 없음
    // 런타임에서는 Object.isFrozen으로 확인 불가 (as const는 컴파일 타임 전용)
    // 대신 타입 레벨에서 리터럴 타입인지 확인
    const authValue: 'auth' = MessageType.AUTH;
    expect(authValue).toBe('auth');
  });

  it('should export MessageTypeValue type', () => {
    // 타입 테스트 - 컴파일이 되면 성공
    const value: MessageTypeValue = 'auth';
    expect(value).toBe('auth');
  });
});

describe('ConversationStatus', () => {
  it('should have all 4 conversation statuses', () => {
    const statuses = Object.keys(ConversationStatus);
    expect(statuses).toHaveLength(4);
  });

  it('should have correct status values', () => {
    expect(ConversationStatus.IDLE).toBe('idle');
    expect(ConversationStatus.WORKING).toBe('working');
    expect(ConversationStatus.WAITING).toBe('waiting');
    expect(ConversationStatus.ERROR).toBe('error');
  });

  it('should be readonly (as const)', () => {
    const idleValue: 'idle' = ConversationStatus.IDLE;
    expect(idleValue).toBe('idle');
  });

  it('should export ConversationStatusValue type', () => {
    const value: ConversationStatusValue = 'idle';
    expect(value).toBe('idle');
  });
});

describe('ClaudeEventType', () => {
  it('should have all 8 event types', () => {
    const eventTypes = Object.keys(ClaudeEventType);
    expect(eventTypes).toHaveLength(8);
  });

  it('should have correct event type values', () => {
    expect(ClaudeEventType.STATE).toBe('state');
    expect(ClaudeEventType.TEXT).toBe('text');
    expect(ClaudeEventType.TOOL_START).toBe('tool_start');
    expect(ClaudeEventType.TOOL_COMPLETE).toBe('tool_complete');
    expect(ClaudeEventType.PERMISSION_REQUEST).toBe('permission_request');
    expect(ClaudeEventType.ASK_QUESTION).toBe('ask_question');
    expect(ClaudeEventType.RESULT).toBe('result');
    expect(ClaudeEventType.ERROR).toBe('error');
  });

  it('should be readonly (as const)', () => {
    const stateValue: 'state' = ClaudeEventType.STATE;
    expect(stateValue).toBe('state');
  });

  it('should export ClaudeEventTypeValue type', () => {
    const value: ClaudeEventTypeValue = 'state';
    expect(value).toBe('state');
  });
});

describe('PermissionMode', () => {
  it('should have all 3 permission modes', () => {
    const modes = Object.keys(PermissionMode);
    expect(modes).toHaveLength(3);
  });

  it('should have correct mode values', () => {
    expect(PermissionMode.DEFAULT).toBe('default');
    expect(PermissionMode.ACCEPT_EDITS).toBe('acceptEdits');
    expect(PermissionMode.BYPASS).toBe('bypassPermissions');
  });

  it('should be readonly (as const)', () => {
    const defaultValue: 'default' = PermissionMode.DEFAULT;
    expect(defaultValue).toBe('default');
  });

  it('should export PermissionModeValue type', () => {
    const value: PermissionModeValue = 'default';
    expect(value).toBe('default');
  });
});

describe('BlobConfig', () => {
  it('should have CHUNK_SIZE of 65536 (64KB)', () => {
    expect(BlobConfig.CHUNK_SIZE).toBe(65536);
  });

  it('should have ENCODING of base64', () => {
    expect(BlobConfig.ENCODING).toBe('base64');
  });

  it('should be readonly (as const)', () => {
    const chunkSize: 65536 = BlobConfig.CHUNK_SIZE;
    const encoding: 'base64' = BlobConfig.ENCODING;
    expect(chunkSize).toBe(65536);
    expect(encoding).toBe('base64');
  });
});

describe('Characters', () => {
  it('should have device 1, 2, lucy, and estelle', () => {
    const characterIds = Object.keys(Characters);
    expect(characterIds).toContain('1');
    expect(characterIds).toContain('2');
    expect(characterIds).toContain('lucy');
    expect(characterIds).toContain('estelle');
    expect(characterIds).toHaveLength(4);
  });

  it('should have correct device 1 info', () => {
    expect(Characters['1'].name).toBe('Device 1');
    expect(Characters['1'].icon).toBe('\uD83C\uDFE2'); // 🏢
    expect(Characters['1'].description).toBe('\uD68C\uC0AC'); // 회사
  });

  it('should have correct device 2 info', () => {
    expect(Characters['2'].name).toBe('Device 2');
    expect(Characters['2'].icon).toBe('\uD83C\uDFE0'); // 🏠
    expect(Characters['2'].description).toBe('\uC9D1'); // 집
  });

  it('should have correct lucy info', () => {
    expect(Characters.lucy.name).toBe('Lucy');
    expect(Characters.lucy.icon).toBe('\uD83D\uDCF1'); // 📱
    expect(Characters.lucy.description).toBe('Mobile');
  });

  it('should have correct estelle info', () => {
    expect(Characters.estelle.name).toBe('Estelle');
    expect(Characters.estelle.icon).toBe('\uD83D\uDCAB'); // 💫
    expect(Characters.estelle.description).toBe('Relay');
  });

  it('should export CharacterId and CharacterInfo types', () => {
    // 타입 테스트 - 컴파일이 되면 성공
    const id: CharacterId = '1';
    const info: CharacterInfo = { name: 'Test', icon: 'X', description: 'desc' };
    expect(id).toBe('1');
    expect(info.name).toBe('Test');
  });
});
