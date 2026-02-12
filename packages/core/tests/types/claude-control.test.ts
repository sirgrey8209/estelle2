/**
 * @file claude-control.test.ts
 * @description Claude 제어 관련 Payload 타입 테스트
 */

import { describe, it, expect } from 'vitest';
import type {
  ClaudeSendPayload,
  ClaudePermissionPayload,
  ClaudeAnswerPayload,
  ClaudeControlPayload,
  PermissionModeType,
  SetPermissionModePayload,
  PermissionDecision,
  ClaudeControlAction,
} from '../../src/types/claude-control.js';
import {
  isClaudeSendPayload,
  isClaudePermissionPayload,
  isClaudeAnswerPayload,
  isClaudeControlPayload,
  isPermissionModeType,
  isSetPermissionModePayload,
  isPermissionDecision,
  isClaudeControlAction,
} from '../../src/types/claude-control.js';
import {
  encodePylonId,
  encodeWorkspaceId,
  encodeConversationId,
} from '../../src/utils/id-system.js';

/** 테스트용 ConversationId 생성 헬퍼 */
function createTestConversationId(
  envId: 0 | 1 | 2,
  deviceIndex: number,
  workspaceIndex: number,
  conversationIndex: number
) {
  const pylonId = encodePylonId(envId, deviceIndex);
  const workspaceId = encodeWorkspaceId(pylonId, workspaceIndex);
  return encodeConversationId(workspaceId, conversationIndex);
}

/** 테스트용 ConversationId (envId:0, deviceIndex:1, workspaceIndex:1, conversationIndex:1) */
const TEST_CONVERSATION_ID = createTestConversationId(0, 1, 1, 1);

describe('ClaudeSendPayload', () => {
  it('should have conversationId and message as required properties', () => {
    const payload: ClaudeSendPayload = {
      conversationId: TEST_CONVERSATION_ID,
      message: 'Hello, Claude!',
    };

    expect(payload.conversationId).toBe(TEST_CONVERSATION_ID);
    expect(payload.message).toBe('Hello, Claude!');
  });

  it('should support unicode in message', () => {
    const payload: ClaudeSendPayload = {
      conversationId: TEST_CONVERSATION_ID,
      message: '안녕하세요! 한글 메시지입니다.',
    };

    expect(payload.message).toBe('안녕하세요! 한글 메시지입니다.');
  });

  it('should support multiline message', () => {
    const multilineMessage = `Line 1
Line 2
Line 3`;

    const payload: ClaudeSendPayload = {
      conversationId: TEST_CONVERSATION_ID,
      message: multilineMessage,
    };

    expect(payload.message).toContain('\n');
  });

  it('should support empty message', () => {
    const payload: ClaudeSendPayload = {
      conversationId: TEST_CONVERSATION_ID,
      message: '',
    };

    expect(payload.message).toBe('');
  });

  it('should support optional attachments property', () => {
    const payloadWithAttachments: ClaudeSendPayload = {
      conversationId: TEST_CONVERSATION_ID,
      message: 'Check this file',
      attachments: [{
        id: 'att-001',
        filename: 'file.txt',
        mimeType: 'text/plain',
        size: 100,
      }],
    };

    expect(payloadWithAttachments.attachments).toHaveLength(1);

    const payloadWithoutAttachments: ClaudeSendPayload = {
      conversationId: TEST_CONVERSATION_ID,
      message: 'No attachments',
    };

    expect(payloadWithoutAttachments.attachments).toBeUndefined();
  });
});

describe('PermissionDecision', () => {
  it('should accept "allow" value', () => {
    const decision: PermissionDecision = 'allow';
    expect(decision).toBe('allow');
  });

  it('should accept "deny" value', () => {
    const decision: PermissionDecision = 'deny';
    expect(decision).toBe('deny');
  });

  it('should accept "allowAll" value', () => {
    const decision: PermissionDecision = 'allowAll';
    expect(decision).toBe('allowAll');
  });
});

describe('ClaudePermissionPayload', () => {
  it('should have all required properties', () => {
    const payload: ClaudePermissionPayload = {
      conversationId: TEST_CONVERSATION_ID,
      toolUseId: 'toolu_12345',
      decision: 'allow',
    };

    expect(payload.conversationId).toBe(TEST_CONVERSATION_ID);
    expect(payload.toolUseId).toBe('toolu_12345');
    expect(payload.decision).toBe('allow');
  });

  it('should accept all valid decision values', () => {
    const decisions: PermissionDecision[] = ['allow', 'deny', 'allowAll'];

    decisions.forEach((decision) => {
      const payload: ClaudePermissionPayload = {
        conversationId: TEST_CONVERSATION_ID,
        toolUseId: 'toolu_12345',
        decision,
      };
      expect(payload.decision).toBe(decision);
    });
  });

  it('should work with various toolUseId formats', () => {
    const toolUseIds = [
      'toolu_01234567890abcdef',
      'toolu_abc123',
      'tool-use-id-format',
    ];

    toolUseIds.forEach((toolUseId) => {
      const payload: ClaudePermissionPayload = {
        conversationId: TEST_CONVERSATION_ID,
        toolUseId,
        decision: 'allow',
      };
      expect(payload.toolUseId).toBe(toolUseId);
    });
  });
});

describe('ClaudeAnswerPayload', () => {
  it('should have all required properties', () => {
    const payload: ClaudeAnswerPayload = {
      conversationId: TEST_CONVERSATION_ID,
      toolUseId: 'toolu_12345',
      answer: 'Option A',
    };

    expect(payload.conversationId).toBe(TEST_CONVERSATION_ID);
    expect(payload.toolUseId).toBe('toolu_12345');
    expect(payload.answer).toBe('Option A');
  });

  it('should support unicode in answer', () => {
    const payload: ClaudeAnswerPayload = {
      conversationId: TEST_CONVERSATION_ID,
      toolUseId: 'toolu_12345',
      answer: '옵션 A를 선택합니다.',
    };

    expect(payload.answer).toBe('옵션 A를 선택합니다.');
  });

  it('should support empty answer', () => {
    const payload: ClaudeAnswerPayload = {
      conversationId: TEST_CONVERSATION_ID,
      toolUseId: 'toolu_12345',
      answer: '',
    };

    expect(payload.answer).toBe('');
  });

  it('should support multiline answer', () => {
    const multilineAnswer = `First line
Second line
Third line`;

    const payload: ClaudeAnswerPayload = {
      conversationId: TEST_CONVERSATION_ID,
      toolUseId: 'toolu_12345',
      answer: multilineAnswer,
    };

    expect(payload.answer).toContain('\n');
  });
});

describe('ClaudeControlAction', () => {
  it('should accept "stop" value', () => {
    const action: ClaudeControlAction = 'stop';
    expect(action).toBe('stop');
  });

  it('should accept "new_session" value', () => {
    const action: ClaudeControlAction = 'new_session';
    expect(action).toBe('new_session');
  });

  it('should accept "clear" value', () => {
    const action: ClaudeControlAction = 'clear';
    expect(action).toBe('clear');
  });

  it('should accept "compact" value', () => {
    const action: ClaudeControlAction = 'compact';
    expect(action).toBe('compact');
  });
});

describe('ClaudeControlPayload', () => {
  it('should have conversationId and action as required properties', () => {
    const payload: ClaudeControlPayload = {
      conversationId: TEST_CONVERSATION_ID,
      action: 'stop',
    };

    expect(payload.conversationId).toBe(TEST_CONVERSATION_ID);
    expect(payload.action).toBe('stop');
  });

  it('should accept all valid action values', () => {
    const actions: ClaudeControlAction[] = ['stop', 'new_session', 'clear', 'compact'];

    actions.forEach((action) => {
      const payload: ClaudeControlPayload = {
        conversationId: TEST_CONVERSATION_ID,
        action,
      };
      expect(payload.action).toBe(action);
    });
  });
});

describe('PermissionModeType', () => {
  it('should accept "default" value', () => {
    const mode: PermissionModeType = 'default';
    expect(mode).toBe('default');
  });

  it('should accept "acceptEdits" value', () => {
    const mode: PermissionModeType = 'acceptEdits';
    expect(mode).toBe('acceptEdits');
  });

  it('should accept "bypassPermissions" value', () => {
    const mode: PermissionModeType = 'bypassPermissions';
    expect(mode).toBe('bypassPermissions');
  });
});

describe('SetPermissionModePayload', () => {
  it('should have mode as required property', () => {
    const payload: SetPermissionModePayload = {
      mode: 'default',
    };

    expect(payload.mode).toBe('default');
  });

  it('should accept all valid mode values', () => {
    const modes: PermissionModeType[] = ['default', 'acceptEdits', 'bypassPermissions'];

    modes.forEach((mode) => {
      const payload: SetPermissionModePayload = {
        mode,
      };
      expect(payload.mode).toBe(mode);
    });
  });
});

describe('Type Guards', () => {
  describe('isPermissionDecision', () => {
    it('should return true for valid decisions', () => {
      expect(isPermissionDecision('allow')).toBe(true);
      expect(isPermissionDecision('deny')).toBe(true);
      expect(isPermissionDecision('allowAll')).toBe(true);
    });

    it('should return false for invalid decisions', () => {
      expect(isPermissionDecision('invalid')).toBe(false);
      expect(isPermissionDecision('')).toBe(false);
      expect(isPermissionDecision(null)).toBe(false);
      expect(isPermissionDecision(undefined)).toBe(false);
      expect(isPermissionDecision(123)).toBe(false);
    });
  });

  describe('isClaudeControlAction', () => {
    it('should return true for valid actions', () => {
      expect(isClaudeControlAction('stop')).toBe(true);
      expect(isClaudeControlAction('new_session')).toBe(true);
      expect(isClaudeControlAction('clear')).toBe(true);
      expect(isClaudeControlAction('compact')).toBe(true);
    });

    it('should return false for invalid actions', () => {
      expect(isClaudeControlAction('invalid')).toBe(false);
      expect(isClaudeControlAction('')).toBe(false);
      expect(isClaudeControlAction(null)).toBe(false);
      expect(isClaudeControlAction(undefined)).toBe(false);
    });
  });

  describe('isPermissionModeType', () => {
    it('should return true for valid modes', () => {
      expect(isPermissionModeType('default')).toBe(true);
      expect(isPermissionModeType('acceptEdits')).toBe(true);
      expect(isPermissionModeType('bypassPermissions')).toBe(true);
    });

    it('should return false for invalid modes', () => {
      expect(isPermissionModeType('invalid')).toBe(false);
      expect(isPermissionModeType('')).toBe(false);
      expect(isPermissionModeType(null)).toBe(false);
      expect(isPermissionModeType(undefined)).toBe(false);
    });
  });

  describe('isClaudeSendPayload', () => {
    it('should return true for valid payloads', () => {
      const payload = { conversationId: TEST_CONVERSATION_ID, message: 'Hello' };
      expect(isClaudeSendPayload(payload)).toBe(true);
    });

    it('should return true for payloads with attachments', () => {
      const payload = {
        conversationId: TEST_CONVERSATION_ID,
        message: 'Hello',
        attachments: [{
          id: 'att-001',
          filename: 'file.txt',
          mimeType: 'text/plain',
          size: 100,
        }],
      };
      expect(isClaudeSendPayload(payload)).toBe(true);
    });

    it('should return false for invalid payloads', () => {
      expect(isClaudeSendPayload(null)).toBe(false);
      expect(isClaudeSendPayload(undefined)).toBe(false);
      expect(isClaudeSendPayload({})).toBe(false);
      expect(isClaudeSendPayload({ conversationId: TEST_CONVERSATION_ID })).toBe(false); // missing message
      expect(isClaudeSendPayload({ message: 'Hello' })).toBe(false); // missing conversationId
      expect(isClaudeSendPayload({ conversationId: 'not-a-number', message: 'Hello' })).toBe(false); // wrong type
    });
  });

  describe('isClaudePermissionPayload', () => {
    it('should return true for valid payloads', () => {
      const payload = {
        conversationId: TEST_CONVERSATION_ID,
        toolUseId: 'toolu_12345',
        decision: 'allow',
      };
      expect(isClaudePermissionPayload(payload)).toBe(true);
    });

    it('should return false for invalid payloads', () => {
      expect(isClaudePermissionPayload(null)).toBe(false);
      expect(isClaudePermissionPayload({})).toBe(false);
      expect(isClaudePermissionPayload({
        conversationId: TEST_CONVERSATION_ID,
        toolUseId: 'toolu_12345',
        decision: 'invalid',
      })).toBe(false);
      expect(isClaudePermissionPayload({
        conversationId: TEST_CONVERSATION_ID,
        toolUseId: 'toolu_12345',
        // missing decision
      })).toBe(false);
    });
  });

  describe('isClaudeAnswerPayload', () => {
    it('should return true for valid payloads', () => {
      const payload = {
        conversationId: TEST_CONVERSATION_ID,
        toolUseId: 'toolu_12345',
        answer: 'Option A',
      };
      expect(isClaudeAnswerPayload(payload)).toBe(true);
    });

    it('should return true for empty answer', () => {
      const payload = {
        conversationId: TEST_CONVERSATION_ID,
        toolUseId: 'toolu_12345',
        answer: '',
      };
      expect(isClaudeAnswerPayload(payload)).toBe(true);
    });

    it('should return false for invalid payloads', () => {
      expect(isClaudeAnswerPayload(null)).toBe(false);
      expect(isClaudeAnswerPayload({})).toBe(false);
      expect(isClaudeAnswerPayload({
        conversationId: TEST_CONVERSATION_ID,
        toolUseId: 'toolu_12345',
        // missing answer
      })).toBe(false);
    });
  });

  describe('isClaudeControlPayload', () => {
    it('should return true for valid payloads', () => {
      const payload = {
        conversationId: TEST_CONVERSATION_ID,
        action: 'stop',
      };
      expect(isClaudeControlPayload(payload)).toBe(true);
    });

    it('should return true for all valid actions', () => {
      const actions = ['stop', 'new_session', 'clear', 'compact'];
      actions.forEach((action) => {
        const payload = { conversationId: TEST_CONVERSATION_ID, action };
        expect(isClaudeControlPayload(payload)).toBe(true);
      });
    });

    it('should return false for invalid payloads', () => {
      expect(isClaudeControlPayload(null)).toBe(false);
      expect(isClaudeControlPayload({})).toBe(false);
      expect(isClaudeControlPayload({
        conversationId: TEST_CONVERSATION_ID,
        action: 'invalid',
      })).toBe(false);
    });
  });

  describe('isSetPermissionModePayload', () => {
    it('should return true for valid payloads', () => {
      const payload = { mode: 'default' };
      expect(isSetPermissionModePayload(payload)).toBe(true);
    });

    it('should return true for all valid modes', () => {
      const modes = ['default', 'acceptEdits', 'bypassPermissions'];
      modes.forEach((mode) => {
        const payload = { mode };
        expect(isSetPermissionModePayload(payload)).toBe(true);
      });
    });

    it('should return false for invalid payloads', () => {
      expect(isSetPermissionModePayload(null)).toBe(false);
      expect(isSetPermissionModePayload({})).toBe(false);
      expect(isSetPermissionModePayload({ mode: 'invalid' })).toBe(false);
    });
  });
});
