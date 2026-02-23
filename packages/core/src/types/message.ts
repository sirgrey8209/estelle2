/**
 * @file message.ts
 * @description 메시지 타입 정의
 *
 * Estelle 시스템에서 컴포넌트 간 통신에 사용되는 메시지 타입입니다.
 */

import type { DeviceId } from './device.js';

/**
 * 시스템 내 모든 통신에 사용되는 기본 메시지 인터페이스
 *
 * @description
 * Relay, Pylon, App 간의 모든 통신은 이 Message 형식을 따릅니다.
 * 제네릭 타입 T를 통해 payload의 타입을 지정할 수 있습니다.
 *
 * @typeParam T - payload의 타입 (기본값: unknown)
 *
 * @property type - 메시지 유형을 나타내는 문자열 (예: 'prompt', 'response', 'error')
 * @property payload - 메시지의 실제 데이터
 * @property timestamp - 메시지 생성 시각 (Unix timestamp, 밀리초)
 * @property from - 메시지 발신자의 DeviceId (선택적)
 * @property to - 메시지 수신자의 DeviceId (선택적)
 * @property requestId - 요청-응답 매칭을 위한 고유 ID (선택적)
 *
 * @example
 * ```typescript
 * // 기본 메시지
 * const pingMessage: Message = {
 *   type: 'ping',
 *   payload: null,
 *   timestamp: Date.now()
 * };
 *
 * // 타입이 지정된 메시지
 * interface PromptPayload {
 *   content: string;
 *   sessionId: string;
 * }
 *
 * const promptMessage: Message<PromptPayload> = {
 *   type: 'prompt',
 *   payload: {
 *     content: 'Hello, Claude!',
 *     sessionId: 'session-001'
 *   },
 *   timestamp: Date.now(),
 *   from: { pcId: 'mobile-001', deviceType: 'mobile' },
 *   to: { pcId: 'pylon-001', deviceType: 'pylon' },
 *   requestId: 'req-abc-123'
 * };
 * ```
 */
export interface Message<T = unknown> {
  /**
   * 메시지 유형을 나타내는 문자열
   * @example 'prompt', 'response', 'error', 'ping', 'pong'
   */
  type: string;

  /**
   * 메시지의 실제 데이터
   * 제네릭 타입 T에 의해 타입이 결정됨
   */
  payload: T;

  /**
   * 메시지 생성 시각 (Unix timestamp, 밀리초)
   * @example Date.now() // 1704067200000
   */
  timestamp: number;

  /**
   * 메시지 발신자의 DeviceId (Relay가 인증 시 설정)
   * Relay 내부에서 pylonId (number)로 관리됨
   */
  from?: DeviceId | null;

  /**
   * 메시지 수신자의 pylonId 배열
   * Relay가 라우팅 시 사용 (number[])
   * undefined/null인 경우 브로드캐스트
   */
  to?: number[] | null;

  /**
   * 요청-응답 매칭을 위한 고유 ID
   * 비동기 요청에 대한 응답을 추적할 때 사용
   * null인 경우 응답이 필요 없는 단방향 메시지
   */
  requestId?: string | null;
}
