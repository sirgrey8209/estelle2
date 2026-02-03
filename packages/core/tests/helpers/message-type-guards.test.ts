/**
 * @file message-type-guards.test.ts
 * @description 메시지 타입 가드 함수 테스트
 */

import { describe, it, expect } from 'vitest';
import { MessageType } from '../../src/constants/index.js';
import {
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
  isMessage,
  getMessageType,
} from '../../src/helpers/message-type-guards.js';

// 테스트용 메시지 생성 헬퍼
function makeMessage<T>(type: string, payload: T) {
  return {
    type,
    payload,
    timestamp: Date.now(),
    from: null,
    to: null,
    requestId: null,
  };
}

describe('isMessage', () => {
  it('should 유효한 메시지 구조에 대해 true를 반환해야 한다', () => {
    const msg = makeMessage('test', {});
    expect(isMessage(msg)).toBe(true);
  });

  it('should null에 대해 false를 반환해야 한다', () => {
    expect(isMessage(null)).toBe(false);
  });

  it('should undefined에 대해 false를 반환해야 한다', () => {
    expect(isMessage(undefined)).toBe(false);
  });

  it('should type이 없는 객체에 대해 false를 반환해야 한다', () => {
    expect(isMessage({ payload: {}, timestamp: Date.now() })).toBe(false);
  });

  it('should timestamp가 없는 객체에 대해 false를 반환해야 한다', () => {
    expect(isMessage({ type: 'test', payload: {} })).toBe(false);
  });

  it('should type이 문자열이 아닌 객체에 대해 false를 반환해야 한다', () => {
    expect(isMessage({ type: 123, payload: {}, timestamp: Date.now() })).toBe(false);
  });
});

describe('getMessageType', () => {
  it('should 메시지의 type을 반환해야 한다', () => {
    const msg = makeMessage('auth', {});
    expect(getMessageType(msg)).toBe('auth');
  });

  it('should 유효하지 않은 메시지에 대해 null을 반환해야 한다', () => {
    expect(getMessageType(null)).toBeNull();
    expect(getMessageType(undefined)).toBeNull();
    expect(getMessageType({})).toBeNull();
  });
});

describe('isAuthMessage', () => {
  it('should auth 타입 메시지에 대해 true를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.AUTH, {
      pcId: 'pc1',
      deviceType: 'pylon',
    });
    expect(isAuthMessage(msg)).toBe(true);
  });

  it('should 다른 타입 메시지에 대해 false를 반환해야 한다', () => {
    const msg = makeMessage('ping', null);
    expect(isAuthMessage(msg)).toBe(false);
  });

  it('should 유효하지 않은 값에 대해 false를 반환해야 한다', () => {
    expect(isAuthMessage(null)).toBe(false);
    expect(isAuthMessage({})).toBe(false);
  });
});

describe('isAuthResultMessage', () => {
  it('should auth_result 타입 메시지에 대해 true를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.AUTH_RESULT, {
      success: true,
      deviceId: { pcId: 'pc1', deviceType: 'pylon' },
    });
    expect(isAuthResultMessage(msg)).toBe(true);
  });

  it('should 다른 타입 메시지에 대해 false를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.AUTH, {});
    expect(isAuthResultMessage(msg)).toBe(false);
  });
});

describe('isWorkspaceListResultMessage', () => {
  it('should workspace_list_result 타입 메시지에 대해 true를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.WORKSPACE_LIST_RESULT, {
      workspaces: [],
    });
    expect(isWorkspaceListResultMessage(msg)).toBe(true);
  });

  it('should 다른 타입 메시지에 대해 false를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.WORKSPACE_LIST, {});
    expect(isWorkspaceListResultMessage(msg)).toBe(false);
  });
});

describe('isClaudeEventMessage', () => {
  it('should claude_event 타입 메시지에 대해 true를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.CLAUDE_EVENT, {
      conversationId: 'desk1',
      event: { type: 'text', content: 'hello' },
    });
    expect(isClaudeEventMessage(msg)).toBe(true);
  });

  it('should 다른 타입 메시지에 대해 false를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.CLAUDE_SEND, {});
    expect(isClaudeEventMessage(msg)).toBe(false);
  });
});

describe('isClaudeSendMessage', () => {
  it('should claude_send 타입 메시지에 대해 true를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.CLAUDE_SEND, {
      conversationId: 'desk1',
      message: 'hello',
    });
    expect(isClaudeSendMessage(msg)).toBe(true);
  });

  it('should 다른 타입 메시지에 대해 false를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.CLAUDE_EVENT, {});
    expect(isClaudeSendMessage(msg)).toBe(false);
  });
});

describe('isBlobStartMessage', () => {
  it('should blob_start 타입 메시지에 대해 true를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.BLOB_START, {
      blobId: 'blob1',
      filename: 'test.png',
      mimeType: 'image/png',
      totalSize: 1024,
      chunkSize: 256,
      totalChunks: 4,
      encoding: 'base64',
      context: { type: 'image_upload', conversationId: 'desk1' },
    });
    expect(isBlobStartMessage(msg)).toBe(true);
  });

  it('should 다른 타입 메시지에 대해 false를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.BLOB_CHUNK, {});
    expect(isBlobStartMessage(msg)).toBe(false);
  });
});

describe('isBlobChunkMessage', () => {
  it('should blob_chunk 타입 메시지에 대해 true를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.BLOB_CHUNK, {
      blobId: 'blob1',
      index: 0,
      data: 'base64data',
      size: 256,
    });
    expect(isBlobChunkMessage(msg)).toBe(true);
  });

  it('should 다른 타입 메시지에 대해 false를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.BLOB_END, {});
    expect(isBlobChunkMessage(msg)).toBe(false);
  });
});

describe('isBlobEndMessage', () => {
  it('should blob_end 타입 메시지에 대해 true를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.BLOB_END, {
      blobId: 'blob1',
      totalReceived: 1024,
    });
    expect(isBlobEndMessage(msg)).toBe(true);
  });

  it('should 다른 타입 메시지에 대해 false를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.BLOB_START, {});
    expect(isBlobEndMessage(msg)).toBe(false);
  });
});

describe('isPingMessage', () => {
  it('should ping 타입 메시지에 대해 true를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.PING, null);
    expect(isPingMessage(msg)).toBe(true);
  });

  it('should 다른 타입 메시지에 대해 false를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.PONG, null);
    expect(isPingMessage(msg)).toBe(false);
  });
});

describe('isPongMessage', () => {
  it('should pong 타입 메시지에 대해 true를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.PONG, null);
    expect(isPongMessage(msg)).toBe(true);
  });

  it('should 다른 타입 메시지에 대해 false를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.PING, null);
    expect(isPongMessage(msg)).toBe(false);
  });
});

describe('isErrorMessage', () => {
  it('should error 타입 메시지에 대해 true를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.ERROR, {
      code: 'ERR001',
      message: 'Something went wrong',
    });
    expect(isErrorMessage(msg)).toBe(true);
  });

  it('should 다른 타입 메시지에 대해 false를 반환해야 한다', () => {
    const msg = makeMessage(MessageType.PING, null);
    expect(isErrorMessage(msg)).toBe(false);
  });
});

describe('타입 가드 조합 테스트', () => {
  it('should 하나의 메시지는 정확히 하나의 타입 가드만 통과해야 한다', () => {
    const authMsg = makeMessage(MessageType.AUTH, { pcId: 'pc1', deviceType: 'pylon' });

    expect(isAuthMessage(authMsg)).toBe(true);
    expect(isAuthResultMessage(authMsg)).toBe(false);
    expect(isWorkspaceListResultMessage(authMsg)).toBe(false);
    expect(isClaudeEventMessage(authMsg)).toBe(false);
    expect(isClaudeSendMessage(authMsg)).toBe(false);
    expect(isBlobStartMessage(authMsg)).toBe(false);
    expect(isPingMessage(authMsg)).toBe(false);
    expect(isErrorMessage(authMsg)).toBe(false);
  });
});
