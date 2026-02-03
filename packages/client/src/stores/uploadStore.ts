import { create } from 'zustand';

/**
 * 업로드 상태 타입
 */
export type UploadStatus = 'uploading' | 'completed' | 'failed';

/**
 * 업로드 정보
 */
export interface UploadInfo {
  blobId: string;
  filename: string;
  status: UploadStatus;
  sentChunks: number;
  totalChunks: number;
  serverPath?: string;
  error?: string;
}

/**
 * 업로드 시작 파라미터
 */
export interface StartUploadParams {
  blobId: string;
  filename: string;
  totalChunks: number;
}

/**
 * 업로드 상태 인터페이스
 */
export interface UploadState {
  /** 업로드 목록 (blobId -> UploadInfo) */
  uploads: Record<string, UploadInfo>;

  /** 업로드 중인 항목 존재 여부 */
  isUploading: boolean;

  /** 최근 완료된 업로드 ID 목록 */
  recentUploads: string[];

  // Actions
  startUpload: (params: StartUploadParams) => void;
  updateProgress: (blobId: string, sentChunks: number) => void;
  completeUpload: (blobId: string, serverPath: string) => void;
  failUpload: (blobId: string, error: string) => void;
  getProgress: (blobId: string) => number;
  consumeRecentUploads: () => string[];
  reset: () => void;
}

/**
 * 초기 상태
 */
const initialState = {
  uploads: {} as Record<string, UploadInfo>,
  isUploading: false,
  recentUploads: [] as string[],
};

/**
 * 업로드 중인 항목이 있는지 확인
 */
function hasActiveUploads(uploads: Record<string, UploadInfo>): boolean {
  return Object.values(uploads).some((u) => u.status === 'uploading');
}

/**
 * 업로드 상태 스토어
 *
 * 이미지/파일 업로드 진행률을 관리합니다.
 */
export const useUploadStore = create<UploadState>((set, get) => ({
  ...initialState,

  startUpload: (params) => {
    const { blobId, filename, totalChunks } = params;

    set((state) => ({
      uploads: {
        ...state.uploads,
        [blobId]: {
          blobId,
          filename,
          status: 'uploading',
          sentChunks: 0,
          totalChunks,
        },
      },
      isUploading: true,
    }));
  },

  updateProgress: (blobId, sentChunks) => {
    set((state) => {
      const upload = state.uploads[blobId];
      if (!upload) return state;

      return {
        uploads: {
          ...state.uploads,
          [blobId]: { ...upload, sentChunks },
        },
      };
    });
  },

  completeUpload: (blobId, serverPath) => {
    set((state) => {
      const upload = state.uploads[blobId];
      if (!upload) return state;

      const newUploads = {
        ...state.uploads,
        [blobId]: {
          ...upload,
          status: 'completed' as UploadStatus,
          serverPath,
        },
      };

      return {
        uploads: newUploads,
        isUploading: hasActiveUploads(newUploads),
        recentUploads: [...state.recentUploads, blobId],
      };
    });
  },

  failUpload: (blobId, error) => {
    set((state) => {
      const upload = state.uploads[blobId];
      if (!upload) return state;

      const newUploads = {
        ...state.uploads,
        [blobId]: {
          ...upload,
          status: 'failed' as UploadStatus,
          error,
        },
      };

      return {
        uploads: newUploads,
        isUploading: hasActiveUploads(newUploads),
      };
    });
  },

  getProgress: (blobId) => {
    const upload = get().uploads[blobId];
    if (!upload || upload.totalChunks === 0) return 0;
    return Math.round((upload.sentChunks / upload.totalChunks) * 100);
  },

  consumeRecentUploads: () => {
    const recent = get().recentUploads;
    set({ recentUploads: [] });
    return recent;
  },

  reset: () => {
    set({ ...initialState });
  },
}));
