/**
 * @file blob-config.ts
 * @description Blob(파일) 전송 설정 상수 정의
 *
 * 대용량 파일 전송 시 사용되는 청크 크기와 인코딩 방식을 정의합니다.
 * 이미지, 로그 파일 등을 Relay를 통해 전송할 때 사용됩니다.
 */

/**
 * Blob 전송 설정 상수
 *
 * @description
 * 파일 전송에 사용되는 설정값을 정의합니다.
 *
 * 전송 흐름:
 * 1. BLOB_START - 파일 메타데이터 전송 (이름, 크기, MIME 타입)
 * 2. BLOB_CHUNK - CHUNK_SIZE 단위로 분할하여 전송 (base64 인코딩)
 * 3. BLOB_END - 전송 완료 신호
 * 4. BLOB_ACK - 수신 확인
 *
 * @example
 * ```typescript
 * import { BlobConfig } from '@estelle/core';
 *
 * // 파일을 청크로 분할
 * const chunks: string[] = [];
 * for (let i = 0; i < buffer.length; i += BlobConfig.CHUNK_SIZE) {
 *   const chunk = buffer.slice(i, i + BlobConfig.CHUNK_SIZE);
 *   chunks.push(chunk.toString(BlobConfig.ENCODING));
 * }
 * ```
 */
export const BlobConfig = {
  /**
   * 청크 크기 (바이트)
   * 64KB = 65536 bytes
   *
   * WebSocket 메시지 크기 제한을 고려하여 설정됨.
   * base64 인코딩 시 약 33% 크기 증가 (87KB 정도)
   */
  CHUNK_SIZE: 65536,

  /**
   * 청크 인코딩 방식
   *
   * WebSocket은 텍스트 메시지를 사용하므로
   * 바이너리 데이터를 base64로 인코딩하여 전송
   */
  ENCODING: 'base64',
} as const;

/**
 * 청크 크기 타입 (리터럴)
 * @internal
 */
export type ChunkSize = typeof BlobConfig.CHUNK_SIZE;

/**
 * 인코딩 타입 (리터럴)
 * @internal
 */
export type BlobEncoding = typeof BlobConfig.ENCODING;
