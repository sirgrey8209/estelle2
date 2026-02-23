/**
 * @file blob-handler.ts
 * @description Blob Handler - 대용량 파일(이미지) 전송 처리
 *
 * 청크 단위로 파일을 전송/수신하고, uploads/ 폴더에 대화별로 저장합니다.
 * 동일 디바이스 최적화(localPath 직접 사용)와 체크섬 검증을 지원합니다.
 *
 * @remarks
 * 이 모듈은 순수 로직과 I/O를 분리하여 설계되었습니다.
 * - BlobHandler: 순수 전송 로직 (테스트 용이)
 * - FileSystemAdapter: 파일 시스템 접근 추상화
 *
 * @example
 * ```typescript
 * const handler = new BlobHandler({
 *   uploadsDir: './uploads',
 *   fs: realFileSystemAdapter,
 *   sendFn: (msg) => ws.send(JSON.stringify(msg)),
 * });
 *
 * // 전송 시작 처리
 * handler.handleBlobStart(payload, fromDeviceId);
 *
 * // 청크 수신 처리
 * handler.handleBlobChunk(chunkPayload);
 *
 * // 전송 완료 처리
 * const result = handler.handleBlobEnd(endPayload);
 * console.log('Saved to:', result.path);
 * ```
 */

import { createHash } from 'crypto';
import type {
  BlobStartPayload,
  BlobChunkPayload,
  BlobEndPayload,
  BlobRequestPayload,
  BlobContext,
  Message,
  ConversationId,
} from '@estelle/core';
import { BlobConfig, MessageType } from '@estelle/core';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 파일 시스템 접근 추상화 인터페이스
 *
 * @description
 * 실제 파일 시스템 접근을 추상화하여 테스트 시 모킹이 가능하도록 합니다.
 * Node.js의 fs 모듈을 래핑하여 구현할 수 있습니다.
 */
export interface FileSystemAdapter {
  /** 파일/디렉토리 존재 여부 확인 */
  exists(path: string): boolean;

  /** 파일 읽기 (Buffer 반환) */
  readFile(path: string): Buffer;

  /** 파일 쓰기 */
  writeFile(path: string, data: Buffer): void;

  /** 디렉토리 생성 (recursive) */
  mkdir(path: string): void;

  /**
   * 디렉토리에서 파일 검색
   * @param dir - 검색할 디렉토리
   * @param filename - 찾을 파일명 (부분 매칭)
   * @returns 찾은 파일의 전체 경로, 없으면 undefined
   */
  findFile(dir: string, filename: string): string | undefined;
}

/**
 * 메시지 전송 함수 타입
 *
 * @description
 * BlobHandler가 클라이언트에게 메시지를 보낼 때 사용하는 함수입니다.
 * 실제 구현에서는 WebSocket을 통해 전송합니다.
 */
export type SendFileFn = (message: Message<unknown>) => void;

/**
 * BlobHandler 설정 옵션
 */
export interface BlobHandlerOptions {
  /** 업로드 파일 저장 디렉토리 */
  uploadsDir: string;

  /** 파일 시스템 어댑터 */
  fs: FileSystemAdapter;

  /** 메시지 전송 함수 */
  sendFn: SendFileFn;
}

/**
 * 진행 중인 파일 전송 정보
 *
 * @description
 * 활성 전송의 상태를 추적합니다.
 * 청크가 모두 수신되면 조합하여 파일로 저장합니다.
 */
export interface BlobTransfer {
  /** Blob 고유 ID */
  blobId: string;

  /** 파일명 */
  filename: string;

  /** MIME 타입 */
  mimeType: string;

  /** 전체 파일 크기 (바이트) */
  totalSize: number;

  /** 청크 크기 */
  chunkSize: number;

  /** 총 청크 수 */
  totalChunks: number;

  /** 인코딩 방식 */
  encoding: 'base64';

  /** 전송 컨텍스트 */
  context: BlobContext;

  /** 발신 디바이스 ID (pylonId) */
  from: number;

  /** 저장 경로 */
  savePath: string;

  /** 수신된 청크 데이터 (인덱스별 저장) */
  chunks: (Buffer | null)[];

  /** 수신된 청크 수 */
  receivedCount: number;

  /** 전송 완료 여부 */
  completed: boolean;

  /** 동일 디바이스 여부 */
  sameDevice?: boolean;

  /** 로컬 파일 경로 (sameDevice일 때) */
  localPath?: string;

  /** 마지막 진행률 (로깅용) */
  lastProgress?: number;
}

/**
 * BlobHandler 메서드 결과 타입
 */
export interface BlobHandlerResult {
  /** 성공 여부 */
  success: boolean;

  /** 에러 메시지 (실패 시) */
  error?: string;

  /** 저장된/사용된 파일 경로 */
  path?: string;

  /** 동일 디바이스 최적화 사용 여부 */
  sameDevice?: boolean;

  /** 전송 컨텍스트 */
  context?: BlobContext;

  /** 수신된 청크 수 */
  received?: number;

  /** MIME 타입 */
  mimeType?: string;
}

// ============================================================================
// MIME 타입 매핑
// ============================================================================

/**
 * 확장자별 MIME 타입 매핑
 *
 * @description
 * 지원하는 파일 확장자와 해당 MIME 타입을 정의합니다.
 * 이미지, 텍스트, 마크다운 등 일반적인 형식을 지원합니다.
 */
const MIME_TYPES: Record<string, string> = {
  // 이미지
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',

  // 마크다운
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',

  // 텍스트
  '.txt': 'text/plain',
  '.log': 'text/plain',
  '.json': 'application/json',
  '.xml': 'text/xml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
};

// ============================================================================
// BlobHandler 클래스
// ============================================================================

/**
 * Blob 전송 핸들러
 *
 * @description
 * 대용량 파일을 청크 단위로 전송/수신하는 핸들러입니다.
 * 주요 기능:
 * - 청크 단위 파일 수신 및 조합
 * - 대화별 폴더에 파일 저장
 * - 동일 디바이스 최적화 (localPath 직접 사용)
 * - SHA-256 체크섬 검증
 * - 파일 요청 처리 (다운로드)
 *
 * @example
 * ```typescript
 * const handler = new BlobHandler({
 *   uploadsDir: './uploads',
 *   fs: nodeFileSystemAdapter,
 *   sendFn: (msg) => webSocket.send(JSON.stringify(msg)),
 * });
 *
 * // 메시지 타입에 따라 핸들러 호출
 * switch (message.type) {
 *   case 'blob_start':
 *     handler.handleBlobStart(message.payload, message.from);
 *     break;
 *   case 'blob_chunk':
 *     handler.handleBlobChunk(message.payload);
 *     break;
 *   case 'blob_end':
 *     const result = handler.handleBlobEnd(message.payload);
 *     if (result.success) {
 *       console.log('File saved:', result.path);
 *     }
 *     break;
 * }
 * ```
 */
export class BlobHandler {
  /** 업로드 파일 저장 디렉토리 */
  private readonly uploadsDir: string;

  /** 파일 시스템 어댑터 */
  private readonly fs: FileSystemAdapter;

  /** 메시지 전송 함수 */
  private readonly send: SendFileFn;

  /** 활성 전송 목록 (blobId -> BlobTransfer) */
  private readonly activeTransfers: Map<string, BlobTransfer> = new Map();

  /**
   * BlobHandler 생성자
   *
   * @param options - 핸들러 설정 옵션
   */
  constructor(options: BlobHandlerOptions) {
    this.uploadsDir = options.uploadsDir;
    this.fs = options.fs;
    this.send = options.sendFn;
  }

  // ==========================================================================
  // 공개 메서드
  // ==========================================================================

  /**
   * blob_start 메시지 처리
   *
   * @description
   * 파일 전송 시작을 처리합니다.
   * - 동일 디바이스면 localPath를 직접 사용 (청크 전송 생략)
   * - 다른 디바이스면 청크 수신 준비
   *
   * @param payload - BlobStartPayload
   * @param from - 발신 디바이스 ID
   * @returns 처리 결과
   */
  handleBlobStart(payload: BlobStartPayload, from: number): BlobHandlerResult {
    const {
      blobId,
      filename,
      mimeType,
      totalSize,
      chunkSize,
      totalChunks,
      encoding,
      context,
      sameDevice,
      localPath,
    } = payload;

    console.log(`[BLOB] Start: ${blobId} (${filename}, ${totalSize} bytes, ${totalChunks} chunks)`);

    // 동일 디바이스면 로컬 경로 직접 사용
    if (sameDevice && localPath) {
      console.log(`[BLOB] Same device, using local path: ${localPath}`);

      // 로컬 파일 존재 확인
      if (this.fs.exists(localPath)) {
        this.activeTransfers.set(blobId, {
          blobId,
          filename,
          mimeType,
          totalSize,
          chunkSize,
          totalChunks,
          encoding,
          context,
          from,
          savePath: localPath,
          chunks: [],
          receivedCount: 0,
          completed: true,
          sameDevice: true,
          localPath,
        });

        return { success: true, path: localPath, sameDevice: true };
      }

      // 파일이 없으면 일반 전송으로 폴백
      console.log(`[BLOB] Local file not found, falling back to normal transfer`);
    }

    // 대화별 폴더 생성
    const folderName = context.conversationId ? String(context.conversationId) : 'unknown';
    const conversationDir = this.joinPath(this.uploadsDir, folderName);
    this.fs.mkdir(conversationDir);

    // 파일명 정제 (위험한 문자 제거)
    const safeFilename = this.sanitizeFilename(filename);
    const savePath = this.joinPath(conversationDir, safeFilename);

    // 전송 정보 저장
    this.activeTransfers.set(blobId, {
      blobId,
      filename,
      mimeType,
      totalSize,
      chunkSize,
      totalChunks,
      encoding,
      context,
      from,
      savePath,
      chunks: new Array(totalChunks).fill(null),
      receivedCount: 0,
      completed: false,
    });

    return { success: true };
  }

  /**
   * blob_chunk 메시지 처리
   *
   * @description
   * 파일 청크를 수신하여 저장합니다.
   * Base64로 인코딩된 데이터를 디코딩하여 메모리에 보관합니다.
   *
   * @param payload - BlobChunkPayload
   * @returns 처리 결과
   */
  handleBlobChunk(payload: BlobChunkPayload): BlobHandlerResult {
    const { blobId, index, data } = payload;

    const transfer = this.activeTransfers.get(blobId);
    if (!transfer) {
      console.error(`[BLOB] Unknown transfer: ${blobId}`);
      return { success: false, error: 'Unknown transfer' };
    }

    // 동일 디바이스면 청크 무시
    if (transfer.sameDevice) {
      return { success: true };
    }

    // Base64 디코딩
    const chunk = Buffer.from(data, 'base64');
    transfer.chunks[index] = chunk;
    transfer.receivedCount++;

    // 진행률 로그 (10% 단위)
    const progress = Math.floor((transfer.receivedCount / transfer.totalChunks) * 10);
    if (transfer.receivedCount === 1 || progress > (transfer.lastProgress ?? 0)) {
      console.log(
        `[BLOB] ${blobId}: ${transfer.receivedCount}/${transfer.totalChunks} chunks (${progress * 10}%)`
      );
      transfer.lastProgress = progress;
    }

    return { success: true, received: transfer.receivedCount };
  }

  /**
   * blob_end 메시지 처리
   *
   * @description
   * 파일 전송 완료를 처리합니다.
   * - 모든 청크를 조합하여 파일로 저장
   * - 체크섬 검증 (선택적)
   * - 메모리 정리
   *
   * @param payload - BlobEndPayload
   * @returns 처리 결과 (성공 시 저장 경로 포함)
   */
  handleBlobEnd(payload: BlobEndPayload): BlobHandlerResult {
    const { blobId, checksum } = payload;

    const transfer = this.activeTransfers.get(blobId);
    if (!transfer) {
      console.error(`[BLOB] Unknown transfer: ${blobId}`);
      return { success: false, error: 'Unknown transfer' };
    }

    // 동일 디바이스면 이미 완료
    if (transfer.sameDevice) {
      console.log(`[BLOB] Complete (same device): ${blobId} -> ${transfer.localPath}`);
      transfer.completed = true;
      return {
        success: true,
        path: transfer.localPath,
        context: transfer.context,
        mimeType: transfer.mimeType,
      };
    }

    // 모든 청크 확인
    const allChunks = transfer.chunks.filter((c): c is Buffer => c !== null);
    if (allChunks.length !== transfer.totalChunks) {
      console.error(`[BLOB] Missing chunks: ${allChunks.length}/${transfer.totalChunks}`);
      return {
        success: false,
        error: `Missing chunks: ${allChunks.length}/${transfer.totalChunks}`,
      };
    }

    // 청크 조합
    const fileBuffer = Buffer.concat(allChunks);

    // 체크섬 검증 (선택적)
    if (checksum) {
      const hash = createHash('sha256').update(fileBuffer).digest('hex');
      const expectedHash = checksum.replace('sha256:', '');
      if (hash !== expectedHash) {
        console.error(`[BLOB] Checksum mismatch: ${hash} !== ${expectedHash}`);
        return { success: false, error: 'Checksum mismatch' };
      }
    }

    // 파일 저장
    this.fs.writeFile(transfer.savePath, fileBuffer);
    console.log(`[BLOB] Complete: ${blobId} -> ${transfer.savePath}`);

    transfer.completed = true;

    // 메모리 정리
    transfer.chunks = [];

    return {
      success: true,
      path: transfer.savePath,
      context: transfer.context,
      mimeType: transfer.mimeType,
    };
  }

  /**
   * blob_request 메시지 처리 (파일 다운로드 요청)
   *
   * @description
   * 클라이언트가 파일을 요청하면 청크 단위로 전송합니다.
   * - localPath로 직접 접근 시도
   * - 없으면 uploads 디렉토리에서 검색
   *
   * @param payload - BlobRequestPayload
   * @param from - 요청한 디바이스 ID
   * @returns 처리 결과
   */
  handleBlobRequest(payload: BlobRequestPayload, from: number): BlobHandlerResult {
    const { blobId, filename, localPath } = payload;

    console.log(`[BLOB] Download request: ${filename}`, { blobId, localPath });

    // 파일 찾기 - localPath가 있으면 우선 사용
    let filePath = localPath;
    console.log(
      `[BLOB] Trying localPath: ${localPath}, exists: ${localPath ? this.fs.exists(localPath) : 'N/A'}`
    );

    if (!filePath || !this.fs.exists(filePath)) {
      // uploads 디렉토리에서 검색
      filePath = this.fs.findFile(this.uploadsDir, filename);
    }

    if (!filePath || !this.fs.exists(filePath)) {
      console.error(`[BLOB] File not found: ${filename}`);
      return { success: false, error: 'File not found' };
    }

    console.log(`[BLOB] Found file: ${filePath}`);

    // 파일 읽기 및 청크 전송
    const fileBuffer = this.fs.readFile(filePath);
    const mimeType = this.getMimeType(filename);
    const totalChunks = Math.ceil(fileBuffer.length / BlobConfig.CHUNK_SIZE);

    console.log(`[BLOB] Sending file: ${filename} (${fileBuffer.length} bytes, ${totalChunks} chunks) to ${from}`);

    // 요청자 deviceId (Relay 라우팅용)
    const toDeviceId = from;

    // blob_start 전송
    this.send({
      type: MessageType.BLOB_START,
      to: [toDeviceId],
      payload: {
        blobId,
        filename,
        mimeType,
        totalSize: fileBuffer.length,
        chunkSize: BlobConfig.CHUNK_SIZE,
        totalChunks,
        encoding: BlobConfig.ENCODING,
        context: { type: 'file_transfer', conversationId: 0 as ConversationId },
      } satisfies BlobStartPayload,
      timestamp: Date.now(),
    });

    // 청크 전송
    for (let i = 0; i < totalChunks; i++) {
      const start = i * BlobConfig.CHUNK_SIZE;
      const end = Math.min(start + BlobConfig.CHUNK_SIZE, fileBuffer.length);
      const chunk = fileBuffer.subarray(start, end);

      this.send({
        type: MessageType.BLOB_CHUNK,
        to: [toDeviceId],
        payload: {
          blobId,
          index: i,
          data: chunk.toString('base64'),
          size: chunk.length,
        } satisfies BlobChunkPayload,
        timestamp: Date.now(),
      });
    }

    // blob_end 전송
    const checksum = createHash('sha256').update(fileBuffer).digest('hex');
    this.send({
      type: MessageType.BLOB_END,
      to: [toDeviceId],
      payload: {
        blobId,
        checksum: `sha256:${checksum}`,
        totalReceived: fileBuffer.length,
      } satisfies BlobEndPayload,
      timestamp: Date.now(),
    });

    return { success: true };
  }

  /**
   * 전송 정보 조회
   *
   * @param blobId - Blob ID
   * @returns 전송 정보 또는 undefined
   */
  getTransfer(blobId: string): BlobTransfer | undefined {
    return this.activeTransfers.get(blobId);
  }

  /**
   * 전송 정보 삭제 (정리)
   *
   * @param blobId - Blob ID
   */
  cleanup(blobId: string): void {
    this.activeTransfers.delete(blobId);
  }

  /**
   * MIME 타입 추정
   *
   * @description
   * 파일 확장자를 기반으로 MIME 타입을 추정합니다.
   * 알 수 없는 확장자는 application/octet-stream을 반환합니다.
   *
   * @param filename - 파일명
   * @returns MIME 타입 문자열
   */
  getMimeType(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) {
      return 'application/octet-stream';
    }
    const ext = filename.substring(lastDot).toLowerCase();
    return MIME_TYPES[ext] ?? 'application/octet-stream';
  }

  // ==========================================================================
  // 비공개 헬퍼 메서드
  // ==========================================================================

  /**
   * 파일명 정제
   *
   * @description
   * 파일명에서 위험한 문자를 제거합니다.
   * Windows와 Unix 모두에서 안전한 파일명을 생성합니다.
   *
   * @param filename - 원본 파일명
   * @returns 정제된 파일명
   */
  private sanitizeFilename(filename: string): string {
    // 위험한 문자 제거: < > : " / \ | ? *
    return filename.replace(/[<>:"/\\|?*]/g, '_');
  }

  /**
   * 경로 결합
   *
   * @description
   * 두 경로를 결합합니다. 플랫폼 독립적으로 동작합니다.
   *
   * @param base - 기본 경로
   * @param segment - 추가할 경로 세그먼트
   * @returns 결합된 경로
   */
  private joinPath(base: string, segment: string): string {
    // 이미 구분자로 끝나면 그대로, 아니면 / 추가
    const separator = base.endsWith('/') || base.endsWith('\\') ? '' : '/';
    return `${base}${separator}${segment}`;
  }
}
