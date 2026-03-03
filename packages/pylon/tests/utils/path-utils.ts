/**
 * @file path-utils.ts
 * @description 테스트용 경로 유틸리티
 *
 * 플랫폼 독립적인 테스트를 위한 경로 변환 유틸리티입니다.
 */

import os from 'os';

/** Windows 플랫폼 여부 */
export const IS_WINDOWS = os.platform() === 'win32';

/**
 * 경로를 현재 플랫폼에 맞게 변환
 *
 * @description
 * 테스트에서 경로 기대값을 검증할 때 사용합니다.
 * Windows에서는 백슬래시, Unix에서는 슬래시로 변환합니다.
 *
 * @example
 * ```typescript
 * // Windows: 'C:\\test'
 * // Linux: 'C:/test'
 * expect(workspace.workingDir).toBe(toNativePath('C:\\test'));
 * ```
 */
export function toNativePath(path: string): string {
  return IS_WINDOWS ? path.replace(/\//g, '\\') : path.replace(/\\/g, '/');
}
