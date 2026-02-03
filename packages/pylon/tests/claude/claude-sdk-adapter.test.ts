/**
 * @file claude-sdk-adapter.test.ts
 * @description ClaudeSDKAdapter 테스트
 *
 * SDK 자체는 모킹하고 어댑터 로직만 테스트합니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ClaudeQueryOptions, ClaudeMessage } from '../../src/claude/claude-manager.js';

// SDK 모킹
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

import { query as mockQuery } from '@anthropic-ai/claude-agent-sdk';
import { ClaudeSDKAdapter } from '../../src/claude/claude-sdk-adapter.js';

describe('ClaudeSDKAdapter', () => {
  let adapter: ClaudeSDKAdapter;

  beforeEach(() => {
    adapter = new ClaudeSDKAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 모킹된 SDK 응답 생성
   */
  function createMockSDKResponse(messages: ClaudeMessage[]): AsyncIterable<ClaudeMessage> {
    return {
      async *[Symbol.asyncIterator]() {
        for (const msg of messages) {
          yield msg;
        }
      },
    };
  }

  // ============================================================================
  // 기본 동작 테스트
  // ============================================================================
  describe('기본 동작', () => {
    it('should create adapter instance', () => {
      expect(adapter).toBeInstanceOf(ClaudeSDKAdapter);
    });

    it('should call SDK query with correct options', async () => {
      const mockMessages: ClaudeMessage[] = [];
      vi.mocked(mockQuery).mockReturnValue(createMockSDKResponse(mockMessages));

      const options: ClaudeQueryOptions = {
        prompt: 'Hello',
        cwd: '/test/dir',
        abortController: new AbortController(),
        includePartialMessages: true,
        settingSources: ['project'],
      };

      // 메시지 수집
      const messages: ClaudeMessage[] = [];
      for await (const msg of adapter.query(options)) {
        messages.push(msg);
      }

      // SDK가 올바른 옵션으로 호출되었는지 확인
      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Hello',
        options: {
          cwd: '/test/dir',
          abortController: options.abortController,
          includePartialMessages: true,
          settingSources: ['project'],
          resume: undefined,
          mcpServers: undefined,
          canUseTool: undefined,
        },
      });
    });

    it('should use default values when options are not provided', async () => {
      const mockMessages: ClaudeMessage[] = [];
      vi.mocked(mockQuery).mockReturnValue(createMockSDKResponse(mockMessages));

      const options: ClaudeQueryOptions = {
        prompt: 'Hello',
        cwd: '/test/dir',
        abortController: new AbortController(),
        // includePartialMessages, settingSources 생략
      };

      for await (const _msg of adapter.query(options)) {
        // 메시지 소비
      }

      // 기본값 확인
      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Hello',
        options: expect.objectContaining({
          includePartialMessages: true,
          settingSources: ['project'],
        }),
      });
    });
  });

  // ============================================================================
  // 메시지 스트리밍 테스트
  // ============================================================================
  describe('메시지 스트리밍', () => {
    it('should yield all messages from SDK', async () => {
      const mockMessages: ClaudeMessage[] = [
        { type: 'system', subtype: 'init', session_id: 'sess-1', model: 'claude-3' },
        { type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }] } },
        { type: 'result', total_cost_usd: 0.001, num_turns: 1 },
      ];
      vi.mocked(mockQuery).mockReturnValue(createMockSDKResponse(mockMessages));

      const options: ClaudeQueryOptions = {
        prompt: 'Hello',
        cwd: '/test/dir',
        abortController: new AbortController(),
      };

      const messages: ClaudeMessage[] = [];
      for await (const msg of adapter.query(options)) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(3);
      expect(messages[0].type).toBe('system');
      expect(messages[1].type).toBe('assistant');
      expect(messages[2].type).toBe('result');
    });

    it('should pass through stream_event messages', async () => {
      const mockMessages: ClaudeMessage[] = [
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello' },
          },
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: ' World' },
          },
        },
      ];
      vi.mocked(mockQuery).mockReturnValue(createMockSDKResponse(mockMessages));

      const options: ClaudeQueryOptions = {
        prompt: 'Hello',
        cwd: '/test/dir',
        abortController: new AbortController(),
      };

      const messages: ClaudeMessage[] = [];
      for await (const msg of adapter.query(options)) {
        messages.push(msg);
      }

      expect(messages).toHaveLength(2);
      expect(messages[0].event?.delta?.text).toBe('Hello');
      expect(messages[1].event?.delta?.text).toBe(' World');
    });
  });

  // ============================================================================
  // 옵션 전달 테스트
  // ============================================================================
  describe('옵션 전달', () => {
    it('should pass resume option for session continuation', async () => {
      const mockMessages: ClaudeMessage[] = [];
      vi.mocked(mockQuery).mockReturnValue(createMockSDKResponse(mockMessages));

      const options: ClaudeQueryOptions = {
        prompt: 'Continue',
        cwd: '/test/dir',
        abortController: new AbortController(),
        resume: 'previous-session-id',
      };

      for await (const _msg of adapter.query(options)) {
        // 메시지 소비
      }

      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Continue',
        options: expect.objectContaining({
          resume: 'previous-session-id',
        }),
      });
    });

    it('should pass mcpServers option', async () => {
      const mockMessages: ClaudeMessage[] = [];
      vi.mocked(mockQuery).mockReturnValue(createMockSDKResponse(mockMessages));

      const mcpServers = {
        'my-server': { command: 'node', args: ['server.js'] },
      };

      const options: ClaudeQueryOptions = {
        prompt: 'Hello',
        cwd: '/test/dir',
        abortController: new AbortController(),
        mcpServers,
      };

      for await (const _msg of adapter.query(options)) {
        // 메시지 소비
      }

      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Hello',
        options: expect.objectContaining({
          mcpServers,
        }),
      });
    });

    it('should wrap and pass canUseTool callback', async () => {
      const mockMessages: ClaudeMessage[] = [];
      vi.mocked(mockQuery).mockReturnValue(createMockSDKResponse(mockMessages));

      const canUseTool = vi.fn().mockResolvedValue({ behavior: 'allow' });

      const options: ClaudeQueryOptions = {
        prompt: 'Hello',
        cwd: '/test/dir',
        abortController: new AbortController(),
        canUseTool,
      };

      for await (const _msg of adapter.query(options)) {
        // 메시지 소비
      }

      // canUseTool이 래핑되어 함수로 전달되는지 확인
      expect(mockQuery).toHaveBeenCalledWith({
        prompt: 'Hello',
        options: expect.objectContaining({
          canUseTool: expect.any(Function),
        }),
      });
    });
  });
});
