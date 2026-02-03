import { describe, it, expect, beforeEach } from 'vitest';
import { useUploadStore, UploadStatus } from './uploadStore';

describe('uploadStore', () => {
  beforeEach(() => {
    useUploadStore.getState().reset();
  });

  describe('초기 상태', () => {
    it('should have empty uploads', () => {
      const state = useUploadStore.getState();

      expect(state.uploads).toEqual({});
      expect(state.isUploading).toBe(false);
    });
  });

  describe('업로드 시작', () => {
    it('should start upload', () => {
      const { startUpload } = useUploadStore.getState();

      startUpload({
        blobId: 'blob-1',
        filename: 'image.png',
        totalChunks: 10,
      });

      const upload = useUploadStore.getState().uploads['blob-1'];
      expect(upload).toBeDefined();
      expect(upload.filename).toBe('image.png');
      expect(upload.status).toBe('uploading');
      expect(upload.sentChunks).toBe(0);
      expect(upload.totalChunks).toBe(10);
    });

    it('should set isUploading to true', () => {
      const { startUpload } = useUploadStore.getState();

      startUpload({
        blobId: 'blob-1',
        filename: 'image.png',
        totalChunks: 10,
      });

      expect(useUploadStore.getState().isUploading).toBe(true);
    });
  });

  describe('업로드 진행률', () => {
    it('should update progress', () => {
      const { startUpload, updateProgress } = useUploadStore.getState();

      startUpload({
        blobId: 'blob-1',
        filename: 'image.png',
        totalChunks: 10,
      });

      updateProgress('blob-1', 5);

      const upload = useUploadStore.getState().uploads['blob-1'];
      expect(upload.sentChunks).toBe(5);
    });

    it('should calculate progress percentage', () => {
      const { startUpload, updateProgress, getProgress } = useUploadStore.getState();

      startUpload({
        blobId: 'blob-1',
        filename: 'image.png',
        totalChunks: 10,
      });

      updateProgress('blob-1', 5);

      expect(getProgress('blob-1')).toBe(50);
    });
  });

  describe('업로드 완료', () => {
    it('should complete upload', () => {
      const { startUpload, completeUpload } = useUploadStore.getState();

      startUpload({
        blobId: 'blob-1',
        filename: 'image.png',
        totalChunks: 10,
      });

      completeUpload('blob-1', '/path/to/uploaded/image.png');

      const upload = useUploadStore.getState().uploads['blob-1'];
      expect(upload.status).toBe('completed');
      expect(upload.serverPath).toBe('/path/to/uploaded/image.png');
    });

    it('should add to recent uploads', () => {
      const { startUpload, completeUpload } = useUploadStore.getState();

      startUpload({
        blobId: 'blob-1',
        filename: 'image.png',
        totalChunks: 10,
      });

      completeUpload('blob-1', '/path/image.png');

      expect(useUploadStore.getState().recentUploads).toContain('blob-1');
    });

    it('should set isUploading to false when all complete', () => {
      const { startUpload, completeUpload } = useUploadStore.getState();

      startUpload({
        blobId: 'blob-1',
        filename: 'image.png',
        totalChunks: 10,
      });

      completeUpload('blob-1', '/path/image.png');

      expect(useUploadStore.getState().isUploading).toBe(false);
    });
  });

  describe('업로드 실패', () => {
    it('should fail upload', () => {
      const { startUpload, failUpload } = useUploadStore.getState();

      startUpload({
        blobId: 'blob-1',
        filename: 'image.png',
        totalChunks: 10,
      });

      failUpload('blob-1', 'Network error');

      const upload = useUploadStore.getState().uploads['blob-1'];
      expect(upload.status).toBe('failed');
      expect(upload.error).toBe('Network error');
    });
  });

  describe('최근 업로드 소비', () => {
    it('should consume recent uploads', () => {
      const { startUpload, completeUpload, consumeRecentUploads } =
        useUploadStore.getState();

      startUpload({ blobId: 'blob-1', filename: 'a.png', totalChunks: 1 });
      startUpload({ blobId: 'blob-2', filename: 'b.png', totalChunks: 1 });

      completeUpload('blob-1', '/a.png');
      completeUpload('blob-2', '/b.png');

      const recent = consumeRecentUploads();

      expect(recent).toHaveLength(2);
      expect(useUploadStore.getState().recentUploads).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      const { startUpload, reset } = useUploadStore.getState();

      startUpload({
        blobId: 'blob-1',
        filename: 'image.png',
        totalChunks: 10,
      });

      reset();

      const state = useUploadStore.getState();
      expect(state.uploads).toEqual({});
      expect(state.isUploading).toBe(false);
      expect(state.recentUploads).toEqual([]);
    });
  });
});
