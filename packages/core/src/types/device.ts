/**
 * @file device.ts
 * @description 디바이스 관련 타입 정의
 *
 * Estelle 시스템에서 사용되는 디바이스 식별 및 캐릭터 정보를 위한 타입들입니다.
 */

/**
 * 디바이스 유형을 나타내는 타입
 *
 * @description
 * Estelle 시스템에 연결할 수 있는 디바이스의 종류를 정의합니다.
 *
 * - `pylon`: Claude SDK와 연동되는 메인 서비스 (PC에서 실행)
 * - `desktop`: 데스크톱 클라이언트 앱
 *
 * @example
 * ```typescript
 * const deviceType: DeviceType = 'pylon';
 *
 * // 타입 가드로 활용
 * function isValidDeviceType(value: string): value is DeviceType {
 *   return value === 'pylon' || value === 'desktop';
 * }
 * ```
 */
export type DeviceType = 'pylon' | 'desktop';

/**
 * 디바이스를 고유하게 식별하기 위한 인터페이스
 *
 * @description
 * 각 디바이스는 PC ID와 디바이스 유형의 조합으로 식별됩니다.
 * 같은 PC에서 여러 유형의 디바이스가 실행될 수 있으므로,
 * 두 속성의 조합이 고유 식별자 역할을 합니다.
 *
 * @property pcId - PC 또는 디바이스를 식별하는 고유 문자열
 * @property deviceType - 디바이스의 유형
 *
 * @example
 * ```typescript
 * const pylonDevice: DeviceId = {
 *   pcId: 'my-workstation-001',
 *   deviceType: 'pylon'
 * };
 *
 * const desktopDevice: DeviceId = {
 *   pcId: 'my-desktop-001',
 *   deviceType: 'desktop'
 * };
 * ```
 */
export interface DeviceId {
  /** PC 또는 디바이스를 식별하는 고유 문자열 */
  pcId: string;

  /** 디바이스의 유형 (pylon, desktop) */
  deviceType: DeviceType;
}

/**
 * 캐릭터 정보를 나타내는 인터페이스
 *
 * @description
 * UI에서 표시되는 캐릭터(봇, 사용자 등)의 정보를 정의합니다.
 * 채팅 인터페이스에서 메시지 발신자를 표시하거나,
 * 프로필 정보를 보여줄 때 사용됩니다.
 *
 * @property name - 캐릭터의 이름 (표시용)
 * @property icon - 캐릭터 아이콘의 URL 또는 경로
 * @property description - 캐릭터에 대한 설명
 *
 * @example
 * ```typescript
 * const claude: Character = {
 *   name: 'Claude',
 *   icon: 'assets/icons/claude.png',
 *   description: 'AI Assistant powered by Anthropic'
 * };
 *
 * const user: Character = {
 *   name: '사용자',
 *   icon: 'assets/icons/user.png',
 *   description: '현재 로그인한 사용자'
 * };
 * ```
 */
export interface Character {
  /** 캐릭터의 이름 (표시용) */
  name: string;

  /** 캐릭터 아이콘의 URL 또는 경로 */
  icon: string;

  /** 캐릭터에 대한 설명 */
  description: string;
}
