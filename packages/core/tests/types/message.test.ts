/**
 * @file message.test.ts
 * @description Message 타입 테스트
 */

import { describe, it, expect } from 'vitest';
import type { Message } from '../../src/types/message.js';
import type { DeviceId } from '../../src/types/device.js';

describe('Message', () => {
  describe('required fields', () => {
    it('should have type, payload, and timestamp as required fields', () => {
      const message: Message = {
        type: 'test',
        payload: { data: 'value' },
        timestamp: Date.now(),
      };

      expect(message.type).toBe('test');
      expect(message.payload).toEqual({ data: 'value' });
      expect(typeof message.timestamp).toBe('number');
    });

    it('should require timestamp to be a number', () => {
      const now = Date.now();
      const message: Message = {
        type: 'ping',
        payload: null,
        timestamp: now,
      };

      expect(message.timestamp).toBe(now);
      expect(message.timestamp).toBeGreaterThan(0);
    });
  });

  describe('optional fields', () => {
    it('should allow from to be optional', () => {
      // from 없이 생성
      const messageWithoutFrom: Message = {
        type: 'test',
        payload: {},
        timestamp: Date.now(),
      };

      expect(messageWithoutFrom.from).toBeUndefined();
    });

    it('should allow from to be DeviceId or null', () => {
      const fromDevice: DeviceId = { pcId: 'sender-pc', deviceType: 'pylon' };

      const messageWithFrom: Message = {
        type: 'test',
        payload: {},
        timestamp: Date.now(),
        from: fromDevice,
      };

      const messageWithNullFrom: Message = {
        type: 'test',
        payload: {},
        timestamp: Date.now(),
        from: null,
      };

      expect(messageWithFrom.from).toEqual(fromDevice);
      expect(messageWithNullFrom.from).toBeNull();
    });

    it('should allow to to be optional', () => {
      const messageWithoutTo: Message = {
        type: 'test',
        payload: {},
        timestamp: Date.now(),
      };

      expect(messageWithoutTo.to).toBeUndefined();
    });

    it('should allow to to be DeviceId or null', () => {
      const toDevice: DeviceId = { pcId: 'receiver-pc', deviceType: 'desktop' };

      const messageWithTo: Message = {
        type: 'test',
        payload: {},
        timestamp: Date.now(),
        to: toDevice,
      };

      const messageWithNullTo: Message = {
        type: 'test',
        payload: {},
        timestamp: Date.now(),
        to: null,
      };

      expect(messageWithTo.to).toEqual(toDevice);
      expect(messageWithNullTo.to).toBeNull();
    });

    it('should allow requestId to be optional', () => {
      const messageWithoutRequestId: Message = {
        type: 'test',
        payload: {},
        timestamp: Date.now(),
      };

      expect(messageWithoutRequestId.requestId).toBeUndefined();
    });

    it('should allow requestId to be string or null', () => {
      const messageWithRequestId: Message = {
        type: 'test',
        payload: {},
        timestamp: Date.now(),
        requestId: 'req-123-abc',
      };

      const messageWithNullRequestId: Message = {
        type: 'test',
        payload: {},
        timestamp: Date.now(),
        requestId: null,
      };

      expect(messageWithRequestId.requestId).toBe('req-123-abc');
      expect(messageWithNullRequestId.requestId).toBeNull();
    });
  });

  describe('generic payload type', () => {
    it('should apply generic type to payload', () => {
      interface CustomPayload {
        userId: string;
        action: string;
      }

      const message: Message<CustomPayload> = {
        type: 'user-action',
        payload: {
          userId: 'user-001',
          action: 'login',
        },
        timestamp: Date.now(),
      };

      expect(message.payload.userId).toBe('user-001');
      expect(message.payload.action).toBe('login');
    });

    it('should default payload to unknown when no generic is provided', () => {
      const message: Message = {
        type: 'unknown-payload',
        payload: { anything: 'goes' },
        timestamp: Date.now(),
      };

      // unknown 타입이므로 직접 접근 시 타입 좁히기 필요
      expect(message.payload).toBeDefined();
    });

    it('should work with primitive payload types', () => {
      const stringMessage: Message<string> = {
        type: 'string-payload',
        payload: 'hello',
        timestamp: Date.now(),
      };

      const numberMessage: Message<number> = {
        type: 'number-payload',
        payload: 42,
        timestamp: Date.now(),
      };

      const nullMessage: Message<null> = {
        type: 'null-payload',
        payload: null,
        timestamp: Date.now(),
      };

      expect(stringMessage.payload).toBe('hello');
      expect(numberMessage.payload).toBe(42);
      expect(nullMessage.payload).toBeNull();
    });

    it('should work with array payload types', () => {
      const arrayMessage: Message<string[]> = {
        type: 'array-payload',
        payload: ['a', 'b', 'c'],
        timestamp: Date.now(),
      };

      expect(arrayMessage.payload).toEqual(['a', 'b', 'c']);
      expect(arrayMessage.payload.length).toBe(3);
    });
  });

  describe('complete message', () => {
    it('should support all fields together', () => {
      const fromDevice: DeviceId = { pcId: 'sender', deviceType: 'pylon' };
      const toDevice: DeviceId = { pcId: 'receiver', deviceType: 'mobile' };

      interface PromptPayload {
        content: string;
        sessionId: string;
      }

      const completeMessage: Message<PromptPayload> = {
        type: 'prompt',
        payload: {
          content: 'Hello, Claude!',
          sessionId: 'session-001',
        },
        from: fromDevice,
        to: toDevice,
        timestamp: 1704067200000,
        requestId: 'req-abc-123',
      };

      expect(completeMessage.type).toBe('prompt');
      expect(completeMessage.payload.content).toBe('Hello, Claude!');
      expect(completeMessage.payload.sessionId).toBe('session-001');
      expect(completeMessage.from).toEqual(fromDevice);
      expect(completeMessage.to).toEqual(toDevice);
      expect(completeMessage.timestamp).toBe(1704067200000);
      expect(completeMessage.requestId).toBe('req-abc-123');
    });
  });
});
