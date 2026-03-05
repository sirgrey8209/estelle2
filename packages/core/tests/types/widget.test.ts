import { describe, it, expect } from 'vitest';
import { MessageType } from '../../src/constants/message-type';
import {
  isWidgetCheckPayload,
  isWidgetCheckResultPayload,
} from '../../src/types/widget';

describe('Widget Message Types', () => {
  it('should have widget_check message type', () => {
    expect(MessageType.WIDGET_CHECK).toBe('widget_check');
  });

  it('should have widget_check_result message type', () => {
    expect(MessageType.WIDGET_CHECK_RESULT).toBe('widget_check_result');
  });

  it('should validate WidgetCheckPayload', () => {
    const valid = { conversationId: 123, sessionId: 'widget-1-123' };
    const invalid = { conversationId: 123 };

    expect(isWidgetCheckPayload(valid)).toBe(true);
    expect(isWidgetCheckPayload(invalid)).toBe(false);
  });

  it('should validate WidgetCheckResultPayload', () => {
    const valid = { conversationId: 123, sessionId: 'widget-1-123', valid: true };
    const invalid = { conversationId: 123, sessionId: 'widget-1-123' };

    expect(isWidgetCheckResultPayload(valid)).toBe(true);
    expect(isWidgetCheckResultPayload(invalid)).toBe(false);
  });
});
