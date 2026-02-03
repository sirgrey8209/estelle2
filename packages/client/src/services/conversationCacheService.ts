/**
 * 대화 캐시 서비스 (v1 Flutter 대응)
 *
 * AsyncStorage를 사용하여 대화 내용을 캐싱합니다.
 * - 대화별 메시지 캐시
 * - 마지막 읽은 위치 저장
 * - 캐시 만료 관리
 */

// AsyncStorage 타입만 import (런타임에는 조건부 import)
import type { ClaudeMessage } from '../stores/claudeStore';

// AsyncStorage 인터페이스 (react-native-async-storage 미설치 시 대응)
interface AsyncStorageStatic {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

// 동적 import (패키지 미설치 시 메모리 폴백)
let AsyncStorage: AsyncStorageStatic;

// 메모리 폴백 스토리지
const memoryStorage: Record<string, string> = {};
const fallbackStorage: AsyncStorageStatic = {
  async getItem(key: string) {
    return memoryStorage[key] ?? null;
  },
  async setItem(key: string, value: string) {
    memoryStorage[key] = value;
  },
  async removeItem(key: string) {
    delete memoryStorage[key];
  },
  async getAllKeys() {
    return Object.keys(memoryStorage);
  },
  async multiRemove(keys: readonly string[]) {
    keys.forEach((key) => delete memoryStorage[key]);
  },
};

// AsyncStorage 초기화
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  console.warn('[ConversationCache] AsyncStorage not available, using memory fallback');
  AsyncStorage = fallbackStorage;
}

/**
 * 캐시 키 접두사
 */
const CACHE_PREFIX = '@estelle:conversation:';
const METADATA_PREFIX = '@estelle:conv_meta:';

/**
 * 캐시 메타데이터
 */
interface CacheMetadata {
  /** 마지막 업데이트 시간 */
  lastUpdated: number;
  /** 메시지 수 */
  messageCount: number;
  /** 마지막 읽은 메시지 ID */
  lastReadMessageId?: string;
}

/**
 * 캐시 데이터
 */
interface CacheData {
  messages: ClaudeMessage[];
  metadata: CacheMetadata;
}

/**
 * 캐시 설정
 */
interface CacheConfig {
  /** 캐시 만료 시간 (ms) - 기본 7일 */
  expirationMs: number;
  /** 최대 메시지 수 */
  maxMessages: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  expirationMs: 7 * 24 * 60 * 60 * 1000, // 7일
  maxMessages: 500,
};

/**
 * 대화 캐시 클래스
 */
class ConversationCacheService {
  private config: CacheConfig;
  private memoryCache: Map<string, CacheData>;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryCache = new Map();
  }

  /**
   * 캐시 키 생성
   */
  private getCacheKey(conversationId: string): string {
    return `${CACHE_PREFIX}${conversationId}`;
  }

  /**
   * 메타데이터 키 생성
   */
  private getMetadataKey(conversationId: string): string {
    return `${METADATA_PREFIX}${conversationId}`;
  }

  /**
   * 메시지 저장
   */
  async saveMessages(conversationId: string, messages: ClaudeMessage[]): Promise<void> {
    try {
      // 최대 메시지 수 제한
      const trimmedMessages = messages.slice(-this.config.maxMessages);

      const cacheData: CacheData = {
        messages: trimmedMessages,
        metadata: {
          lastUpdated: Date.now(),
          messageCount: trimmedMessages.length,
        },
      };

      // 메모리 캐시 업데이트
      this.memoryCache.set(conversationId, cacheData);

      // AsyncStorage 저장
      await AsyncStorage.setItem(
        this.getCacheKey(conversationId),
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.error('[ConversationCache] Failed to save messages:', error);
    }
  }

  /**
   * 메시지 로드
   */
  async loadMessages(conversationId: string): Promise<ClaudeMessage[]> {
    try {
      // 메모리 캐시 확인
      const memoryData = this.memoryCache.get(conversationId);
      if (memoryData) {
        return memoryData.messages;
      }

      // AsyncStorage에서 로드
      const raw = await AsyncStorage.getItem(this.getCacheKey(conversationId));
      if (!raw) {
        return [];
      }

      const cacheData: CacheData = JSON.parse(raw);

      // 만료 확인
      if (this.isExpired(cacheData.metadata.lastUpdated)) {
        await this.clearCache(conversationId);
        return [];
      }

      // 메모리 캐시 업데이트
      this.memoryCache.set(conversationId, cacheData);

      return cacheData.messages;
    } catch (error) {
      console.error('[ConversationCache] Failed to load messages:', error);
      return [];
    }
  }

  /**
   * 메시지 추가 (기존에 추가)
   */
  async appendMessage(conversationId: string, message: ClaudeMessage): Promise<void> {
    const messages = await this.loadMessages(conversationId);
    messages.push(message);
    await this.saveMessages(conversationId, messages);
  }

  /**
   * 마지막 읽은 위치 저장
   */
  async setLastReadMessage(conversationId: string, messageId: string): Promise<void> {
    try {
      const cacheData = this.memoryCache.get(conversationId);
      if (cacheData) {
        cacheData.metadata.lastReadMessageId = messageId;
        await AsyncStorage.setItem(
          this.getCacheKey(conversationId),
          JSON.stringify(cacheData)
        );
      }
    } catch (error) {
      console.error('[ConversationCache] Failed to set last read:', error);
    }
  }

  /**
   * 마지막 읽은 위치 가져오기
   */
  async getLastReadMessage(conversationId: string): Promise<string | undefined> {
    const cacheData = this.memoryCache.get(conversationId);
    return cacheData?.metadata.lastReadMessageId;
  }

  /**
   * 캐시 초기화
   */
  async clearCache(conversationId: string): Promise<void> {
    try {
      this.memoryCache.delete(conversationId);
      await AsyncStorage.removeItem(this.getCacheKey(conversationId));
    } catch (error) {
      console.error('[ConversationCache] Failed to clear cache:', error);
    }
  }

  /**
   * 모든 캐시 초기화
   */
  async clearAllCaches(): Promise<void> {
    try {
      this.memoryCache.clear();

      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((key: string) => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('[ConversationCache] Failed to clear all caches:', error);
    }
  }

  /**
   * 만료된 캐시 정리
   */
  async cleanupExpiredCaches(): Promise<number> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((key: string) => key.startsWith(CACHE_PREFIX));

      let cleanedCount = 0;

      for (let i = 0; i < cacheKeys.length; i++) {
        const key = cacheKeys[i];
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const cacheData: CacheData = JSON.parse(raw);
          if (this.isExpired(cacheData.metadata.lastUpdated)) {
            await AsyncStorage.removeItem(key);
            cleanedCount++;
          }
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('[ConversationCache] Failed to cleanup:', error);
      return 0;
    }
  }

  /**
   * 캐시 통계
   */
  async getStats(): Promise<{ conversationCount: number; totalMessages: number }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((key: string) => key.startsWith(CACHE_PREFIX));

      let totalMessages = 0;

      for (let i = 0; i < cacheKeys.length; i++) {
        const key = cacheKeys[i];
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const cacheData: CacheData = JSON.parse(raw);
          totalMessages += cacheData.metadata.messageCount;
        }
      }

      return {
        conversationCount: cacheKeys.length,
        totalMessages,
      };
    } catch (error) {
      console.error('[ConversationCache] Failed to get stats:', error);
      return { conversationCount: 0, totalMessages: 0 };
    }
  }

  /**
   * 만료 확인
   */
  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.config.expirationMs;
  }
}

/**
 * 기본 인스턴스
 */
export const conversationCache = new ConversationCacheService();

export type { CacheMetadata, CacheData, CacheConfig };
