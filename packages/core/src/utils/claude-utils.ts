/**
 * @file claude-utils.ts
 * @description Claude 관련 유틸리티 함수
 */

import type { Attachment } from '../types/store-message.js';

/**
 * 이미지 첨부 파싱 유틸
 *
 * @description
 * 원시 컨텐츠 문자열에서 [image:파일명] 또는 [image:/전체/경로] 패턴을 파싱하여
 * 첨부 파일 정보와 텍스트를 분리합니다.
 *
 * @param rawContent - 파싱할 원시 컨텐츠 문자열
 * @returns 분리된 텍스트와 첨부 파일 목록
 *
 * @example
 * ```typescript
 * const { text, attachments } = parseAttachments('Hello [image:test.png]');
 * // text: 'Hello'
 * // attachments: [{ filename: 'test.png', path: 'test.png' }]
 * ```
 */
export function parseAttachments(rawContent: string): { text: string; attachments: Attachment[] } {
  const attachments: Attachment[] = [];
  let text = rawContent;

  // [image:파일명] 또는 [image:/전체/경로] 패턴 파싱
  const imageRegex = /\[image:([^\]]+)\]/g;
  let match;

  while ((match = imageRegex.exec(rawContent)) !== null) {
    const imagePath = match[1];
    const filename = imagePath.split('/').pop()?.split('\\').pop() || imagePath;

    attachments.push({
      filename,
      path: imagePath,
    });

    text = text.replace(match[0], '');
  }

  return { text: text.trim(), attachments };
}

/**
 * 중단 메시지 표시 텍스트
 *
 * @description
 * 중단 사유에 따른 사용자 친화적인 메시지를 반환합니다.
 *
 * @param reason - 중단 사유 ('user' | 'session_ended')
 * @returns 표시할 메시지 문자열
 *
 * @example
 * ```typescript
 * getAbortDisplayText('user'); // '실행 중지됨'
 * getAbortDisplayText('session_ended'); // '세션 종료됨'
 * getAbortDisplayText(); // '중단됨'
 * ```
 */
export function getAbortDisplayText(reason?: string): string {
  switch (reason) {
    case 'user':
      return '실행 중지됨';
    case 'session_ended':
      return '세션 종료됨';
    default:
      return '중단됨';
  }
}

/**
 * 파일 크기 포맷팅
 *
 * @description
 * 바이트 단위의 파일 크기를 사람이 읽기 쉬운 형식으로 변환합니다.
 *
 * @param bytes - 바이트 단위의 파일 크기
 * @returns 포맷된 크기 문자열 (예: '1.5 KB', '2.3 MB')
 *
 * @example
 * ```typescript
 * formatFileSize(1024); // '1.0 KB'
 * formatFileSize(1048576); // '1.0 MB'
 * formatFileSize(500); // '500 B'
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
