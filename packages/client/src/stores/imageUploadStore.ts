import { create } from 'zustand';

/**
 * 업로드 정보 인터페이스
 */
export interface UploadInfo {
  blobId: string;
  filename: string;
  totalChunks: number;
  processedChunks: number;
  status: 'uploading' | 'completed' | 'failed';
  error?: string;
  fileId?: string;
}

/**
 * 첨부 이미지 정보
 */
export interface AttachedImage {
  /** 고유 ID (blobId와 연결) */
  id: string;
  /** 로컬 URI */
  uri: string;
  /** 파일명 */
  fileName: string;
}

/**
 * 이미지 업로드 상태 인터페이스
 */
export interface ImageUploadState {
  /** 현재 업로드 중인 이미지들 */
  uploads: Map<string, UploadInfo>;

  /** 첨부된 이미지 (전송 전) - 단일 이미지 (하위 호환) */
  attachedImage: AttachedImage | null;

  /** 첨부된 이미지들 (여러 개 지원) */
  attachedImages: AttachedImage[];

  /** 업로드 완료 후 메시지에 첨부할 fileIds */
  recentFileIds: string[];

  /** 업로드 중 대기하는 메시지 */
  queuedMessage: string | null;

  // Computed
  /** 활성 업로드 있는지 */
  hasActiveUpload: boolean;

  // Actions
  /** 이미지 첨부 (단일) */
  setAttachedImage: (image: AttachedImage | null) => void;

  /** 이미지 추가 (여러 개 지원) */
  addAttachedImage: (image: AttachedImage) => void;

  /** 이미지 제거 */
  removeAttachedImage: (id: string) => void;

  /** 모든 첨부 이미지 클리어 */
  clearAttachedImages: () => void;

  /** 업로드 시작 */
  startUpload: (info: Omit<UploadInfo, 'status' | 'processedChunks'>) => void;

  /** 프로그레스 업데이트 */
  updateProgress: (blobId: string, processedChunks: number) => void;

  /** 완료 */
  completeUpload: (blobId: string, fileId: string) => void;

  /** 실패 */
  failUpload: (blobId: string, error: string) => void;

  /** 제거 */
  removeUpload: (blobId: string) => void;

  /** 메시지 큐 */
  queueMessage: (text: string) => void;
  dequeueMessage: () => string | null;

  /** fileIds 소비 */
  consumeRecentFileIds: () => string[];

  /** 초기화 */
  reset: () => void;
}

/**
 * 초기 상태
 */
const initialState = {
  uploads: new Map<string, UploadInfo>(),
  attachedImage: null as AttachedImage | null,
  attachedImages: [] as AttachedImage[],
  recentFileIds: [] as string[],
  queuedMessage: null as string | null,
  hasActiveUpload: false,
};

/**
 * 이미지 업로드 상태 관리 스토어
 */
export const useImageUploadStore = create<ImageUploadState>((set, get) => ({
  ...initialState,

  setAttachedImage: (image) => {
    set({ attachedImage: image });
    // 단일 이미지를 배열에도 추가/제거
    if (image) {
      set((state) => ({
        attachedImages: [...state.attachedImages.filter((i) => i.id !== image.id), image],
      }));
    }
  },

  /** 이미지 추가 (여러 개 지원) */
  addAttachedImage: (image: AttachedImage) => {
    set((state) => ({
      attachedImages: [...state.attachedImages, image],
      attachedImage: image, // 하위 호환
    }));
  },

  /** 이미지 제거 */
  removeAttachedImage: (id: string) => {
    set((state) => {
      const newImages = state.attachedImages.filter((i) => i.id !== id);
      return {
        attachedImages: newImages,
        attachedImage: newImages.length > 0 ? newImages[newImages.length - 1] : null,
      };
    });
  },

  /** 모든 첨부 이미지 클리어 */
  clearAttachedImages: () => {
    set({ attachedImages: [], attachedImage: null });
  },

  startUpload: (info) => {
    const uploads = new Map(get().uploads);
    uploads.set(info.blobId, {
      ...info,
      status: 'uploading',
      processedChunks: 0,
    });
    set({ uploads, hasActiveUpload: true });
  },

  updateProgress: (blobId, processedChunks) => {
    const uploads = new Map(get().uploads);
    const upload = uploads.get(blobId);
    if (upload) {
      uploads.set(blobId, { ...upload, processedChunks });
      set({ uploads });
    }
  },

  completeUpload: (blobId, fileId) => {
    const uploads = new Map(get().uploads);
    const upload = uploads.get(blobId);
    if (upload) {
      uploads.set(blobId, { ...upload, status: 'completed', fileId });
    }

    // hasActiveUpload 재계산
    const hasActive = Array.from(uploads.values()).some(
      (u) => u.status === 'uploading'
    );

    // recentFileIds에 추가
    const recentFileIds = [...get().recentFileIds, fileId];

    set({ uploads, hasActiveUpload: hasActive, recentFileIds });
  },

  failUpload: (blobId, error) => {
    const uploads = new Map(get().uploads);
    const upload = uploads.get(blobId);
    if (upload) {
      uploads.set(blobId, { ...upload, status: 'failed', error });
    }

    const hasActive = Array.from(uploads.values()).some(
      (u) => u.status === 'uploading'
    );

    set({ uploads, hasActiveUpload: hasActive });
  },

  removeUpload: (blobId) => {
    const uploads = new Map(get().uploads);
    uploads.delete(blobId);

    const hasActive = Array.from(uploads.values()).some(
      (u) => u.status === 'uploading'
    );

    set({ uploads, hasActiveUpload: hasActive });
  },

  queueMessage: (text) => {
    set({ queuedMessage: text });
  },

  dequeueMessage: () => {
    const message = get().queuedMessage;
    set({ queuedMessage: null });
    return message;
  },

  consumeRecentFileIds: () => {
    const fileIds = [...get().recentFileIds];
    set({ recentFileIds: [] });
    return fileIds;
  },

  reset: () => {
    set({
      ...initialState,
      uploads: new Map(),
    });
  },
}));
