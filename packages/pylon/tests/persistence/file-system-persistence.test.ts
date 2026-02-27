/**
 * @file file-system-persistence.test.ts
 * @description FileSystemPersistence 테스트
 *
 * 실제 파일시스템 대신 인메모리 mock을 사용하여 테스트합니다.
 * 메시지는 SQLite MessageStore에서 관리되므로 여기서는 테스트하지 않습니다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileSystemPersistence } from '../../src/persistence/file-system-persistence.js';
import type { WorkspaceStoreData } from '../../src/stores/workspace-store.js';

// ============================================================================
// Mock 파일시스템
// ============================================================================

interface MockFileSystem {
  existsSync: ReturnType<typeof vi.fn>;
  readFileSync: ReturnType<typeof vi.fn>;
  writeFileSync: ReturnType<typeof vi.fn>;
  mkdirSync: ReturnType<typeof vi.fn>;
  readdirSync: ReturnType<typeof vi.fn>;
  unlinkSync: ReturnType<typeof vi.fn>;
}

function createMockFileSystem(): MockFileSystem {
  return {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
}

// ============================================================================
// 테스트
// ============================================================================

describe('FileSystemPersistence', () => {
  let mockFs: MockFileSystem;
  let persistence: FileSystemPersistence;
  const baseDir = '/test/data';

  beforeEach(() => {
    mockFs = createMockFileSystem();
    persistence = new FileSystemPersistence(baseDir, mockFs);
  });

  // ============================================================================
  // 생성자 테스트
  // ============================================================================

  describe('constructor', () => {
    it('should create instance with baseDir', () => {
      expect(persistence).toBeInstanceOf(FileSystemPersistence);
    });

    it('should ensure data directory exists on construction', () => {
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(baseDir, { recursive: true });
    });
  });

  // ============================================================================
  // WorkspaceStore 테스트
  // ============================================================================

  describe('loadWorkspaceStore', () => {
    it('should return undefined when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = persistence.loadWorkspaceStore();

      expect(result).toBeUndefined();
    });

    it('should load and parse workspace data from file', () => {
      const mockData: WorkspaceStoreData = {
        activeWorkspaceId: 'ws-1',
        activeConversationId: 'conv-1',
        workspaces: [],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockData));

      const result = persistence.loadWorkspaceStore();

      expect(result).toEqual(mockData);
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('workspaces.json'),
        'utf-8'
      );
    });

    it('should return undefined on parse error', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      const result = persistence.loadWorkspaceStore();

      expect(result).toBeUndefined();
    });

    it('should return undefined on read error', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = persistence.loadWorkspaceStore();

      expect(result).toBeUndefined();
    });
  });

  describe('saveWorkspaceStore', () => {
    it('should write workspace data to file', async () => {
      const mockData: WorkspaceStoreData = {
        activeWorkspaceId: 'ws-1',
        activeConversationId: 'conv-1',
        workspaces: [
          {
            workspaceId: 'ws-1',
            name: 'Test',
            workingDir: '/test',
            conversations: [],
            createdAt: Date.now(),
            lastUsed: Date.now(),
          },
        ],
      };

      await persistence.saveWorkspaceStore(mockData);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('workspaces.json'),
        expect.any(String),
        'utf-8'
      );

      // JSON 형식 확인
      const writtenContent = mockFs.writeFileSync.mock.calls[0][1];
      expect(JSON.parse(writtenContent)).toEqual(mockData);
    });
  });
});
