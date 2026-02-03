# v1 → v2 마이그레이션 갭 분석

> **상태**: 진행 중
> **작성일**: 2026-02-01

---

## 개요

v1의 모든 기능이 v2에서 동작해야 하며, PylonState와 ClientState의 SubSet 관계가 유지되어야 합니다.

---

## 1. Pylon 기능 비교

### 1.1 메시지 핸들러 비교

| 카테고리 | v1 메시지 타입 | v2 상태 | 비고 |
|----------|---------------|---------|------|
| **연결 관리** | | | |
| | `ping` | ✅ 완성 | |
| | `get_status` | ✅ 완성 | |
| | `connected` | ✅ 완성 | |
| | `auth_result` | ✅ 완성 | |
| | `registered` | ✅ 완성 | 레거시 |
| | `device_status` | ✅ 완성 | |
| | `client_disconnect` | ✅ 완성 | |
| **워크스페이스** | | | |
| | `workspace_list` | ✅ 완성 | |
| | `workspace_create` | ✅ 완성 | |
| | `workspace_delete` | ✅ 완성 | |
| | `workspace_rename` | ✅ 완성 | |
| | `workspace_switch` | ✅ 완성 | |
| **대화 관리** | | | |
| | `conversation_create` | ✅ 완성 | |
| | `conversation_delete` | ✅ 완성 | |
| | `conversation_rename` | ✅ 완성 | |
| | `conversation_select` | ✅ 완성 | |
| | `history_request` | ✅ 완성 | |
| **Claude 제어** | | | |
| | `claude_send` | ✅ 완성 | |
| | `claude_permission` | ✅ 완성 | |
| | `claude_answer` | ✅ 완성 | |
| | `claude_control` | ✅ 완성 | compact 미구현 |
| | `claude_set_permission_mode` | ✅ 완성 | |
| **폴더 관리** | | | |
| | `folder_list` | ✅ 완성 | |
| | `folder_create` | ✅ 완성 | |
| | `folder_rename` | ✅ 완성 | |
| **태스크 관리** | | | |
| | `task_list` | ✅ 완성 | |
| | `task_get` | ✅ 완성 | |
| | `task_status` | ✅ 완성 | |
| **워커 관리** | | | |
| | `worker_status` | ✅ 완성 | |
| | `worker_start` | ✅ 완성 | |
| | `worker_stop` | ✅ 완성 | |
| **Blob 전송** | | | |
| | `blob_start` | ✅ 완성 | |
| | `blob_chunk` | ✅ 완성 | |
| | `blob_end` | ✅ 완성 | |
| | `blob_request` | ✅ 완성 | |
| **Flutter 개발** | | | |
| | `flutter_server_start` | ❌ 없음 | v2에서 불필요? |
| | `flutter_server_stop` | ❌ 없음 | v2에서 불필요? |
| | `flutter_hot_reload` | ❌ 없음 | v2에서 불필요? |
| | `flutter_server_status` | ❌ 없음 | v2에서 불필요? |
| **배포 관리** | | | |
| | `deploy_request` | ❌ 없음 | 필요 |
| | `deploy_prepare` | ❌ 없음 | 필요 |
| | `deploy_confirm` | ❌ 없음 | 필요 |
| | `deploy_start` | ❌ 없음 | 필요 |
| | `deploy_start_ack` | ❌ 없음 | 필요 |
| | `deploy_go` | ❌ 없음 | 필요 |
| | `run_deploy` | ❌ 없음 | 필요 |
| **기타** | | | |
| | `debug_log` | ✅ 완성 | |
| | `update` | ❌ 없음 | Pylon 자동 업데이트 |
| | `claude_usage_request` | ❌ 없음 | 필요 |
| | `version_check_request` | ❌ 없음 | 필요 |
| | `app_update_request` | ❌ 없음 | 필요 |
| | `bug_report` | ❌ 없음 | 필요 |

### 1.2 Pylon 핵심 누락 기능

#### ⚠️ 심각 (동작 불가)

1. **Claude SDK adapter 미연결**
   - `bin.ts`에서 ClaudeManager에 adapter가 주입되지 않음
   - 실제 Claude 호출이 불가능
   - **해결**: `@anthropic-ai/claude-agent-sdk` 연동 adapter 구현

2. **ClaudeManager 콜백 미연결**
   - `onEvent: () => {}` 빈 함수
   - Claude 이벤트가 Pylon에 전달되지 않음
   - **해결**: `pylon.sendClaudeEvent` 연결

3. **getPermissionMode 고정값**
   - `getPermissionMode: () => 'default'`
   - 대화별 권한 모드가 반영되지 않음
   - **해결**: `workspaceStore.getConversationPermissionMode` 연결

4. **MCP 설정 미로드**
   - `loadMcpConfig: () => null`
   - MCP 서버 사용 불가
   - **해결**: `mcp-config.json` 로드 로직 구현

5. **영속 저장소 미구현**
   - WorkspaceStore/MessageStore가 메모리만 사용
   - 재시작 시 데이터 손실
   - **해결**: JSON 파일 저장/로드 구현

#### ⚠️ 중요 (기능 누락)

6. **배포 기능 전체 미구현**
   - deploy_* 메시지 핸들러 없음
   - deployState 관리 없음
   - **해결**: v1의 배포 로직 포팅

7. **버전/업데이트 확인 미구현**
   - version_check_request, app_update_request 없음
   - **해결**: GitHub Release 연동 로직 포팅

8. **Claude 사용량 요청 미구현**
   - claude_usage_request 없음
   - **해결**: claudeUsage 상태 반환 핸들러 추가

9. **버그 리포트 미구현**
   - bug_report 핸들러 없음
   - **해결**: 로그 수집 및 전송 로직 추가

#### 🔶 보통 (불필요 가능)

10. **Flutter 개발 서버 미구현**
    - Expo 마이그레이션으로 불필요할 수 있음
    - **결정 필요**: 제거 또는 Expo Metro 연동?

11. **FileSimulator 미구현**
    - 개발/테스트용 기능
    - **결정 필요**: 필요시 추가

12. **Pylon 자동 업데이트 미구현**
    - update 메시지 핸들러 없음
    - **결정 필요**: 배포 시스템과 통합?

---

## 2. Client(앱) 기능 비교

### 2.1 화면 비교

| 화면 | v1 Flutter | v2 Expo | 상태 | 비고 |
|------|-----------|---------|------|------|
| 메인 채팅 | ChatArea | ChatArea | ✅ 완성 | |
| 메시지 목록 | MessageList | MessageList | ✅ 완성 | |
| 입력 바 | InputBar | InputBar | ✅ 완성 | |
| 스트리밍 버블 | StreamingBubble | StreamingBubble | ✅ 완성 | |
| 도구 카드 | ToolCard | ToolCard | ✅ 완성 | |
| 작업 표시기 | WorkingIndicator | WorkingIndicator | ✅ 완성 | |
| 결과 정보 | ResultInfo | ResultInfo | ✅ 완성 | |
| 업로드 버블 | UploadingImageBubble | UploadingBubble | ✅ 완성 | |
| 시스템 구분선 | SystemDivider | SystemDivider | ✅ 완성 | |
| 권한 요청 | PermissionRequest | PermissionRequest | ✅ 완성 | |
| 질문 요청 | QuestionRequest | QuestionRequest | ✅ 완성 | |
| 요청 바 | RequestBar | RequestBar | ✅ 완성 | |
| 사이드바 | WorkspaceSidebar | DeskSidebar | ✅ 완성 | 이름 변경 |
| 워크스페이스 아이템 | WorkspaceItem | DeskItem | ✅ 완성 | 이름 변경 |
| 새 워크스페이스 | NewWorkspaceDialog | NewDeskDialog | ✅ 완성 | 이름 변경 |
| 설정 화면 | SettingsScreen | SettingsScreen | ✅ 완성 | |
| 설정 다이얼로그 | SettingsDialog | SettingsDialog | ✅ 완성 | |
| Claude 사용량 | ClaudeUsageCard | ClaudeUsageCard | ✅ 완성 | |
| 배포 섹션 | DeploySection | DeploySection | 🔶 UI만 | 로직 미완 |
| 배포 다이얼로그 | DeployDialog | DeployDialog | 🔶 UI만 | 로직 미완 |
| 배포 상태 카드 | DeployStatusCard | DeployStatusCard | 🔶 UI만 | 로직 미완 |
| 앱 업데이트 | AppUpdateSection | AppUpdateSection | 🔶 UI만 | 로직 미완 |
| 파일 뷰어 | FileViewerDialog | FileViewer | ✅ 완성 | |
| 이미지 뷰어 | ImageViewer | ImageViewer | ✅ 완성 | |
| 마크다운 뷰어 | MarkdownViewer | MarkdownViewer | ✅ 완성 | |
| 텍스트 뷰어 | TextViewer | TextViewer | ✅ 완성 | |
| 버그 리포트 | BugReportDialog | BugReportDialog | 🔶 UI만 | 로직 미완 |
| 태스크 상세 | TaskDetailView | TaskDetailView | ✅ 완성 | |
| 로딩 오버레이 | LoadingOverlay | LoadingOverlay | ✅ 완성 | |
| 상태 점 | StatusDot | StatusDot | ✅ 완성 | |

### 2.2 상태 관리 비교

| 상태 영역 | v1 Provider | v2 Zustand Store | 상태 |
|-----------|-------------|------------------|------|
| 연결 상태 | relayServiceProvider | RelayStore | ✅ 완성 |
| 인증 상태 | authStateProvider | RelayStore | ✅ 완성 |
| 로딩 상태 | loadingStateProvider | RelayStore | ✅ 완성 |
| 워크스페이스 | pylonWorkspacesProvider | DeskStore | ✅ 완성 |
| 선택 항목 | selectedItemProvider | DeskStore | ✅ 완성 |
| 메시지 | claudeMessagesProvider | ClaudeStore | ✅ 완성 |
| Claude 상태 | claudeStateProvider | ClaudeStore | ✅ 완성 |
| 텍스트 버퍼 | currentTextBufferProvider | ClaudeStore | ✅ 완성 |
| 대기 요청 | pendingRequestsProvider | ClaudeStore | ✅ 완성 |
| 히스토리 페이징 | historyOffsetProvider | ClaudeStore | ✅ 완성 |
| Claude 사용량 | claudeUsageProvider | SettingsStore | ✅ 완성 |
| 배포 상태 | deployStatusProvider | SettingsStore | 🔶 UI만 |
| 버전 정보 | deployVersionProvider | SettingsStore | 🔶 UI만 |
| 이미지 업로드 | imageUploadProvider | UploadStore | ✅ 완성 |
| 파일 다운로드 | fileDownloadProvider | DownloadStore | ✅ 완성 |
| 권한 모드 | permissionModeProvider | ClaudeStore | ✅ 완성 |
| 폴더 목록 | folderListProvider | ❓ 미확인 | 확인 필요 |
| 작업 완료 이벤트 | finishWorkCompleteProvider | ❓ 미확인 | 확인 필요 |

### 2.3 Client 핵심 누락 기능

#### ⚠️ 중요 (기능 누락)

1. **배포 로직 미구현**
   - UI는 있지만 실제 WebSocket 통신 없음
   - deploy_prepare, deploy_confirm, deploy_go 전송 안함

2. **버전 확인 로직 미구현**
   - version_check_request 전송 안함
   - GitHub Release 확인 안함

3. **앱 업데이트 로직 미구현**
   - app_update_request 전송 안함

4. **버그 리포트 전송 미구현**
   - UI는 있지만 bug_report 메시지 전송 안함

5. **폴더 선택 다이얼로그 미확인**
   - 새 워크스페이스 생성 시 폴더 탐색 기능

---

## 3. State 구조 비교 (PylonState vs ClientState)

### 3.1 개념 정리

```
PylonState (서버)                 ClientState (앱)
┌─────────────────────┐          ┌─────────────────────┐
│ workspaceStore      │ ─────────│ DeskStore           │
│   - workspaces[]    │  subset  │   - desks[]         │
│   - conversations[] │  ───────>│   - selectedDeskId  │
│   - activeIds       │          │                     │
├─────────────────────┤          ├─────────────────────┤
│ messageStore        │ ─────────│ ClaudeStore         │
│   - messages{}      │  subset  │   - messages[]      │
│   - (sessionId별)   │  ───────>│   - textBuffer      │
│                     │          │   - pendingRequests │
├─────────────────────┤          ├─────────────────────┤
│ claudeManager       │          │ (해당 없음)          │
│   - sessions        │          │                     │
│   - pendingPerms    │          │                     │
├─────────────────────┤          ├─────────────────────┤
│ sessionViewers      │          │ RelayStore          │
│ appUnreadSent       │          │   - isConnected     │
│ claudeUsage         │          │   - isAuthenticated │
│ deployState         │          │   - deviceId        │
├─────────────────────┤          ├─────────────────────┤
│ (영속 저장)          │          │ SettingsStore       │
│   - workspaces.json │          │   - claudeUsage     │
│   - messages/*.json │          │   - deployState     │
└─────────────────────┘          └─────────────────────┘
```

### 3.2 동기화 메커니즘

| Pylon 상태 변경 | 메시지 | Client 상태 업데이트 |
|----------------|--------|---------------------|
| 워크스페이스 목록 | `workspace_list_result` | DeskStore.setDesks() |
| 대화 선택 | `conversation_select` → `history_result` | ClaudeStore.loadMessages() |
| Claude 이벤트 | `claude_event` | ClaudeStore.addMessage() |
| 상태 변경 | `conversation_status` | DeskStore.updateStatus() |
| 파일 업로드 완료 | `blob_upload_complete` | UploadStore.complete() |
| 사용량 업데이트 | `pylon_status` | SettingsStore.setUsage() |

### 3.3 SubSet 관계 유지 원칙

1. **App은 요청만, Pylon이 결정**
   - App에서 직접 상태 변경 금지
   - 모든 변경은 Pylon에 요청 → 결과 수신

2. **모든 App은 동일한 상태**
   - 브로드캐스트를 통한 상태 동기화
   - sessionViewers로 관심 있는 클라이언트만 타겟팅

3. **캐시는 로컬 최적화용**
   - ClaudeStore의 _messageCache는 UI 최적화용
   - 실제 진실은 항상 Pylon의 messageStore

---

## 4. 작업 우선순위

### Phase 1: Pylon 동작 (필수)

1. [ ] **Claude SDK adapter 구현** - `claude-adapter.ts`
   - query() 메서드 구현
   - AsyncIterable<ClaudeMessage> 반환

2. [ ] **bin.ts 의존성 연결 수정**
   - ClaudeManager.onEvent → pylon.sendClaudeEvent
   - getPermissionMode → workspaceStore 연동
   - loadMcpConfig 구현

3. [ ] **영속 저장소 구현**
   - WorkspaceStore: workspaces.json 저장/로드
   - MessageStore: messages/{sessionId}.json 저장/로드

### Phase 2: 누락 기능 추가

4. [ ] **배포 기능 (Pylon)**
   - deploy_* 메시지 핸들러 추가
   - deployState 관리

5. [ ] **배포 기능 (Client)**
   - RelayService에 deploy 메서드 추가
   - SettingsStore와 연동

6. [ ] **버전/업데이트 기능**
   - version_check_request 핸들러
   - app_update_request 핸들러
   - GitHub Release 연동

7. [ ] **Claude 사용량 요청**
   - claude_usage_request 핸들러

8. [ ] **버그 리포트**
   - bug_report 핸들러
   - 로그 수집 로직

### Phase 3: 안정화 및 테스트

9. [ ] **통합 테스트**
   - Pylon ↔ Relay 연결 테스트
   - Pylon ↔ Client 메시지 테스트
   - Claude 세션 테스트

10. [ ] **UI/UX 점검**
    - Flutter vs Expo 차이 확인
    - 반응성 테스트

---

## 5. 결정 필요 사항

### Flutter 개발 서버 기능
- **질문**: v2에서도 필요한가?
- **옵션 A**: 제거 (Expo 마이그레이션 완료)
- **옵션 B**: Expo Metro 연동으로 대체
- **권장**: 옵션 A (Expo 앱이므로 불필요)

### Pylon 자동 업데이트
- **질문**: 어떻게 구현할 것인가?
- **옵션 A**: v1처럼 git pull + 재시작
- **옵션 B**: 배포 시스템과 통합
- **권장**: Phase 2에서 결정

### FileSimulator
- **질문**: 개발/테스트용으로 필요한가?
- **옵션 A**: 제거
- **옵션 B**: 필요시 추가
- **권장**: 옵션 A (Relay 테스트로 충분)

---

*마지막 업데이트: 2026-02-01*
