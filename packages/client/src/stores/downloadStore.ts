import { create } from 'zustand';

/**
 * 다운로드 상태 타입
 */
export type DownloadStatus = 'notDownloaded' | 'downloading' | 'downloaded' | 'failed';

/**
 * 다운로드 상태 인터페이스
 */
export interface DownloadState {
  /** 다운로드 상태 (filename -> status) */
  downloads: Record<string, DownloadStatus>;

  // Actions
  startDownload: (filename: string) => void;
  completeDownload: (filename: string) => void;
  failDownload: (filename: string) => void;
  resetDownload: (filename: string) => void;
  getStatus: (filename: string) => DownloadStatus;
  isDownloading: (filename: string) => boolean;
  isDownloaded: (filename: string) => boolean;
  reset: () => void;
}

/**
 * 초기 상태
 */
const initialState = {
  downloads: {} as Record<string, DownloadStatus>,
};

/**
 * 다운로드 상태 스토어
 *
 * 파일 다운로드 상태를 관리합니다.
 */
export const useDownloadStore = create<DownloadState>((set, get) => ({
  ...initialState,

  startDownload: (filename) => {
    set((state) => ({
      downloads: {
        ...state.downloads,
        [filename]: 'downloading',
      },
    }));
  },

  completeDownload: (filename) => {
    set((state) => ({
      downloads: {
        ...state.downloads,
        [filename]: 'downloaded',
      },
    }));
  },

  failDownload: (filename) => {
    set((state) => ({
      downloads: {
        ...state.downloads,
        [filename]: 'failed',
      },
    }));
  },

  resetDownload: (filename) => {
    set((state) => {
      const { [filename]: _, ...rest } = state.downloads;
      return { downloads: rest };
    });
  },

  getStatus: (filename) => {
    return get().downloads[filename] || 'notDownloaded';
  },

  isDownloading: (filename) => {
    return get().downloads[filename] === 'downloading';
  },

  isDownloaded: (filename) => {
    return get().downloads[filename] === 'downloaded';
  },

  reset: () => {
    set({ ...initialState });
  },
}));
