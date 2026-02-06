/**
 * @file imageUploadStore.test.ts
 * @description imageUploadStore 테스트
 *
 * Phase 2-3: AttachedImage 타입 확장 테스트
 * - AttachedImage에 file, mimeType이 저장되는지 검증
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useImageUploadStore, AttachedImage } from './imageUploadStore';

describe('imageUploadStore', () => {
  beforeEach(() => {
    useImageUploadStore.getState().reset();
  });

  describe('초기 상태', () => {
    it('should have null attachedImage', () => {
      const state = useImageUploadStore.getState();

      expect(state.attachedImage).toBeNull();
      expect(state.attachedImages).toEqual([]);
    });

    it('should have empty uploads', () => {
      const state = useImageUploadStore.getState();

      expect(state.uploads.size).toBe(0);
      expect(state.hasActiveUpload).toBe(false);
    });
  });

  describe('setAttachedImage', () => {
    it('should set attached image', () => {
      const { setAttachedImage } = useImageUploadStore.getState();

      const image: AttachedImage = {
        id: 'img-1',
        uri: 'blob:http://localhost/123',
        fileName: 'test.png',
      };

      setAttachedImage(image);

      const state = useImageUploadStore.getState();
      expect(state.attachedImage).toEqual(image);
    });

    it('should clear attached image when null', () => {
      const { setAttachedImage } = useImageUploadStore.getState();

      setAttachedImage({
        id: 'img-1',
        uri: 'blob:test',
        fileName: 'test.png',
      });

      setAttachedImage(null);

      expect(useImageUploadStore.getState().attachedImage).toBeNull();
    });

    it('should also add to attachedImages array', () => {
      const { setAttachedImage } = useImageUploadStore.getState();

      const image: AttachedImage = {
        id: 'img-1',
        uri: 'blob:test',
        fileName: 'test.png',
      };

      setAttachedImage(image);

      const state = useImageUploadStore.getState();
      expect(state.attachedImages).toContainEqual(image);
    });
  });

  describe('AttachedImage with file and mimeType (Phase 2-3)', () => {
    /**
     * [FAILING TEST] AttachedImage에 file 필드가 포함되어야 함
     *
     * 현재 AttachedImage 인터페이스:
     * - id: string
     * - uri: string
     * - fileName: string
     *
     * 필요한 필드:
     * - file?: File
     * - mimeType?: string
     */
    it('should store file object in attached image', () => {
      const { setAttachedImage } = useImageUploadStore.getState();

      // Mock File 객체 (브라우저 환경)
      const mockFile = new File(['test content'], 'test.png', {
        type: 'image/png',
      });

      const imageWithFile: AttachedImage = {
        id: 'img-file-1',
        uri: 'blob:http://localhost/456',
        fileName: 'test.png',
        file: mockFile, // 이 필드가 현재 타입에 없음 - FAILING
      };

      setAttachedImage(imageWithFile);

      const state = useImageUploadStore.getState();
      expect(state.attachedImage?.file).toBe(mockFile);
      expect(state.attachedImage?.file?.name).toBe('test.png');
      expect(state.attachedImage?.file?.type).toBe('image/png');
    });

    it('should store mimeType in attached image', () => {
      const { setAttachedImage } = useImageUploadStore.getState();

      const imageWithMime: AttachedImage = {
        id: 'img-mime-1',
        uri: 'blob:http://localhost/789',
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg', // 이 필드가 현재 타입에 없음 - FAILING
      };

      setAttachedImage(imageWithMime);

      const state = useImageUploadStore.getState();
      expect(state.attachedImage?.mimeType).toBe('image/jpeg');
    });

    it('should store both file and mimeType together', () => {
      const { setAttachedImage } = useImageUploadStore.getState();

      const mockFile = new File(['image data'], 'screenshot.png', {
        type: 'image/png',
      });

      const fullImage: AttachedImage = {
        id: 'img-full-1',
        uri: 'blob:http://localhost/full',
        fileName: 'screenshot.png',
        file: mockFile, // FAILING - 타입에 없음
        mimeType: 'image/png', // FAILING - 타입에 없음
      };

      setAttachedImage(fullImage);

      const state = useImageUploadStore.getState();
      expect(state.attachedImage?.file).toBe(mockFile);
      expect(state.attachedImage?.mimeType).toBe('image/png');
    });

    it('should work without file and mimeType (backward compatibility)', () => {
      const { setAttachedImage } = useImageUploadStore.getState();

      // 기존 형식 (file, mimeType 없음)
      const legacyImage: AttachedImage = {
        id: 'img-legacy',
        uri: 'blob:http://localhost/legacy',
        fileName: 'old.png',
      };

      setAttachedImage(legacyImage);

      const state = useImageUploadStore.getState();
      expect(state.attachedImage).toEqual(legacyImage);
      expect(state.attachedImage?.file).toBeUndefined();
      expect(state.attachedImage?.mimeType).toBeUndefined();
    });
  });

  describe('addAttachedImage', () => {
    it('should add image to array', () => {
      const { addAttachedImage } = useImageUploadStore.getState();

      addAttachedImage({
        id: 'img-1',
        uri: 'blob:1',
        fileName: 'a.png',
      });

      addAttachedImage({
        id: 'img-2',
        uri: 'blob:2',
        fileName: 'b.png',
      });

      const state = useImageUploadStore.getState();
      expect(state.attachedImages).toHaveLength(2);
    });

    it('should add image with file object', () => {
      const { addAttachedImage } = useImageUploadStore.getState();

      const mockFile = new File(['data'], 'multi.png', { type: 'image/png' });

      addAttachedImage({
        id: 'img-multi',
        uri: 'blob:multi',
        fileName: 'multi.png',
        file: mockFile, // FAILING - 타입에 없음
        mimeType: 'image/png', // FAILING - 타입에 없음
      });

      const state = useImageUploadStore.getState();
      const added = state.attachedImages.find((i) => i.id === 'img-multi');
      expect(added?.file).toBe(mockFile);
      expect(added?.mimeType).toBe('image/png');
    });
  });

  describe('removeAttachedImage', () => {
    it('should remove image by id', () => {
      const { addAttachedImage, removeAttachedImage } =
        useImageUploadStore.getState();

      addAttachedImage({ id: 'img-1', uri: 'blob:1', fileName: 'a.png' });
      addAttachedImage({ id: 'img-2', uri: 'blob:2', fileName: 'b.png' });

      removeAttachedImage('img-1');

      const state = useImageUploadStore.getState();
      expect(state.attachedImages).toHaveLength(1);
      expect(state.attachedImages[0].id).toBe('img-2');
    });

    it('should update attachedImage when removed', () => {
      const { addAttachedImage, removeAttachedImage } =
        useImageUploadStore.getState();

      addAttachedImage({ id: 'img-1', uri: 'blob:1', fileName: 'a.png' });
      addAttachedImage({ id: 'img-2', uri: 'blob:2', fileName: 'b.png' });

      // img-2가 마지막이므로 attachedImage는 img-2
      expect(useImageUploadStore.getState().attachedImage?.id).toBe('img-2');

      // img-2 제거 시 img-1이 attachedImage가 됨
      removeAttachedImage('img-2');

      expect(useImageUploadStore.getState().attachedImage?.id).toBe('img-1');
    });
  });

  describe('clearAttachedImages', () => {
    it('should clear all attached images', () => {
      const { addAttachedImage, clearAttachedImages } =
        useImageUploadStore.getState();

      addAttachedImage({ id: 'img-1', uri: 'blob:1', fileName: 'a.png' });
      addAttachedImage({ id: 'img-2', uri: 'blob:2', fileName: 'b.png' });

      clearAttachedImages();

      const state = useImageUploadStore.getState();
      expect(state.attachedImages).toEqual([]);
      expect(state.attachedImage).toBeNull();
    });
  });

  describe('upload workflow', () => {
    it('should start upload', () => {
      const { startUpload } = useImageUploadStore.getState();

      startUpload({
        blobId: 'blob-1',
        filename: 'upload.png',
        totalChunks: 5,
      });

      const state = useImageUploadStore.getState();
      const upload = state.uploads.get('blob-1');

      expect(upload).toBeDefined();
      expect(upload?.status).toBe('uploading');
      expect(upload?.processedChunks).toBe(0);
      expect(state.hasActiveUpload).toBe(true);
    });

    it('should update progress', () => {
      const { startUpload, updateProgress } = useImageUploadStore.getState();

      startUpload({
        blobId: 'blob-1',
        filename: 'upload.png',
        totalChunks: 10,
      });

      updateProgress('blob-1', 5);

      const upload = useImageUploadStore.getState().uploads.get('blob-1');
      expect(upload?.processedChunks).toBe(5);
    });

    it('should complete upload', () => {
      const { startUpload, completeUpload } = useImageUploadStore.getState();

      startUpload({
        blobId: 'blob-1',
        filename: 'upload.png',
        totalChunks: 1,
      });

      completeUpload('blob-1', 'file-123');

      const state = useImageUploadStore.getState();
      const upload = state.uploads.get('blob-1');

      expect(upload?.status).toBe('completed');
      expect(upload?.fileId).toBe('file-123');
      expect(state.hasActiveUpload).toBe(false);
      expect(state.recentFileIds).toContain('file-123');
    });

    it('should fail upload', () => {
      const { startUpload, failUpload } = useImageUploadStore.getState();

      startUpload({
        blobId: 'blob-1',
        filename: 'upload.png',
        totalChunks: 1,
      });

      failUpload('blob-1', 'Network error');

      const upload = useImageUploadStore.getState().uploads.get('blob-1');
      expect(upload?.status).toBe('failed');
      expect(upload?.error).toBe('Network error');
    });
  });

  describe('message queue', () => {
    it('should queue and dequeue message', () => {
      const { queueMessage, dequeueMessage } = useImageUploadStore.getState();

      queueMessage('Hello with image');

      expect(useImageUploadStore.getState().queuedMessage).toBe(
        'Hello with image'
      );

      const message = dequeueMessage();

      expect(message).toBe('Hello with image');
      expect(useImageUploadStore.getState().queuedMessage).toBeNull();
    });

    it('should return null when no queued message', () => {
      const { dequeueMessage } = useImageUploadStore.getState();

      const message = dequeueMessage();

      expect(message).toBeNull();
    });
  });

  describe('consumeRecentFileIds', () => {
    it('should consume and clear recent file ids', () => {
      const { startUpload, completeUpload, consumeRecentFileIds } =
        useImageUploadStore.getState();

      startUpload({ blobId: 'b1', filename: 'a.png', totalChunks: 1 });
      startUpload({ blobId: 'b2', filename: 'b.png', totalChunks: 1 });

      completeUpload('b1', 'file-1');
      completeUpload('b2', 'file-2');

      const fileIds = consumeRecentFileIds();

      expect(fileIds).toEqual(['file-1', 'file-2']);
      expect(useImageUploadStore.getState().recentFileIds).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      const { setAttachedImage, startUpload, queueMessage, reset } =
        useImageUploadStore.getState();

      setAttachedImage({ id: 'img-1', uri: 'blob:1', fileName: 'a.png' });
      startUpload({ blobId: 'b1', filename: 'a.png', totalChunks: 1 });
      queueMessage('test');

      reset();

      const state = useImageUploadStore.getState();
      expect(state.attachedImage).toBeNull();
      expect(state.attachedImages).toEqual([]);
      expect(state.uploads.size).toBe(0);
      expect(state.queuedMessage).toBeNull();
      expect(state.hasActiveUpload).toBe(false);
    });
  });
});
