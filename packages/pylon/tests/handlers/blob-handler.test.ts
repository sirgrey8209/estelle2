/**
 * @file blob-handler.test.ts
 * @description BlobHandler 테스트
 *
 * 대용량 파일(이미지) 전송 처리 로직을 테스트합니다.
 * 파일 시스템 접근은 FileSystemAdapter를 통해 추상화되어 있어
 * 실제 파일 I/O 없이 순수하게 테스트할 수 있습니다.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BlobHandler,
  type BlobTransfer,
  type FileSystemAdapter,
  type BlobHandlerResult,
  type SendFileFn,
} from '../../src/handlers/blob-handler.js';
import type {
  BlobStartPayload,
  BlobChunkPayload,
  BlobEndPayload,
  BlobRequestPayload,
  BlobContext,
  Message,
} from '@estelle/core';
import { BlobConfig } from '@estelle/core';

// ============================================================================
// 테스트 헬퍼
// ============================================================================

/**
 * 테스트용 Mock FileSystemAdapter 생성
 */
function createMockFs(): FileSystemAdapter {
  const files = new Map<string, Buffer>();

  return {
    exists: vi.fn((path: string) => files.has(path)),
    readFile: vi.fn((path: string) => {
      const data = files.get(path);
      if (!data) throw new Error(`File not found: ${path}`);
      return data;
    }),
    writeFile: vi.fn((path: string, data: Buffer) => {
      files.set(path, data);
    }),
    mkdir: vi.fn(),
    findFile: vi.fn((_dir: string, _filename: string) => undefined),

    // 테스트용: 파일 추가/제거 메서드
    _setFile: (path: string, data: Buffer) => files.set(path, data),
    _getFile: (path: string) => files.get(path),
    _clear: () => files.clear(),
  };
}

/**
 * Base64 인코딩된 청크 데이터 생성
 */
function createChunkData(content: string): string {
  return Buffer.from(content).toString('base64');
}

/**
 * 테스트용 BlobContext 생성
 */
function createTestContext(overrides?: Partial<BlobContext>): BlobContext {
  return {
    type: 'image_upload',
    conversationId: 'conv-123',
    ...overrides,
  };
}

// ============================================================================
// BlobHandler 테스트
// ============================================================================

describe('BlobHandler', () => {
  let handler: BlobHandler;
  let mockFs: FileSystemAdapter & {
    _setFile: (path: string, data: Buffer) => void;
    _getFile: (path: string) => Buffer | undefined;
    _clear: () => void;
  };
  let sentMessages: Message<unknown>[];
  let sendFn: SendFileFn;

  beforeEach(() => {
    mockFs = createMockFs() as typeof mockFs;
    sentMessages = [];
    sendFn = vi.fn((msg: Message<unknown>) => {
      sentMessages.push(msg);
    });
    handler = new BlobHandler({
      uploadsDir: '/uploads',
      fs: mockFs,
      sendFn,
    });
  });

  // ==========================================================================
  // handleBlobStart 테스트
  // ==========================================================================

  describe('handleBlobStart', () => {
    it('should initialize transfer for normal file upload', () => {
      const payload: BlobStartPayload = {
        blobId: 'blob-001',
        filename: 'test.png',
        mimeType: 'image/png',
        totalSize: 1024,
        chunkSize: BlobConfig.CHUNK_SIZE,
        totalChunks: 1,
        encoding: 'base64',
        context: createTestContext(),
      };

      const result = handler.handleBlobStart(payload, 'device-001');

      expect(result.success).toBe(true);
      expect(handler.getTransfer('blob-001')).toBeDefined();
    });

    it('should create conversation directory if not exists', () => {
      const payload: BlobStartPayload = {
        blobId: 'blob-001',
        filename: 'test.png',
        mimeType: 'image/png',
        totalSize: 1024,
        chunkSize: BlobConfig.CHUNK_SIZE,
        totalChunks: 1,
        encoding: 'base64',
        context: createTestContext({ conversationId: 'conv-new' }),
      };

      handler.handleBlobStart(payload, 'device-001');

      expect(mockFs.mkdir).toHaveBeenCalledWith('/uploads/conv-new');
    });

    it('should use root uploads folder when conversationId is empty', () => {
      const payload: BlobStartPayload = {
        blobId: 'blob-001',
        filename: 'test.png',
        mimeType: 'image/png',
        totalSize: 1024,
        chunkSize: BlobConfig.CHUNK_SIZE,
        totalChunks: 1,
        encoding: 'base64',
        context: { type: 'image_upload', conversationId: '' },
      };

      handler.handleBlobStart(payload, 'device-001');

      expect(mockFs.mkdir).toHaveBeenCalledWith('/uploads/');
    });

    it('should sanitize filename', () => {
      const payload: BlobStartPayload = {
        blobId: 'blob-001',
        filename: 'test<>:"/\\|?*.png',
        mimeType: 'image/png',
        totalSize: 1024,
        chunkSize: BlobConfig.CHUNK_SIZE,
        totalChunks: 1,
        encoding: 'base64',
        context: createTestContext(),
      };

      handler.handleBlobStart(payload, 'device-001');

      const transfer = handler.getTransfer('blob-001');
      expect(transfer?.savePath).toMatch(/test[_]+\.png$/);
    });

    it('should handle sameDevice optimization with existing file', () => {
      // 로컬 파일이 존재하는 경우
      mockFs._setFile('C:/local/image.png', Buffer.from('test'));

      const payload: BlobStartPayload = {
        blobId: 'blob-001',
        filename: 'image.png',
        mimeType: 'image/png',
        totalSize: 4,
        chunkSize: BlobConfig.CHUNK_SIZE,
        totalChunks: 1,
        encoding: 'base64',
        context: createTestContext(),
        sameDevice: true,
        localPath: 'C:/local/image.png',
      };

      const result = handler.handleBlobStart(payload, 'device-001');

      expect(result.success).toBe(true);
      expect(result.path).toBe('C:/local/image.png');
      expect(result.sameDevice).toBe(true);

      const transfer = handler.getTransfer('blob-001');
      expect(transfer?.completed).toBe(true);
    });

    it('should fallback to normal upload when sameDevice file not found', () => {
      const payload: BlobStartPayload = {
        blobId: 'blob-001',
        filename: 'image.png',
        mimeType: 'image/png',
        totalSize: 1024,
        chunkSize: BlobConfig.CHUNK_SIZE,
        totalChunks: 2,
        encoding: 'base64',
        context: createTestContext(),
        sameDevice: true,
        localPath: 'C:/not/exists.png',
      };

      const result = handler.handleBlobStart(payload, 'device-001');

      expect(result.success).toBe(true);
      expect(result.sameDevice).toBeUndefined();

      const transfer = handler.getTransfer('blob-001');
      expect(transfer?.sameDevice).toBeFalsy();
      expect(transfer?.completed).toBe(false);
    });
  });

  // ==========================================================================
  // handleBlobChunk 테스트
  // ==========================================================================

  describe('handleBlobChunk', () => {
    beforeEach(() => {
      // 전송 시작
      handler.handleBlobStart(
        {
          blobId: 'blob-001',
          filename: 'test.png',
          mimeType: 'image/png',
          totalSize: 6,
          chunkSize: BlobConfig.CHUNK_SIZE,
          totalChunks: 2,
          encoding: 'base64',
          context: createTestContext(),
        },
        'device-001'
      );
    });

    it('should store chunk data', () => {
      const payload: BlobChunkPayload = {
        blobId: 'blob-001',
        index: 0,
        data: createChunkData('abc'),
        size: 3,
      };

      const result = handler.handleBlobChunk(payload);

      expect(result.success).toBe(true);
      expect(result.received).toBe(1);
    });

    it('should handle multiple chunks in order', () => {
      handler.handleBlobChunk({
        blobId: 'blob-001',
        index: 0,
        data: createChunkData('abc'),
        size: 3,
      });
      const result = handler.handleBlobChunk({
        blobId: 'blob-001',
        index: 1,
        data: createChunkData('def'),
        size: 3,
      });

      expect(result.received).toBe(2);
    });

    it('should handle out-of-order chunks', () => {
      // 두 번째 청크 먼저
      handler.handleBlobChunk({
        blobId: 'blob-001',
        index: 1,
        data: createChunkData('def'),
        size: 3,
      });
      // 첫 번째 청크
      const result = handler.handleBlobChunk({
        blobId: 'blob-001',
        index: 0,
        data: createChunkData('abc'),
        size: 3,
      });

      expect(result.received).toBe(2);
    });

    it('should fail for unknown blobId', () => {
      const result = handler.handleBlobChunk({
        blobId: 'unknown-blob',
        index: 0,
        data: createChunkData('abc'),
        size: 3,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown transfer');
    });

    it('should ignore chunks for sameDevice transfer', () => {
      // sameDevice 전송 시작
      mockFs._setFile('C:/local/image.png', Buffer.from('test'));
      handler.handleBlobStart(
        {
          blobId: 'blob-same',
          filename: 'image.png',
          mimeType: 'image/png',
          totalSize: 4,
          chunkSize: BlobConfig.CHUNK_SIZE,
          totalChunks: 1,
          encoding: 'base64',
          context: createTestContext(),
          sameDevice: true,
          localPath: 'C:/local/image.png',
        },
        'device-001'
      );

      const result = handler.handleBlobChunk({
        blobId: 'blob-same',
        index: 0,
        data: createChunkData('ignored'),
        size: 7,
      });

      expect(result.success).toBe(true);
      // receivedCount가 증가하지 않음
      const transfer = handler.getTransfer('blob-same');
      expect(transfer?.receivedCount).toBe(0);
    });
  });

  // ==========================================================================
  // handleBlobEnd 테스트
  // ==========================================================================

  describe('handleBlobEnd', () => {
    beforeEach(() => {
      // 전송 시작 및 청크 전송
      handler.handleBlobStart(
        {
          blobId: 'blob-001',
          filename: 'test.txt',
          mimeType: 'text/plain',
          totalSize: 6,
          chunkSize: BlobConfig.CHUNK_SIZE,
          totalChunks: 2,
          encoding: 'base64',
          context: createTestContext(),
        },
        'device-001'
      );
      handler.handleBlobChunk({
        blobId: 'blob-001',
        index: 0,
        data: createChunkData('abc'),
        size: 3,
      });
      handler.handleBlobChunk({
        blobId: 'blob-001',
        index: 1,
        data: createChunkData('def'),
        size: 3,
      });
    });

    it('should assemble chunks and write file', () => {
      const payload: BlobEndPayload = {
        blobId: 'blob-001',
        totalReceived: 6,
      };

      const result = handler.handleBlobEnd(payload);

      expect(result.success).toBe(true);
      expect(result.path).toContain('test.txt');
      expect(mockFs.writeFile).toHaveBeenCalled();

      // 파일 내용 확인
      const writtenData = (mockFs.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as Buffer;
      expect(writtenData.toString()).toBe('abcdef');
    });

    it('should verify checksum when provided', () => {
      // 'abcdef'의 sha256
      const correctChecksum = 'sha256:bef57ec7f53a6d40beb640a780a639c83bc29ac8a9816f1fc6c5c6dcd93c4721';

      const result = handler.handleBlobEnd({
        blobId: 'blob-001',
        checksum: correctChecksum,
        totalReceived: 6,
      });

      expect(result.success).toBe(true);
    });

    it('should fail on checksum mismatch', () => {
      const wrongChecksum = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

      const result = handler.handleBlobEnd({
        blobId: 'blob-001',
        checksum: wrongChecksum,
        totalReceived: 6,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Checksum mismatch');
    });

    it('should fail when chunks are missing', () => {
      // 새로운 전송 시작 (청크 없이)
      handler.handleBlobStart(
        {
          blobId: 'blob-incomplete',
          filename: 'incomplete.txt',
          mimeType: 'text/plain',
          totalSize: 100,
          chunkSize: BlobConfig.CHUNK_SIZE,
          totalChunks: 5,
          encoding: 'base64',
          context: createTestContext(),
        },
        'device-001'
      );
      // 일부 청크만 전송
      handler.handleBlobChunk({
        blobId: 'blob-incomplete',
        index: 0,
        data: createChunkData('chunk0'),
        size: 6,
      });
      handler.handleBlobChunk({
        blobId: 'blob-incomplete',
        index: 2,
        data: createChunkData('chunk2'),
        size: 6,
      });

      const result = handler.handleBlobEnd({
        blobId: 'blob-incomplete',
        totalReceived: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing chunks');
    });

    it('should handle sameDevice transfer end', () => {
      mockFs._setFile('C:/local/image.png', Buffer.from('test'));
      handler.handleBlobStart(
        {
          blobId: 'blob-same',
          filename: 'image.png',
          mimeType: 'image/png',
          totalSize: 4,
          chunkSize: BlobConfig.CHUNK_SIZE,
          totalChunks: 1,
          encoding: 'base64',
          context: createTestContext(),
          sameDevice: true,
          localPath: 'C:/local/image.png',
        },
        'device-001'
      );

      const result = handler.handleBlobEnd({
        blobId: 'blob-same',
        totalReceived: 4,
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('C:/local/image.png');
      // writeFile이 호출되지 않음 (로컬 파일 사용)
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should return context in result', () => {
      const result = handler.handleBlobEnd({
        blobId: 'blob-001',
        totalReceived: 6,
      });

      expect(result.context).toBeDefined();
      expect(result.context?.conversationId).toBe('conv-123');
    });

    it('should clean up chunks after successful write', () => {
      handler.handleBlobEnd({
        blobId: 'blob-001',
        totalReceived: 6,
      });

      const transfer = handler.getTransfer('blob-001');
      expect(transfer?.chunks).toHaveLength(0);
    });
  });

  // ==========================================================================
  // handleBlobRequest 테스트
  // ==========================================================================

  describe('handleBlobRequest', () => {
    it('should send file chunks when file exists via localPath', () => {
      const fileContent = 'Hello World!';
      mockFs._setFile('C:/uploads/conv-123/image.png', Buffer.from(fileContent));

      const payload: BlobRequestPayload = {
        blobId: 'request-001',
        filename: 'image.png',
        localPath: 'C:/uploads/conv-123/image.png',
      };

      const result = handler.handleBlobRequest(payload, 'device-001');

      expect(result.success).toBe(true);

      // blob_start, blob_chunk, blob_end 메시지 확인
      expect(sentMessages.length).toBeGreaterThanOrEqual(3);
      expect(sentMessages[0].type).toBe('blob_start');
      expect(sentMessages[sentMessages.length - 1].type).toBe('blob_end');
    });

    it('should search in uploads directory when localPath not found', () => {
      const fileContent = 'Test file content';
      // findFile mock 설정
      (mockFs.findFile as ReturnType<typeof vi.fn>).mockReturnValue('/uploads/conv-123/test.txt');
      mockFs._setFile('/uploads/conv-123/test.txt', Buffer.from(fileContent));

      const payload: BlobRequestPayload = {
        blobId: 'request-002',
        filename: 'test.txt',
      };

      const result = handler.handleBlobRequest(payload, 'device-001');

      expect(result.success).toBe(true);
      expect(mockFs.findFile).toHaveBeenCalled();
    });

    it('should fail when file not found', () => {
      const payload: BlobRequestPayload = {
        blobId: 'request-003',
        filename: 'notfound.png',
      };

      const result = handler.handleBlobRequest(payload, 'device-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should include checksum in blob_end', () => {
      const fileContent = 'Test';
      mockFs._setFile('C:/test.txt', Buffer.from(fileContent));

      handler.handleBlobRequest(
        {
          blobId: 'request-004',
          filename: 'test.txt',
          localPath: 'C:/test.txt',
        },
        'device-001'
      );

      const endMessage = sentMessages.find((m) => m.type === 'blob_end');
      expect(endMessage).toBeDefined();
      expect((endMessage?.payload as BlobEndPayload).checksum).toMatch(/^sha256:/);
    });

    it('should split large files into chunks', () => {
      // 200KB 파일 (CHUNK_SIZE = 64KB)
      const largeContent = Buffer.alloc(200 * 1024, 'x');
      mockFs._setFile('C:/large.bin', largeContent);

      handler.handleBlobRequest(
        {
          blobId: 'request-large',
          filename: 'large.bin',
          localPath: 'C:/large.bin',
        },
        'device-001'
      );

      const startMessage = sentMessages.find((m) => m.type === 'blob_start');
      const chunkMessages = sentMessages.filter((m) => m.type === 'blob_chunk');

      expect(startMessage).toBeDefined();
      expect((startMessage?.payload as BlobStartPayload).totalChunks).toBe(4); // 200KB / 64KB = ~4
      expect(chunkMessages.length).toBe(4);
    });
  });

  // ==========================================================================
  // getMimeType 테스트
  // ==========================================================================

  describe('getMimeType', () => {
    it('should return correct mime type for images', () => {
      expect(handler.getMimeType('photo.jpg')).toBe('image/jpeg');
      expect(handler.getMimeType('photo.jpeg')).toBe('image/jpeg');
      expect(handler.getMimeType('image.png')).toBe('image/png');
      expect(handler.getMimeType('animation.gif')).toBe('image/gif');
      expect(handler.getMimeType('photo.webp')).toBe('image/webp');
    });

    it('should return correct mime type for text files', () => {
      expect(handler.getMimeType('readme.md')).toBe('text/markdown');
      expect(handler.getMimeType('notes.txt')).toBe('text/plain');
      expect(handler.getMimeType('data.json')).toBe('application/json');
      expect(handler.getMimeType('config.yaml')).toBe('text/yaml');
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(handler.getMimeType('file.xyz')).toBe('application/octet-stream');
      expect(handler.getMimeType('noextension')).toBe('application/octet-stream');
    });
  });

  // ==========================================================================
  // cleanup 테스트
  // ==========================================================================

  describe('cleanup', () => {
    it('should remove transfer from active transfers', () => {
      handler.handleBlobStart(
        {
          blobId: 'blob-cleanup',
          filename: 'test.txt',
          mimeType: 'text/plain',
          totalSize: 10,
          chunkSize: BlobConfig.CHUNK_SIZE,
          totalChunks: 1,
          encoding: 'base64',
          context: createTestContext(),
        },
        'device-001'
      );

      expect(handler.getTransfer('blob-cleanup')).toBeDefined();

      handler.cleanup('blob-cleanup');

      expect(handler.getTransfer('blob-cleanup')).toBeUndefined();
    });
  });

  // ==========================================================================
  // 진행률 추적 테스트
  // ==========================================================================

  describe('progress tracking', () => {
    it('should track progress correctly', () => {
      handler.handleBlobStart(
        {
          blobId: 'blob-progress',
          filename: 'test.txt',
          mimeType: 'text/plain',
          totalSize: 10,
          chunkSize: BlobConfig.CHUNK_SIZE,
          totalChunks: 10,
          encoding: 'base64',
          context: createTestContext(),
        },
        'device-001'
      );

      // 5개 청크 전송
      for (let i = 0; i < 5; i++) {
        handler.handleBlobChunk({
          blobId: 'blob-progress',
          index: i,
          data: createChunkData('x'),
          size: 1,
        });
      }

      const transfer = handler.getTransfer('blob-progress');
      expect(transfer?.receivedCount).toBe(5);
      expect(transfer?.totalChunks).toBe(10);
    });
  });
});
