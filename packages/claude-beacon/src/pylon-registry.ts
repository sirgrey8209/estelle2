/**
 * @file pylon-registry.ts
 * @description PylonRegistry - pylonId -> PylonConnection 매핑 관리
 *
 * Pylon 등록 시 pylonId, mcpHost, mcpPort를 저장하고,
 * MCP lookup 시 conversationId에서 pylonId를 추출하여 연결 정보를 조회한다.
 *
 * pylonId 체계 (id-system.md 참조):
 * - pylonId = (envId << 5) | (0 << 4) | deviceIndex
 * - release: envId=0, stage: envId=1, dev: envId=2
 * - 예: dev deviceIndex=1 → (2 << 5) | 0 | 1 = 65
 */

// ============================================================================
// 상수
// ============================================================================

/** 환경 이름 매핑 (envId -> 이름) */
const ENV_NAMES = ['release', 'stage', 'dev'] as const;

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * Pylon 연결 정보
 */
export interface PylonConnection {
  /** Pylon ID (envId << 5 | 0 << 4 | deviceIndex) */
  pylonId: number;

  /** MCP TCP 서버 호스트 */
  mcpHost: string;

  /** MCP TCP 서버 포트 */
  mcpPort: number;
}

/**
 * 환경 이름 타입
 */
export type EnvName = (typeof ENV_NAMES)[number];

// ============================================================================
// 유틸 함수
// ============================================================================

/**
 * pylonId에서 환경 이름 추출
 *
 * @param pylonId Pylon ID
 * @returns 환경 이름 (release, stage, dev)
 */
export function getEnvName(pylonId: number): EnvName {
  const envId = pylonId >> 5;
  return ENV_NAMES[envId] ?? 'release';
}

/**
 * conversationId에서 pylonId 추출
 *
 * conversationId = pylonId << 17 | seq
 *
 * @param conversationId 대화 ID
 * @returns Pylon ID
 */
export function extractPylonId(conversationId: number): number {
  return conversationId >> 17;
}

// ============================================================================
// PylonRegistry 클래스
// ============================================================================

/**
 * PylonRegistry - pylonId -> PylonConnection 매핑을 관리하는 클래스
 *
 * Beacon에서 여러 Pylon의 연결 정보를 추적하고,
 * MCP lookup 시 해당 Pylon의 MCP 호스트/포트를 조회할 수 있다.
 */
export class PylonRegistry {
  // ============================================================================
  // Private 필드
  // ============================================================================

  /** pylonId -> PylonConnection 매핑 */
  private readonly _map: Map<number, PylonConnection>;

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
   * Pylon 연결 정보 저장
   *
   * @param pylonId Pylon ID
   * @param connection 연결 정보
   */
  set(pylonId: number, connection: PylonConnection): void {
    this._map.set(pylonId, connection);
  }

  /**
   * Pylon 연결 정보 조회
   *
   * @param pylonId Pylon ID
   * @returns PylonConnection 또는 undefined
   */
  get(pylonId: number): PylonConnection | undefined {
    return this._map.get(pylonId);
  }

  /**
   * Pylon 연결 정보 삭제
   *
   * @param pylonId Pylon ID
   * @returns 삭제 성공 여부
   */
  delete(pylonId: number): boolean {
    return this._map.delete(pylonId);
  }

  /**
   * Pylon 등록 여부 확인
   *
   * @param pylonId Pylon ID
   * @returns 등록 여부
   */
  has(pylonId: number): boolean {
    return this._map.has(pylonId);
  }

  /**
   * 모든 Pylon 연결 정보 조회
   *
   * @returns PylonConnection 배열
   */
  getAll(): PylonConnection[] {
    return Array.from(this._map.values());
  }

  /**
   * 모든 항목 삭제
   */
  clear(): void {
    this._map.clear();
  }

  /**
   * 현재 저장된 항목 수
   */
  get size(): number {
    return this._map.size;
  }

  // ============================================================================
  // 편의 메서드
  // ============================================================================

  /**
   * conversationId로 Pylon 연결 정보 조회
   *
   * conversationId에서 pylonId를 추출하여 조회한다.
   *
   * @param conversationId 대화 ID
   * @returns PylonConnection 또는 undefined
   */
  getByConversationId(conversationId: number): PylonConnection | undefined {
    const pylonId = extractPylonId(conversationId);
    return this.get(pylonId);
  }
}
