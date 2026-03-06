/**
 * @file index.ts
 * @description Agent 모듈 진입점
 *
 * Agent SDK 연동 관련 기능을 제공합니다.
 *
 * 주요 구성요소:
 * - AgentManager: Agent SDK 연동 핵심 클래스
 * - permission-rules: 도구 실행 권한 결정 순수 함수
 *
 * @example
 * ```typescript
 * import {
 *   AgentManager,
 *   checkPermission,
 *   isPermissionAllow,
 *   AUTO_ALLOW_TOOLS,
 * } from './agent/index.js';
 *
 * // AgentManager 사용
 * const manager = new AgentManager({
 *   onEvent: (sessionId, event) => console.log(event),
 *   getPermissionMode: (sessionId) => 'default',
 * });
 *
 * // 권한 규칙 사용
 * const result = checkPermission('Read', { file_path: '/test.txt' }, 'default');
 * if (isPermissionAllow(result)) {
 *   console.log('Auto-allowed');
 * }
 * ```
 */

// ============================================================================
// AgentManager
// ============================================================================

export {
  AgentManager,
  type AgentManagerOptions,
  type AgentManagerEvent,
  type AgentManagerEventType,
  type AgentState,
  type TokenUsage,
  type AgentSession,
  type PendingPermission,
  type PendingQuestion,
  type PendingEvent,
  type PermissionCallbackResult,
  type SendMessageOptions,
  type AgentEventHandler,
  type GetPermissionModeFn,
  type LoadMcpConfigFn,
  type AgentAdapter,
  type AgentQueryOptions,
  type AgentMessage,
} from './agent-manager.js';

// ============================================================================
// Permission Rules
// ============================================================================

// ============================================================================
// ClaudeSDKAdapter
// ============================================================================

export { ClaudeSDKAdapter } from './claude-sdk-adapter.js';

// ============================================================================
// CodexSDKAdapter
// ============================================================================

export { CodexSDKAdapter } from './codex-sdk-adapter.js';

// ============================================================================
// MockClaudeAdapter (테스트용)
// ============================================================================

export {
  MockClaudeAdapter,
  type MockScenario,
  type MockSimpleTextScenario,
  type MockToolUseScenario,
  type MockErrorScenario,
  type MockStreamingScenario,
  type MockCustomScenario,
} from './mock-claude-adapter.js';

// ============================================================================
// Permission Rules
// ============================================================================

export {
  // 순수 함수
  checkPermission,
  isAutoAllowTool,
  isEditTool,
  checkAutoDenyPattern,
  // 타입 가드
  isPermissionAllow,
  isPermissionDeny,
  isPermissionAsk,
  // 상수
  AUTO_ALLOW_TOOLS,
  EDIT_TOOLS,
  AUTO_DENY_PATTERNS,
  // 타입
  type PermissionResult,
  type PermissionAllowResult,
  type PermissionDenyResult,
  type PermissionAskResult,
  type AutoDenyPattern,
} from './permission-rules.js';
