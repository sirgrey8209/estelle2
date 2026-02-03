/**
 * @file create-message.ts
 * @description 메시지 생성 헬퍼 함수
 *
 * Estelle 시스템에서 사용하는 표준 메시지 객체를 생성하는 유틸리티 함수입니다.
 * 메시지에는 type, payload, timestamp가 필수이며,
 * 선택적으로 from, to, requestId를 지정할 수 있습니다.
 */

import type { Message, DeviceId } from '../types/index.js';

/**
 * createMessage 함수의 옵션 인터페이스
 *
 * @description
 * 메시지 생성 시 라우팅 및 추적 정보를 설정하는 옵션입니다.
 *
 * @property from - 메시지 발신자의 DeviceId (선택적)
 * @property to - 메시지 수신자의 DeviceId (선택적)
 * @property requestId - 요청-응답 매칭을 위한 고유 ID (선택적)
 *
 * @example
 * ```typescript
 * const options: CreateMessageOptions = {
 *   from: { pcId: 'sender-pc', deviceType: 'pylon' },
 *   to: { pcId: 'receiver-pc', deviceType: 'mobile' },
 *   requestId: 'req-123'
 * };
 * ```
 */
export interface CreateMessageOptions {
  /** 메시지 발신자의 DeviceId */
  from?: DeviceId | null;

  /** 메시지 수신자의 DeviceId */
  to?: DeviceId | null;

  /** 요청-응답 매칭을 위한 고유 ID */
  requestId?: string | null;
}

/**
 * 표준 메시지 객체를 생성합니다
 *
 * @description
 * Estelle 시스템에서 사용하는 표준 Message 객체를 생성합니다.
 * timestamp는 자동으로 현재 시간(Date.now())으로 설정됩니다.
 * options가 제공되지 않은 필드는 null로 설정됩니다.
 *
 * @typeParam T - payload의 타입
 *
 * @param type - 메시지 타입 (예: 'auth', 'ping', 'claude_send' 등)
 * @param payload - 메시지에 담을 실제 데이터
 * @param options - 선택적 라우팅/추적 정보
 *
 * @returns 생성된 Message 객체
 *
 * @example
 * ```typescript
 * // 기본 메시지 생성
 * const pingMsg = createMessage('ping', null);
 *
 * // 페이로드와 함께 생성
 * const authMsg = createMessage('auth', {
 *   pcId: 'my-pc',
 *   deviceType: 'pylon'
 * });
 *
 * // 라우팅 정보와 함께 생성
 * const routedMsg = createMessage(
 *   'claude_send',
 *   { conversationId: 'conv-001', message: 'Hello' },
 *   {
 *     from: { pcId: 'mobile1', deviceType: 'mobile' },
 *     to: { pcId: 'pc1', deviceType: 'pylon' },
 *     requestId: 'req-abc123'
 *   }
 * );
 * ```
 */
export function createMessage<T>(
  type: string,
  payload: T,
  options?: CreateMessageOptions
): Message<T> {
  return {
    type,
    payload,
    timestamp: Date.now(),
    from: options?.from ?? null,
    to: options?.to ?? null,
    requestId: options?.requestId ?? null,
  };
}
