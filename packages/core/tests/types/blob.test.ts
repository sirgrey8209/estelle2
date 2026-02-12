/**
 * @file blob.test.ts
 * @description Blob 전송 관련 타입 테스트
 */

import { describe, it, expect } from 'vitest';
import type {
  Attachment,
  BlobContextType,
  BlobContext,
  BlobStartPayload,
  BlobChunkPayload,
  BlobEndPayload,
  BlobAckPayload,
  BlobRequestPayload,
} from '../../src/types/blob.js';
import {
  isAttachment,
  isBlobContextType,
  isBlobContext,
  isBlobStartPayload,
  isBlobChunkPayload,
  isBlobEndPayload,
  isBlobAckPayload,
  isBlobRequestPayload,
} from '../../src/types/blob.js';
import {
  encodePylonId,
  encodeWorkspaceId,
  encodeConversationId,
} from '../../src/utils/id-system.js';

/** 테스트용 ConversationId 생성 헬퍼 */
function createTestConversationId(
  envId: 0 | 1 | 2,
  deviceIndex: number,
  workspaceIndex: number,
  conversationIndex: number
) {
  const pylonId = encodePylonId(envId, deviceIndex);
  const workspaceId = encodeWorkspaceId(pylonId, workspaceIndex);
  return encodeConversationId(workspaceId, conversationIndex);
}

const TEST_CONVERSATION_ID = createTestConversationId(0, 1, 1, 1);

describe('Attachment', () => {
  it('should have all required properties', () => {
    const attachment: Attachment = {
      id: 'att-001',
      filename: 'document.pdf',
      mimeType: 'application/pdf',
      size: 1024,
    };

    expect(attachment.id).toBe('att-001');
    expect(attachment.filename).toBe('document.pdf');
    expect(attachment.mimeType).toBe('application/pdf');
    expect(attachment.size).toBe(1024);
  });

  it('should support optional localPath property', () => {
    const attachmentWithPath: Attachment = {
      id: 'att-001',
      filename: 'image.png',
      mimeType: 'image/png',
      size: 2048,
      localPath: '/tmp/uploads/image.png',
    };

    expect(attachmentWithPath.localPath).toBe('/tmp/uploads/image.png');

    const attachmentWithoutPath: Attachment = {
      id: 'att-002',
      filename: 'image.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
    };

    expect(attachmentWithoutPath.localPath).toBeUndefined();
  });

  it('should support various MIME types', () => {
    const mimeTypes = [
      'image/png',
      'image/jpeg',
      'application/pdf',
      'text/plain',
      'application/json',
      'video/mp4',
    ];

    mimeTypes.forEach((mimeType) => {
      const attachment: Attachment = {
        id: 'att-001',
        filename: 'file',
        mimeType,
        size: 100,
      };
      expect(attachment.mimeType).toBe(mimeType);
    });
  });

  it('should support unicode in filename', () => {
    const attachment: Attachment = {
      id: 'att-001',
      filename: '한글파일명.pdf',
      mimeType: 'application/pdf',
      size: 1024,
    };

    expect(attachment.filename).toBe('한글파일명.pdf');
  });

  it('should support zero size', () => {
    const attachment: Attachment = {
      id: 'att-001',
      filename: 'empty.txt',
      mimeType: 'text/plain',
      size: 0,
    };

    expect(attachment.size).toBe(0);
  });
});

describe('BlobContextType', () => {
  it('should accept "image_upload" value', () => {
    const contextType: BlobContextType = 'image_upload';
    expect(contextType).toBe('image_upload');
  });

  it('should accept "file_transfer" value', () => {
    const contextType: BlobContextType = 'file_transfer';
    expect(contextType).toBe('file_transfer');
  });
});

describe('BlobContext', () => {
  it('should have all required properties', () => {
    const context: BlobContext = {
      type: 'image_upload',
      conversationId: TEST_CONVERSATION_ID,
    };

    expect(context.type).toBe('image_upload');
    expect(context.conversationId).toBe(TEST_CONVERSATION_ID);
  });

  it('should support optional message property', () => {
    const contextWithMessage: BlobContext = {
      type: 'file_transfer',
      conversationId: TEST_CONVERSATION_ID,
      message: 'Please analyze this file.',
    };

    expect(contextWithMessage.message).toBe('Please analyze this file.');
  });

  it('should support all properties together', () => {
    const fullContext: BlobContext = {
      type: 'image_upload',
      conversationId: TEST_CONVERSATION_ID,
      message: '이 이미지를 분석해주세요.',
    };

    expect(fullContext.type).toBe('image_upload');
    expect(fullContext.conversationId).toBe(TEST_CONVERSATION_ID);
    expect(fullContext.message).toBe('이 이미지를 분석해주세요.');
  });
});

describe('BlobStartPayload', () => {
  it('should have all required properties', () => {
    const payload: BlobStartPayload = {
      blobId: 'blob-001',
      filename: 'large-file.zip',
      mimeType: 'application/zip',
      totalSize: 10485760, // 10MB
      chunkSize: 65536, // 64KB
      totalChunks: 160,
      encoding: 'base64',
      context: {
        type: 'file_transfer',
        conversationId: TEST_CONVERSATION_ID,
      },
    };

    expect(payload.blobId).toBe('blob-001');
    expect(payload.filename).toBe('large-file.zip');
    expect(payload.mimeType).toBe('application/zip');
    expect(payload.totalSize).toBe(10485760);
    expect(payload.chunkSize).toBe(65536);
    expect(payload.totalChunks).toBe(160);
    expect(payload.encoding).toBe('base64');
    expect(payload.context.type).toBe('file_transfer');
    expect(payload.context.conversationId).toBe(TEST_CONVERSATION_ID);
  });

  it('should support optional sameDevice property', () => {
    const payloadWithSameDevice: BlobStartPayload = {
      blobId: 'blob-001',
      filename: 'file.txt',
      mimeType: 'text/plain',
      totalSize: 1024,
      chunkSize: 512,
      totalChunks: 2,
      encoding: 'base64',
      context: {
        type: 'file_transfer',
        conversationId: TEST_CONVERSATION_ID,
      },
      sameDevice: true,
    };

    expect(payloadWithSameDevice.sameDevice).toBe(true);

    const payloadWithoutSameDevice: BlobStartPayload = {
      blobId: 'blob-002',
      filename: 'file2.txt',
      mimeType: 'text/plain',
      totalSize: 1024,
      chunkSize: 512,
      totalChunks: 2,
      encoding: 'base64',
      context: {
        type: 'file_transfer',
        conversationId: TEST_CONVERSATION_ID,
      },
    };

    expect(payloadWithoutSameDevice.sameDevice).toBeUndefined();
  });

  it('should support optional localPath property', () => {
    const payloadWithLocalPath: BlobStartPayload = {
      blobId: 'blob-001',
      filename: 'image.png',
      mimeType: 'image/png',
      totalSize: 2048,
      chunkSize: 1024,
      totalChunks: 2,
      encoding: 'base64',
      context: {
        type: 'image_upload',
        conversationId: TEST_CONVERSATION_ID,
      },
      localPath: 'C:\\Users\\user\\images\\image.png',
    };

    expect(payloadWithLocalPath.localPath).toBe('C:\\Users\\user\\images\\image.png');
  });

  it('should only accept "base64" as encoding', () => {
    const payload: BlobStartPayload = {
      blobId: 'blob-001',
      filename: 'file.txt',
      mimeType: 'text/plain',
      totalSize: 100,
      chunkSize: 50,
      totalChunks: 2,
      encoding: 'base64',
      context: {
        type: 'file_transfer',
        conversationId: TEST_CONVERSATION_ID,
      },
    };

    expect(payload.encoding).toBe('base64');
  });

  it('should support context with all optional properties', () => {
    const payload: BlobStartPayload = {
      blobId: 'blob-001',
      filename: 'screenshot.png',
      mimeType: 'image/png',
      totalSize: 5000,
      chunkSize: 1000,
      totalChunks: 5,
      encoding: 'base64',
      context: {
        type: 'image_upload',
        conversationId: TEST_CONVERSATION_ID,
        message: 'Analyze this screenshot',
      },
    };

    expect(payload.context.conversationId).toBe(TEST_CONVERSATION_ID);
    expect(payload.context.message).toBe('Analyze this screenshot');
  });
});

describe('BlobChunkPayload', () => {
  it('should have all required properties', () => {
    const payload: BlobChunkPayload = {
      blobId: 'blob-001',
      index: 0,
      data: 'SGVsbG8gV29ybGQh', // "Hello World!" in base64
      size: 12,
    };

    expect(payload.blobId).toBe('blob-001');
    expect(payload.index).toBe(0);
    expect(payload.data).toBe('SGVsbG8gV29ybGQh');
    expect(payload.size).toBe(12);
  });

  it('should support index starting from 0', () => {
    const firstChunk: BlobChunkPayload = {
      blobId: 'blob-001',
      index: 0,
      data: 'chunk0data',
      size: 100,
    };

    expect(firstChunk.index).toBe(0);
  });

  it('should support various index values', () => {
    const indices = [0, 1, 10, 100, 1000];

    indices.forEach((index) => {
      const payload: BlobChunkPayload = {
        blobId: 'blob-001',
        index,
        data: 'data',
        size: 4,
      };
      expect(payload.index).toBe(index);
    });
  });

  it('should support large base64 data', () => {
    const largeData = 'A'.repeat(65536); // 64KB of 'A's in base64 representation

    const payload: BlobChunkPayload = {
      blobId: 'blob-001',
      index: 0,
      data: largeData,
      size: 65536,
    };

    expect(payload.data.length).toBe(65536);
  });
});

describe('BlobEndPayload', () => {
  it('should have all required properties', () => {
    const payload: BlobEndPayload = {
      blobId: 'blob-001',
      totalReceived: 10485760,
    };

    expect(payload.blobId).toBe('blob-001');
    expect(payload.totalReceived).toBe(10485760);
  });

  it('should support optional checksum property', () => {
    const payloadWithChecksum: BlobEndPayload = {
      blobId: 'blob-001',
      checksum: 'sha256:abc123def456',
      totalReceived: 1024,
    };

    expect(payloadWithChecksum.checksum).toBe('sha256:abc123def456');

    const payloadWithoutChecksum: BlobEndPayload = {
      blobId: 'blob-002',
      totalReceived: 2048,
    };

    expect(payloadWithoutChecksum.checksum).toBeUndefined();
  });

  it('should support various checksum formats', () => {
    const checksums = [
      'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'md5:d41d8cd98f00b204e9800998ecf8427e',
      'crc32:00000000',
    ];

    checksums.forEach((checksum) => {
      const payload: BlobEndPayload = {
        blobId: 'blob-001',
        checksum,
        totalReceived: 100,
      };
      expect(payload.checksum).toBe(checksum);
    });
  });

  it('should support zero totalReceived', () => {
    const payload: BlobEndPayload = {
      blobId: 'blob-001',
      totalReceived: 0,
    };

    expect(payload.totalReceived).toBe(0);
  });
});

describe('BlobAckPayload', () => {
  it('should have all required properties', () => {
    const payload: BlobAckPayload = {
      blobId: 'blob-001',
      receivedChunks: [0, 1, 2, 3, 4],
      missingChunks: [5, 6],
    };

    expect(payload.blobId).toBe('blob-001');
    expect(payload.receivedChunks).toEqual([0, 1, 2, 3, 4]);
    expect(payload.missingChunks).toEqual([5, 6]);
  });

  it('should support empty receivedChunks array', () => {
    const payload: BlobAckPayload = {
      blobId: 'blob-001',
      receivedChunks: [],
      missingChunks: [0, 1, 2],
    };

    expect(payload.receivedChunks).toHaveLength(0);
    expect(payload.missingChunks).toHaveLength(3);
  });

  it('should support empty missingChunks array', () => {
    const payload: BlobAckPayload = {
      blobId: 'blob-001',
      receivedChunks: [0, 1, 2],
      missingChunks: [],
    };

    expect(payload.receivedChunks).toHaveLength(3);
    expect(payload.missingChunks).toHaveLength(0);
  });

  it('should support large chunk arrays', () => {
    const receivedChunks = Array.from({ length: 1000 }, (_, i) => i);
    const missingChunks = [1000, 1001, 1002];

    const payload: BlobAckPayload = {
      blobId: 'blob-001',
      receivedChunks,
      missingChunks,
    };

    expect(payload.receivedChunks).toHaveLength(1000);
    expect(payload.missingChunks).toHaveLength(3);
  });
});

describe('BlobRequestPayload', () => {
  it('should have all required properties', () => {
    const payload: BlobRequestPayload = {
      blobId: 'blob-001',
      filename: 'requested-file.txt',
    };

    expect(payload.blobId).toBe('blob-001');
    expect(payload.filename).toBe('requested-file.txt');
  });

  it('should support optional localPath property', () => {
    const payloadWithPath: BlobRequestPayload = {
      blobId: 'blob-001',
      filename: 'file.txt',
      localPath: '/home/user/downloads/file.txt',
    };

    expect(payloadWithPath.localPath).toBe('/home/user/downloads/file.txt');

    const payloadWithoutPath: BlobRequestPayload = {
      blobId: 'blob-002',
      filename: 'file2.txt',
    };

    expect(payloadWithoutPath.localPath).toBeUndefined();
  });

  it('should support unicode in filename', () => {
    const payload: BlobRequestPayload = {
      blobId: 'blob-001',
      filename: '요청파일.pdf',
    };

    expect(payload.filename).toBe('요청파일.pdf');
  });

  it('should support Windows path format in localPath', () => {
    const payload: BlobRequestPayload = {
      blobId: 'blob-001',
      filename: 'file.txt',
      localPath: 'C:\\Users\\user\\Downloads\\file.txt',
    };

    expect(payload.localPath).toBe('C:\\Users\\user\\Downloads\\file.txt');
  });
});

describe('Type Guards', () => {
  describe('isAttachment', () => {
    it('should return true for valid attachments', () => {
      const attachment = {
        id: 'att-001',
        filename: 'file.txt',
        mimeType: 'text/plain',
        size: 100,
      };
      expect(isAttachment(attachment)).toBe(true);
    });

    it('should return true for attachments with localPath', () => {
      const attachment = {
        id: 'att-001',
        filename: 'file.txt',
        mimeType: 'text/plain',
        size: 100,
        localPath: '/path/to/file.txt',
      };
      expect(isAttachment(attachment)).toBe(true);
    });

    it('should return false for invalid attachments', () => {
      expect(isAttachment(null)).toBe(false);
      expect(isAttachment(undefined)).toBe(false);
      expect(isAttachment({})).toBe(false);
      expect(isAttachment({ id: 'att-001' })).toBe(false);
      expect(isAttachment({ id: 'att-001', filename: 'file.txt' })).toBe(false);
      expect(isAttachment({
        id: 'att-001',
        filename: 'file.txt',
        mimeType: 'text/plain',
        // missing size
      })).toBe(false);
      expect(isAttachment({
        id: 123, // wrong type
        filename: 'file.txt',
        mimeType: 'text/plain',
        size: 100,
      })).toBe(false);
    });
  });

  describe('isBlobContextType', () => {
    it('should return true for valid context types', () => {
      expect(isBlobContextType('image_upload')).toBe(true);
      expect(isBlobContextType('file_transfer')).toBe(true);
    });

    it('should return false for invalid context types', () => {
      expect(isBlobContextType('invalid')).toBe(false);
      expect(isBlobContextType('')).toBe(false);
      expect(isBlobContextType(null)).toBe(false);
      expect(isBlobContextType(undefined)).toBe(false);
      expect(isBlobContextType(123)).toBe(false);
    });
  });

  describe('isBlobContext', () => {
    it('should return true for valid contexts', () => {
      const context = {
        type: 'image_upload',
        conversationId: TEST_CONVERSATION_ID,
      };
      expect(isBlobContext(context)).toBe(true);
    });

    it('should return true for contexts with optional properties', () => {
      const context = {
        type: 'file_transfer',
        conversationId: TEST_CONVERSATION_ID,
        message: 'Hello',
      };
      expect(isBlobContext(context)).toBe(true);
    });

    it('should return false for invalid contexts', () => {
      expect(isBlobContext(null)).toBe(false);
      expect(isBlobContext(undefined)).toBe(false);
      expect(isBlobContext({})).toBe(false);
      expect(isBlobContext({ type: 'image_upload' })).toBe(false); // missing conversationId
      expect(isBlobContext({ conversationId: TEST_CONVERSATION_ID })).toBe(false); // missing type
      expect(isBlobContext({
        type: 'invalid_type',
        conversationId: TEST_CONVERSATION_ID,
      })).toBe(false);
    });
  });

  describe('isBlobStartPayload', () => {
    it('should return true for valid payloads', () => {
      const payload = {
        blobId: 'blob-001',
        filename: 'file.txt',
        mimeType: 'text/plain',
        totalSize: 1024,
        chunkSize: 512,
        totalChunks: 2,
        encoding: 'base64',
        context: {
          type: 'file_transfer',
          conversationId: TEST_CONVERSATION_ID,
        },
      };
      expect(isBlobStartPayload(payload)).toBe(true);
    });

    it('should return true for payloads with optional properties', () => {
      const payload = {
        blobId: 'blob-001',
        filename: 'file.txt',
        mimeType: 'text/plain',
        totalSize: 1024,
        chunkSize: 512,
        totalChunks: 2,
        encoding: 'base64',
        context: {
          type: 'file_transfer',
          conversationId: TEST_CONVERSATION_ID,
        },
        sameDevice: true,
        localPath: '/path/to/file.txt',
      };
      expect(isBlobStartPayload(payload)).toBe(true);
    });

    it('should return false for invalid payloads', () => {
      expect(isBlobStartPayload(null)).toBe(false);
      expect(isBlobStartPayload(undefined)).toBe(false);
      expect(isBlobStartPayload({})).toBe(false);
      expect(isBlobStartPayload({
        blobId: 'blob-001',
        // missing other required properties
      })).toBe(false);
      expect(isBlobStartPayload({
        blobId: 'blob-001',
        filename: 'file.txt',
        mimeType: 'text/plain',
        totalSize: 1024,
        chunkSize: 512,
        totalChunks: 2,
        encoding: 'utf-8', // wrong encoding
        context: {
          type: 'file_transfer',
          conversationId: TEST_CONVERSATION_ID,
        },
      })).toBe(false);
    });
  });

  describe('isBlobChunkPayload', () => {
    it('should return true for valid payloads', () => {
      const payload = {
        blobId: 'blob-001',
        index: 0,
        data: 'SGVsbG8=',
        size: 5,
      };
      expect(isBlobChunkPayload(payload)).toBe(true);
    });

    it('should return false for invalid payloads', () => {
      expect(isBlobChunkPayload(null)).toBe(false);
      expect(isBlobChunkPayload(undefined)).toBe(false);
      expect(isBlobChunkPayload({})).toBe(false);
      expect(isBlobChunkPayload({
        blobId: 'blob-001',
        index: 'zero', // wrong type
        data: 'data',
        size: 4,
      })).toBe(false);
      expect(isBlobChunkPayload({
        blobId: 'blob-001',
        index: 0,
        data: 123, // wrong type
        size: 4,
      })).toBe(false);
    });
  });

  describe('isBlobEndPayload', () => {
    it('should return true for valid payloads', () => {
      const payload = {
        blobId: 'blob-001',
        totalReceived: 1024,
      };
      expect(isBlobEndPayload(payload)).toBe(true);
    });

    it('should return true for payloads with checksum', () => {
      const payload = {
        blobId: 'blob-001',
        checksum: 'sha256:abc123',
        totalReceived: 1024,
      };
      expect(isBlobEndPayload(payload)).toBe(true);
    });

    it('should return false for invalid payloads', () => {
      expect(isBlobEndPayload(null)).toBe(false);
      expect(isBlobEndPayload(undefined)).toBe(false);
      expect(isBlobEndPayload({})).toBe(false);
      expect(isBlobEndPayload({
        blobId: 'blob-001',
        // missing totalReceived
      })).toBe(false);
      expect(isBlobEndPayload({
        blobId: 'blob-001',
        totalReceived: '1024', // wrong type
      })).toBe(false);
    });
  });

  describe('isBlobAckPayload', () => {
    it('should return true for valid payloads', () => {
      const payload = {
        blobId: 'blob-001',
        receivedChunks: [0, 1, 2],
        missingChunks: [3, 4],
      };
      expect(isBlobAckPayload(payload)).toBe(true);
    });

    it('should return true for payloads with empty arrays', () => {
      const payload = {
        blobId: 'blob-001',
        receivedChunks: [],
        missingChunks: [],
      };
      expect(isBlobAckPayload(payload)).toBe(true);
    });

    it('should return false for invalid payloads', () => {
      expect(isBlobAckPayload(null)).toBe(false);
      expect(isBlobAckPayload(undefined)).toBe(false);
      expect(isBlobAckPayload({})).toBe(false);
      expect(isBlobAckPayload({
        blobId: 'blob-001',
        receivedChunks: 'invalid', // wrong type
        missingChunks: [],
      })).toBe(false);
      expect(isBlobAckPayload({
        blobId: 'blob-001',
        receivedChunks: [],
        // missing missingChunks
      })).toBe(false);
    });
  });

  describe('isBlobRequestPayload', () => {
    it('should return true for valid payloads', () => {
      const payload = {
        blobId: 'blob-001',
        filename: 'file.txt',
      };
      expect(isBlobRequestPayload(payload)).toBe(true);
    });

    it('should return true for payloads with localPath', () => {
      const payload = {
        blobId: 'blob-001',
        filename: 'file.txt',
        localPath: '/path/to/file.txt',
      };
      expect(isBlobRequestPayload(payload)).toBe(true);
    });

    it('should return false for invalid payloads', () => {
      expect(isBlobRequestPayload(null)).toBe(false);
      expect(isBlobRequestPayload(undefined)).toBe(false);
      expect(isBlobRequestPayload({})).toBe(false);
      expect(isBlobRequestPayload({
        blobId: 'blob-001',
        // missing filename
      })).toBe(false);
      expect(isBlobRequestPayload({
        blobId: 123, // wrong type
        filename: 'file.txt',
      })).toBe(false);
    });
  });
});
