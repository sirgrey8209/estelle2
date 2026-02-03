# Phase 2: Client 상태 동기화 강화

> **목표**: PylonState ⊃ ClientState 관계가 명확하게 유지됨
> **상태**: 진행 중
> **선행**: Phase 1 완료 ✅

---

## 2.1 상태 관계 문서화

### 현재 구조

```
PylonState (서버, 진실의 원천)     ClientState (앱, 부분 복사본)
┌─────────────────────────┐        ┌─────────────────────────┐
│ workspaceStore          │ ─────> │ DeskStore               │
│   - workspaces[]        │ subset │   - desks[]             │
│   - conversations[]     │        │   - selectedDeskId      │
│   - activeIds           │        │   - selectedChatId      │
├─────────────────────────┤        ├─────────────────────────┤
│ messageStore            │ ─────> │ ClaudeStore             │
│   - messages{}          │ subset │   - messages[]          │
│   - (모든 세션)          │        │   - (현재 세션만)        │
├─────────────────────────┤        ├─────────────────────────┤
│ claudeManager           │        │ (상태 없음)              │
│   - sessions            │        │                         │
│   - pendingPermissions  │        │                         │
├─────────────────────────┤        ├─────────────────────────┤
│ (서버 전용)              │        │ RelayStore              │
│                         │        │   - isConnected         │
│                         │        │   - deviceInfo          │
└─────────────────────────┘        └─────────────────────────┘
```

### SubSet 관계 원칙

1. **App은 요청만, Pylon이 결정**
   - App에서 직접 상태 변경 금지
   - 모든 변경은 Pylon에 요청 → 결과 수신

2. **모든 App은 동일한 상태**
   - 브로드캐스트를 통한 상태 동기화
   - sessionViewers로 관심 있는 클라이언트만 타겟팅

3. **캐시는 로컬 최적화용**
   - ClaudeStore의 _messageCache는 UI 최적화용
   - 실제 진실은 항상 Pylon의 messageStore

### Client Store 역할 분석 (2026-02-02)

| Store | 파일 | 역할 | Pylon 대응 |
|-------|------|------|-----------|
| **DeskStore** | `deskStore.ts` | 워크스페이스/대화 목록 관리 | WorkspaceStore |
| **ClaudeStore** | `claudeStore.ts` | Claude 메시지/상태 관리 | MessageStore + ClaudeManager |
| **RelayStore** | `relayStore.ts` | 연결 상태 관리 | (서버 전용 없음) |
| SettingsStore | `settingsStore.ts` | 로컬 설정 | (클라이언트 전용) |
| UploadStore | `uploadStore.ts` | 파일 업로드 | BlobHandler |
| DownloadStore | `downloadStore.ts` | 파일 다운로드 | BlobHandler |

### 금지 패턴 목록

Client에서 **절대 하면 안 되는 것**:

1. **데스크 목록 직접 수정**: `desks` 배열을 로컬에서 push/splice 금지
2. **메시지 직접 생성**: Pylon 이벤트 없이 메시지 추가 금지
3. **상태 직접 변경**: `status`를 UI에서 직접 변경 금지 (Pylon의 `state` 이벤트로만)
4. **claudeSessionId 직접 설정**: Pylon의 `init` 이벤트에서만 받아야 함

### 완료 조건

- [x] 상태 관계 다이어그램 확정 ✅
- [x] Client Store별 역할 문서화 ✅
- [x] 금지 패턴 목록 작성 ✅

---

## 2.2 동기화 메시지 플로우 검증

### 메시지 플로우 매핑

| Pylon 이벤트 | 메시지 타입 | Client 업데이트 |
|-------------|------------|----------------|
| 워크스페이스 목록 변경 | `workspace_list_result` | DeskStore.setDesks() |
| 대화 상태 변경 | `conversation_status` | DeskStore.updateConversationStatus() |
| 대화 선택 | `history_result` | ClaudeStore.setMessages() |
| Claude 텍스트 | `claude_event` (text) | ClaudeStore.appendText() |
| Claude 도구 시작 | `claude_event` (toolInfo) | ClaudeStore.addToolStart() |
| Claude 도구 완료 | `claude_event` (toolComplete) | ClaudeStore.updateToolComplete() |
| 권한 요청 | `claude_event` (permission_request) | ClaudeStore.addPendingPermission() |
| 질문 요청 | `claude_event` (askQuestion) | ClaudeStore.addPendingQuestion() |
| 세션 완료 | `claude_event` (result) | ClaudeStore.setIdle() |

### 검증 결과 (2026-02-02)

#### Pylon이 전송하는 메시지 타입

| 카테고리 | 메시지 타입 | 설명 |
|----------|------------|------|
| 워크스페이스 | `workspace_list_result` | 목록 응답/브로드캐스트 |
| | `workspace_create_result` | 생성 응답 |
| | `workspace_delete_result` | 삭제 응답 |
| 대화 | `conversation_create_result` | 생성 응답 |
| | `conversation_status` | 상태 변경 (read/unread, 작업 상태) |
| | `history_result` | 메시지 히스토리 |
| Claude | `claude_event` | SDK 이벤트 (state, text, tool, result 등) |
| | `pylon_status` | Claude 사용량 |
| 파일 | `blob_upload_complete` | 업로드 완료 |
| 폴더 | `folder_list_result`, `folder_create_result`, `folder_rename_result` | 폴더 작업 |
| 태스크 | `task_list_result`, `task_get_result`, `task_status_result` | 태스크 관리 |
| 워커 | `worker_status_result`, `worker_start_result`, `worker_stop_result` | 워커 관리 |

#### 발견된 문제점

**🔴 Critical: 메시지 타입 명명 불일치**

| @estelle/core 정의 | Pylon 실제 사용 |
|-------------------|-----------------|
| `DESK_LIST`, `DESK_LIST_RESULT` | `workspace_list`, `workspace_list_result` |
| `DESK_CREATE`, `DESK_DELETE` | `workspace_create`, `workspace_delete` |
| `DESK_STATUS` | `conversation_status` |

→ **해결 필요**: core 타입을 Pylon 실제 구현에 맞게 업데이트 또는 통일

**🔴 Critical: Client 메시지 핸들러 미완성**

- `RelayService`가 모든 메시지를 단순 `'message'` 이벤트로 발생
- 메시지 타입별 라우팅 로직이 없음
- 각 Store와의 연결 고리가 불명확

**🟡 Important: 메시지 인터페이스 불일치**

```typescript
// Pylon의 from 타입
from?: { type: 'device' | 'session'; id: number | string }

// Client의 from 타입
from?: string
```

#### 누락된 핸들러 목록

| 메시지 타입 | Client 처리 | 상태 |
|------------|------------|------|
| `workspace_list_result` | DeskStore.setDesks() | ⚠️ 연결 확인 필요 |
| `workspace_create_result` | (미구현) | ❌ 누락 |
| `workspace_delete_result` | (미구현) | ❌ 누락 |
| `conversation_status` | DeskStore.updateDeskStatus() | ⚠️ 연결 확인 필요 |
| `history_result` | ClaudeStore.setMessages() | ⚠️ 연결 확인 필요 |
| `claude_event` | ClaudeStore 여러 메서드 | ⚠️ 연결 확인 필요 |
| `folder_*_result` | (미구현) | ❌ 누락 |
| `task_*_result` | (미구현) | ❌ 누락 |
| `worker_*_result` | (미구현) | ❌ 누락 |

### 검증 항목

각 메시지에 대해:

1. **Pylon → Client 전송 확인**
   - 올바른 메시지 타입 사용
   - 필수 필드 포함
   - 올바른 타겟에게 전송 (broadcast vs unicast)

2. **Client 수신 처리 확인**
   - 메시지 핸들러 존재
   - Store 업데이트 로직 정확
   - UI 리렌더링 트리거

3. **에러 케이스 확인**
   - 메시지 누락 시 복구 방법
   - 순서 뒤바뀜 처리

### 완료 조건

- [x] 모든 메시지 타입에 대해 송수신 코드 확인 ✅
- [x] 누락된 핸들러 식별 ✅ (구현은 별도 태스크)
- [ ] 에러 케이스 문서화

---

## 2.3 타입 일관성 확인

### 알려진 이슈

**1. deviceId 타입 불일치** (pylon-app-integration-test.md 참조)
- Pylon: string으로 전송
- App: number로 기대
- 해결: Pylon에서 number로 전송

**2. 메시지 인터페이스 불일치** (2026-02-02 발견)
- Pylon `from`: `{ type: 'device' | 'session'; id: number | string }`
- Client `from`: `string`
- 해결 필요: @estelle/core에서 공통 타입 정의

**3. 메시지 타입 상수 불일치** (2026-02-02 발견)
- @estelle/core: `DESK_*` 명명
- Pylon 구현: `workspace_*`, `conversation_*` 명명
- 해결 필요: 타입 상수 업데이트 또는 매핑 레이어

### 검증 대상

| 필드 | Pylon 타입 | Client 타입 | 상태 |
|------|-----------|------------|------|
| deviceId | number | number | ⚠️ 확인 필요 |
| workspaceId | string | string | ✅ |
| conversationId | string | string | ✅ |
| timestamp | number | number | ⚠️ 확인 필요 |
| status | DeskStatusValue | DeskStatusValue | ✅ |

### 메시지 타입 불일치 상세 (2026-02-02)

#### @estelle/core에 정의됨 vs Pylon 실제 사용

| 카테고리 | Core 정의 | Pylon 사용 | 상태 |
|----------|----------|-----------|------|
| 목록 조회 | `desk_list` | `workspace_list` | ❌ 불일치 |
| 목록 응답 | `desk_list_result` | `workspace_list_result` | ❌ 불일치 |
| 생성 | `desk_create` | `workspace_create` | ❌ 불일치 |
| 생성 응답 | (없음) | `workspace_create_result` | ❌ 누락 |
| 삭제 | `desk_delete` | `workspace_delete` | ❌ 불일치 |
| 삭제 응답 | (없음) | `workspace_delete_result` | ❌ 누락 |
| 대화 생성 | (없음) | `conversation_create` | ❌ 누락 |
| 대화 생성 응답 | (없음) | `conversation_create_result` | ❌ 누락 |
| 상태 변경 | `desk_status` | `conversation_status` | ❌ 불일치 |
| 히스토리 | (없음) | `history_result` | ❌ 누락 |

#### Pylon이 사용하지만 Core에 없는 타입

```
# 응답 메시지
history_result, workspace_create_result, workspace_delete_result
conversation_create_result, blob_upload_complete

# 폴더 관련 (전체 누락)
folder_list, folder_list_result, folder_create, folder_create_result
folder_rename, folder_rename_result

# 태스크 관련 (전체 누락)
task_list, task_list_result, task_get, task_get_result
task_create, task_update, task_status_result

# 워커 관련 (전체 누락)
worker_status, worker_status_result, worker_start, worker_start_result
worker_stop, worker_stop_result

# 상태/유틸리티
status, pylon_status, relay_status, from_relay
```

#### 결론

**@estelle/core의 MessageType이 실제 구현과 크게 동기화되지 않음**

- 초기 설계(DESK_*)와 실제 구현(workspace_*, conversation_*)이 다름
- 응답 메시지 타입(_result)이 대부분 누락
- 폴더/태스크/워커 관련 메시지 타입이 전혀 정의되지 않음

**권장 조치:**
1. ~~Core MessageType을 실제 구현에 맞게 업데이트~~ ✅ 완료 (2026-02-02)
2. 또는 Pylon에서 Core의 상수를 사용하도록 수정

**MessageType 업데이트 내역 (2026-02-02)**:
- WORKSPACE_*, CONVERSATION_* 타입 추가
- *_RESULT 응답 메시지 타입 추가
- FOLDER_*, TASK_*, WORKER_* 타입 추가
- 기존 DESK_* 타입은 deprecated로 유지 (하위 호환성)
- 총 62개 메시지 타입 정의 (기존 27개 → 62개)

### 공유 타입 활용

`@estelle/core` 패키지의 타입을 Pylon과 Client 모두에서 사용:

```typescript
// packages/core/src/types/
export type DeskStatusValue = 'idle' | 'working' | 'permission' | 'offline';
export type PermissionModeValue = 'default' | 'acceptEdits' | 'bypassPermissions';
```

### 완료 조건

- [x] 모든 메시지 페이로드의 타입 일치 확인 ✅ (불일치 다수 발견)
- [x] @estelle/core에서 공유 타입 사용 확인 ✅ (대부분 미사용)
- [ ] 타입 불일치 발견 시 수정 (별도 태스크로 진행)

---

## Phase 2 체크리스트

- [x] **2.1** 상태 관계 문서화 ✅
- [x] **2.2** 동기화 메시지 검증 ✅ (이슈 식별 완료)
- [x] **2.3** 타입 일관성 확인 ✅ (이슈 식별 완료)

### 발견된 이슈 요약

| 이슈 | 심각도 | 해결 방안 |
|------|--------|----------|
| 메시지 타입 명명 불일치 (DESK vs workspace) | 🔴 Critical | core 타입 업데이트 |
| Client 메시지 라우터 부재 | 🔴 Critical | RelayService 개선 |
| 메시지 from 타입 불일치 | 🟡 Important | core에 공통 타입 정의 |
| 누락된 핸들러 다수 | 🟡 Important | Client Store 연결 구현 |

---

*이전: [Phase 1: Pylon 핵심 동작](./phase1-pylon-core.md)*
*다음: [Phase 3: 통합 테스트](./phase3-integration-test.md)*
