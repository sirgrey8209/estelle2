/**
 * 캐시 통계 정보
 */
export interface CacheStats {
  /** 캐시된 항목 수 */
  count: number;

  /** 현재 사용 중인 바이트 */
  sizeBytes: number;

  /** 최대 용량 바이트 */
  maxSizeBytes: number;

  /** 사용률 (%) */
  usagePercent: number;
}

/**
 * 캐시 설정
 */
export interface CacheConfig {
  /** 최대 캐시 크기 (바이트) */
  maxSizeBytes: number;
}

/**
 * 캐시 엔트리
 */
interface CacheEntry {
  data: Uint8Array;
  size: number;
}

/**
 * 이미지 캐시 서비스 (LRU)
 *
 * 메모리에 이미지를 캐싱하고 LRU 정책으로 오래된 항목을 제거합니다.
 */
export class ImageCacheService {
  private cache: Map<string, CacheEntry>;
  private accessOrder: string[];
  private currentSize: number;
  private maxSize: number;

  constructor(config: CacheConfig) {
    this.cache = new Map();
    this.accessOrder = [];
    this.currentSize = 0;
    this.maxSize = config.maxSizeBytes;
  }

  /**
   * 캐시에서 이미지 조회
   */
  get(key: string): Uint8Array | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // 접근 순서 갱신
    this.updateAccessOrder(key);

    return entry.data;
  }

  /**
   * 캐시에 이미지 저장
   */
  set(key: string, data: Uint8Array): void {
    const size = data.length;

    // 기존 항목 삭제 (업데이트 시)
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // 공간 확보
    while (this.currentSize + size > this.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder[0];
      this.delete(oldestKey);
    }

    // 단일 항목이 최대 크기보다 큰 경우 저장하지 않음
    if (size > this.maxSize) {
      return;
    }

    // 저장
    this.cache.set(key, { data, size });
    this.accessOrder.push(key);
    this.currentSize += size;
  }

  /**
   * 캐시에 키 존재 여부 확인
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * 캐시에서 항목 삭제
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.currentSize -= entry.size;
    this.accessOrder = this.accessOrder.filter((k) => k !== key);

    return true;
  }

  /**
   * 캐시 전체 초기화
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.currentSize = 0;
  }

  /**
   * 캐시 통계 조회
   */
  getStats(): CacheStats {
    return {
      count: this.cache.size,
      sizeBytes: this.currentSize,
      maxSizeBytes: this.maxSize,
      usagePercent: this.maxSize > 0 ? (this.currentSize / this.maxSize) * 100 : 0,
    };
  }

  /**
   * 접근 순서 갱신 (LRU)
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }
  }
}

/**
 * 기본 캐시 인스턴스 (50MB)
 */
export const imageCache = new ImageCacheService({
  maxSizeBytes: 50 * 1024 * 1024,
});
