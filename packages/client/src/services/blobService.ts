/**
 * @file services/blobService.ts
 * @description Blob 전송 서비스 (파일 업로드/다운로드)
 */

import { imageCache } from './imageCacheService';

/** Blob 전송 상태 */
export type BlobTransferState =
  | 'pending'
  | 'uploading'
  | 'downloading'
  | 'waitingAck'
  | 'completed'
  | 'failed';

/** 전송 중인 Blob 정보 */
export interface BlobTransfer {
  blobId: string;
  filename: string;
  mimeType: string;
  totalSize: number;
  chunkSize: number;
  totalChunks: number;
  context: Record<string, unknown>;
  isUpload: boolean;
  state: BlobTransferState;
  processedChunks: number;
  chunks: Uint8Array[];
  bytes?: Uint8Array;
  pylonPath?: string;
  error?: string;
}

/** 업로드 완료 이벤트 */
export interface BlobUploadCompleteEvent {
  blobId: string;
  fileId: string;
  filename: string;
  pylonPath: string;
  entityId: number;
  thumbnailBase64?: string;
}

/** 다운로드 완료 이벤트 */
export interface BlobDownloadCompleteEvent {
  blobId: string;
  filename: string;
  bytes: Uint8Array;
}

/** 콜백 타입 */
export type ProgressCallback = (
  blobId: string,
  processed: number,
  total: number
) => void;
export type UploadCompleteCallback = (blobId: string, pylonPath: string) => void;
export type DownloadCompleteCallback = (
  blobId: string,
  filename: string,
  bytes: Uint8Array
) => void;
export type ErrorCallback = (blobId: string, error: string) => void;

/** WebSocket 전송 인터페이스 */
export interface BlobSender {
  send: (data: Record<string, unknown>) => void;
}

/** 청크 크기 (64KB) */
const CHUNK_SIZE = 65536;

/**
 * UUID v4 생성
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 파일명 정규화 (특수문자 → _)
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Base64 인코딩
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 디코딩
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * SHA-256 체크섬 계산 (간단한 해시 - 실제 구현에서는 crypto 라이브러리 사용)
 */
async function calculateChecksum(bytes: Uint8Array): Promise<string> {
  // Web Crypto API 사용
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      // 새로운 ArrayBuffer를 생성하여 데이터 복사
      // 이렇게 하면 SubtleCrypto에서 올바르게 인식됨
      const buffer = new ArrayBuffer(bytes.length);
      const view = new Uint8Array(buffer);
      view.set(bytes);
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      return `sha256:${hashHex}`;
    } catch {
      // 폴백: 간단한 해시
      let hash = 0;
      for (let i = 0; i < bytes.length; i++) {
        hash = ((hash << 5) - hash + bytes[i]) | 0;
      }
      return `simple:${hash.toString(16)}`;
    }
  }
  // 폴백: 간단한 해시
  let hash = 0;
  for (let i = 0; i < bytes.length; i++) {
    hash = ((hash << 5) - hash + bytes[i]) | 0;
  }
  return `simple:${hash.toString(16)}`;
}

/**
 * Blob 전송 서비스
 */
export class BlobTransferService {
  private sender: BlobSender | null = null;
  private transfers: Map<string, BlobTransfer> = new Map();

  // 이벤트 리스너
  private progressListeners: ProgressCallback[] = [];
  private uploadCompleteListeners: ((event: BlobUploadCompleteEvent) => void)[] = [];
  private downloadCompleteListeners: ((event: BlobDownloadCompleteEvent) => void)[] = [];
  private errorListeners: ErrorCallback[] = [];

  /**
   * 전송자(WebSocket) 설정
   */
  setSender(sender: BlobSender): void {
    this.sender = sender;
  }

  /**
   * 이벤트 리스너 등록
   */
  onProgress(callback: ProgressCallback): () => void {
    this.progressListeners.push(callback);
    return () => {
      this.progressListeners = this.progressListeners.filter((cb) => cb !== callback);
    };
  }

  onUploadComplete(callback: (event: BlobUploadCompleteEvent) => void): () => void {
    this.uploadCompleteListeners.push(callback);
    return () => {
      this.uploadCompleteListeners = this.uploadCompleteListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  onDownloadComplete(callback: (event: BlobDownloadCompleteEvent) => void): () => void {
    this.downloadCompleteListeners.push(callback);
    return () => {
      this.downloadCompleteListeners = this.downloadCompleteListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  onError(callback: ErrorCallback): () => void {
    this.errorListeners.push(callback);
    return () => {
      this.errorListeners = this.errorListeners.filter((cb) => cb !== callback);
    };
  }

  // ============ 업로드 (Client → Pylon) ============

  /**
   * 이미지 업로드 시작
   */
  async uploadImageBytes(params: {
    bytes: Uint8Array;
    filename: string;
    targetDeviceId: number;
    workspaceId: string;
    entityId: number;
    message?: string;
    mimeType?: string;
  }): Promise<string | null> {
    const { bytes, filename, targetDeviceId, workspaceId, entityId, message, mimeType } =
      params;

    if (!this.sender) {
      console.error('[BLOB] No sender configured');
      return null;
    }

    try {
      const mime = mimeType ?? 'application/octet-stream';
      const timestamp = Date.now();
      const safeFilename = sanitizeFilename(`${timestamp}_${filename}`);

      console.log(`[BLOB] Starting upload: ${safeFilename} (${bytes.length} bytes)`);

      // 캐시에 저장
      imageCache.set(safeFilename, bytes);

      const blobId = generateUUID();
      const totalChunks = Math.ceil(bytes.length / CHUNK_SIZE);

      const transfer: BlobTransfer = {
        blobId,
        filename: safeFilename,
        mimeType: mime,
        totalSize: bytes.length,
        chunkSize: CHUNK_SIZE,
        totalChunks,
        context: {
          type: 'image_upload',
          workspaceId,
          entityId,
          message,
        },
        isUpload: true,
        state: 'uploading',
        processedChunks: 0,
        chunks: [],
        bytes,
      };

      this.transfers.set(blobId, transfer);

      // blob_start 전송
      this.sender.send({
        type: 'blob_start',
        to: { deviceId: targetDeviceId, deviceType: 'pylon' },
        payload: {
          blobId,
          filename: safeFilename,
          mimeType: mime,
          totalSize: bytes.length,
          chunkSize: CHUNK_SIZE,
          totalChunks,
          encoding: 'base64',
          context: transfer.context,
        },
      });

      // 청크 전송
      await this.sendChunks(blobId, bytes, targetDeviceId);

      return blobId;
    } catch (e) {
      console.error('[BLOB] Upload error:', e);
      this.errorListeners.forEach((cb) => cb('', String(e)));
      return null;
    }
  }

  private async sendChunks(
    blobId: string,
    bytes: Uint8Array,
    targetDeviceId: number
  ): Promise<void> {
    const transfer = this.transfers.get(blobId);
    if (!transfer || !this.sender) return;

    for (let i = 0; i < transfer.totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, bytes.length);
      const chunk = bytes.slice(start, end);

      this.sender.send({
        type: 'blob_chunk',
        to: { deviceId: targetDeviceId, deviceType: 'pylon' },
        payload: {
          blobId,
          index: i,
          data: uint8ArrayToBase64(chunk),
          size: chunk.length,
        },
      });

      transfer.processedChunks = i + 1;
      this.progressListeners.forEach((cb) =>
        cb(blobId, transfer.processedChunks, transfer.totalChunks)
      );

      // 너무 빠른 전송 방지
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    // blob_end 전송
    const checksum = await calculateChecksum(bytes);
    this.sender.send({
      type: 'blob_end',
      to: { deviceId: targetDeviceId, deviceType: 'pylon' },
      payload: {
        blobId,
        checksum,
        totalReceived: bytes.length,
      },
    });

    transfer.state = 'waitingAck';
  }

  // ============ 다운로드 (Pylon → Client) ============

  /**
   * 파일 다운로드 요청
   */
  requestFile(params: {
    targetDeviceId: number;
    entityId: number;
    filename: string;
    filePath?: string;
  }): void {
    const { targetDeviceId, entityId, filename, filePath } = params;

    // 캐시에 있으면 바로 반환
    const cached = imageCache.get(filename);
    if (cached) {
      console.log(`[BLOB] Cache hit: ${filename}`);
      const event: BlobDownloadCompleteEvent = {
        blobId: `cached_${filename}`,
        filename,
        bytes: cached,
      };
      this.downloadCompleteListeners.forEach((cb) => cb(event));
      return;
    }

    if (!this.sender) {
      console.error('[BLOB] No sender configured');
      return;
    }

    const blobId = generateUUID();
    console.log(`[BLOB] Requesting download: ${filename}`);

    this.sender.send({
      type: 'blob_request',
      to: { deviceId: targetDeviceId, deviceType: 'pylon' },
      payload: {
        blobId,
        entityId,
        filename,
        ...(filePath && { localPath: filePath }),
      },
    });
  }

  // ============ 메시지 핸들러 ============

  /**
   * 수신 메시지 처리 (RelayService에서 호출)
   */
  handleMessage(data: Record<string, unknown>): void {
    const type = data.type as string;

    switch (type) {
      case 'blob_start':
        this.handleBlobStart(data);
        break;
      case 'blob_chunk':
        this.handleBlobChunk(data);
        break;
      case 'blob_end':
        this.handleBlobEnd(data);
        break;
      case 'blob_upload_complete':
        this.handleBlobUploadComplete(data);
        break;
    }
  }

  private handleBlobStart(data: Record<string, unknown>): void {
    const payload = data.payload as Record<string, unknown>;
    if (!payload) return;

    const blobId = payload.blobId as string;
    const filename = payload.filename as string;

    // 이미 캐시에 있으면 스킵
    if (imageCache.has(filename)) {
      console.log(`[BLOB] Already cached, skipping: ${filename}`);
      return;
    }

    const transfer: BlobTransfer = {
      blobId,
      filename,
      mimeType: payload.mimeType as string,
      totalSize: payload.totalSize as number,
      chunkSize: payload.chunkSize as number,
      totalChunks: payload.totalChunks as number,
      context: (payload.context as Record<string, unknown>) ?? {},
      isUpload: false,
      state: 'downloading',
      processedChunks: 0,
      chunks: new Array(payload.totalChunks as number).fill(new Uint8Array(0)),
    };

    this.transfers.set(blobId, transfer);
    console.log(`[BLOB] Download started: ${filename} (${transfer.totalChunks} chunks)`);
  }

  private handleBlobChunk(data: Record<string, unknown>): void {
    const payload = data.payload as Record<string, unknown>;
    if (!payload) return;

    const blobId = payload.blobId as string;
    const transfer = this.transfers.get(blobId);
    if (!transfer) return;

    const index = payload.index as number;
    const dataStr = payload.data as string;
    const chunk = base64ToUint8Array(dataStr);

    transfer.chunks[index] = chunk;
    transfer.processedChunks++;

    this.progressListeners.forEach((cb) =>
      cb(blobId, transfer.processedChunks, transfer.totalChunks)
    );
  }

  private handleBlobEnd(data: Record<string, unknown>): void {
    const payload = data.payload as Record<string, unknown>;
    if (!payload) return;

    const blobId = payload.blobId as string;
    const transfer = this.transfers.get(blobId);
    if (!transfer || transfer.isUpload) return;

    // 모든 청크 조합 (누락된 청크 건너뛰기)
    const validChunks = transfer.chunks.filter((chunk) => chunk && chunk.length > 0);
    const totalLength = validChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const bytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of validChunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }

    // 캐시에 저장
    imageCache.set(transfer.filename, bytes);

    transfer.bytes = bytes;
    transfer.state = 'completed';
    transfer.chunks = []; // 메모리 정리

    // 완료 이벤트 발송
    const event: BlobDownloadCompleteEvent = {
      blobId,
      filename: transfer.filename,
      bytes,
    };
    this.downloadCompleteListeners.forEach((cb) => cb(event));

    console.log(`[BLOB] Download complete: ${transfer.filename} (${bytes.length} bytes)`);
  }

  private handleBlobUploadComplete(data: Record<string, unknown>): void {
    const payload = data.payload as Record<string, unknown>;
    if (!payload) return;

    const blobId = payload.blobId as string;
    const fileId = (payload.fileId as string) ?? blobId;
    const pylonPath = payload.path as string;
    const entityId = (payload.entityId as number) ?? 0;
    const thumbnailBase64 = payload.thumbnail as string | undefined;

    const transfer = this.transfers.get(blobId);
    if (transfer) {
      transfer.state = 'completed';
      transfer.pylonPath = pylonPath;

      // 썸네일 캐시 저장 (data URI prefix 제거)
      if (thumbnailBase64) {
        const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
        const thumbBytes = base64ToUint8Array(base64Data);
        imageCache.set(`thumb_${transfer.filename}`, thumbBytes);
      }

      const event: BlobUploadCompleteEvent = {
        blobId,
        fileId,
        filename: transfer.filename,
        pylonPath,
        entityId,
        thumbnailBase64,
      };
      this.uploadCompleteListeners.forEach((cb) => cb(event));

      console.log(`[BLOB] Upload complete: ${transfer.filename} -> ${pylonPath}`);
    }
  }

  // ============ 캐시 관리 ============

  getCachedImage(filename: string): Uint8Array | undefined {
    return imageCache.get(filename);
  }

  hasCachedImage(filename: string): boolean {
    return imageCache.has(filename);
  }

  get cacheStats() {
    return imageCache.getStats();
  }

  // ============ 기타 ============

  getTransfer(blobId: string): BlobTransfer | undefined {
    return this.transfers.get(blobId);
  }

  cancelTransfer(blobId: string): void {
    const transfer = this.transfers.get(blobId);
    if (transfer) {
      transfer.state = 'failed';
      transfer.error = 'Cancelled';
    }
  }

  removeTransfer(blobId: string): void {
    this.transfers.delete(blobId);
  }

  dispose(): void {
    this.transfers.clear();
    this.progressListeners = [];
    this.uploadCompleteListeners = [];
    this.downloadCompleteListeners = [];
    this.errorListeners = [];
  }
}

/** 싱글톤 인스턴스 */
export const blobService = new BlobTransferService();
