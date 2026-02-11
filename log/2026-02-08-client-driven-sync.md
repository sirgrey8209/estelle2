# Client-Driven Sync 구현 완료

## 개요

Client가 동기화 상태를 주도적으로 관리하는 pull-based 초기 동기화 아키텍처를 구현했다.
기존의 분산된 동기화 플래그(`isSynced`, `desksLoaded`, `isFirstSync`)를 `syncStore` + `syncOrchestrator`로 통합했다.

## 배경 (문제)

- `requestWorkspaceList()` 전송 실패 시 재시도 없음
- Pylon broadcast가 client 인증 전에 발생하면 유실
- 재연결 시 stale 데이터로 `isFirstSync` 판정이 어긋남
- 동기화 플래그가 여러 store에 분산 (relayStore, workspaceStore, useMessageRouter 로컬 변수)

## 구현 내용

### Cycle 1: syncStore 신설
- `packages/client/src/stores/syncStore.ts` 신규 생성
- `SyncPhase` 타입: `'idle' | 'requesting' | 'synced' | 'failed'`
- 워크스페이스 동기화 상태 + 대화별 동기화 상태 + 재시도 카운터
- 16개 테스트

### Cycle 2: syncOrchestrator 신설
- `packages/client/src/services/syncOrchestrator.ts` 신규 생성
- `startInitialSync()`: 인증 후 workspace 목록 요청 + 5초 타임아웃 + 3회 재시도
- `onWorkspaceListReceived()`: requesting일 때만 동작 (push 방어), 대화 선택 전송
- `onHistoryReceived()`: conversation sync 정보 업데이트
- `cleanup()`: 타이머 정리 + syncStore 리셋
- 9개 테스트

### Cycle 2.5: HISTORY_RESULT dual-write
- `useMessageRouter.ts`에서 HISTORY_RESULT 수신 시 syncStore에도 동기화 정보 기록
- 초기 로드: syncedCount + phase='synced'
- 페이징: syncedCount 누적 (phase 변경 없음)
- 2개 테스트

### Cycle 3: 실제 연결 + 레거시 제거

#### Part A: syncOrchestrator 싱글턴 export
- `syncOrchestrator.ts` 하단에 `requestWorkspaceList`/`selectConversation` 주입한 싱글턴 인스턴스 export

#### Part B: App.tsx 연결
- `requestWorkspaceList()` 직접 호출 → `syncOrchestrator.startInitialSync()` 전환
- `ws.onclose`에 `syncOrchestrator.cleanup()` 추가

#### Part C: useMessageRouter 변경
- `isFirstSync` 로직 제거 (직접 `selectConversation` 호출 제거)
- `setDesksLoaded(true)` 제거
- `syncOrchestrator.onWorkspaceListReceived()` 호출 추가
- `useRelayStore` import 제거

#### Part D: HomePage 전환
- `useWorkspaceStore.isSynced` → `useSyncStore.workspaceSync` 전환
- `failed` 상태에 대한 에러 메시지 추가

#### Part E: 레거시 제거
- **workspaceStore**: `isSynced` 필드 완전 제거 (인터페이스, initialState, setWorkspaces, reset)
- **relayStore**: `desksLoaded`, `loadingState`, `setDesksLoaded`, `computeLoadingState`, `LoadingState` 타입 제거
- **stores/index.ts**: `LoadingState` export 제거

#### Part F: 테스트 업데이트
- `relayStore.test.ts`: `loadingState`/`desksLoaded` 관련 테스트 3개 제거
- `useMessageRouter.test.ts`: `mockRelayStore` → `mockSyncOrchestrator` 전환, `setCurrentConversation` mock 추가
- `conversation-state-integration.test.ts`: `setDesksLoaded` mock → 빈 객체, `syncOrchestrator` mock 추가
- `message-flow.test.ts`: `desksLoaded`/`setDesksLoaded` 제거, `syncOrchestrator` mock 추가
- `state-sync.test.ts`: `setDesksLoaded` mock → 빈 객체, `syncOrchestrator` mock 추가
- `testUtils.tsx`: `createMockRelayStore`에서 `desksLoaded`/`setDesksLoaded` 제거

## 변경 파일 목록

| 파일 | 유형 | 핵심 변경 |
|------|------|-----------|
| `stores/syncStore.ts` | Cycle 1 신규 | 동기화 상태 전용 store |
| `stores/syncStore.test.ts` | Cycle 1 신규 | 16개 테스트 |
| `services/syncOrchestrator.ts` | Cycle 2 신규 → Cycle 3 수정 | 동기화 오케스트레이터 + 싱글턴 export |
| `services/syncOrchestrator.test.ts` | Cycle 2 신규 | 9개 테스트 |
| `hooks/useMessageRouter.ts` | 수정 | dual-write, isFirstSync/setDesksLoaded 제거, orchestrator 연결 |
| `hooks/useMessageRouter.test.ts` | 수정 | relayStore mock → orchestrator mock |
| `App.tsx` | 수정 | startInitialSync + cleanup 연결 |
| `pages/HomePage.tsx` | 수정 | isSynced → syncStore.workspaceSync |
| `stores/workspaceStore.ts` | 수정 | isSynced 제거 |
| `stores/relayStore.ts` | 수정 | desksLoaded/loadingState/setDesksLoaded 제거 |
| `stores/relayStore.test.ts` | 수정 | loadingState/desksLoaded 테스트 제거 |
| `stores/index.ts` | 수정 | LoadingState export 제거, syncStore export 추가 |
| `e2e/conversation-state-integration.test.ts` | 수정 | mock 업데이트 |
| `e2e/message-flow.test.ts` | 수정 | mock 업데이트 |
| `e2e/state-sync.test.ts` | 수정 | mock 업데이트 |
| `test/testUtils.tsx` | 수정 | desksLoaded 제거 |

## 아키텍처: Push vs Pull

| 데이터 | 방식 | 트리거 |
|--------|------|--------|
| Workspace list (초기) | **Pull** | Client 인증 후 `startInitialSync()` |
| Workspace list (변경) | **Push** | Pylon `broadcastWorkspaceList()` |
| History (초기) | **Pull** | 대화 선택 시 `selectConversation()` |
| Conversation status | **Push** | Pylon `conversation_status` broadcast |
| Claude events | **Push** | Pylon `claude_event` (viewers only) |

Push로 온 `WORKSPACE_LIST_RESULT`는 `syncStore.workspaceSync !== 'requesting'`이므로 `onWorkspaceListReceived()`가 무시함 (정상 동작).

## 테스트 결과

```
Client: 23 files, 292 tests passed
Pylon:  21 files, 554 tests passed
```

## 미완료 / 추후 확인

- [ ] dev 서버 실제 연결 테스트 (연결 → 인증 → 워크스페이스 로드 → 대화 전환)
- [ ] 재연결 시나리오 테스트 (onclose → cleanup → 재연결 → startInitialSync)
- [ ] stage 배포 후 모바일 테스트

## 부록: 좀비 프로세스 발견

작업 중 node 프로세스가 332개 발견됨. 원인은 Claude Code의 Bash 도구가 Windows에서 `pnpm test` 실행 시 vitest tinypool 워커를 정리하지 못하는 문제.
- 12회 테스트 실행 × 23개 워커 = 276개 tinypool 좀비
- `scripts/kill-zombie.ps1`로 정리 완료 (332 → 31)
- Claude Code + Windows + vitest 조합의 프로세스 정리 문제로 판단
