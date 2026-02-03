import { describe, it, expect, beforeEach } from 'vitest';
import { PylonState, type ClaudeEvent } from '../src/state.js';
import type { PromptMessage } from '@estelle/core';

describe('PylonState', () => {
  let state: PylonState;

  beforeEach(() => {
    state = new PylonState();
  });

  describe('handlePacket', () => {
    it('should create conversation on first message', () => {
      const packet: PromptMessage = {
        type: 'prompt',
        conversationId: 'conv1',
        content: 'hello',
      };

      state.handlePacket(packet);

      expect(state.conversations.has('conv1')).toBe(true);
      const conv = state.conversations.get('conv1')!;
      expect(conv.messages).toHaveLength(1);
      expect(conv.messages[0].role).toBe('user');
      expect(conv.messages[0].content).toBe('hello');
    });

    it('should add message to existing conversation', () => {
      const packet1: PromptMessage = {
        type: 'prompt',
        conversationId: 'conv1',
        content: 'hello',
      };
      const packet2: PromptMessage = {
        type: 'prompt',
        conversationId: 'conv1',
        content: 'world',
      };

      state.handlePacket(packet1);
      state.handlePacket(packet2);

      const conv = state.conversations.get('conv1')!;
      expect(conv.messages).toHaveLength(2);
      expect(conv.messages[1].content).toBe('world');
    });
  });

  describe('handleClaude', () => {
    beforeEach(() => {
      // 대화 먼저 생성
      state.handlePacket({
        type: 'prompt',
        conversationId: 'conv1',
        content: 'hello',
      });
    });

    it('should add assistant message', () => {
      const event: ClaudeEvent = {
        type: 'message',
        conversationId: 'conv1',
        content: 'Hi there!',
      };

      state.handleClaude(event);

      const conv = state.conversations.get('conv1')!;
      expect(conv.messages).toHaveLength(2);
      expect(conv.messages[1].role).toBe('assistant');
      expect(conv.messages[1].content).toBe('Hi there!');
    });

    it('should queue output event for app', () => {
      const event: ClaudeEvent = {
        type: 'message',
        conversationId: 'conv1',
        content: 'Hi there!',
      };

      state.handleClaude(event);

      const events = state.flushEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('send_to_app');
      expect(events[0].message.content).toBe('Hi there!');
    });

    it('should set streaming flag on stream_start', () => {
      state.handleClaude({
        type: 'stream_start',
        conversationId: 'conv1',
      });

      const conv = state.conversations.get('conv1')!;
      expect(conv.isStreaming).toBe(true);
    });

    it('should clear streaming flag on stream_end', () => {
      state.handleClaude({ type: 'stream_start', conversationId: 'conv1' });
      state.handleClaude({ type: 'stream_end', conversationId: 'conv1' });

      const conv = state.conversations.get('conv1')!;
      expect(conv.isStreaming).toBe(false);
    });

    it('should ignore events for non-existent conversation', () => {
      const event: ClaudeEvent = {
        type: 'message',
        conversationId: 'non-existent',
        content: 'Hi!',
      };

      state.handleClaude(event);

      expect(state.conversations.has('non-existent')).toBe(false);
    });
  });

  describe('flushEvents', () => {
    it('should clear events after flush', () => {
      state.handlePacket({
        type: 'prompt',
        conversationId: 'conv1',
        content: 'hello',
      });
      state.handleClaude({
        type: 'message',
        conversationId: 'conv1',
        content: 'Hi!',
      });

      const events1 = state.flushEvents();
      const events2 = state.flushEvents();

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(0);
    });
  });
});
