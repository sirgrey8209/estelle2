import { describe, it, expect } from 'vitest';
import {
  isPromptMessage,
  isClaudeMessage,
  isStreamChunk,
  type PromptMessage,
  type ClaudeMessage,
} from '../src/messages.js';

describe('messages', () => {
  describe('isPromptMessage', () => {
    it('should return true for prompt message', () => {
      const msg: PromptMessage = {
        type: 'prompt',
        conversationId: 'conv1',
        content: 'hello',
      };
      expect(isPromptMessage(msg)).toBe(true);
    });

    it('should return false for other message types', () => {
      const msg = { type: 'claude_message' };
      expect(isPromptMessage(msg)).toBe(false);
    });
  });

  describe('isClaudeMessage', () => {
    it('should return true for claude message', () => {
      const msg: ClaudeMessage = {
        type: 'claude_message',
        conversationId: 'conv1',
        role: 'assistant',
        content: 'Hi there!',
      };
      expect(isClaudeMessage(msg)).toBe(true);
    });

    it('should return false for other message types', () => {
      const msg = { type: 'prompt' };
      expect(isClaudeMessage(msg)).toBe(false);
    });
  });

  describe('isStreamChunk', () => {
    it('should return true for stream chunk', () => {
      const msg = {
        type: 'stream_chunk',
        conversationId: 'conv1',
        content: 'chunk',
      };
      expect(isStreamChunk(msg)).toBe(true);
    });

    it('should return false for other message types', () => {
      const msg = { type: 'prompt' };
      expect(isStreamChunk(msg)).toBe(false);
    });
  });
});
