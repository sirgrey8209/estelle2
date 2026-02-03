/**
 * @file blob.ts
 * @description Blob 전송 관련 타입 정의
 *
 * Estelle 시스템에서 대용량 파일(이미지, 문서 등)을 청크 단위로 전송할 때
 * 사용하는 타입들을 정의합니다. 파일 첨부, 전송 시작/진행/완료, 청크 확인
 * 등의 기능을 포함합니다.
 */

// ============================================================================
// Attachment Types
// ============================================================================

/**
 * 첨부 파일 타입
 *
 * @description
 * Claude에게 메시지와 함께 전송할 첨부 파일을 나타냅니다.
 * 이미지, 문서, 텍스트 파일 등 다양한 형식의 파일을 첨부할 수 있습니다.
 *
 * @property id - 첨부 파일의 고유 식별자
 * @property filename - 파일 이름 (확장자 포함)
 * @property mimeType - 파일의 MIME 타입 (예: 'image/png', 'application/pdf')
 * @property size - 파일 크기 (바이트 단위)
 * @property localPath - 로컬 파일 시스템 경로 (선택적, 같은 기기에서 전송 시)
 *
 * @example
 * ```typescript
 * // 이미지 첨부
 * const imageAttachment: Attachment = {
 *   id: 'att-001',
 *   filename: 'screenshot.png',
 *   mimeType: 'image/png',
 *   size: 2048576,
 *   localPath: 'C:\\Users\\user\\images\\screenshot.png'
 * };
 *
 * // PDF 문서 첨부
 * const pdfAttachment: Attachment = {
 *   id: 'att-002',
 *   filename: 'document.pdf',
 *   mimeType: 'application/pdf',
 *   size: 1024000
 * };
 * ```
 */
export interface Attachment {
  /** 첨부 파일의 고유 식별자 */
  id: string;

  /** 파일 이름 (확장자 포함) */
  filename: string;

  /** 파일의 MIME 타입 (예: 'image/png', 'application/pdf') */
  mimeType: string;

  /** 파일 크기 (바이트 단위) */
  size: number;

  /**
   * 로컬 파일 시스템 경로 (선택적)
   * 같은 기기에서 전송할 때 실제 파일 경로를 저장합니다.
   */
  localPath?: string;
}

// ============================================================================
// Blob Context Types
// ============================================================================

/**
 * Blob 컨텍스트 타입
 *
 * @description
 * Blob 전송의 목적을 나타내는 타입입니다.
 *
 * - `image_upload`: 이미지 업로드 (Claude에게 이미지 분석 요청 등)
 * - `file_transfer`: 일반 파일 전송
 *
 * @example
 * ```typescript
 * const contextType: BlobContextType = 'image_upload';
 * ```
 */
export type BlobContextType = 'image_upload' | 'file_transfer';

/**
 * Blob 전송 컨텍스트
 *
 * @description
 * Blob 전송이 어떤 맥락에서 이루어지는지에 대한 정보를 담습니다.
 * 대상 대화, 전송 목적 등의 정보를 포함합니다.
 *
 * @property type - 전송 유형 ('image_upload' 또는 'file_transfer')
 * @property conversationId - 전송 대상 대화의 고유 식별자
 * @property message - 파일과 함께 전송할 메시지 (선택적)
 *
 * @example
 * ```typescript
 * // 이미지 업로드 컨텍스트
 * const uploadContext: BlobContext = {
 *   type: 'image_upload',
 *   conversationId: 'conv-123',
 *   message: '이 이미지를 분석해주세요.'
 * };
 *
 * // 파일 전송 컨텍스트
 * const transferContext: BlobContext = {
 *   type: 'file_transfer',
 *   conversationId: 'conv-123'
 * };
 * ```
 */
export interface BlobContext {
  /** 전송 유형 */
  type: BlobContextType;

  /** 전송 대상 대화의 고유 식별자 */
  conversationId: string;

  /** 파일과 함께 전송할 메시지 (선택적) */
  message?: string;
}

// ============================================================================
// Blob Transfer Payloads
// ============================================================================

/**
 * Blob 전송 시작 페이로드
 *
 * @description
 * 대용량 파일 전송을 시작할 때 전송하는 메타데이터입니다.
 * 파일 정보, 청크 분할 정보, 전송 컨텍스트 등을 포함합니다.
 *
 * @property blobId - Blob의 고유 식별자 (전송 세션 ID)
 * @property filename - 파일 이름
 * @property mimeType - 파일의 MIME 타입
 * @property totalSize - 전체 파일 크기 (바이트)
 * @property chunkSize - 각 청크의 크기 (바이트)
 * @property totalChunks - 총 청크 수
 * @property encoding - 데이터 인코딩 방식 (현재 'base64'만 지원)
 * @property context - 전송 컨텍스트 정보
 * @property sameDevice - 송신자와 수신자가 같은 기기인지 여부 (선택적)
 * @property localPath - 원본 파일의 로컬 경로 (선택적)
 *
 * @example
 * ```typescript
 * const startPayload: BlobStartPayload = {
 *   blobId: 'blob-uuid-001',
 *   filename: 'large-image.png',
 *   mimeType: 'image/png',
 *   totalSize: 10485760, // 10MB
 *   chunkSize: 65536,    // 64KB
 *   totalChunks: 160,
 *   encoding: 'base64',
 *   context: {
 *     type: 'image_upload',
 *     conversationId: 'conv-123',
 *     message: '이 이미지를 분석해주세요.'
 *   }
 * };
 * ```
 */
export interface BlobStartPayload {
  /** Blob의 고유 식별자 (전송 세션 ID) */
  blobId: string;

  /** 파일 이름 */
  filename: string;

  /** 파일의 MIME 타입 */
  mimeType: string;

  /** 전체 파일 크기 (바이트) */
  totalSize: number;

  /** 각 청크의 크기 (바이트) */
  chunkSize: number;

  /** 총 청크 수 */
  totalChunks: number;

  /**
   * 데이터 인코딩 방식
   * 현재 'base64'만 지원합니다.
   */
  encoding: 'base64';

  /** 전송 컨텍스트 정보 */
  context: BlobContext;

  /**
   * 송신자와 수신자가 같은 기기인지 여부 (선택적)
   * true인 경우 localPath를 통한 직접 파일 접근이 가능할 수 있습니다.
   */
  sameDevice?: boolean;

  /** 원본 파일의 로컬 경로 (선택적) */
  localPath?: string;
}

/**
 * Blob 청크 페이로드
 *
 * @description
 * 분할된 파일 데이터의 한 청크를 전송할 때 사용하는 페이로드입니다.
 * Base64로 인코딩된 데이터와 청크 메타데이터를 포함합니다.
 *
 * @property blobId - 해당 청크가 속한 Blob의 고유 식별자
 * @property index - 청크 인덱스 (0부터 시작)
 * @property data - Base64로 인코딩된 청크 데이터
 * @property size - 원본 데이터 크기 (바이트, 인코딩 전)
 *
 * @example
 * ```typescript
 * const chunkPayload: BlobChunkPayload = {
 *   blobId: 'blob-uuid-001',
 *   index: 0,
 *   data: 'SGVsbG8gV29ybGQh...', // Base64 encoded data
 *   size: 65536
 * };
 * ```
 */
export interface BlobChunkPayload {
  /** 해당 청크가 속한 Blob의 고유 식별자 */
  blobId: string;

  /** 청크 인덱스 (0부터 시작) */
  index: number;

  /** Base64로 인코딩된 청크 데이터 */
  data: string;

  /** 원본 데이터 크기 (바이트, 인코딩 전) */
  size: number;
}

/**
 * Blob 전송 완료 페이로드
 *
 * @description
 * 모든 청크 전송이 완료되었을 때 전송하는 페이로드입니다.
 * 선택적으로 체크섬을 포함하여 데이터 무결성을 검증할 수 있습니다.
 *
 * @property blobId - 완료된 Blob의 고유 식별자
 * @property checksum - 파일 체크섬 (선택적, 예: 'sha256:abc123...')
 * @property totalReceived - 실제로 수신된 총 바이트 수
 *
 * @example
 * ```typescript
 * const endPayload: BlobEndPayload = {
 *   blobId: 'blob-uuid-001',
 *   checksum: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
 *   totalReceived: 10485760
 * };
 * ```
 */
export interface BlobEndPayload {
  /** 완료된 Blob의 고유 식별자 */
  blobId: string;

  /**
   * 파일 체크섬 (선택적)
   * 형식: '{algorithm}:{hash}' (예: 'sha256:abc123...', 'md5:def456...')
   */
  checksum?: string;

  /** 실제로 수신된 총 바이트 수 */
  totalReceived: number;
}

/**
 * Blob 수신 확인 페이로드
 *
 * @description
 * 수신 측에서 어떤 청크를 받았고 어떤 청크가 누락되었는지 알려주는 페이로드입니다.
 * 신뢰성 있는 전송을 위한 재전송 요청에 사용됩니다.
 *
 * @property blobId - 확인 중인 Blob의 고유 식별자
 * @property receivedChunks - 성공적으로 수신된 청크 인덱스 배열
 * @property missingChunks - 누락된 청크 인덱스 배열 (재전송 필요)
 *
 * @example
 * ```typescript
 * const ackPayload: BlobAckPayload = {
 *   blobId: 'blob-uuid-001',
 *   receivedChunks: [0, 1, 2, 3, 4, 6, 7, 8],
 *   missingChunks: [5, 9] // 이 청크들은 재전송 필요
 * };
 * ```
 */
export interface BlobAckPayload {
  /** 확인 중인 Blob의 고유 식별자 */
  blobId: string;

  /** 성공적으로 수신된 청크 인덱스 배열 */
  receivedChunks: number[];

  /** 누락된 청크 인덱스 배열 (재전송 필요) */
  missingChunks: number[];
}

/**
 * Blob 요청 페이로드
 *
 * @description
 * 특정 파일의 전송을 요청할 때 사용하는 페이로드입니다.
 * 파일 다운로드 요청이나 재전송 요청 시 사용됩니다.
 *
 * @property blobId - 요청하는 Blob의 고유 식별자
 * @property filename - 요청하는 파일의 이름
 * @property localPath - 저장할 로컬 경로 (선택적)
 *
 * @example
 * ```typescript
 * const requestPayload: BlobRequestPayload = {
 *   blobId: 'blob-uuid-001',
 *   filename: 'document.pdf',
 *   localPath: 'C:\\Users\\user\\Downloads\\document.pdf'
 * };
 * ```
 */
export interface BlobRequestPayload {
  /** 요청하는 Blob의 고유 식별자 */
  blobId: string;

  /** 요청하는 파일의 이름 */
  filename: string;

  /** 저장할 로컬 경로 (선택적) */
  localPath?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * 값이 객체이고 null이 아닌지 확인하는 헬퍼 함수
 *
 * @param value - 확인할 값
 * @returns 객체이고 null이 아니면 true
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 유효한 BlobContextType 값 목록
 */
const BLOB_CONTEXT_TYPES: readonly string[] = ['image_upload', 'file_transfer'];

/**
 * Attachment 타입 가드
 *
 * @description
 * 주어진 값이 유효한 Attachment 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns 유효한 Attachment면 true
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(message);
 * if (isAttachment(data)) {
 *   console.log('Filename:', data.filename);
 * }
 * ```
 */
export function isAttachment(value: unknown): value is Attachment {
  if (!isObject(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.filename !== 'string') return false;
  if (typeof value.mimeType !== 'string') return false;
  if (typeof value.size !== 'number') return false;
  if (value.localPath !== undefined && typeof value.localPath !== 'string') return false;
  return true;
}

/**
 * BlobContextType 타입 가드
 *
 * @description
 * 주어진 값이 유효한 BlobContextType 값인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns 유효한 BlobContextType이면 true
 *
 * @example
 * ```typescript
 * const type: unknown = 'image_upload';
 * if (isBlobContextType(type)) {
 *   // type은 BlobContextType 타입으로 좁혀짐
 * }
 * ```
 */
export function isBlobContextType(value: unknown): value is BlobContextType {
  return typeof value === 'string' && BLOB_CONTEXT_TYPES.includes(value);
}

/**
 * BlobContext 타입 가드
 *
 * @description
 * 주어진 값이 유효한 BlobContext 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns 유효한 BlobContext면 true
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(message);
 * if (isBlobContext(data)) {
 *   console.log('Conversation ID:', data.conversationId);
 * }
 * ```
 */
export function isBlobContext(value: unknown): value is BlobContext {
  if (!isObject(value)) return false;
  if (!isBlobContextType(value.type)) return false;
  if (typeof value.conversationId !== 'string') return false;
  if (value.message !== undefined && typeof value.message !== 'string') return false;
  return true;
}

/**
 * BlobStartPayload 타입 가드
 *
 * @description
 * 주어진 값이 유효한 BlobStartPayload 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns 유효한 BlobStartPayload면 true
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(message);
 * if (isBlobStartPayload(data)) {
 *   console.log('Total chunks:', data.totalChunks);
 * }
 * ```
 */
export function isBlobStartPayload(value: unknown): value is BlobStartPayload {
  if (!isObject(value)) return false;
  if (typeof value.blobId !== 'string') return false;
  if (typeof value.filename !== 'string') return false;
  if (typeof value.mimeType !== 'string') return false;
  if (typeof value.totalSize !== 'number') return false;
  if (typeof value.chunkSize !== 'number') return false;
  if (typeof value.totalChunks !== 'number') return false;
  if (value.encoding !== 'base64') return false;
  if (!isBlobContext(value.context)) return false;
  if (value.sameDevice !== undefined && typeof value.sameDevice !== 'boolean') return false;
  if (value.localPath !== undefined && typeof value.localPath !== 'string') return false;
  return true;
}

/**
 * BlobChunkPayload 타입 가드
 *
 * @description
 * 주어진 값이 유효한 BlobChunkPayload 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns 유효한 BlobChunkPayload면 true
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(message);
 * if (isBlobChunkPayload(data)) {
 *   console.log('Chunk index:', data.index);
 * }
 * ```
 */
export function isBlobChunkPayload(value: unknown): value is BlobChunkPayload {
  if (!isObject(value)) return false;
  if (typeof value.blobId !== 'string') return false;
  if (typeof value.index !== 'number') return false;
  if (typeof value.data !== 'string') return false;
  if (typeof value.size !== 'number') return false;
  return true;
}

/**
 * BlobEndPayload 타입 가드
 *
 * @description
 * 주어진 값이 유효한 BlobEndPayload 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns 유효한 BlobEndPayload면 true
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(message);
 * if (isBlobEndPayload(data)) {
 *   console.log('Total received:', data.totalReceived);
 * }
 * ```
 */
export function isBlobEndPayload(value: unknown): value is BlobEndPayload {
  if (!isObject(value)) return false;
  if (typeof value.blobId !== 'string') return false;
  if (value.checksum !== undefined && typeof value.checksum !== 'string') return false;
  if (typeof value.totalReceived !== 'number') return false;
  return true;
}

/**
 * BlobAckPayload 타입 가드
 *
 * @description
 * 주어진 값이 유효한 BlobAckPayload 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns 유효한 BlobAckPayload면 true
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(message);
 * if (isBlobAckPayload(data)) {
 *   console.log('Missing chunks:', data.missingChunks);
 * }
 * ```
 */
export function isBlobAckPayload(value: unknown): value is BlobAckPayload {
  if (!isObject(value)) return false;
  if (typeof value.blobId !== 'string') return false;
  if (!Array.isArray(value.receivedChunks)) return false;
  if (!Array.isArray(value.missingChunks)) return false;
  return true;
}

/**
 * BlobRequestPayload 타입 가드
 *
 * @description
 * 주어진 값이 유효한 BlobRequestPayload 타입인지 확인합니다.
 *
 * @param value - 확인할 값
 * @returns 유효한 BlobRequestPayload면 true
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(message);
 * if (isBlobRequestPayload(data)) {
 *   console.log('Filename:', data.filename);
 * }
 * ```
 */
export function isBlobRequestPayload(value: unknown): value is BlobRequestPayload {
  if (!isObject(value)) return false;
  if (typeof value.blobId !== 'string') return false;
  if (typeof value.filename !== 'string') return false;
  if (value.localPath !== undefined && typeof value.localPath !== 'string') return false;
  return true;
}
