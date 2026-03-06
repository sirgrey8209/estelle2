/**
 * @file agent.ts
 * @description 에이전트 타입 정의
 *
 * Estelle이 지원하는 AI 에이전트 타입을 정의합니다.
 */

/**
 * 에이전트 타입
 *
 * @description
 * - `claude`: Claude Code (Anthropic)
 * - `codex`: Codex CLI (OpenAI)
 */
export type AgentType = 'claude' | 'codex';

/**
 * 기본 에이전트 타입
 */
export const DEFAULT_AGENT_TYPE: AgentType = 'claude';

/**
 * AgentType 타입 가드
 */
export function isAgentType(value: unknown): value is AgentType {
  return value === 'claude' || value === 'codex';
}
