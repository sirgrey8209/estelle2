/**
 * @file character.ts
 * @description 캐릭터(디바이스) 정보 조회 헬퍼 함수
 *
 * PC ID를 기반으로 캐릭터 정보를 조회하거나,
 * 데스크의 전체 이름을 생성하는 유틸리티 함수를 제공합니다.
 */

import type { Character } from '../types/index.js';
import { Characters, type CharacterId } from '../constants/index.js';

/**
 * 알려지지 않은 PC에 대한 기본 캐릭터 정보
 *
 * @description
 * Characters에 등록되지 않은 PC ID에 대해 반환되는 기본 캐릭터입니다.
 * name은 입력된 pcId로 동적으로 설정되므로, 이 상수는 icon과 description만 제공합니다.
 *
 * @example
 * ```typescript
 * const unknown = getCharacter('unknown-pc');
 * // {
 * //   name: 'unknown-pc',
 * //   icon: '💻',
 * //   description: 'Unknown PC'
 * // }
 * ```
 */
export const DEFAULT_CHARACTER: Character = {
  name: '', // 실제 사용 시 pcId로 대체됨
  icon: '\uD83D\uDCBB', // 💻
  description: 'Unknown PC',
};

/**
 * 주어진 키가 Characters 상수에 존재하는지 확인합니다
 *
 * @param key - 확인할 키
 * @returns Characters에 존재하면 true
 */
function isKnownCharacterId(key: string): key is CharacterId {
  return key in Characters;
}

/**
 * PC ID로 캐릭터 정보를 조회합니다
 *
 * @description
 * 주어진 pcId에 해당하는 캐릭터 정보를 반환합니다.
 * pcId가 Characters 상수에 등록되어 있으면 해당 정보를,
 * 그렇지 않으면 기본 캐릭터(name: pcId, icon: 💻, description: 'Unknown PC')를 반환합니다.
 *
 * pcId는 문자열 또는 숫자로 제공할 수 있습니다.
 * 숫자는 내부적으로 문자열로 변환되어 처리됩니다.
 *
 * @param pcId - PC 또는 디바이스의 고유 식별자 (문자열 또는 숫자)
 *
 * @returns 캐릭터 정보 (name, icon, description)
 *
 * @example
 * ```typescript
 * // 알려진 PC ID
 * const device1 = getCharacter('1');
 * // { name: 'Device 1', icon: '🏢', description: '회사' }
 *
 * const device1Num = getCharacter(1);
 * // { name: 'Device 1', icon: '🏢', description: '회사' }
 *
 * // 알려지지 않은 PC ID
 * const unknown = getCharacter('my-custom-pc');
 * // { name: 'my-custom-pc', icon: '💻', description: 'Unknown PC' }
 * ```
 */
export function getCharacter(pcId: string | number): Character {
  const key = String(pcId);

  if (isKnownCharacterId(key)) {
    return Characters[key];
  }

  // 알려지지 않은 pcId에 대해서는 기본 캐릭터 반환
  // name만 pcId로 설정
  return {
    ...DEFAULT_CHARACTER,
    name: key,
  };
}

/**
 * 대화의 전체 이름을 생성합니다
 *
 * @description
 * PC의 캐릭터 이름과 대화 이름을 조합하여
 * "캐릭터이름/대화이름" 형식의 전체 이름을 생성합니다.
 *
 * 이 형식은 여러 PC의 여러 대화를 구분하기 위해 사용됩니다.
 *
 * @param pcId - PC 또는 디바이스의 고유 식별자 (문자열 또는 숫자)
 * @param conversationName - 대화의 이름
 *
 * @returns "캐릭터이름/대화이름" 형식의 문자열
 *
 * @example
 * ```typescript
 * // 알려진 PC의 대화
 * getConversationFullName('1', 'workspace');
 * // 'Device 1/workspace'
 *
 * getConversationFullName(2, 'project-a');
 * // 'Device 2/project-a'
 *
 * // 알려지지 않은 PC의 대화
 * getConversationFullName('my-pc', 'main');
 * // 'my-pc/main'
 * ```
 */
export function getConversationFullName(pcId: string | number, conversationName: string): string {
  const character = getCharacter(pcId);
  return `${character.name}/${conversationName}`;
}

/**
 * @deprecated getDeskFullName은 getConversationFullName으로 대체되었습니다
 */
export const getDeskFullName = getConversationFullName;
