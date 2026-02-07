/**
 * @file claude-event.test.ts
 * @description Claude SDK 이벤트 관련 타입 테스트
 */

import { describe, it, expect } from 'vitest';
import type {
  ClaudeStateEvent,
  ClaudeTextEvent,
  ClaudeToolStartEvent,
  ClaudeToolCompleteEvent,
  ClaudePermissionRequestEvent,
  ClaudeAskQuestionEvent,
  ClaudeResultEvent,
  ClaudeErrorEvent,
  ClaudeEvent,
  ClaudeEventPayload,
} from '../../src/types/claude-event.js';
import {
  isClaudeStateEvent,
  isClaudeTextEvent,
  isClaudeToolStartEvent,
  isClaudeToolCompleteEvent,
  isClaudePermissionRequestEvent,
  isClaudeAskQuestionEvent,
  isClaudeResultEvent,
  isClaudeErrorEvent,
  isClaudeEvent,
} from '../../src/types/claude-event.js';
import { encodeEntityId } from '../../src/utils/entity-id.js';

/** 테스트용 EntityId */
const TEST_ENTITY_ID = encodeEntityId(1, 1, 1);
const TEST_ENTITY_ID_2 = encodeEntityId(1, 1, 2);
const TEST_ENTITY_ID_3 = encodeEntityId(1, 2, 1);

describe('ClaudeStateEvent', () => {
  it('should have type "state" and state property', () => {
    const event: ClaudeStateEvent = {
      type: 'state',
      state: 'idle',
    };

    expect(event.type).toBe('state');
    expect(event.state).toBe('idle');
  });

  it('should accept various state values', () => {
    const states = ['idle', 'working', 'waiting', 'done'];

    states.forEach((state) => {
      const event: ClaudeStateEvent = {
        type: 'state',
        state,
      };
      expect(event.state).toBe(state);
    });
  });
});

describe('ClaudeTextEvent', () => {
  it('should have type "text" and content property', () => {
    const event: ClaudeTextEvent = {
      type: 'text',
      content: 'Hello, World!',
    };

    expect(event.type).toBe('text');
    expect(event.content).toBe('Hello, World!');
  });

  it('should support unicode content', () => {
    const event: ClaudeTextEvent = {
      type: 'text',
      content: '안녕하세요! 한글 텍스트입니다.',
    };

    expect(event.content).toBe('안녕하세요! 한글 텍스트입니다.');
  });

  it('should support multiline content', () => {
    const multilineContent = `Line 1
Line 2
Line 3`;

    const event: ClaudeTextEvent = {
      type: 'text',
      content: multilineContent,
    };

    expect(event.content).toContain('\n');
  });

  it('should support empty content', () => {
    const event: ClaudeTextEvent = {
      type: 'text',
      content: '',
    };

    expect(event.content).toBe('');
  });
});

describe('ClaudeToolStartEvent', () => {
  it('should have type "tool_start", toolName and toolInput properties', () => {
    const event: ClaudeToolStartEvent = {
      type: 'tool_start',
      toolName: 'read_file',
      toolInput: { path: '/home/user/file.txt' },
    };

    expect(event.type).toBe('tool_start');
    expect(event.toolName).toBe('read_file');
    expect(event.toolInput).toEqual({ path: '/home/user/file.txt' });
  });

  it('should accept complex toolInput', () => {
    const event: ClaudeToolStartEvent = {
      type: 'tool_start',
      toolName: 'search',
      toolInput: {
        query: 'test',
        filters: {
          type: 'file',
          extension: '.ts',
        },
        limit: 10,
        recursive: true,
      },
    };

    expect(event.toolInput.query).toBe('test');
    expect(event.toolInput.filters.type).toBe('file');
    expect(event.toolInput.limit).toBe(10);
  });

  it('should accept empty toolInput', () => {
    const event: ClaudeToolStartEvent = {
      type: 'tool_start',
      toolName: 'get_status',
      toolInput: {},
    };

    expect(event.toolInput).toEqual({});
  });
});

describe('ClaudeToolCompleteEvent', () => {
  it('should have type "tool_complete", toolName and output properties', () => {
    const event: ClaudeToolCompleteEvent = {
      type: 'tool_complete',
      toolName: 'read_file',
      output: 'file content here',
    };

    expect(event.type).toBe('tool_complete');
    expect(event.toolName).toBe('read_file');
    expect(event.output).toBe('file content here');
  });

  it('should accept various output types', () => {
    // String output
    const stringEvent: ClaudeToolCompleteEvent = {
      type: 'tool_complete',
      toolName: 'tool1',
      output: 'string result',
    };
    expect(stringEvent.output).toBe('string result');

    // Object output
    const objectEvent: ClaudeToolCompleteEvent = {
      type: 'tool_complete',
      toolName: 'tool2',
      output: { success: true, data: [1, 2, 3] },
    };
    expect(objectEvent.output.success).toBe(true);

    // Array output
    const arrayEvent: ClaudeToolCompleteEvent = {
      type: 'tool_complete',
      toolName: 'tool3',
      output: ['item1', 'item2'],
    };
    expect(arrayEvent.output).toHaveLength(2);

    // Null output
    const nullEvent: ClaudeToolCompleteEvent = {
      type: 'tool_complete',
      toolName: 'tool4',
      output: null,
    };
    expect(nullEvent.output).toBeNull();

    // Number output
    const numberEvent: ClaudeToolCompleteEvent = {
      type: 'tool_complete',
      toolName: 'tool5',
      output: 42,
    };
    expect(numberEvent.output).toBe(42);
  });
});

describe('ClaudePermissionRequestEvent', () => {
  it('should have all required properties', () => {
    const event: ClaudePermissionRequestEvent = {
      type: 'permission_request',
      toolName: 'write_file',
      toolInput: { path: '/tmp/file.txt', content: 'hello' },
      toolUseId: 'toolu_12345',
    };

    expect(event.type).toBe('permission_request');
    expect(event.toolName).toBe('write_file');
    expect(event.toolInput.path).toBe('/tmp/file.txt');
    expect(event.toolUseId).toBe('toolu_12345');
  });

  it('should work with complex toolInput', () => {
    const event: ClaudePermissionRequestEvent = {
      type: 'permission_request',
      toolName: 'execute_command',
      toolInput: {
        command: 'npm install',
        args: ['--save-dev'],
        cwd: '/project',
      },
      toolUseId: 'toolu_67890',
    };

    expect(event.toolInput.command).toBe('npm install');
    expect(event.toolInput.args).toEqual(['--save-dev']);
  });
});

describe('ClaudeAskQuestionEvent', () => {
  it('should have all required properties', () => {
    const event: ClaudeAskQuestionEvent = {
      type: 'ask_question',
      question: 'Which option do you prefer?',
      options: ['Option A', 'Option B', 'Option C'],
      toolUseId: 'toolu_abc123',
    };

    expect(event.type).toBe('ask_question');
    expect(event.question).toBe('Which option do you prefer?');
    expect(event.options).toHaveLength(3);
    expect(event.toolUseId).toBe('toolu_abc123');
  });

  it('should support unicode in question and options', () => {
    const event: ClaudeAskQuestionEvent = {
      type: 'ask_question',
      question: '어떤 옵션을 선택하시겠습니까?',
      options: ['옵션 A', '옵션 B'],
      toolUseId: 'toolu_korean',
    };

    expect(event.question).toBe('어떤 옵션을 선택하시겠습니까?');
    expect(event.options[0]).toBe('옵션 A');
  });

  it('should support empty options array', () => {
    const event: ClaudeAskQuestionEvent = {
      type: 'ask_question',
      question: 'Please provide your input:',
      options: [],
      toolUseId: 'toolu_empty',
    };

    expect(event.options).toEqual([]);
  });
});

describe('ClaudeResultEvent', () => {
  it('should have type "result" and result property', () => {
    const event: ClaudeResultEvent = {
      type: 'result',
      result: 'Task completed successfully',
    };

    expect(event.type).toBe('result');
    expect(event.result).toBe('Task completed successfully');
  });

  it('should accept various result types', () => {
    // String result
    const stringEvent: ClaudeResultEvent = {
      type: 'result',
      result: 'done',
    };
    expect(stringEvent.result).toBe('done');

    // Object result
    const objectEvent: ClaudeResultEvent = {
      type: 'result',
      result: { status: 'success', files: 3 },
    };
    expect(objectEvent.result.status).toBe('success');

    // Null result
    const nullEvent: ClaudeResultEvent = {
      type: 'result',
      result: null,
    };
    expect(nullEvent.result).toBeNull();
  });
});

describe('ClaudeErrorEvent', () => {
  it('should have type "error" and error property', () => {
    const event: ClaudeErrorEvent = {
      type: 'error',
      error: 'Something went wrong',
    };

    expect(event.type).toBe('error');
    expect(event.error).toBe('Something went wrong');
  });

  it('should support detailed error messages', () => {
    const event: ClaudeErrorEvent = {
      type: 'error',
      error: 'Failed to read file: /path/to/file.txt - Permission denied',
    };

    expect(event.error).toContain('Permission denied');
  });

  it('should support unicode in error messages', () => {
    const event: ClaudeErrorEvent = {
      type: 'error',
      error: '파일을 찾을 수 없습니다.',
    };

    expect(event.error).toBe('파일을 찾을 수 없습니다.');
  });
});

describe('ClaudeEvent (Union Type)', () => {
  it('should accept all 8 event types', () => {
    const events: ClaudeEvent[] = [
      { type: 'state', state: 'idle' },
      { type: 'text', content: 'Hello' },
      { type: 'tool_start', toolName: 'test', toolInput: {} },
      { type: 'tool_complete', toolName: 'test', output: 'result' },
      {
        type: 'permission_request',
        toolName: 'write',
        toolInput: {},
        toolUseId: 'id1',
      },
      {
        type: 'ask_question',
        question: 'Question?',
        options: ['A', 'B'],
        toolUseId: 'id2',
      },
      { type: 'result', result: 'done' },
      { type: 'error', error: 'failed' },
    ];

    expect(events).toHaveLength(8);
  });

  it('should work with discriminated union type guard', () => {
    const event: ClaudeEvent = { type: 'text', content: 'Hello' };

    // TypeScript discriminated union pattern
    if (event.type === 'text') {
      expect(event.content).toBe('Hello');
    }
  });

  it('should support type narrowing with switch statement', () => {
    const processEvent = (event: ClaudeEvent): string => {
      switch (event.type) {
        case 'state':
          return `State: ${event.state}`;
        case 'text':
          return `Text: ${event.content}`;
        case 'tool_start':
          return `Tool Start: ${event.toolName}`;
        case 'tool_complete':
          return `Tool Complete: ${event.toolName}`;
        case 'permission_request':
          return `Permission: ${event.toolName}`;
        case 'ask_question':
          return `Question: ${event.question}`;
        case 'result':
          return `Result received`;
        case 'error':
          return `Error: ${event.error}`;
      }
    };

    expect(processEvent({ type: 'state', state: 'working' })).toBe('State: working');
    expect(processEvent({ type: 'text', content: 'hi' })).toBe('Text: hi');
    expect(processEvent({ type: 'error', error: 'oops' })).toBe('Error: oops');
  });
});

describe('ClaudeEventPayload', () => {
  it('should have entityId and event properties', () => {
    const payload: ClaudeEventPayload = {
      entityId: TEST_ENTITY_ID,
      event: { type: 'text', content: 'Hello from conversation' },
    };

    expect(payload.entityId).toBe(TEST_ENTITY_ID);
    expect(payload.event.type).toBe('text');
  });

  it('should work with all event types', () => {
    const textPayload: ClaudeEventPayload = {
      entityId: TEST_ENTITY_ID,
      event: { type: 'text', content: 'Hello' },
    };

    const errorPayload: ClaudeEventPayload = {
      entityId: TEST_ENTITY_ID_2,
      event: { type: 'error', error: 'Something failed' },
    };

    const permissionPayload: ClaudeEventPayload = {
      entityId: TEST_ENTITY_ID_3,
      event: {
        type: 'permission_request',
        toolName: 'bash',
        toolInput: { command: 'rm -rf /' },
        toolUseId: 'toolu_dangerous',
      },
    };

    expect(textPayload.event.type).toBe('text');
    expect(errorPayload.event.type).toBe('error');
    expect(permissionPayload.event.type).toBe('permission_request');
  });

  it('should support optional legacy conversationId', () => {
    const payload: ClaudeEventPayload = {
      entityId: TEST_ENTITY_ID,
      conversationId: '대화-001',
      event: { type: 'state', state: 'idle' },
    };

    expect(payload.conversationId).toBe('대화-001');
    expect(payload.entityId).toBe(TEST_ENTITY_ID);
  });
});

describe('Type Guards', () => {
  describe('isClaudeStateEvent', () => {
    it('should return true for state events', () => {
      const event = { type: 'state', state: 'idle' };
      expect(isClaudeStateEvent(event)).toBe(true);
    });

    it('should return false for other events', () => {
      expect(isClaudeStateEvent({ type: 'text', content: 'hi' })).toBe(false);
      expect(isClaudeStateEvent({ type: 'error', error: 'err' })).toBe(false);
      expect(isClaudeStateEvent(null)).toBe(false);
      expect(isClaudeStateEvent(undefined)).toBe(false);
      expect(isClaudeStateEvent({ type: 'state' })).toBe(false); // missing state property
    });
  });

  describe('isClaudeTextEvent', () => {
    it('should return true for text events', () => {
      const event = { type: 'text', content: 'Hello' };
      expect(isClaudeTextEvent(event)).toBe(true);
    });

    it('should return false for other events', () => {
      expect(isClaudeTextEvent({ type: 'state', state: 'idle' })).toBe(false);
      expect(isClaudeTextEvent({ type: 'text' })).toBe(false); // missing content
      expect(isClaudeTextEvent(null)).toBe(false);
    });
  });

  describe('isClaudeToolStartEvent', () => {
    it('should return true for tool_start events', () => {
      const event = { type: 'tool_start', toolName: 'read', toolInput: {} };
      expect(isClaudeToolStartEvent(event)).toBe(true);
    });

    it('should return false for invalid events', () => {
      expect(isClaudeToolStartEvent({ type: 'tool_start', toolName: 'read' })).toBe(false); // missing toolInput
      expect(isClaudeToolStartEvent({ type: 'tool_complete', toolName: 'read', output: '' })).toBe(false);
    });
  });

  describe('isClaudeToolCompleteEvent', () => {
    it('should return true for tool_complete events', () => {
      const event = { type: 'tool_complete', toolName: 'read', output: 'data' };
      expect(isClaudeToolCompleteEvent(event)).toBe(true);
    });

    it('should return true even with null output', () => {
      const event = { type: 'tool_complete', toolName: 'read', output: null };
      expect(isClaudeToolCompleteEvent(event)).toBe(true);
    });

    it('should return false for invalid events', () => {
      expect(isClaudeToolCompleteEvent({ type: 'tool_start', toolName: 'read', toolInput: {} })).toBe(false);
    });
  });

  describe('isClaudePermissionRequestEvent', () => {
    it('should return true for permission_request events', () => {
      const event = {
        type: 'permission_request',
        toolName: 'write',
        toolInput: {},
        toolUseId: 'id1',
      };
      expect(isClaudePermissionRequestEvent(event)).toBe(true);
    });

    it('should return false for incomplete events', () => {
      expect(
        isClaudePermissionRequestEvent({
          type: 'permission_request',
          toolName: 'write',
          toolInput: {},
          // missing toolUseId
        })
      ).toBe(false);
    });
  });

  describe('isClaudeAskQuestionEvent', () => {
    it('should return true for ask_question events', () => {
      const event = {
        type: 'ask_question',
        question: 'Q?',
        options: ['A', 'B'],
        toolUseId: 'id1',
      };
      expect(isClaudeAskQuestionEvent(event)).toBe(true);
    });

    it('should return false for invalid events', () => {
      expect(
        isClaudeAskQuestionEvent({
          type: 'ask_question',
          question: 'Q?',
          // missing options and toolUseId
        })
      ).toBe(false);
    });
  });

  describe('isClaudeResultEvent', () => {
    it('should return true for result events', () => {
      const event = { type: 'result', result: 'done' };
      expect(isClaudeResultEvent(event)).toBe(true);
    });

    it('should return true even with null result', () => {
      const event = { type: 'result', result: null };
      expect(isClaudeResultEvent(event)).toBe(true);
    });

    it('should return false for invalid events', () => {
      expect(isClaudeResultEvent({ type: 'result' })).toBe(false); // missing result
    });
  });

  describe('isClaudeErrorEvent', () => {
    it('should return true for error events', () => {
      const event = { type: 'error', error: 'something went wrong' };
      expect(isClaudeErrorEvent(event)).toBe(true);
    });

    it('should return false for invalid events', () => {
      expect(isClaudeErrorEvent({ type: 'error' })).toBe(false); // missing error
      expect(isClaudeErrorEvent({ type: 'text', content: 'error' })).toBe(false);
    });
  });

  describe('isClaudeEvent', () => {
    it('should return true for all valid event types', () => {
      expect(isClaudeEvent({ type: 'state', state: 'idle' })).toBe(true);
      expect(isClaudeEvent({ type: 'text', content: 'hi' })).toBe(true);
      expect(isClaudeEvent({ type: 'tool_start', toolName: 't', toolInput: {} })).toBe(true);
      expect(isClaudeEvent({ type: 'tool_complete', toolName: 't', output: null })).toBe(true);
      expect(
        isClaudeEvent({
          type: 'permission_request',
          toolName: 't',
          toolInput: {},
          toolUseId: 'id',
        })
      ).toBe(true);
      expect(
        isClaudeEvent({
          type: 'ask_question',
          question: 'q',
          options: [],
          toolUseId: 'id',
        })
      ).toBe(true);
      expect(isClaudeEvent({ type: 'result', result: null })).toBe(true);
      expect(isClaudeEvent({ type: 'error', error: 'err' })).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isClaudeEvent(null)).toBe(false);
      expect(isClaudeEvent(undefined)).toBe(false);
      expect(isClaudeEvent({})).toBe(false);
      expect(isClaudeEvent({ type: 'unknown' })).toBe(false);
      expect(isClaudeEvent('string')).toBe(false);
      expect(isClaudeEvent(123)).toBe(false);
    });
  });
});
