/**
 * @file compact-event.test.ts
 * @description Compact 이벤트 처리 테스트
 *
 * SDK에서 오는 compact 관련 시스템 메시지(compacting, compact_boundary)를
 * ClaudeManager에서 처리하여 이벤트로 변환하는 기능을 테스트합니다.
 *
 * TDD: 2-TEST 단계 - 구현 전 테스트 작성
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ClaudeManager,
  type ClaudeManagerOptions,
  type ClaudeManagerEvent,
  type ClaudeAdapter,
  type ClaudeQueryOptions,
  type ClaudeMessage,
} from '../../src/claude/claude-manager.js';
import { PermissionMode } from '@estelle/core';

describe('ClaudeManager - Compact Event', () => {
  let manager: ClaudeManager;
  let events: Array<{ sessionId: number; event: ClaudeManagerEvent }>;
  let mockAdapter: ClaudeAdapter;
  let queryMessages: ClaudeMessage[];

  /**
   * 모킹된 Claude 어댑터 생성
   */
  function createMockAdapter(messages: ClaudeMessage[] = []): ClaudeAdapter {
    return {
      async *query(_options: ClaudeQueryOptions): AsyncIterable<ClaudeMessage> {
        for (const msg of messages) {
          yield msg;
        }
      },
    };
  }

  /**
   * 기본 설정으로 ClaudeManager 생성
   */
  function createManager(
    options: Partial<ClaudeManagerOptions> = {}
  ): ClaudeManager {
    return new ClaudeManager({
      onEvent: (sessionId, event) => {
        events.push({ sessionId, event });
      },
      getPermissionMode: () => PermissionMode.DEFAULT,
      adapter: mockAdapter,
      ...options,
    });
  }

  beforeEach(() => {
    events = [];
    queryMessages = [];
    mockAdapter = createMockAdapter(queryMessages);
  });

  // ============================================================================
  // compactStart 이벤트 테스트
  // ============================================================================
  describe('compactStart event', () => {
    it('should_emit_compactStart_when_system_status_compacting_received', async () => {
      // Arrange: SDK에서 compacting 상태 메시지가 올 때
      queryMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'sess-1',
        },
        {
          type: 'system',
          subtype: 'status',
          status: 'compacting',
          session_id: 'sess-1',
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      // Act
      await manager.sendMessage(100, 'Hello', {
        workingDir: '/project',
      });

      // Assert: compactStart 이벤트가 emit되어야 함
      const compactStartEvents = events.filter(
        (e) => e.event.type === 'compactStart'
      );
      expect(compactStartEvents).toHaveLength(1);
      expect(compactStartEvents[0].sessionId).toBe(100);
    });

    it('should_not_emit_compactStart_when_status_is_not_compacting', async () => {
      // Arrange: 다른 상태 메시지
      queryMessages = [
        {
          type: 'system',
          subtype: 'status',
          status: 'idle',
          session_id: 'sess-1',
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      // Act
      await manager.sendMessage(100, 'Hello', {
        workingDir: '/project',
      });

      // Assert: compactStart 이벤트가 없어야 함
      const compactStartEvents = events.filter(
        (e) => e.event.type === 'compactStart'
      );
      expect(compactStartEvents).toHaveLength(0);
    });
  });

  // ============================================================================
  // compactComplete 이벤트 테스트
  // ============================================================================
  describe('compactComplete event', () => {
    it('should_emit_compactComplete_when_system_compact_boundary_received', async () => {
      // Arrange: SDK에서 compact_boundary 메시지가 올 때
      queryMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'sess-1',
        },
        {
          type: 'system',
          subtype: 'compact_boundary',
          session_id: 'sess-1',
          compact_metadata: {
            trigger: 'auto',
            pre_tokens: 168833,
          },
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      // Act
      await manager.sendMessage(100, 'Hello', {
        workingDir: '/project',
      });

      // Assert: compactComplete 이벤트가 emit되어야 함
      const compactCompleteEvents = events.filter(
        (e) => e.event.type === 'compactComplete'
      );
      expect(compactCompleteEvents).toHaveLength(1);
      expect(compactCompleteEvents[0].sessionId).toBe(100);
    });

    it('should_include_pre_tokens_in_compactComplete_event', async () => {
      // Arrange: pre_tokens 정보가 포함된 compact_boundary
      queryMessages = [
        {
          type: 'system',
          subtype: 'compact_boundary',
          session_id: 'sess-1',
          compact_metadata: {
            trigger: 'auto',
            pre_tokens: 200000,
          },
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      // Act
      await manager.sendMessage(100, 'Hello', {
        workingDir: '/project',
      });

      // Assert: pre_tokens가 이벤트에 포함되어야 함
      const compactCompleteEvent = events.find(
        (e) => e.event.type === 'compactComplete'
      );
      expect(compactCompleteEvent?.event).toMatchObject({
        type: 'compactComplete',
        preTokens: 200000,
      });
    });

    it('should_include_trigger_info_in_compactComplete_event', async () => {
      // Arrange: trigger 정보가 포함된 compact_boundary
      queryMessages = [
        {
          type: 'system',
          subtype: 'compact_boundary',
          session_id: 'sess-1',
          compact_metadata: {
            trigger: 'manual',
            pre_tokens: 150000,
          },
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      // Act
      await manager.sendMessage(100, 'Hello', {
        workingDir: '/project',
      });

      // Assert: trigger가 이벤트에 포함되어야 함
      const compactCompleteEvent = events.find(
        (e) => e.event.type === 'compactComplete'
      );
      expect(compactCompleteEvent?.event).toMatchObject({
        type: 'compactComplete',
        trigger: 'manual',
      });
    });
  });

  // ============================================================================
  // compactStart + compactComplete 시퀀스 테스트
  // ============================================================================
  describe('compact event sequence', () => {
    it('should_emit_compactStart_then_compactComplete_in_order', async () => {
      // Arrange: compacting -> compact_boundary 순서로 메시지가 올 때
      queryMessages = [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'sess-1',
        },
        {
          type: 'system',
          subtype: 'status',
          status: 'compacting',
          session_id: 'sess-1',
        },
        {
          type: 'system',
          subtype: 'compact_boundary',
          session_id: 'sess-1',
          compact_metadata: {
            trigger: 'auto',
            pre_tokens: 168833,
          },
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      // Act
      await manager.sendMessage(100, 'Hello', {
        workingDir: '/project',
      });

      // Assert: compactStart가 먼저, compactComplete가 나중에 발생
      const compactEvents = events.filter(
        (e) => e.event.type === 'compactStart' || e.event.type === 'compactComplete'
      );
      expect(compactEvents).toHaveLength(2);
      expect(compactEvents[0].event.type).toBe('compactStart');
      expect(compactEvents[1].event.type).toBe('compactComplete');
    });

    it('should_emit_compactComplete_without_compactStart_when_only_boundary_received', async () => {
      // Arrange: compact_boundary만 수신된 경우 (비정상이지만 처리해야 함)
      queryMessages = [
        {
          type: 'system',
          subtype: 'compact_boundary',
          session_id: 'sess-1',
          compact_metadata: {
            trigger: 'auto',
            pre_tokens: 100000,
          },
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      // Act
      await manager.sendMessage(100, 'Hello', {
        workingDir: '/project',
      });

      // Assert: compactComplete만 발생해야 함
      const compactStartEvents = events.filter((e) => e.event.type === 'compactStart');
      const compactCompleteEvents = events.filter((e) => e.event.type === 'compactComplete');
      expect(compactStartEvents).toHaveLength(0);
      expect(compactCompleteEvents).toHaveLength(1);
    });
  });

  // ============================================================================
  // Edge cases
  // ============================================================================
  describe('edge cases', () => {
    it('should_handle_compact_boundary_without_metadata', async () => {
      // Arrange: compact_metadata가 없는 경우
      queryMessages = [
        {
          type: 'system',
          subtype: 'compact_boundary',
          session_id: 'sess-1',
          // compact_metadata 없음
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      // Act
      await manager.sendMessage(100, 'Hello', {
        workingDir: '/project',
      });

      // Assert: compactComplete가 발생하되, preTokens는 undefined
      const compactCompleteEvent = events.find(
        (e) => e.event.type === 'compactComplete'
      );
      expect(compactCompleteEvent).toBeDefined();
      expect(compactCompleteEvent?.event.preTokens).toBeUndefined();
    });

    it('should_handle_compact_boundary_with_partial_metadata', async () => {
      // Arrange: pre_tokens만 있고 trigger가 없는 경우
      queryMessages = [
        {
          type: 'system',
          subtype: 'compact_boundary',
          session_id: 'sess-1',
          compact_metadata: {
            pre_tokens: 50000,
            // trigger 없음
          },
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      // Act
      await manager.sendMessage(100, 'Hello', {
        workingDir: '/project',
      });

      // Assert: preTokens만 포함되어야 함
      const compactCompleteEvent = events.find(
        (e) => e.event.type === 'compactComplete'
      );
      expect(compactCompleteEvent?.event.preTokens).toBe(50000);
      expect(compactCompleteEvent?.event.trigger).toBeUndefined();
    });

    it('should_ignore_other_system_subtypes', async () => {
      // Arrange: 알 수 없는 subtype
      queryMessages = [
        {
          type: 'system',
          subtype: 'unknown_subtype',
          session_id: 'sess-1',
        },
      ];
      mockAdapter = createMockAdapter(queryMessages);
      manager = createManager();

      // Act
      await manager.sendMessage(100, 'Hello', {
        workingDir: '/project',
      });

      // Assert: compact 관련 이벤트가 없어야 함
      const compactEvents = events.filter(
        (e) => e.event.type === 'compactStart' || e.event.type === 'compactComplete'
      );
      expect(compactEvents).toHaveLength(0);
    });
  });

  // ============================================================================
  // ClaudeManagerEventType 확장 테스트
  // ============================================================================
  describe('ClaudeManagerEventType extension', () => {
    /**
     * 이 테스트는 타입 시스템 검증용입니다.
     * ClaudeManagerEventType에 'compactStart' | 'compactComplete'가
     * 추가되어야 컴파일이 통과합니다.
     */
    it('should_accept_compactStart_as_valid_event_type', async () => {
      // Arrange
      let receivedEventType: string | null = null;
      manager = new ClaudeManager({
        onEvent: (sessionId, event) => {
          if (event.type === 'compactStart') {
            receivedEventType = event.type;
          }
        },
        getPermissionMode: () => PermissionMode.DEFAULT,
        adapter: createMockAdapter([
          {
            type: 'system',
            subtype: 'status',
            status: 'compacting',
            session_id: 'sess-1',
          },
        ]),
      });

      // Act
      await manager.sendMessage(100, 'Hello', { workingDir: '/project' });

      // Assert: 이 테스트가 컴파일되면 타입이 올바른 것
      expect(receivedEventType).toBe('compactStart');
    });

    it('should_accept_compactComplete_as_valid_event_type', async () => {
      // Arrange
      let receivedEventType: string | null = null;
      manager = new ClaudeManager({
        onEvent: (sessionId, event) => {
          if (event.type === 'compactComplete') {
            receivedEventType = event.type;
          }
        },
        getPermissionMode: () => PermissionMode.DEFAULT,
        adapter: createMockAdapter([
          {
            type: 'system',
            subtype: 'compact_boundary',
            session_id: 'sess-1',
            compact_metadata: { trigger: 'auto', pre_tokens: 100 },
          },
        ]),
      });

      // Act
      await manager.sendMessage(100, 'Hello', { workingDir: '/project' });

      // Assert
      expect(receivedEventType).toBe('compactComplete');
    });
  });
});
