/**
 * @file entity-id.ts
 * @description EntityId 인코딩/디코딩 유틸리티
 *
 * 통합 ID 체계:
 * - 1:0:0   → Pylon 레벨 (pylonId만)
 * - 1:2:0   → Workspace 레벨 (pylonId + workspaceId)
 * - 1:2:3   → Conversation 레벨 (전체)
 *
 * 비트 레이아웃 (21비트):
 * [pylonId: 4비트][workspaceId: 7비트][conversationId: 10비트]
 *      1~10            1~127              1~1023
 */

// ============================================================================
// 상수 정의
// ============================================================================

/** pylonId 비트 수 (4비트, 최대값 15이지만 실제 범위는 1~10) */
export const PYLON_ID_BITS = 4;

/** workspaceId 비트 수 (7비트, 최대값 127이지만 실제 범위는 0~100) */
export const WORKSPACE_ID_BITS = 7;

/** conversationId 비트 수 (10비트, 최대값 1023이지만 실제 범위는 0~1000) */
export const CONVERSATION_ID_BITS = 10;

/** pylonId 최대값 (4비트: 1~15, 실사용 1~10) */
export const MAX_PYLON_ID = 10;

/** workspaceId 최대값 (7비트: 1~127) */
export const MAX_WORKSPACE_ID = 127;

/** conversationId 최대값 (10비트: 1~1023) */
export const MAX_CONVERSATION_ID = 1023;

// ============================================================================
// 타입 정의
// ============================================================================

/** 브랜드 타입으로 EntityId를 일반 number와 구분 */
export type EntityId = number & { readonly __brand: 'EntityId' };

/** 디코딩된 EntityId 객체 */
export interface DecodedEntityId {
  pylonId: number;
  workspaceId: number;
  conversationId: number;
}

/** Entity 레벨 타입 */
export type EntityLevel = 'pylon' | 'workspace' | 'conversation';

// ============================================================================
// 레거시 호환 (deprecated)
// ============================================================================

/** @deprecated EntityId를 사용하세요 */
export type ConversationPath = EntityId;

/** @deprecated DecodedEntityId를 사용하세요 */
export type DecodedConversationPath = DecodedEntityId;

/** @deprecated EntityLevel을 사용하세요 */
export type PathLevel = EntityLevel;

// ============================================================================
// 유효성 검증
// ============================================================================

/**
 * pylonId 범위 검증 (1 ~ MAX_PYLON_ID)
 */
function validatePylonId(pylonId: number): void {
  if (pylonId < 1 || pylonId > MAX_PYLON_ID) {
    throw new RangeError(
      `pylonId must be between 1 and ${MAX_PYLON_ID}, got ${pylonId}`
    );
  }
}

/**
 * workspaceId 범위 검증 (1 ~ MAX_WORKSPACE_ID, 0은 Pylon 레벨에서만 허용)
 */
function validateWorkspaceId(workspaceId: number): void {
  if (workspaceId < 1 || workspaceId > MAX_WORKSPACE_ID) {
    throw new RangeError(
      `workspaceId must be between 1 and ${MAX_WORKSPACE_ID}, got ${workspaceId}`
    );
  }
}

/**
 * conversationId 범위 검증 (1 ~ MAX_CONVERSATION_ID, 0은 상위 레벨에서만 허용)
 */
function validateConversationId(conversationId: number): void {
  if (conversationId < 1 || conversationId > MAX_CONVERSATION_ID) {
    throw new RangeError(
      `conversationId must be between 1 and ${MAX_CONVERSATION_ID}, got ${conversationId}`
    );
  }
}

// ============================================================================
// 인코딩 함수
// ============================================================================

/**
 * pylonId, workspaceId, conversationId를 단일 숫자로 인코딩
 *
 * 비트 레이아웃:
 * [pylonId: 4비트][workspaceId: 7비트][conversationId: 10비트]
 *
 * @param pylonId - Pylon ID (1~10)
 * @param workspaceId - Workspace ID (1~100)
 * @param conversationId - Conversation ID (1~1000)
 * @returns 인코딩된 EntityId
 * @throws RangeError 범위를 벗어난 값이 입력된 경우
 */
export function encodeEntityId(
  pylonId: number,
  workspaceId: number,
  conversationId: number
): EntityId {
  validatePylonId(pylonId);
  validateWorkspaceId(workspaceId);
  validateConversationId(conversationId);

  const encoded =
    (pylonId << (WORKSPACE_ID_BITS + CONVERSATION_ID_BITS)) |
    (workspaceId << CONVERSATION_ID_BITS) |
    conversationId;

  return encoded as EntityId;
}

/**
 * Pylon 레벨 EntityId 생성 (x:0:0 형식)
 *
 * @param pylonId - Pylon ID (1~10)
 * @returns 인코딩된 EntityId (workspaceId=0, conversationId=0)
 * @throws RangeError pylonId가 범위를 벗어난 경우
 */
export function encodePylonId(pylonId: number): EntityId {
  validatePylonId(pylonId);

  const encoded =
    (pylonId << (WORKSPACE_ID_BITS + CONVERSATION_ID_BITS)) | 0 | 0;

  return encoded as EntityId;
}

/**
 * Workspace 레벨 EntityId 생성 (x:y:0 형식)
 *
 * @param pylonId - Pylon ID (1~10)
 * @param workspaceId - Workspace ID (1~100)
 * @returns 인코딩된 EntityId (conversationId=0)
 * @throws RangeError pylonId 또는 workspaceId가 범위를 벗어난 경우
 */
export function encodeWorkspaceId(
  pylonId: number,
  workspaceId: number
): EntityId {
  validatePylonId(pylonId);
  validateWorkspaceId(workspaceId);

  const encoded =
    (pylonId << (WORKSPACE_ID_BITS + CONVERSATION_ID_BITS)) |
    (workspaceId << CONVERSATION_ID_BITS) |
    0;

  return encoded as EntityId;
}

// ============================================================================
// 디코딩 함수
// ============================================================================

/**
 * 인코딩된 EntityId를 원래 값들로 디코딩
 *
 * @param id - 인코딩된 EntityId
 * @returns 디코딩된 pylonId, workspaceId, conversationId 객체
 */
export function decodeEntityId(id: EntityId): DecodedEntityId {
  const conversationIdMask = (1 << CONVERSATION_ID_BITS) - 1; // 0x3FF (10비트)
  const workspaceIdMask = (1 << WORKSPACE_ID_BITS) - 1; // 0x7F (7비트)

  const conversationId = id & conversationIdMask;
  const workspaceId = (id >> CONVERSATION_ID_BITS) & workspaceIdMask;
  const pylonId = id >> (WORKSPACE_ID_BITS + CONVERSATION_ID_BITS);

  return {
    pylonId,
    workspaceId,
    conversationId,
  };
}

/**
 * EntityId를 문자열로 변환 (pylonId:workspaceId:conversationId 형식)
 *
 * @param id - 인코딩된 EntityId
 * @returns "pylonId:workspaceId:conversationId" 형식의 문자열
 */
export function entityIdToString(id: EntityId): string {
  const { pylonId, workspaceId, conversationId } = decodeEntityId(id);
  return `${pylonId}:${workspaceId}:${conversationId}`;
}

// ============================================================================
// 레벨 판별 함수
// ============================================================================

/**
 * Pylon 레벨인지 확인 (x:0:0 형식)
 *
 * @param id - 확인할 EntityId
 * @returns workspaceId와 conversationId가 모두 0이면 true
 */
export function isPylonEntity(id: EntityId): boolean {
  const { workspaceId, conversationId } = decodeEntityId(id);
  return workspaceId === 0 && conversationId === 0;
}

/**
 * Workspace 레벨인지 확인 (x:y:0 형식, y > 0)
 *
 * @param id - 확인할 EntityId
 * @returns workspaceId > 0이고 conversationId === 0이면 true
 */
export function isWorkspaceEntity(id: EntityId): boolean {
  const { workspaceId, conversationId } = decodeEntityId(id);
  return workspaceId > 0 && conversationId === 0;
}

/**
 * Conversation 레벨인지 확인 (x:y:z 형식, z > 0)
 *
 * @param id - 확인할 EntityId
 * @returns conversationId > 0이면 true
 */
export function isConversationEntity(id: EntityId): boolean {
  const { conversationId } = decodeEntityId(id);
  return conversationId > 0;
}

/**
 * EntityId의 레벨을 반환
 *
 * @param id - 확인할 EntityId
 * @returns 'pylon' | 'workspace' | 'conversation'
 */
export function getEntityLevel(id: EntityId): EntityLevel {
  const { workspaceId, conversationId } = decodeEntityId(id);

  if (conversationId > 0) {
    return 'conversation';
  }
  if (workspaceId > 0) {
    return 'workspace';
  }
  return 'pylon';
}

// ============================================================================
// 레거시 호환 함수 (deprecated)
// ============================================================================

/** @deprecated encodeEntityId를 사용하세요 */
export const encodeConversationPath = encodeEntityId;

/** @deprecated encodePylonId를 사용하세요 */
export const encodePylonPath = encodePylonId;

/** @deprecated encodeWorkspaceId를 사용하세요 */
export const encodeWorkspacePath = encodeWorkspaceId;

/** @deprecated decodeEntityId를 사용하세요 */
export const decodeConversationPath = decodeEntityId;

/** @deprecated entityIdToString을 사용하세요 */
export const conversationPathToString = entityIdToString;

/** @deprecated isPylonEntity를 사용하세요 */
export const isPylonPath = isPylonEntity;

/** @deprecated isWorkspaceEntity를 사용하세요 */
export const isWorkspacePath = isWorkspaceEntity;

/** @deprecated isConversationEntity를 사용하세요 */
export const isConversationPathFull = isConversationEntity;

/** @deprecated getEntityLevel을 사용하세요 */
export const getPathLevel = getEntityLevel;
