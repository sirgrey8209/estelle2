/**
 * @file share.ts
 * @description 대화 공유 관련 타입 정의
 *
 * Estelle 시스템에서 대화를 외부에 공유할 때 사용되는 타입들입니다.
 * 공유 링크 생성, 접근 추적 등의 기능을 지원합니다.
 */

/**
 * Base62 문자셋 (a-z, A-Z, 0-9)
 *
 * @description
 * URL-safe한 ID 생성을 위해 사용되는 문자셋입니다.
 * 특수문자나 유니코드 없이 ASCII 문자만 포함하여
 * URL 인코딩 없이 그대로 사용할 수 있습니다.
 */
const BASE62_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * 공유 ID의 길이
 */
const SHARE_ID_LENGTH = 12;

/**
 * 대화 공유 정보를 나타내는 인터페이스
 *
 * @description
 * 대화를 외부에 공유할 때 생성되는 메타데이터입니다.
 * 공유 링크의 고유 ID, 원본 대화 참조, 생성 시간,
 * 접근 횟수 등을 추적합니다.
 *
 * @property shareId - 공유 링크의 고유 식별자 (12자리 Base62)
 * @property conversationId - 공유되는 원본 대화의 ID
 * @property createdAt - 공유 생성 시간 (Unix timestamp, ms)
 * @property accessCount - 공유 링크 접근 횟수
 *
 * @example
 * ```typescript
 * const shareInfo: ShareInfo = {
 *   shareId: 'abc123XYZ789',
 *   conversationId: 42,
 *   createdAt: Date.now(),
 *   accessCount: 0
 * };
 *
 * // 공유 링크 URL 생성
 * const shareUrl = `https://example.com/share/${shareInfo.shareId}`;
 * ```
 */
export interface ShareInfo {
  /** 공유 링크의 고유 식별자 (12자리 Base62) */
  shareId: string;

  /** 공유되는 원본 대화의 ID */
  conversationId: number;

  /** 공유 생성 시간 (Unix timestamp, ms) */
  createdAt: number;

  /** 공유 링크 접근 횟수 */
  accessCount: number;
}

/**
 * 12자리 Base62 공유 ID를 생성합니다.
 *
 * @description
 * URL-safe한 고유 ID를 생성합니다. Base62 인코딩을 사용하여
 * a-z, A-Z, 0-9 문자만 포함하며, URL 인코딩 없이
 * 그대로 경로에 사용할 수 있습니다.
 *
 * 62^12 = 약 3.2 * 10^21 가지의 조합이 가능하여
 * 충돌 가능성이 매우 낮습니다.
 *
 * @returns 12자리 Base62 문자열
 *
 * @example
 * ```typescript
 * const shareId = generateShareId();
 * console.log(shareId); // 예: 'AbCdEf123456'
 * console.log(shareId.length); // 12
 *
 * // URL에 그대로 사용 가능
 * const url = `https://example.com/share/${shareId}`;
 * ```
 */
export function generateShareId(): string {
  let result = '';
  const charsetLength = BASE62_CHARS.length;

  for (let i = 0; i < SHARE_ID_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * charsetLength);
    result += BASE62_CHARS[randomIndex];
  }

  return result;
}

/**
 * 주어진 값이 유효한 ShareInfo 객체인지 검사합니다.
 *
 * @description
 * 런타임에 unknown 타입의 값이 ShareInfo 인터페이스를
 * 만족하는지 검증하는 타입 가드입니다.
 *
 * 모든 필수 속성(shareId, conversationId, createdAt, accessCount)이
 * 존재하고 올바른 타입인지 확인합니다.
 * 추가 속성이 있어도 필수 속성이 모두 올바르면 true를 반환합니다.
 *
 * @param value - 검사할 값
 * @returns 값이 ShareInfo이면 true, 아니면 false
 *
 * @example
 * ```typescript
 * const data: unknown = JSON.parse(rawJson);
 *
 * if (isShareInfo(data)) {
 *   // data는 ShareInfo 타입으로 좁혀짐
 *   console.log(data.shareId);
 *   console.log(data.conversationId);
 * }
 * ```
 */
export function isShareInfo(value: unknown): value is ShareInfo {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // 필수 속성 검증
  if (typeof obj.shareId !== 'string') {
    return false;
  }

  if (typeof obj.conversationId !== 'number') {
    return false;
  }

  if (typeof obj.createdAt !== 'number') {
    return false;
  }

  if (typeof obj.accessCount !== 'number') {
    return false;
  }

  return true;
}
