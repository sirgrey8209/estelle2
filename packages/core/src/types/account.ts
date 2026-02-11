/**
 * @file account.ts
 * @description 계정 관련 타입 정의
 *
 * Claude 구독 계정 전환 기능에 사용되는 타입들입니다.
 */

/**
 * 계정 타입
 *
 * - linegames: 회사 계정 (team 구독)
 * - personal: 개인 계정 (max 구독)
 */
export type AccountType = 'linegames' | 'personal';

/**
 * 계정 전환 요청 페이로드
 *
 * App → Pylon: ACCOUNT_SWITCH 메시지의 payload
 */
export interface AccountSwitchPayload {
  /** 전환할 계정 */
  account: AccountType;
}

/**
 * 계정 상태 페이로드
 *
 * Pylon → App: ACCOUNT_STATUS 메시지의 payload
 */
export interface AccountStatusPayload {
  /** 현재 활성 계정 */
  current: AccountType;
  /** 구독 타입 (team, max 등) */
  subscriptionType?: string;
}

/**
 * AccountType 타입 가드
 */
export function isAccountType(value: unknown): value is AccountType {
  return value === 'linegames' || value === 'personal';
}

/**
 * AccountSwitchPayload 타입 가드
 */
export function isAccountSwitchPayload(value: unknown): value is AccountSwitchPayload {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return isAccountType(obj.account);
}

/**
 * AccountStatusPayload 타입 가드
 */
export function isAccountStatusPayload(value: unknown): value is AccountStatusPayload {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return isAccountType(obj.current);
}
