# Desk → Workspace/Conversation 정리

## 상태
✅ 완료

## 목표
v2의 `Desk` 기반 코드를 `Workspace/Conversation` 2단계 구조로 정리

---

## 디자인 결정 사항

### 개념 정의
- **Workspace** = 프로젝트 = Git 리포지터리
- **Conversation** = 작업 단위 (태스크에 가까움)
  - 향후: 문서 연결, 대화 분기 기능 추가 예정

### v1 대비 변경점
| 항목 | v1 | v2 새 방향 |
|------|-----|-----------|
| `skillType` | `general`, `planner`, `worker` | **제거** |
| `tasks` (Workspace) | 별도 배열 | **제거** |
| `workerStatus` | 워커 상태 | **제거** |
| `DeskStatus` | - | `ConversationStatus`로 리네이밍 |
| `permission` | - | `waiting`으로 변경 (v1 일치) |

---

## 완료된 작업

### Phase 1: Core 타입 정리 ✅
- [x] `constants/conversation-status.ts` 추가
  - `ConversationStatus`: `idle`, `working`, `waiting`, `error`
- [x] `types/workspace.ts` 추가
  - `Workspace`, `Conversation`, `WorkspaceWithActive` 타입
  - 관련 Payload 타입들
- [x] `DeskStatus`를 `ConversationStatus`의 alias로 유지 (하위 호환성)
- [x] 테스트 업데이트 및 통과

### Phase 2: Pylon 정합성 ✅
- [x] `workspace-store.ts`: `DeskStatus` → `ConversationStatus` 변경
- [x] `pylon.ts`: `DeskStatusValue` → `ConversationStatusValue` 변경
- [x] 테스트 업데이트 및 통과

### Phase 3: Client 전환 ✅
- [x] `workspaceStore.ts` 추가 (새 2단계 구조)
- [x] `stores/index.ts` export 업데이트
- [x] 기존 `deskStore.ts` 유지 (레거시 호환성)
- [x] 테스트 통과

---

## 생성/수정된 파일

### Core 패키지
| 파일 | 상태 | 설명 |
|------|------|------|
| `src/constants/conversation-status.ts` | 신규 | ConversationStatus 상수 |
| `src/types/workspace.ts` | 신규 | Workspace, Conversation 타입 |
| `src/constants/index.ts` | 수정 | ConversationStatus export 추가 |
| `src/types/index.ts` | 수정 | workspace.ts export 추가 |
| `tests/constants/constants.test.ts` | 수정 | ConversationStatus 테스트 추가 |
| `tests/integration.test.ts` | 수정 | ConversationStatus 테스트 추가 |

### Pylon 패키지
| 파일 | 상태 | 설명 |
|------|------|------|
| `src/stores/workspace-store.ts` | 수정 | ConversationStatus 사용 |
| `src/pylon.ts` | 수정 | ConversationStatusValue 사용 |
| `tests/stores/workspace-store.test.ts` | 수정 | ConversationStatus 사용 |

### Client 패키지
| 파일 | 상태 | 설명 |
|------|------|------|
| `src/stores/workspaceStore.ts` | 신규 | 새 Workspace/Conversation 스토어 |
| `src/stores/index.ts` | 수정 | workspaceStore export 추가 |

---

## 레거시 호환성

다음 항목들은 하위 호환성을 위해 유지됨:

- `DeskStatus` → `ConversationStatus`의 alias
- `DeskStatusValue` → `ConversationStatusValue`의 alias
- `useDeskStore` → Client에서 계속 사용 가능 (deprecated)
- `desk.ts` 타입들 → 계속 export됨

---

## 향후 작업 (선택)

- [ ] Client 컴포넌트 리네이밍 (DeskItem → ConversationItem 등)
- [ ] 레거시 타입/상수 제거 (안정화 후)
- [ ] 문서 연결 기능 추가 (linkedDocument)
- [ ] 대화 분기 기능 추가 (parentConversationId)

---

## 로그
- [250202 17:30] 스텁 문서 생성
- [250202 19:xx] 사용처 조사 완료, v1 비교 분석 완료
- [250202 19:xx] 디자인 논의 완료
- [250202 22:30] Phase 1 완료 (Core 타입 정리)
- [250202 22:35] Phase 2 완료 (Pylon 정합성)
- [250202 22:42] Phase 3 완료 (Client 전환)
- [250202 22:42] 전체 테스트 통과, 작업 완료
