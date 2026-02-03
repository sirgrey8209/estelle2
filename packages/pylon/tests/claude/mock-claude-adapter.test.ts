/**
 * @file mock-claude-adapter.test.ts
 * @description MockClaudeAdapter 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockClaudeAdapter } from '../../src/claude/mock-claude-adapter.js';
import type { ClaudeMessage } from '../../src/claude/claude-manager.js';

describe('MockClaudeAdapter', () => {
  let adapter: MockClaudeAdapter;

  beforeEach(() => {
    adapter = new MockClaudeAdapter();
  });

  describe('간단한 텍스트 응답', () => {
    it('setSimpleResponse로 텍스트 응답 설정', async () => {
      adapter.setSimpleResponse('Hello, world!');

      const messages: ClaudeMessage[] = [];
      for await (const msg of adapter.query({
        prompt: 'test',
        cwd: '/test',
        abortController: new AbortController(),
      })) {
        messages.push(msg);
      }

      // init 메시지 확인
      const initMsg = messages.find(
        (m) => m.type === 'system' && m.subtype === 'init'
      );
      expect(initMsg).toBeDefined();
      expect(initMsg?.session_id).toContain('mock-session');

      // 텍스트 델타 확인
      const textDelta = messages.find(
        (m) =>
          m.type === 'stream_event' &&
          m.event?.type === 'content_block_delta' &&
          m.event?.delta?.text === 'Hello, world!'
      );
      expect(textDelta).toBeDefined();

      // result 확인
      const result = messages.find((m) => m.type === 'result');
      expect(result).toBeDefined();
      expect(result?.subtype).toBe('success');
    });
  });

  describe('도구 사용 응답', () => {
    it('setToolUseResponse로 도구 사용 시뮬레이션', async () => {
      adapter.setToolUseResponse('Read', { file_path: '/test.txt' }, {
        toolResult: 'File contents here',
        finalText: 'I read the file for you.',
      });

      const messages: ClaudeMessage[] = [];
      for await (const msg of adapter.query({
        prompt: 'read file',
        cwd: '/test',
        abortController: new AbortController(),
        canUseTool: async () => ({ behavior: 'allow' }),
      })) {
        messages.push(msg);
      }

      // tool_use 블록 시작 확인
      const toolStart = messages.find(
        (m) =>
          m.type === 'stream_event' &&
          m.event?.type === 'content_block_start' &&
          m.event?.content_block?.name === 'Read'
      );
      expect(toolStart).toBeDefined();

      // tool_progress 확인
      const progress = messages.find((m) => m.type === 'tool_progress');
      expect(progress).toBeDefined();
      expect(progress?.tool_name).toBe('Read');

      // tool_result 확인
      const toolResult = messages.find(
        (m) =>
          m.type === 'user' &&
          m.message?.content?.[0]?.type === 'tool_result'
      );
      expect(toolResult).toBeDefined();
      expect(toolResult?.message?.content?.[0]?.content).toBe('File contents here');

      // 최종 텍스트 확인
      const finalText = messages.find(
        (m) =>
          m.type === 'assistant' &&
          m.message?.content?.[0]?.text === 'I read the file for you.'
      );
      expect(finalText).toBeDefined();
    });

    it('권한 거부 시 에러 결과 반환', async () => {
      adapter.setToolUseResponse('Bash', { command: 'rm -rf /' });

      const messages: ClaudeMessage[] = [];
      for await (const msg of adapter.query({
        prompt: 'delete everything',
        cwd: '/test',
        abortController: new AbortController(),
        canUseTool: async () => ({
          behavior: 'deny',
          message: 'Dangerous command blocked',
        }),
      })) {
        messages.push(msg);
      }

      // 에러 결과 확인
      const errorResult = messages.find(
        (m) =>
          m.type === 'user' &&
          m.message?.content?.[0]?.is_error === true
      );
      expect(errorResult).toBeDefined();
      expect(errorResult?.message?.content?.[0]?.content).toBe(
        'Dangerous command blocked'
      );

      // result가 error로 종료
      const result = messages.find((m) => m.type === 'result');
      expect(result?.subtype).toBe('error');
    });
  });

  describe('스트리밍 응답', () => {
    it('청크 단위로 스트리밍', async () => {
      adapter.setScenario({
        type: 'streaming',
        chunks: ['Hello', ', ', 'world', '!'],
        delayMs: 0, // 테스트에서는 딜레이 없이
      });

      const textChunks: string[] = [];
      for await (const msg of adapter.query({
        prompt: 'test',
        cwd: '/test',
        abortController: new AbortController(),
      })) {
        if (
          msg.type === 'stream_event' &&
          msg.event?.type === 'content_block_delta' &&
          msg.event?.delta?.text
        ) {
          textChunks.push(msg.event.delta.text);
        }
      }

      expect(textChunks).toEqual(['Hello', ', ', 'world', '!']);
    });
  });

  describe('에러 응답', () => {
    it('setErrorResponse로 에러 시뮬레이션', async () => {
      adapter.setErrorResponse('Something went wrong');

      await expect(async () => {
        const messages: ClaudeMessage[] = [];
        for await (const msg of adapter.query({
          prompt: 'test',
          cwd: '/test',
          abortController: new AbortController(),
        })) {
          messages.push(msg);
        }
      }).rejects.toThrow('Something went wrong');
    });
  });

  describe('커스텀 메시지 시퀀스', () => {
    it('custom 시나리오로 임의 메시지 시퀀스', async () => {
      const customMessages: ClaudeMessage[] = [
        { type: 'system', subtype: 'init', session_id: 'custom-1' },
        { type: 'assistant', message: { content: [{ type: 'text', text: 'Custom!' }] } },
        { type: 'result', subtype: 'success' },
      ];

      adapter.setScenario({
        type: 'custom',
        messages: customMessages,
      });

      const messages: ClaudeMessage[] = [];
      for await (const msg of adapter.query({
        prompt: 'test',
        cwd: '/test',
        abortController: new AbortController(),
      })) {
        messages.push(msg);
      }

      expect(messages).toEqual(customMessages);
    });
  });

  describe('다중 시나리오', () => {
    it('여러 쿼리에 대해 순차적으로 다른 응답', async () => {
      adapter.setScenarios([
        { type: 'simple_text', text: 'First response' },
        { type: 'simple_text', text: 'Second response' },
      ]);

      // 첫 번째 쿼리
      let texts: string[] = [];
      for await (const msg of adapter.query({
        prompt: 'first',
        cwd: '/test',
        abortController: new AbortController(),
      })) {
        if (msg.type === 'assistant' && msg.message?.content?.[0]?.text) {
          texts.push(msg.message.content[0].text);
        }
      }
      expect(texts).toContain('First response');

      // 두 번째 쿼리
      texts = [];
      for await (const msg of adapter.query({
        prompt: 'second',
        cwd: '/test',
        abortController: new AbortController(),
      })) {
        if (msg.type === 'assistant' && msg.message?.content?.[0]?.text) {
          texts.push(msg.message.content[0].text);
        }
      }
      expect(texts).toContain('Second response');
    });

    it('reset()으로 인덱스 초기화', async () => {
      adapter.setScenarios([
        { type: 'simple_text', text: 'First' },
        { type: 'simple_text', text: 'Second' },
      ]);

      // 첫 번째 쿼리 실행
      for await (const _ of adapter.query({
        prompt: 'test',
        cwd: '/test',
        abortController: new AbortController(),
      })) {}

      // 리셋
      adapter.reset();

      // 다시 첫 번째부터
      let text = '';
      for await (const msg of adapter.query({
        prompt: 'test',
        cwd: '/test',
        abortController: new AbortController(),
      })) {
        if (msg.type === 'assistant' && msg.message?.content?.[0]?.text) {
          text = msg.message.content[0].text;
        }
      }
      expect(text).toBe('First');
    });
  });

  describe('abort 처리', () => {
    it('abort 시 에러 throw', async () => {
      adapter.setScenario({
        type: 'streaming',
        chunks: ['a', 'b', 'c', 'd', 'e'],
        delayMs: 50,
      });

      const controller = new AbortController();

      // 즉시 abort
      controller.abort();

      await expect(async () => {
        for await (const _ of adapter.query({
          prompt: 'test',
          cwd: '/test',
          abortController: controller,
        })) {}
      }).rejects.toThrow('Aborted');
    });
  });
});
