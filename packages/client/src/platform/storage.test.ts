/**
 * @file platform/storage.test.ts
 * @description 플랫폼 스토리지 테스트
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from './storage';

describe('WebStorage', () => {
  beforeEach(async () => {
    await storage.clear();
  });

  describe('기본 동작', () => {
    it('setItem/getItem으로 값을 저장하고 읽을 수 있다', async () => {
      await storage.setItem('test-key', 'test-value');
      const result = await storage.getItem('test-key');
      expect(result).toBe('test-value');
    });

    it('존재하지 않는 키는 null을 반환한다', async () => {
      const result = await storage.getItem('non-existent-key');
      expect(result).toBeNull();
    });

    it('removeItem으로 값을 삭제할 수 있다', async () => {
      await storage.setItem('test-key', 'test-value');
      await storage.removeItem('test-key');
      const result = await storage.getItem('test-key');
      expect(result).toBeNull();
    });
  });

  describe('getAllKeys', () => {
    it('저장된 모든 키를 반환한다', async () => {
      await storage.setItem('key1', 'value1');
      await storage.setItem('key2', 'value2');
      await storage.setItem('key3', 'value3');

      const keys = await storage.getAllKeys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });

  describe('multiRemove', () => {
    it('여러 키를 한번에 삭제할 수 있다', async () => {
      await storage.setItem('key1', 'value1');
      await storage.setItem('key2', 'value2');
      await storage.setItem('key3', 'value3');

      await storage.multiRemove(['key1', 'key3']);

      expect(await storage.getItem('key1')).toBeNull();
      expect(await storage.getItem('key2')).toBe('value2');
      expect(await storage.getItem('key3')).toBeNull();
    });
  });

  describe('clear', () => {
    it('모든 데이터를 삭제한다', async () => {
      await storage.setItem('key1', 'value1');
      await storage.setItem('key2', 'value2');

      await storage.clear();

      expect(await storage.getItem('key1')).toBeNull();
      expect(await storage.getItem('key2')).toBeNull();
    });
  });

  describe('JSON 데이터', () => {
    it('객체를 JSON으로 저장하고 파싱할 수 있다', async () => {
      const data = { name: 'test', count: 42, nested: { value: true } };
      await storage.setItem('json-key', JSON.stringify(data));

      const raw = await storage.getItem('json-key');
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw!);
      expect(parsed).toEqual(data);
    });
  });
});
