import { describe, it, expect, beforeEach } from 'vitest';
import { useDownloadStore, DownloadStatus } from './downloadStore';

describe('downloadStore', () => {
  beforeEach(() => {
    useDownloadStore.getState().reset();
  });

  describe('초기 상태', () => {
    it('should have empty downloads', () => {
      const state = useDownloadStore.getState();

      expect(state.downloads).toEqual({});
    });
  });

  describe('다운로드 상태 조회', () => {
    it('should return notDownloaded for unknown file', () => {
      const { getStatus } = useDownloadStore.getState();

      expect(getStatus('unknown.txt')).toBe('notDownloaded');
    });
  });

  describe('다운로드 시작', () => {
    it('should start download', () => {
      const { startDownload } = useDownloadStore.getState();

      startDownload('image.png');

      expect(useDownloadStore.getState().downloads['image.png']).toBe('downloading');
    });

    it('should track multiple downloads', () => {
      const { startDownload } = useDownloadStore.getState();

      startDownload('image1.png');
      startDownload('image2.png');

      const downloads = useDownloadStore.getState().downloads;
      expect(downloads['image1.png']).toBe('downloading');
      expect(downloads['image2.png']).toBe('downloading');
    });
  });

  describe('다운로드 완료', () => {
    it('should complete download', () => {
      const { startDownload, completeDownload } = useDownloadStore.getState();

      startDownload('image.png');
      completeDownload('image.png');

      expect(useDownloadStore.getState().downloads['image.png']).toBe('downloaded');
    });
  });

  describe('다운로드 실패', () => {
    it('should fail download', () => {
      const { startDownload, failDownload } = useDownloadStore.getState();

      startDownload('image.png');
      failDownload('image.png');

      expect(useDownloadStore.getState().downloads['image.png']).toBe('failed');
    });
  });

  describe('다운로드 상태 확인', () => {
    it('should check if downloading', () => {
      const { startDownload, isDownloading } = useDownloadStore.getState();

      expect(isDownloading('image.png')).toBe(false);

      startDownload('image.png');

      expect(useDownloadStore.getState().isDownloading('image.png')).toBe(true);
    });

    it('should check if downloaded', () => {
      const { startDownload, completeDownload, isDownloaded } =
        useDownloadStore.getState();

      expect(isDownloaded('image.png')).toBe(false);

      startDownload('image.png');
      completeDownload('image.png');

      expect(useDownloadStore.getState().isDownloaded('image.png')).toBe(true);
    });
  });

  describe('다운로드 초기화', () => {
    it('should reset download status', () => {
      const { startDownload, completeDownload, resetDownload } =
        useDownloadStore.getState();

      startDownload('image.png');
      completeDownload('image.png');
      resetDownload('image.png');

      expect(useDownloadStore.getState().downloads['image.png']).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      const { startDownload, reset } = useDownloadStore.getState();

      startDownload('image1.png');
      startDownload('image2.png');

      reset();

      expect(useDownloadStore.getState().downloads).toEqual({});
    });
  });
});
