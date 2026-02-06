/**
 * @file platform/storage.ts
 * @description 플랫폼 독립적 스토리지 인터페이스 (웹: localStorage)
 */

/**
 * Storage 인터페이스
 */
export interface StorageInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<string[]>;
  multiRemove(keys: string[]): Promise<void>;
  clear(): Promise<void>;
}

/**
 * localStorage 기반 스토리지 구현
 */
class WebStorage implements StorageInterface {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch {
      console.warn('[Storage] Failed to get item:', key);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('[Storage] Failed to set item:', key, error);
      // localStorage가 가득 찬 경우 등
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch {
      console.warn('[Storage] Failed to remove item:', key);
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null) {
          keys.push(key);
        }
      }
      return keys;
    } catch {
      return [];
    }
  }

  async multiRemove(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.removeItem(key);
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch {
      console.warn('[Storage] Failed to clear storage');
    }
  }
}

/**
 * 메모리 폴백 스토리지 (SSR 환경 등)
 */
class MemoryStorage implements StorageInterface {
  private data: Record<string, string> = {};

  async getItem(key: string): Promise<string | null> {
    return this.data[key] ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.data[key] = value;
  }

  async removeItem(key: string): Promise<void> {
    delete this.data[key];
  }

  async getAllKeys(): Promise<string[]> {
    return Object.keys(this.data);
  }

  async multiRemove(keys: string[]): Promise<void> {
    keys.forEach((key) => delete this.data[key]);
  }

  async clear(): Promise<void> {
    this.data = {};
  }
}

/**
 * 플랫폼에 맞는 스토리지 인스턴스 생성
 */
function createStorage(): StorageInterface {
  if (typeof window !== 'undefined' && window.localStorage) {
    return new WebStorage();
  }
  return new MemoryStorage();
}

/**
 * 싱글톤 스토리지 인스턴스
 */
export const storage = createStorage();
