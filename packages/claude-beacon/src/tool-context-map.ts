/**
 * @file tool-context-map.ts
 * @description ClaudeBeacon ToolContextMap - toolUseId -> PylonInfo 매핑 관리
 *
 * Pylon의 ToolContextMap과 달리, Beacon의 ToolContextMap은
 * toolUseId -> { pylonAddress, entityId, raw } 매핑을 관리한다.
 *
 * MCP에서 toolUseId로 조회하면 해당 도구 호출이 어느 Pylon의
 * 어느 대화에서 발생했는지 알 수 있다.
 */

// ============================================================================
// 상수
// ============================================================================

/** 기본 만료 시간 (30분) */
const DEFAULT_MAX_AGE = 30 * 60 * 1000;

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 도구 사용 원본 데이터
 */
export interface ToolUseRaw {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Pylon 정보
 */
export interface PylonInfo {
  pylonAddress: string;
  entityId: number;
  raw: ToolUseRaw;
}

/**
 * 내부 저장용 엔트리
 */
interface ContextEntry {
  info: PylonInfo;
  createdAt: number;
}

// ============================================================================
// ToolContextMap 클래스
// ============================================================================

/**
 * ToolContextMap - toolUseId -> PylonInfo 매핑을 관리하는 클래스
 *
 * Beacon에서 여러 Pylon의 도구 호출을 추적하고,
 * MCP에서 toolUseId로 해당 도구 호출의 출처를 조회할 수 있다.
 */
export class ToolContextMap {
  // ============================================================================
  // Private 필드
  // ============================================================================

  /** toolUseId -> ContextEntry 매핑 */
  private _map: Map<string, ContextEntry>;

  // ============================================================================
  // 생성자
  // ============================================================================

  constructor() {
    this._map = new Map();
  }

  // ============================================================================
  // 공개 메서드
  // ============================================================================

  /**
   * toolUseId -> PylonInfo 저장
   *
   * @param toolUseId Claude 도구 사용 ID
   * @param info Pylon 정보
   */
  set(toolUseId: string, info: PylonInfo): void {
    // 빈 문자열은 저장하지 않음
    if (toolUseId === '') {
      return;
    }

    this._map.set(toolUseId, {
      info,
      createdAt: Date.now(),
    });
  }

  /**
   * toolUseId로 PylonInfo 조회
   *
   * @param toolUseId Claude 도구 사용 ID
   * @returns PylonInfo 또는 undefined
   */
  get(toolUseId: string): PylonInfo | undefined {
    // 빈 문자열은 undefined 반환
    if (toolUseId === '') {
      return undefined;
    }

    const entry = this._map.get(toolUseId);
    return entry?.info;
  }

  /**
   * toolUseId 삭제
   *
   * @param toolUseId Claude 도구 사용 ID
   * @returns 삭제 성공 여부
   */
  delete(toolUseId: string): boolean {
    return this._map.delete(toolUseId);
  }

  /**
   * 오래된 항목 정리
   *
   * @param maxAge 최대 유지 시간 (밀리초), 기본값 30분
   * @returns 삭제된 항목 수
   */
  cleanup(maxAge: number = DEFAULT_MAX_AGE): number {
    const now = Date.now();
    const threshold = now - maxAge;
    let removed = 0;

    for (const [toolUseId, entry] of this._map.entries()) {
      if (entry.createdAt < threshold) {
        this._map.delete(toolUseId);
        removed++;
      }
    }

    return removed;
  }

  /**
   * 현재 저장된 항목 수
   */
  get size(): number {
    return this._map.size;
  }

  /**
   * 모든 항목 삭제
   */
  clear(): void {
    this._map.clear();
  }
}
