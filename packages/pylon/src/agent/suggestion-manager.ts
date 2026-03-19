/**
 * @file suggestion-manager.ts
 * @description SuggestionManager - 대화 맥락 기반 자동 제안 생성 모듈
 *
 * 현재 대화 세션을 fork하여 사용자가 다음에 입력할 수 있는
 * 메시지 3개를 자동으로 생성합니다.
 *
 * 주요 기능:
 * - 대화 맥락을 기반으로 3개의 제안 메시지 생성
 * - 기존 세션을 fork하여 대화 흐름 유지
 * - AbortController를 통한 취소 지원
 * - 10초 타임아웃
 *
 * @example
 * ```typescript
 * const manager = new SuggestionManager(adapter, onEvent);
 * await manager.generate(sessionId, agentSessionId, workingDir);
 * manager.cancel(sessionId); // 취소
 * ```
 */

import type {
  AgentAdapter,
  AgentQueryOptions,
  AgentEventHandler,
} from './agent-manager.js';

// ============================================================================
// 상수
// ============================================================================

/** 제안 생성 타임아웃 (ms) */
const SUGGESTION_TIMEOUT_MS = 10_000;

/** 제안 생성 프롬프트 */
const SUGGESTION_PROMPT = `You are generating suggested user inputs for a conversation.
Based on the conversation so far, suggest exactly 3 short messages that the user would most likely want to say next.

Rules:
- Each suggestion must be concise (under 80 characters)
- Suggestions should cover different possible directions
- Write in the same language the user has been using
- Do not explain or add commentary
- Output ONLY a JSON array of 3 strings

Example output:
["첫 번째 제안", "두 번째 제안", "세 번째 제안"]`;

// ============================================================================
// SuggestionManager 클래스
// ============================================================================

/**
 * SuggestionManager - 대화 맥락 기반 자동 제안 생성
 *
 * @description
 * AgentAdapter를 사용하여 현재 대화 세션을 fork하고,
 * 사용자가 다음에 입력할 수 있는 메시지 3개를 생성합니다.
 */
export class SuggestionManager {
  /** Agent 어댑터 */
  private readonly adapter: AgentAdapter;

  /** 이벤트 핸들러 */
  private readonly onEvent: AgentEventHandler;

  /** 진행 중인 생성 작업의 AbortController (sessionId -> AbortController) */
  private readonly controllers: Map<number, AbortController> = new Map();

  /** 생성된 제안 캐시 (sessionId -> suggestions) */
  private readonly cache: Map<number, string[]> = new Map();

  /**
   * SuggestionManager 생성자
   *
   * @param adapter - Agent 어댑터 (쿼리 실행용)
   * @param onEvent - 이벤트 핸들러 (상태 전달용)
   */
  constructor(adapter: AgentAdapter, onEvent: AgentEventHandler) {
    this.adapter = adapter;
    this.onEvent = onEvent;
  }

  /**
   * 제안 생성
   *
   * @description
   * 기존 대화 세션을 fork하여 3개의 제안 메시지를 생성합니다.
   * 같은 sessionId로 이미 진행 중인 생성이 있으면 먼저 취소합니다.
   *
   * @param sessionId - 세션 ID
   * @param agentSessionId - Agent 세션 ID (fork 원본)
   * @param workingDir - 작업 디렉토리
   */
  async generate(
    sessionId: number,
    agentSessionId: string,
    workingDir: string
  ): Promise<void> {
    // 캐시에 있으면 즉시 반환
    const cached = this.cache.get(sessionId);
    if (cached) {
      console.log(`[Suggestion] Cache hit for session=${sessionId}`);
      this.onEvent(sessionId, { type: 'suggestion', status: 'ready', items: cached });
      return;
    }

    console.log(`[Suggestion] Generate for session=${sessionId}, agentSession=${agentSessionId}, cwd=${workingDir}`);

    // 기존 생성 취소
    this.cancel(sessionId);

    // 새 AbortController 생성
    const abortController = new AbortController();
    this.controllers.set(sessionId, abortController);

    // loading 상태 전달
    this.onEvent(sessionId, { type: 'suggestion', status: 'loading' });

    // 타임아웃 설정
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, SUGGESTION_TIMEOUT_MS);

    try {
      // 쿼리 옵션 구성
      const queryOptions: AgentQueryOptions = {
        prompt: SUGGESTION_PROMPT,
        cwd: workingDir,
        abortController,
        resume: agentSessionId,
        forkSession: true,
      };

      // 쿼리 실행 및 텍스트 수집
      console.log(`[Suggestion] Starting fork query for session=${sessionId}`);
      let responseText = '';
      const query = this.adapter.query(queryOptions);

      for await (const msg of query) {
        // abort 확인
        if (abortController.signal.aborted) {
          return;
        }

        // assistant 메시지에서 텍스트 추출
        if (msg.type === 'assistant' && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === 'text' && block.text) {
              responseText += block.text;
            }
          }
        }
      }

      // abort 후 도착한 경우
      if (abortController.signal.aborted) {
        return;
      }

      // JSON 파싱
      console.log(`[Suggestion] Response received for session=${sessionId}: ${responseText.substring(0, 200)}`);
      const parsed = this.parseResponse(responseText);

      // ready 이벤트 전달
      console.log(`[Suggestion] Ready for session=${sessionId}: ${JSON.stringify(parsed)}`);
      this.cache.set(sessionId, parsed);
      this.onEvent(sessionId, {
        type: 'suggestion',
        status: 'ready',
        items: parsed,
      });
    } catch (err) {
      // abort에 의한 에러는 무시 (이벤트 전달 안 함)
      if (abortController.signal.aborted) {
        console.log(`[Suggestion] Aborted for session=${sessionId}`);
        return;
      }

      // 기타 에러
      console.error(`[Suggestion] Error for session=${sessionId}:`, err);
      this.onEvent(sessionId, { type: 'suggestion', status: 'error' });
    } finally {
      clearTimeout(timeoutId);
      this.controllers.delete(sessionId);
    }
  }

  /**
   * 진행 중인 생성 취소
   *
   * @param sessionId - 취소할 세션 ID
   */
  cancel(sessionId: number): void {
    const controller = this.controllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.controllers.delete(sessionId);
    }
    this.cache.delete(sessionId);
  }

  /**
   * 캐시 삭제 (새 메시지 전송 시 기존 제안 무효화)
   *
   * @param sessionId - 캐시를 삭제할 세션 ID
   */
  clearCache(sessionId: number): void {
    this.cache.delete(sessionId);
  }

  /**
   * 응답 텍스트를 파싱하여 3개 문자열 배열로 변환
   *
   * @param text - 응답 텍스트 (JSON 배열 형식이어야 함)
   * @returns 3개 문자열 배열
   * @throws JSON 파싱 실패, 배열이 아닌 경우, 길이가 3이 아닌 경우
   */
  private parseResponse(text: string): [string, string, string] {
    const trimmed = text.trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error(`Invalid JSON response: ${trimmed.substring(0, 100)}`);
    }

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    if (parsed.length !== 3) {
      throw new Error(`Expected 3 items, got ${parsed.length}`);
    }

    if (!parsed.every((item) => typeof item === 'string')) {
      throw new Error('All items must be strings');
    }

    return parsed as [string, string, string];
  }
}
