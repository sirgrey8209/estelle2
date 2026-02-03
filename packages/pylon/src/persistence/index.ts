/**
 * @file index.ts
 * @description Persistence 모듈 export
 */

export type { PersistenceAdapter } from './types.js';
export {
  FileSystemPersistence,
  type FileSystemInterface,
} from './file-system-persistence.js';
export { InMemoryPersistence } from './in-memory-persistence.js';
