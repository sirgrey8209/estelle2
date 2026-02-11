/**
 * @file mock-sdk.test.ts
 * @description MockSDK 테스트
 *
 * ClaudeBeacon 테스트를 위한 MockSDK.
 * 실제 Claude SDK의 이벤트 시퀀스를 재생하여 테스트할 수 있게 한다.
 *
 * 주요 이벤트:
 * - content_block_start (type: tool_use) - 도구 호출 시작
 * - content_block_delta - 도구 입력 스트리밍
 * - content_block_stop - 도구 호출 완료
 *
 * 테스트 케이스:
 * - 이벤트 생성
 * - 이벤트 시퀀스 재생
 * - 콜백 호출 검증
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
// 아직 구현되지 않은 모듈 - 테스트 실패 예상
import { MockSDK, type SDKEvent, type ToolUseBlockStart } from '../src/mock-sdk.js';

describe('MockSDK', () => {
  let mockSDK: MockSDK;

  beforeEach(() => {
    mockSDK = new MockSDK();
  });

  // ============================================================================
  // createToolUseStartEvent 테스트
  // ============================================================================
  describe('createToolUseStartEvent', () => {
    it('should_create_content_block_start_event_with_tool_use', () => {
      // Act
      const event = mockSDK.createToolUseStartEvent({
        id: 'toolu_01ABC123',
        name: 'Read',
      });

      // Assert
      expect(event.type).toBe('content_block_start');
      expect(event.content_block.type).toBe('tool_use');
      expect(event.content_block.id).toBe('toolu_01ABC123');
      expect(event.content_block.name).toBe('Read');
    });

    it('should_auto_generate_tool_use_id_when_not_provided', () => {
      // Act
      const event = mockSDK.createToolUseStartEvent({
        name: 'Write',
      });

      // Assert
      expect(event.content_block.id).toMatch(/^toolu_/);
      expect(event.content_block.name).toBe('Write');
    });

    it('should_include_index_in_event', () => {
      // Act
      const event = mockSDK.createToolUseStartEvent({
        id: 'toolu_01',
        name: 'Read',
        index: 2,
      });

      // Assert
      expect(event.index).toBe(2);
    });
  });

  // ============================================================================
  // createToolUseDeltaEvent 테스트
  // ============================================================================
  describe('createToolUseDeltaEvent', () => {
    it('should_create_content_block_delta_event_with_partial_json', () => {
      // Act
      const event = mockSDK.createToolUseDeltaEvent({
        index: 1,
        partialJson: '{"file_path": "/test.ts"',
      });

      // Assert
      expect(event.type).toBe('content_block_delta');
      expect(event.index).toBe(1);
      expect(event.delta.type).toBe('input_json_delta');
      expect(event.delta.partial_json).toBe('{"file_path": "/test.ts"');
    });
  });

  // ============================================================================
  // createToolUseStopEvent 테스트
  // ============================================================================
  describe('createToolUseStopEvent', () => {
    it('should_create_content_block_stop_event', () => {
      // Act
      const event = mockSDK.createToolUseStopEvent({
        index: 1,
      });

      // Assert
      expect(event.type).toBe('content_block_stop');
      expect(event.index).toBe(1);
    });
  });

  // ============================================================================
  // 이벤트 시퀀스 테스트
  // ============================================================================
  describe('event sequence', () => {
    it('should_generate_complete_tool_use_sequence', () => {
      // Act
      const sequence = mockSDK.createToolUseSequence({
        id: 'toolu_01ABC123',
        name: 'Read',
        input: { file_path: '/test.ts' },
      });

      // Assert
      expect(sequence).toHaveLength(3); // start, delta, stop

      // start
      expect(sequence[0].type).toBe('content_block_start');
      const startEvent = sequence[0] as SDKEvent & { content_block: ToolUseBlockStart };
      expect(startEvent.content_block.id).toBe('toolu_01ABC123');
      expect(startEvent.content_block.name).toBe('Read');

      // delta
      expect(sequence[1].type).toBe('content_block_delta');

      // stop
      expect(sequence[2].type).toBe('content_block_stop');
    });

    it('should_split_large_input_into_multiple_delta_events', () => {
      // Arrange - 큰 입력
      const largeInput = {
        file_path: '/test.ts',
        old_string: 'x'.repeat(1000),
        new_string: 'y'.repeat(1000),
      };

      // Act
      const sequence = mockSDK.createToolUseSequence({
        id: 'toolu_large',
        name: 'Edit',
        input: largeInput,
        chunkSize: 100, // 100바이트씩 분할
      });

      // Assert - start + 여러 delta + stop
      expect(sequence.length).toBeGreaterThan(3);

      // 첫 번째는 start
      expect(sequence[0].type).toBe('content_block_start');

      // 마지막은 stop
      expect(sequence[sequence.length - 1].type).toBe('content_block_stop');

      // 중간은 모두 delta
      for (let i = 1; i < sequence.length - 1; i++) {
        expect(sequence[i].type).toBe('content_block_delta');
      }
    });
  });

  // ============================================================================
  // replay 테스트
  // ============================================================================
  describe('replay', () => {
    it('should_emit_events_through_callback', async () => {
      // Arrange
      const events: SDKEvent[] = [];
      const callback = (event: SDKEvent) => {
        events.push(event);
      };

      const sequence = mockSDK.createToolUseSequence({
        id: 'toolu_replay',
        name: 'Read',
        input: { file_path: '/test.ts' },
      });

      // Act
      await mockSDK.replay(sequence, callback);

      // Assert
      expect(events).toHaveLength(sequence.length);
      expect(events[0].type).toBe('content_block_start');
    });

    it('should_emit_events_with_delay_when_specified', async () => {
      // Arrange
      const events: Array<{ event: SDKEvent; timestamp: number }> = [];
      const callback = (event: SDKEvent) => {
        events.push({ event, timestamp: Date.now() });
      };

      const sequence = mockSDK.createToolUseSequence({
        id: 'toolu_delay',
        name: 'Read',
        input: { file_path: '/test.ts' },
      });

      const startTime = Date.now();

      // Act
      await mockSDK.replay(sequence, callback, { delayMs: 50 });

      // Assert
      const totalTime = Date.now() - startTime;
      // 최소 (이벤트 수 - 1) * delay 시간 경과
      expect(totalTime).toBeGreaterThanOrEqual((sequence.length - 1) * 40); // 약간의 여유
    });

    it('should_emit_events_in_order', async () => {
      // Arrange
      const types: string[] = [];
      const callback = (event: SDKEvent) => {
        types.push(event.type);
      };

      const sequence = mockSDK.createToolUseSequence({
        id: 'toolu_order',
        name: 'Read',
        input: { file_path: '/test.ts' },
      });

      // Act
      await mockSDK.replay(sequence, callback);

      // Assert
      expect(types[0]).toBe('content_block_start');
      expect(types[types.length - 1]).toBe('content_block_stop');
    });
  });

  // ============================================================================
  // 다중 도구 호출 테스트
  // ============================================================================
  describe('multiple tool calls', () => {
    it('should_generate_sequence_for_multiple_tools', () => {
      // Act
      const sequence = mockSDK.createMultiToolSequence([
        { id: 'toolu_01', name: 'Read', input: { file_path: '/a.ts' } },
        { id: 'toolu_02', name: 'Write', input: { file_path: '/b.ts', content: 'hello' } },
        { id: 'toolu_03', name: 'Bash', input: { command: 'ls' } },
      ]);

      // Assert
      // 각 도구마다 최소 3개 이벤트 (start, delta, stop)
      expect(sequence.length).toBeGreaterThanOrEqual(9);

      // 각 도구의 start 이벤트가 있어야 함
      const startEvents = sequence.filter((e) => e.type === 'content_block_start');
      expect(startEvents).toHaveLength(3);

      // 각 도구 이름 확인
      const names = startEvents.map(
        (e) => (e as SDKEvent & { content_block: ToolUseBlockStart }).content_block.name
      );
      expect(names).toContain('Read');
      expect(names).toContain('Write');
      expect(names).toContain('Bash');
    });

    it('should_assign_correct_indices_to_each_tool', () => {
      // Act
      const sequence = mockSDK.createMultiToolSequence([
        { id: 'toolu_01', name: 'Read', input: {} },
        { id: 'toolu_02', name: 'Write', input: {} },
      ]);

      // Assert
      const startEvents = sequence.filter(
        (e) => e.type === 'content_block_start'
      ) as Array<SDKEvent & { index: number }>;

      // 인덱스가 순서대로 할당되어야 함
      expect(startEvents[0].index).toBe(0);
      expect(startEvents[1].index).toBe(1);
    });
  });

  // ============================================================================
  // 실제 SDK 로그 기반 테스트
  // ============================================================================
  describe('from sdk log', () => {
    it('should_parse_and_recreate_events_from_log_entry', () => {
      // Arrange - 실제 SDK 로그 형식
      const logEntry = {
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'tool_use',
          id: 'toolu_01N8QFk2EJLh2VPhwvGT4mVh',
          name: 'Read',
          input: {},
        },
      };

      // Act
      const event = mockSDK.fromLogEntry(logEntry);

      // Assert
      expect(event.type).toBe('content_block_start');
      expect(event.content_block.id).toBe('toolu_01N8QFk2EJLh2VPhwvGT4mVh');
      expect(event.content_block.name).toBe('Read');
    });

    it('should_recreate_complete_sequence_from_log_entries', () => {
      // Arrange - 여러 로그 엔트리
      const logEntries = [
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', id: 'toolu_01', name: 'Read', input: {} },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '{"file_path":' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '"/test.ts"}' },
        },
        { type: 'content_block_stop', index: 0 },
      ];

      // Act
      const sequence = mockSDK.fromLogEntries(logEntries);

      // Assert
      expect(sequence).toHaveLength(4);
      expect(sequence[0].type).toBe('content_block_start');
      expect(sequence[3].type).toBe('content_block_stop');
    });
  });

  // ============================================================================
  // 엣지 케이스 테스트
  // ============================================================================
  describe('edge cases', () => {
    it('should_handle_empty_input', () => {
      // Act
      const sequence = mockSDK.createToolUseSequence({
        id: 'toolu_empty',
        name: 'Bash',
        input: {},
      });

      // Assert
      expect(sequence.length).toBeGreaterThanOrEqual(2); // 최소 start + stop
    });

    it('should_handle_null_values_in_input', () => {
      // Act
      const sequence = mockSDK.createToolUseSequence({
        id: 'toolu_null',
        name: 'Edit',
        input: { file_path: '/test.ts', old_string: null, new_string: 'hello' },
      });

      // Assert
      expect(sequence.length).toBeGreaterThanOrEqual(2);
    });

    it('should_handle_unicode_in_input', () => {
      // Act
      const sequence = mockSDK.createToolUseSequence({
        id: 'toolu_unicode',
        name: 'Write',
        input: { content: '한글 테스트 🎉' },
      });

      // Assert
      expect(sequence.length).toBeGreaterThanOrEqual(2);
    });

    it('should_handle_nested_objects_in_input', () => {
      // Act
      const sequence = mockSDK.createToolUseSequence({
        id: 'toolu_nested',
        name: 'CustomTool',
        input: {
          config: {
            nested: {
              deeply: {
                value: 'test',
              },
            },
          },
          array: [1, 2, { key: 'value' }],
        },
      });

      // Assert
      expect(sequence.length).toBeGreaterThanOrEqual(2);
    });
  });
});
