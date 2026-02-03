import { describe, it, expect, beforeEach } from 'vitest';
import { ImageCacheService } from './imageCacheService';

describe('ImageCacheService', () => {
  let cache: ImageCacheService;

  beforeEach(() => {
    cache = new ImageCacheService({ maxSizeBytes: 1024 * 1024 }); // 1MB
  });

  describe('기본 동작', () => {
    it('should store and retrieve data', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);

      cache.set('image1.png', data);
      const retrieved = cache.get('image1.png');

      expect(retrieved).toEqual(data);
    });

    it('should return undefined for unknown key', () => {
      expect(cache.get('unknown.png')).toBeUndefined();
    });

    it('should check if key exists', () => {
      const data = new Uint8Array([1, 2, 3]);

      expect(cache.has('image.png')).toBe(false);

      cache.set('image.png', data);

      expect(cache.has('image.png')).toBe(true);
    });

    it('should delete entry', () => {
      const data = new Uint8Array([1, 2, 3]);

      cache.set('image.png', data);
      cache.delete('image.png');

      expect(cache.has('image.png')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('image1.png', new Uint8Array([1]));
      cache.set('image2.png', new Uint8Array([2]));

      cache.clear();

      expect(cache.has('image1.png')).toBe(false);
      expect(cache.has('image2.png')).toBe(false);
    });
  });

  describe('LRU 정책', () => {
    it('should evict least recently used when over capacity', () => {
      // 1MB 캐시에 500KB 이미지 3개 추가 시도
      const size500KB = 500 * 1024;
      const data1 = new Uint8Array(size500KB);
      const data2 = new Uint8Array(size500KB);
      const data3 = new Uint8Array(size500KB);

      cache.set('image1.png', data1);
      cache.set('image2.png', data2);
      cache.set('image3.png', data3); // 이때 image1이 제거되어야 함

      expect(cache.has('image1.png')).toBe(false);
      expect(cache.has('image2.png')).toBe(true);
      expect(cache.has('image3.png')).toBe(true);
    });

    it('should update access order on get', () => {
      const size400KB = 400 * 1024;
      const data1 = new Uint8Array(size400KB);
      const data2 = new Uint8Array(size400KB);
      const data3 = new Uint8Array(size400KB);

      cache.set('image1.png', data1);
      cache.set('image2.png', data2);

      // image1을 접근해서 최근 사용으로 이동
      cache.get('image1.png');

      // image3 추가 시 image2가 제거되어야 함
      cache.set('image3.png', data3);

      expect(cache.has('image1.png')).toBe(true);
      expect(cache.has('image2.png')).toBe(false);
      expect(cache.has('image3.png')).toBe(true);
    });
  });

  describe('통계', () => {
    it('should track cache stats', () => {
      cache.set('image1.png', new Uint8Array(1000));
      cache.set('image2.png', new Uint8Array(2000));

      const stats = cache.getStats();

      expect(stats.count).toBe(2);
      expect(stats.sizeBytes).toBe(3000);
      expect(stats.maxSizeBytes).toBe(1024 * 1024);
    });

    it('should calculate usage percentage', () => {
      // 1MB 캐시에 500KB 데이터
      cache.set('image.png', new Uint8Array(512 * 1024));

      const stats = cache.getStats();

      expect(stats.usagePercent).toBeCloseTo(50, 0);
    });
  });
});
