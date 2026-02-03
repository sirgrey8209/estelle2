/**
 * @file create-message.test.ts
 * @description createMessage 헬퍼 함수 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMessage, type CreateMessageOptions } from '../../src/helpers/create-message.js';

describe('createMessage', () => {
  // timestamp를 고정하기 위한 mock 설정
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('기본 메시지 생성', () => {
    it('should type과 payload로 기본 메시지를 생성해야 한다', () => {
      const message = createMessage('ping', null);

      expect(message).toEqual({
        type: 'ping',
        payload: null,
        timestamp: Date.now(),
        from: null,
        to: null,
        requestId: null,
      });
    });

    it('should timestamp를 현재 시간(Date.now())으로 설정해야 한다', () => {
      const expectedTimestamp = Date.now();
      const message = createMessage('test', { data: 'value' });

      expect(message.timestamp).toBe(expectedTimestamp);
    });

    it('should 제네릭 타입으로 payload 타입을 지정할 수 있어야 한다', () => {
      interface TestPayload {
        content: string;
        count: number;
      }

      const message = createMessage<TestPayload>('test', {
        content: 'hello',
        count: 42,
      });

      // 타입 체크가 통과하면 payload에 타입이 적용된 것
      expect(message.payload.content).toBe('hello');
      expect(message.payload.count).toBe(42);
    });
  });

  describe('옵션으로 from, to, requestId 설정', () => {
    it('should options.from으로 발신자를 설정할 수 있어야 한다', () => {
      const from = { pcId: 'pc1', deviceType: 'pylon' as const };
      const message = createMessage('test', {}, { from });

      expect(message.from).toEqual(from);
    });

    it('should options.to로 수신자를 설정할 수 있어야 한다', () => {
      const to = { pcId: 'pc2', deviceType: 'mobile' as const };
      const message = createMessage('test', {}, { to });

      expect(message.to).toEqual(to);
    });

    it('should options.requestId로 요청 ID를 설정할 수 있어야 한다', () => {
      const message = createMessage('test', {}, { requestId: 'req-123' });

      expect(message.requestId).toBe('req-123');
    });

    it('should 여러 옵션을 동시에 설정할 수 있어야 한다', () => {
      const options: CreateMessageOptions = {
        from: { pcId: 'sender', deviceType: 'desktop' },
        to: { pcId: 'receiver', deviceType: 'pylon' },
        requestId: 'req-456',
      };

      const message = createMessage('test', { value: 1 }, options);

      expect(message.from).toEqual(options.from);
      expect(message.to).toEqual(options.to);
      expect(message.requestId).toBe('req-456');
    });
  });

  describe('옵션이 없거나 null인 경우', () => {
    it('should 옵션이 없으면 from, to, requestId를 null로 설정해야 한다', () => {
      const message = createMessage('test', {});

      expect(message.from).toBeNull();
      expect(message.to).toBeNull();
      expect(message.requestId).toBeNull();
    });

    it('should 옵션이 빈 객체이면 from, to, requestId를 null로 설정해야 한다', () => {
      const message = createMessage('test', {}, {});

      expect(message.from).toBeNull();
      expect(message.to).toBeNull();
      expect(message.requestId).toBeNull();
    });

    it('should 옵션 값이 null이면 null로 유지해야 한다', () => {
      const message = createMessage('test', {}, {
        from: null,
        to: null,
        requestId: null,
      });

      expect(message.from).toBeNull();
      expect(message.to).toBeNull();
      expect(message.requestId).toBeNull();
    });
  });

  describe('다양한 payload 타입', () => {
    it('should null payload를 처리할 수 있어야 한다', () => {
      const message = createMessage('ping', null);
      expect(message.payload).toBeNull();
    });

    it('should 문자열 payload를 처리할 수 있어야 한다', () => {
      const message = createMessage('text', 'hello world');
      expect(message.payload).toBe('hello world');
    });

    it('should 숫자 payload를 처리할 수 있어야 한다', () => {
      const message = createMessage('count', 42);
      expect(message.payload).toBe(42);
    });

    it('should 배열 payload를 처리할 수 있어야 한다', () => {
      const message = createMessage('items', [1, 2, 3]);
      expect(message.payload).toEqual([1, 2, 3]);
    });

    it('should 객체 payload를 처리할 수 있어야 한다', () => {
      const payload = { key: 'value', nested: { a: 1 } };
      const message = createMessage('data', payload);
      expect(message.payload).toEqual(payload);
    });
  });
});
