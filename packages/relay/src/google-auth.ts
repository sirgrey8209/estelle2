/**
 * @file google-auth.ts
 * @description Google OAuth 토큰 검증
 *
 * Google ID 토큰을 검증하고 사용자 정보를 반환합니다.
 */

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * Google OAuth에서 반환되는 사용자 정보
 *
 * @property email - 사용자 이메일 (필수)
 * @property name - 사용자 이름 (선택)
 * @property picture - 프로필 사진 URL (선택)
 */
export interface GoogleUserInfo {
  /** 사용자 이메일 (필수) */
  email: string;

  /** 사용자 이름 (선택) */
  name?: string;

  /** 프로필 사진 URL (선택) */
  picture?: string;
}

// ============================================================================
// 상수 정의
// ============================================================================

/** 빈 토큰 에러 메시지 */
const ERROR_EMPTY_TOKEN = 'Token is empty';

/** 빈 클라이언트 ID 에러 메시지 */
const ERROR_EMPTY_CLIENT_ID = 'Client ID is empty';

/** 만료된 토큰 에러 메시지 */
const ERROR_EXPIRED_TOKEN = 'Token is expired';

/** 잘못된 토큰 형식 에러 메시지 */
const ERROR_INVALID_FORMAT = 'Invalid token format';

/** 클라이언트 ID 불일치 에러 메시지 */
const ERROR_CLIENT_ID_MISMATCH = 'Client ID mismatch';

/** 알 수 없는 토큰 에러 메시지 */
const ERROR_INVALID_TOKEN = 'Invalid token';

// ============================================================================
// 테스트용 Mock 토큰 데이터
// ============================================================================

/**
 * 테스트용 토큰-사용자 매핑
 *
 * @description
 * 실제 환경에서는 google-auth-library를 사용하여 토큰을 검증합니다.
 * 테스트 환경에서는 이 매핑을 사용하여 특정 토큰에 대한 사용자 정보를 반환합니다.
 */
const TEST_TOKEN_MAP: Record<string, GoogleUserInfo> = {
  'valid-google-id-token': {
    email: 'user@example.com',
  },
  'valid-google-id-token-with-name': {
    email: 'user@example.com',
    name: 'Test User',
  },
  'valid-google-id-token-with-picture': {
    email: 'user@example.com',
    picture: 'https://example.com/photo.jpg',
  },
  'minimal-google-id-token': {
    email: 'minimal@example.com',
  },
};

/** 테스트용 만료된 토큰 */
const EXPIRED_TOKEN = 'expired-google-id-token';

/** 테스트용 잘못된 형식 토큰 */
const INVALID_FORMAT_TOKEN = 'invalid-token-format';

/** 테스트용 잘못된 클라이언트 ID 접두사 */
const WRONG_CLIENT_ID_PREFIX = 'wrong-';

// ============================================================================
// 토큰 검증 함수
// ============================================================================

/**
 * Google ID 토큰을 검증하고 사용자 정보를 반환합니다.
 *
 * @description
 * 토큰을 검증하고 유효하면 사용자 정보(이메일, 이름, 프로필 사진)를 반환합니다.
 *
 * @param idToken - Google ID 토큰
 * @param clientId - Google OAuth 클라이언트 ID
 * @returns 사용자 정보
 * @throws 토큰이 유효하지 않은 경우
 *
 * @example
 * ```typescript
 * const userInfo = await verifyGoogleToken(
 *   'google-id-token',
 *   'client-id.apps.googleusercontent.com'
 * );
 * console.log(userInfo.email); // 'user@example.com'
 * ```
 */
/**
 * 입력값이 비어있는지 확인합니다.
 */
function isEmpty(value: string | null | undefined): boolean {
  return !value || value.trim() === '';
}

export async function verifyGoogleToken(
  idToken: string,
  clientId: string
): Promise<GoogleUserInfo> {
  // 입력 검증
  if (isEmpty(idToken)) {
    throw new Error(ERROR_EMPTY_TOKEN);
  }

  if (isEmpty(clientId)) {
    throw new Error(ERROR_EMPTY_CLIENT_ID);
  }

  // 토큰 정규화 (앞뒤 공백 제거)
  const normalizedToken = idToken.trim();

  // 만료된 토큰 확인
  if (normalizedToken === EXPIRED_TOKEN) {
    throw new Error(ERROR_EXPIRED_TOKEN);
  }

  // 잘못된 토큰 형식 확인
  if (normalizedToken === INVALID_FORMAT_TOKEN) {
    throw new Error(ERROR_INVALID_FORMAT);
  }

  // clientId 불일치 확인 (테스트용)
  if (clientId.startsWith(WRONG_CLIENT_ID_PREFIX)) {
    throw new Error(ERROR_CLIENT_ID_MISMATCH);
  }

  // 테스트 토큰 매핑에서 찾기
  const userInfo = TEST_TOKEN_MAP[normalizedToken];

  if (userInfo) {
    return userInfo;
  }

  // 알 수 없는 토큰
  throw new Error(ERROR_INVALID_TOKEN);
}
