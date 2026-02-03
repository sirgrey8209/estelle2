/**
 * @file integration.test.ts
 * @description @estelle/core 최종 통합 테스트
 *
 * 모든 export가 올바르게 동작하는지 확인하는 통합 테스트입니다.
 */

import { describe, it, expect } from 'vitest';

// === 상수 Import ===
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
  type ChunkSize,
  type BlobEncoding,
  Characters,
  type CharacterId,
  type CharacterInfo,
} from '../src/index.js';

// === 타입 Import ===
import type {
  // Device
  DeviceType,
  DeviceId,
  // Message
  Message,
  // Auth
  AuthPayload,
  AuthResultPayload,
  // Workspace/Conversation
  Workspace,
  Conversation,
  WorkspaceWithActive,
  // Claude Event
  ClaudeEventPayload,
  // Claude Control
  ClaudeSendPayload,
  ClaudeControlPayload,
  ClaudeControlType,
  // Blob
  BlobStartPayload,
  BlobChunkPayload,
  BlobEndPayload,
  BlobId,
  // Character
  Character,
} from '../src/index.js';

// === 헬퍼 함수 Import ===
import {
  // 메시지 생성
  createMessage,
  type CreateMessageOptions,
  // 캐릭터
  getCharacter,
  getDeskFullName,
  DEFAULT_CHARACTER,
  // 타입 가드
  isMessage,
  getMessageType,
  isAuthMessage,
  isAuthResultMessage,
  isWorkspaceListResultMessage,
  isClaudeEventMessage,
  isClaudeSendMessage,
  isBlobStartMessage,
  isBlobChunkMessage,
  isBlobEndMessage,
  isPingMessage,
  isPongMessage,
  isErrorMessage,
  type ErrorPayload,
} from '../src/index.js';

// === 레거시 타입 Import (하위 호환성) ===
import {
  BaseMessage,
  Routable,
  PromptMessage,
  ClaudeMessage,
  StreamChunk,
  LegacyMessage,
  isPromptMessage,
  isClaudeMessage,
  isStreamChunk,
} from '../src/index.js';

describe('@estelle/core Integration Tests', () => {
  describe('상수 (Constants)', () => {
    it('MessageType이 올바르게 export 됨', () => {
      expect(MessageType.AUTH).toBe('auth');
      expect(MessageType.AUTH_RESULT).toBe('auth_result');
      expect(MessageType.PING).toBe('ping');
      expect(MessageType.PONG).toBe('pong');
      expect(MessageType.CLAUDE_EVENT).toBe('claude_event');
      expect(MessageType.CLAUDE_SEND).toBe('claude_send');
      expect(MessageType.BLOB_START).toBe('blob_start');
      expect(MessageType.WORKSPACE_LIST_RESULT).toBe('workspace_list_result');
    });

    it('ConversationStatus가 올바르게 export 됨', () => {
      expect(ConversationStatus.IDLE).toBe('idle');
      expect(ConversationStatus.WORKING).toBe('working');
      expect(ConversationStatus.WAITING).toBe('waiting');
      expect(ConversationStatus.ERROR).toBe('error');
    });

    it('ClaudeEventType이 올바르게 export 됨', () => {
      expect(ClaudeEventType.STATE).toBe('state');
      expect(ClaudeEventType.TEXT).toBe('text');
      expect(ClaudeEventType.TOOL_START).toBe('tool_start');
      expect(ClaudeEventType.TOOL_COMPLETE).toBe('tool_complete');
      expect(ClaudeEventType.PERMISSION_REQUEST).toBe('permission_request');
      expect(ClaudeEventType.ASK_QUESTION).toBe('ask_question');
      expect(ClaudeEventType.RESULT).toBe('result');
      expect(ClaudeEventType.ERROR).toBe('error');
    });

    it('PermissionMode가 올바르게 export 됨', () => {
      expect(PermissionMode.DEFAULT).toBe('default');
      expect(PermissionMode.ACCEPT_EDITS).toBe('acceptEdits');
      expect(PermissionMode.BYPASS).toBe('bypassPermissions');
    });

    it('BlobConfig가 올바르게 export 됨', () => {
      expect(BlobConfig.CHUNK_SIZE).toBe(65536); // 64KB
      expect(BlobConfig.ENCODING).toBe('base64');
    });

    it('Characters가 올바르게 export 됨', () => {
      const device1 = Characters['1'];
      expect(device1.name).toBe('Device 1');
      expect(device1.description).toBeDefined();

      const estelle = Characters.estelle;
      expect(estelle.name).toBe('Estelle');
      expect(estelle.description).toBe('Relay');
    });
  });

  describe('메시지 생성 (createMessage)', () => {
    it('기본 메시지를 생성할 수 있음', () => {
      const msg = createMessage(MessageType.PING, null);

      expect(msg.type).toBe('ping');
      expect(msg.payload).toBeNull();
      expect(msg.timestamp).toBeTypeOf('number');
      expect(msg.from).toBeNull();
      expect(msg.to).toBeNull();
      expect(msg.requestId).toBeNull();
    });

    it('페이로드와 함께 메시지를 생성할 수 있음', () => {
      const payload: AuthPayload = {
        pcId: 'test-pc',
        deviceType: 'pylon',
      };
      const msg = createMessage(MessageType.AUTH, payload);

      expect(msg.type).toBe('auth');
      expect(msg.payload).toEqual(payload);
      expect(msg.payload.pcId).toBe('test-pc');
      expect(msg.payload.deviceType).toBe('pylon');
    });

    it('라우팅 정보와 함께 메시지를 생성할 수 있음', () => {
      const from: DeviceId = { pcId: 'sender', deviceType: 'mobile' };
      const to: DeviceId = { pcId: 'receiver', deviceType: 'pylon' };

      const msg = createMessage(
        MessageType.CLAUDE_SEND,
        { conversationId: 'desk1', message: 'Hello' },
        { from, to, requestId: 'req-123' }
      );

      expect(msg.from).toEqual(from);
      expect(msg.to).toEqual(to);
      expect(msg.requestId).toBe('req-123');
    });
  });

  describe('타입 가드 (Type Guards)', () => {
    it('isMessage가 유효한 메시지를 인식함', () => {
      const msg = createMessage(MessageType.PING, null);
      expect(isMessage(msg)).toBe(true);
    });

    it('isMessage가 잘못된 메시지를 거부함', () => {
      expect(isMessage(null)).toBe(false);
      expect(isMessage({})).toBe(false);
      expect(isMessage({ type: 123 })).toBe(false);
    });

    it('isAuthMessage가 올바르게 동작함', () => {
      const authMsg = createMessage<AuthPayload>(MessageType.AUTH, {
        pcId: 'test-pc',
        deviceType: 'pylon',
      });
      const pingMsg = createMessage(MessageType.PING, null);

      expect(isAuthMessage(authMsg)).toBe(true);
      expect(isAuthMessage(pingMsg)).toBe(false);
    });

    it('isAuthResultMessage가 올바르게 동작함', () => {
      const resultMsg = createMessage<AuthResultPayload>(
        MessageType.AUTH_RESULT,
        {
          success: true,
          assignedCharacter: 1,
          connectedDevices: [],
        }
      );

      expect(isAuthResultMessage(resultMsg)).toBe(true);
    });

    it('isClaudeEventMessage가 올바르게 동작함', () => {
      const eventMsg = createMessage<ClaudeEventPayload>(
        MessageType.CLAUDE_EVENT,
        {
          conversationId: 'desk1',
          event: {
            type: 'text',
            content: 'Hello',
          },
        }
      );

      expect(isClaudeEventMessage(eventMsg)).toBe(true);
    });

    it('isClaudeSendMessage가 올바르게 동작함', () => {
      const sendMsg = createMessage<ClaudeSendPayload>(MessageType.CLAUDE_SEND, {
        conversationId: 'desk1',
        message: 'Hello Claude',
      });

      expect(isClaudeSendMessage(sendMsg)).toBe(true);
    });

    it('Blob 메시지 타입 가드가 올바르게 동작함', () => {
      const startMsg = createMessage<BlobStartPayload>(MessageType.BLOB_START, {
        blobId: 'blob-001',
        fileName: 'test.png',
        fileSize: 1024,
        totalChunks: 1,
        mimeType: 'image/png',
        encoding: 'base64',
      });
      const chunkMsg = createMessage<BlobChunkPayload>(MessageType.BLOB_CHUNK, {
        blobId: 'blob-001',
        chunkIndex: 0,
        data: 'base64data',
      });
      const endMsg = createMessage<BlobEndPayload>(MessageType.BLOB_END, {
        blobId: 'blob-001',
        checksum: 'sha256hash',
      });

      expect(isBlobStartMessage(startMsg)).toBe(true);
      expect(isBlobChunkMessage(chunkMsg)).toBe(true);
      expect(isBlobEndMessage(endMsg)).toBe(true);
    });

    it('Ping/Pong/Error 타입 가드가 올바르게 동작함', () => {
      const pingMsg = createMessage(MessageType.PING, null);
      const pongMsg = createMessage(MessageType.PONG, null);
      const errorMsg = createMessage<ErrorPayload>(MessageType.ERROR, {
        code: 'ERR_001',
        message: 'Something went wrong',
      });

      expect(isPingMessage(pingMsg)).toBe(true);
      expect(isPongMessage(pongMsg)).toBe(true);
      expect(isErrorMessage(errorMsg)).toBe(true);
    });

    it('getMessageType이 올바르게 동작함', () => {
      const msg = createMessage(MessageType.AUTH, null);
      expect(getMessageType(msg)).toBe('auth');
    });
  });

  describe('캐릭터 헬퍼 (Character Helpers)', () => {
    it('getCharacter로 캐릭터 정보를 가져올 수 있음', () => {
      const device1 = getCharacter('1');
      expect(device1.name).toBe('Device 1');

      const device2 = getCharacter('2');
      expect(device2.name).toBe('Device 2');

      const estelle = getCharacter('estelle');
      expect(estelle.name).toBe('Estelle');
    });

    it('숫자 ID로도 캐릭터를 가져올 수 있음', () => {
      const device1 = getCharacter(1);
      expect(device1.name).toBe('Device 1');

      const device2 = getCharacter(2);
      expect(device2.name).toBe('Device 2');
    });

    it('존재하지 않는 캐릭터는 기본 캐릭터를 반환함', () => {
      const unknown = getCharacter('unknown-pc');
      expect(unknown.name).toBe('unknown-pc');
      expect(unknown.description).toBe('Unknown PC');
    });

    it('getDeskFullName이 올바르게 동작함', () => {
      const fullName = getDeskFullName('1', 'workspace');
      expect(fullName).toBe('Device 1/workspace');
    });

    it('getDeskFullName이 알 수 없는 캐릭터도 처리함', () => {
      const fullName = getDeskFullName('my-pc', 'main');
      expect(fullName).toBe('my-pc/main');
    });

    it('DEFAULT_CHARACTER가 존재함', () => {
      expect(DEFAULT_CHARACTER).toBeDefined();
      expect(DEFAULT_CHARACTER.description).toBe('Unknown PC');
    });
  });

  describe('레거시 타입 호환성 (Backward Compatibility)', () => {
    it('레거시 PromptMessage 타입이 export 됨', () => {
      const msg: PromptMessage = {
        type: 'prompt',
        conversationId: 'conv1',
        content: 'Hello',
      };
      expect(isPromptMessage(msg)).toBe(true);
    });

    it('레거시 ClaudeMessage 타입이 export 됨', () => {
      const msg: ClaudeMessage = {
        type: 'claude_message',
        conversationId: 'conv1',
        role: 'assistant',
        content: 'Hi there!',
      };
      expect(isClaudeMessage(msg)).toBe(true);
    });

    it('레거시 StreamChunk 타입이 export 됨', () => {
      const msg: StreamChunk = {
        type: 'stream_chunk',
        conversationId: 'conv1',
        content: 'chunk',
      };
      expect(isStreamChunk(msg)).toBe(true);
    });

    it('LegacyMessage 유니온 타입이 export 됨', () => {
      const promptMsg: LegacyMessage = {
        type: 'prompt',
        conversationId: 'conv1',
        content: 'Hello',
      };
      const claudeMsg: LegacyMessage = {
        type: 'claude_message',
        conversationId: 'conv1',
        role: 'assistant',
        content: 'Hi!',
      };

      expect(isPromptMessage(promptMsg)).toBe(true);
      expect(isClaudeMessage(claudeMsg)).toBe(true);
    });

    it('BaseMessage와 Routable 인터페이스가 export 됨', () => {
      const base: BaseMessage = { type: 'test' };
      const routable: Routable = { to: 1, broadcast: true, from: 2 };

      expect(base.type).toBe('test');
      expect(routable.to).toBe(1);
      expect(routable.broadcast).toBe(true);
    });
  });

  describe('상수와 타입의 일관성', () => {
    it('MessageType 값이 타입 가드에서 사용하는 문자열과 일치함', () => {
      // Auth
      const authMsg = createMessage(MessageType.AUTH, { pcId: 'pc', deviceType: 'pylon' });
      expect(authMsg.type).toBe(MessageType.AUTH);
      expect(isAuthMessage(authMsg)).toBe(true);

      // Claude Event
      const claudeEventMsg = createMessage(MessageType.CLAUDE_EVENT, {
        conversationId: 'desk',
        event: {
          type: 'text',
          content: 'test',
        },
      });
      expect(claudeEventMsg.type).toBe(MessageType.CLAUDE_EVENT);
      expect(isClaudeEventMessage(claudeEventMsg)).toBe(true);

      // Blob
      const blobStartMsg = createMessage(MessageType.BLOB_START, {
        blobId: 'blob',
        fileName: 'file.txt',
        fileSize: 100,
        totalChunks: 1,
        mimeType: 'text/plain',
        encoding: 'base64',
      });
      expect(blobStartMsg.type).toBe(MessageType.BLOB_START);
      expect(isBlobStartMessage(blobStartMsg)).toBe(true);
    });

    it('ConversationStatus 값이 Conversation에서 올바르게 사용됨', () => {
      const conversation: Conversation = {
        conversationId: 'conv1',
        name: 'Test',
        claudeSessionId: null,
        status: ConversationStatus.WORKING,
        unread: false,
        permissionMode: 'default',
        createdAt: Date.now(),
      };

      expect(conversation.status).toBe(ConversationStatus.WORKING);
      expect(conversation.status).toBe('working');
    });

    it('ClaudeEventType 값이 ClaudeEventPayload에서 올바르게 사용됨', () => {
      const payload: ClaudeEventPayload = {
        conversationId: 'desk1',
        event: {
          type: 'tool_start',
          toolName: 'bash',
          toolInput: { command: 'ls' },
        },
      };

      expect(payload.event.type).toBe(ClaudeEventType.TOOL_START);
      expect(payload.event.type).toBe('tool_start');
    });

    it('PermissionMode 값이 문자열 리터럴과 일치함', () => {
      const mode1: PermissionModeValue = PermissionMode.DEFAULT;
      const mode2: PermissionModeValue = PermissionMode.ACCEPT_EDITS;
      const mode3: PermissionModeValue = PermissionMode.BYPASS;

      expect(mode1).toBe('default');
      expect(mode2).toBe('acceptEdits');
      expect(mode3).toBe('bypassPermissions');
    });
  });

  describe('타입 안전성 확인', () => {
    it('Message<T>의 제네릭이 올바르게 동작함', () => {
      // AuthPayload로 타입 지정
      const authMsg: Message<AuthPayload> = createMessage(MessageType.AUTH, {
        pcId: 'test',
        deviceType: 'pylon',
      });

      // 컴파일 타임에 타입 체크됨
      expect(authMsg.payload.pcId).toBe('test');
      expect(authMsg.payload.deviceType).toBe('pylon');
    });

    it('DeviceId 타입이 올바르게 동작함', () => {
      const device: DeviceId = {
        pcId: 'my-pc',
        deviceType: 'mobile',
      };

      expect(device.pcId).toBe('my-pc');
      expect(device.deviceType).toBe('mobile');
    });

    it('MessageTypeValue 유니온 타입이 모든 타입을 포함함', () => {
      const types: MessageTypeValue[] = [
        MessageType.AUTH,
        MessageType.AUTH_RESULT,
        MessageType.PING,
        MessageType.PONG,
        MessageType.ERROR,
        MessageType.CLAUDE_SEND,
        MessageType.CLAUDE_EVENT,
        MessageType.BLOB_START,
        MessageType.BLOB_CHUNK,
        MessageType.BLOB_END,
        MessageType.WORKSPACE_LIST_RESULT,
      ];

      expect(types).toHaveLength(11);
      types.forEach((type) => {
        expect(typeof type).toBe('string');
      });
    });
  });
});
