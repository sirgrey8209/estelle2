/**
 * @file index.ts
 * @description ClaudeBeacon 패키지 진입점
 */

export { ClaudeBeacon, type ClaudeBeaconOptions } from './beacon.js';
export { ClaudeBeaconAdapter, type BeaconQueryOptions } from './beacon-adapter.js';
export {
  ToolContextMap,
  type ToolContext,
  type PylonInfo, // deprecated: ToolContext 사용 권장
  type ToolUseRaw,
} from './tool-context-map.js';
export {
  PylonRegistry,
  type PylonConnection,
  type EnvName,
  getEnvName,
  extractPylonId,
} from './pylon-registry.js';
export { MockSDK } from './mock-sdk.js';
