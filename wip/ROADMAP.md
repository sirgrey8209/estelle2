# Estelle v2 로드맵

## 1차 목표: v1 → v2 전환

> v1의 모든 기능이 v2에서 동작하는 상태에서, v1을 제거하고 v2로 배포

---

## 단계별 계획

### Phase 1: 로컬 개발 환경 안정화 ✅

**목표**: 누구나 쉽게 로컬에서 v2를 실행할 수 있는 환경 구축

- [x] **실행 스크립트 정비**
  - [x] Relay 로컬 실행 스크립트 (`pnpm dev:relay`)
  - [x] Pylon 로컬 실행 스크립트 (`pnpm dev:pylon`)
  - [x] App(웹) 로컬 실행 스크립트
  - [x] 통합 실행 스크립트 (`pnpm dev` / `pnpm dev:stop`)

- [x] **가이드 문서 작성**
  - [x] `CLAUDE.md` 개발 서버 섹션 추가
  - [x] 필수 환경변수 정리

- [x] **환경 설정 표준화**
  - [x] `config/environments.json` (Dev/Release 설정 중앙 관리)
  - [x] `.env` 파일 (Expo 환경변수용)
  - [x] 포트 번호 통일 (Dev: Relay 3000, Expo 10000 / Release: Web 8080)

### Phase 2: v1 기능 마이그레이션 ✅

**목표**: v1의 모든 핵심 기능이 v2에서 동작

#### Pylon 기능 ✅
- [x] Claude SDK 세션 관리 (ClaudeSDKAdapter)
- [x] 워크스페이스 CRUD
- [x] 메시지 저장/로드 (FileSystemPersistence)
- [x] 버그 리포트 핸들러
- [ ] 태스크 관리 (v1에서 미사용, 제외)
- [ ] 워커 프로세스 관리 (v1에서 미사용, 제외)
- [ ] 파일 전송 (Blob) - 필요시 구현

#### App 기능 (Expo 마이그레이션 완료 ✅)
- [x] 워크스페이스 목록 표시
- [x] 대화 목록/선택
- [x] 메시지 송수신
- [x] 스트리밍 표시
- [x] 권한 요청 처리
- [x] 설정 화면
- [x] 반응형 레이아웃 (Desktop/Mobile)
- [x] 메시지 라우터 (useMessageRouter)

#### Relay 기능 ✅
- [x] 인증
- [x] 메시지 라우팅
- [x] 브로드캐스트

### Phase 3: 배포 시스템 구축 (진행 중)

**목표**: 안정적인 프로덕션 배포

- [x] **빌드/배포 시스템** ✅
  - [x] Dev → Stage → Release 3단계 환경 분리
  - [x] `scripts/build-deploy.ps1 -Target stage|release` 통합 스크립트
  - [x] 빌드 버저닝 `(env)vMMDD_N` + build-counter.json
  - [x] 환경별 데이터 분리 (release-data/, stage-data/, junction)
  - [x] MCP deploy 도구 (detached 빌드 실행)
  - [x] PM2 환경별 분리 (estelle-pylon, estelle-pylon-stage)
  - [x] sync-data.ps1 양방향 동기화 (-From/-To)

- [x] **Relay 배포** ✅
  - [x] Fly.io prod: https://estelle-relay-v2.fly.dev
  - [x] Fly.io stage: https://estelle-relay-v2-stage.fly.dev

- [x] **Pylon 배포** ✅
  - [x] PM2 estelle-pylon (release)
  - [x] PM2 estelle-pylon-stage (stage)

- [x] **App 웹 배포** ✅
  - [x] Relay 내장 (Fly.io 서빙)

- [x] **App 모바일 빌드** (삭제됨 - 웹 전용 전환)
  - 삭제: APK 빌드 제거 (Expo → Vite 전환)

- [x] **Expo → React (Vite) 전환** ✅
  - [x] Vite 빌드 시스템 구축
  - [x] shadcn/ui 컴포넌트 라이브러리 적용
  - [x] Platform Abstraction Layer (storage, useImagePicker)
  - [x] Relay 정적 파일 서빙 통합
  - [x] 테스트 환경 통합 (Jest → Vitest)

- [ ] **v1 제거**
  - [ ] v1 Relay 중단
  - [ ] v1 Pylon 제거
  - [ ] v1 코드 아카이브

---

## 현재 상태

| 컴포넌트 | 상태 | Dev 포트 | Release |
|----------|------|----------|---------|
| Relay v2 | ✅ 동작 | 3000 | Fly.io prod / stage |
| Pylon v2 | ✅ 동작 | - | PM2 (estelle-pylon / estelle-pylon-stage) |
| ClaudeBeacon | ✅ 동작 | 9875 | PM2 (claude-beacon) |
| Client (Vite) | ✅ 동작 | 5173 | Relay 내장 |

환경 설정: `config/environments.json`

### ClaudeBeacon 아키텍처 (2026-02-10 도입)

단일 ClaudeBeacon이 Claude SDK를 실행하고, 다중 Pylon(dev/stage/release)에 서비스.

```
                    ┌─────────────────────────────┐
                    │      ClaudeBeacon           │
                    │  - Claude SDK 단일 실행      │
                    │  - ToolContextMap           │
                    │  - TCP Server (:9875)       │
                    └─────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
       Dev Pylon     Stage Pylon    Release Pylon
```

**핵심 변경사항**:
- Pylon의 `ToolContextMap`, `McpTcpServer` 삭제 → ClaudeBeacon으로 이전
- Pylon은 `ClaudeBeaconAdapter`를 통해 SDK 호출
- MCP 도구는 ClaudeBeacon(:9875)에서 toolUseId 조회

**포트 할당**:
| 포트 | 용도 |
|------|------|
| 9875 | ClaudeBeacon (Pylon 연결 + lookup) |
| 9876 | MCP TCP (release) |
| 9877 | MCP TCP (stage) |
| 9878 | MCP TCP (dev) |

상세: `log/2026-02-11-claude-beacon-architecture.md`

### v1 → v2 마이그레이션 완료 (2026-02-02)

3단계 마이그레이션 완료:
- **Phase 1**: Pylon 핵심 동작 (Claude SDK Adapter, 영속 저장소)
- **Phase 2**: Client 상태 동기화 (MessageType 62개, 메시지 라우터)
- **Phase 3**: 통합 테스트 (1,035개 테스트 통과)

상세: `log/2026-02-02-v2-migration-plan.md`

### 테스트 현황

```
✓ Core:    201 tests
✓ Relay:   162 tests
✓ Pylon:   508 tests
✓ Client:  172 tests (vitest, jsdom)
─────────────────────
  Total: 1043 tests passing
```

---

## 다음 작업

**Phase 3 마무리**
- [x] APK 빌드 ✅
- [x] GitHub Release 업로드 ✅
- [ ] v1 제거

**Linked Document (진행 중)**
- [x] Store 구현 (linkDocument, unlinkDocument, getLinkedDocuments)
- [x] Core 타입 추가 (Conversation.linkedDocuments)
- [ ] 메시지 타입 추가 — 현재는 workspace_sync로 동기화, 향후 경량화 필요
- [x] Client UI (칩 표시 + 클릭 시 뷰어)
- [ ] Claude 주입 (세션 시작 시 문서 경로 전달)
- [ ] 변경 동기화 (Claude 수정 감지 → Client)

---

## 작업 로그

- [260211 12:55] ClaudeBeacon + BeaconServer 통합 (BeaconServer 제거, lookup 액션 ClaudeBeacon에 통합, 포트 9877 제거 → 9875 단일 포트)
- [260211 12:30] ClaudeBeaconAdapter 자동 재연결 로직 추가 (reconnect, reconnectInterval, maxReconnectAttempts 옵션, onReconnect/onReconnectFailed 콜백, 88개 테스트 통과)
- [260211 21:00] send_file MCP 마이그레이션 (toolComplete 훅 → PylonClient 기반, PylonMcpServer send_file 액션, 22개 테스트 추가, 748개 전체 통과)
- [260210 20:17] entityId 재사용 시 대화 캐시 정리 버그 수정 (CONVERSATION_CREATE_RESULT 핸들러 추가, WORKSPACE_LIST_RESULT 삭제 감지, TDD 8개 테스트)
- [260210 21:10] 재연결 시 상태 동기화 버그 수정 (CONVERSATION_STATUS에서 convState 없어도 상태 설정, history_result에 currentStatus 추가)
- [260211 18:20] conversation_status 버그 수정 (대화 선택 시 unread 해제, status: 'unread' → status 유지 + unread: true 분리, 클라이언트 방어 로직 추가)
- [260211 17:25] Pylon ToolContextMap/McpTcpServer 삭제 (ClaudeBeacon으로 이전 완료, 633개 테스트 통과)
- [260210 21:40] textComplete 중복 emit 버그 수정 (handleAssistantMessage에서 text 블록 합쳐서 단일 emit, TDD 7개 테스트)
- [260210 17:15] PendingQuestion sessionId 버그 수정 (다중 대화 질문 응답이 잘못된 채널로 라우팅되던 문제 해결, TDD 6개 테스트)
- [260210 17:00] Pylon-Beacon 연동 완료 (ClaudeBeaconAdapter 인터페이스 호환, bin.ts 환경변수 분기, 통합 테스트 성공)
- [260210 16:15] ClaudeBeacon PM2 등록 (bin.ts 진입점, ecosystem.config.cjs, 포트 9875, pm2 save 완료)
- [260210 15:30] ClaudeBeaconAdapter TDD 완료 (beacon-adapter.ts + beacon.ts 구현, 101개 테스트 통과 + 1개 스킵)
- [260210 12:35] ClaudeBeacon 패키지 구현 완료 (TDD, ToolContextMap + BeaconServer + MockSDK, 51개 테스트, 전체 1,682개 테스트 통과)
- [260209 07:20] ChatPanel 가로 스크롤 버그 수정 (MessageBubble에 break-words 클래스 추가)
- [260209 06:45] useCurrentConversationState hook 추가 (Zustand selector 구독 문제 해결, 5개 컴포넌트 마이그레이션, 14개 테스트)
- [260208 23:10] LinkedDocument Store 구현 완료 (linkDocument/unlinkDocument/getLinkedDocuments, 26개 테스트, TDD)
- [260208 21:50] Client-Driven Sync 구현 완료 (syncStore + syncOrchestrator 신설, isSynced/desksLoaded/isFirstSync 레거시 제거, 292+554 테스트 통과)
- [260208 15:10] Client EntityId 대화선택 버그 수정 (workspaceStore 4개 메서드 entityId 전환, 구형 UUID 데이터 삭제, 구형 Pylon 프로세스 정리)
- [260208 09:10] workspaceStore entityId 매칭 마이그레이션 (selectConversation/updateConversationStatus/updatePermissionMode/getConversation → entityId 기반, 1483 테스트 통과)
- [260207 22:10] EntityId 마이그레이션 완료 (Pylon 패키지: UUID→숫자 비트패킹, 142개 테스트 통과)
- [260207 14:30] Dev→Stage→Release 배포 시스템 구축 (3환경 분리, 빌드 버저닝, MCP deploy, Fly.io stage 앱 생성, 양방향 sync-data)
- [260207 09:35] Phase 5 완료: conversation_status에 workspaceId 추가 (Pylon 2곳 수정, 테스트 2개 추가)
- [260207 09:22] Phase 4 완료: claudeStore 완전 제거 (conversationStore로 마이그레이션, 543→860 테스트)
- [260207 02:30] Safe Release Build Pipeline 구현 (staging→verify→atomic swap→healthcheck→rollback, release-data/ junction 분리)
- [260207 00:15] PWA 키보드 대응 수정 (visualViewport 동기화 방식으로 변경, 멀티라인 입력 시 키보드 아래 밀림 해결)
- [260206 23:30] PWA 지원 추가 (vite-plugin-pwa, manifest, 아이콘, viewport 대응, Fly.io 배포)
- [260206 22:00] 채팅 UX 개선 (대화 이름변경/삭제, 파일뷰어 개선, 모바일 Enter, 클립보드 붙여넣기, 첨부카드 컴팩트화)
- [260205 16:45] 워크스페이스 CRUD Phase 2 완료 (useLongPress 훅, WorkspaceDialog New/Edit 통합, WorkspaceSidebar 롱홀드 편집)
- [260205 16:15] 워크스페이스 CRUD Phase 1 완료 (updateWorkspace API, foldersWithChildren, listDrives)
- [260205 15:30] UI 버그 수정 일괄 (색상 테마 Claude.ai 스타일, 퍼미션 버튼 연결, AskUserQuestion 표시, 모바일 레이아웃, 디바이스 아이콘)
- [260205 13:48] Vite 마이그레이션 버그 수정 (HomePage 컴포넌트 연결, ChatArea 스크롤/레이아웃, AutoResizeTextarea onChange)
- [260205 10:25] Expo → Vite 전환 완료 (Phase 0-5, shadcn/ui, Relay 정적 파일 서빙 통합, APK 제거)
- [260204 23:20] ToolCard UX 완료 (8개 툴 커스텀 렌더링, textUtils 추출, 테스트 포트 분리)
- [260204 14:30] 폰트 체계 통일 (labelSmall→bodySmall 24개 파일, 앱타이틀 headlineSmall 24sp, Markdown 헤딩 조정)
- [260204 11:15] 환경 설정 중앙화 (config/environments.json), 웹 타이틀 (dev) 표시, 커스텀 스크롤바 컴포넌트
- [260203 23:55] APK 빌드 성공 + GitHub Release v2.0.0 배포
- [260203 22:xx] 릴리즈 배포 시스템 구축 (Relay→Fly.io, Pylon/Client→PM2)
- [260208 08:30] Client EntityId 마이그레이션 완료 (conversationId:string → entityId:number, 929+ 테스트 통과)
- [260208 08:30] mock-e2e.test.ts 임시 삭제 (fake timer + queueMicrotask hang 이슈, 정리 필요)
- [260203 16:20] AutoResizeTextInput 구현 및 InputBar 통합 (TDD, 24개 테스트)
- [260203 10:50] Material Design 3 마이그레이션 완료 (NativeWind → React Native Paper, 40+개 컴포넌트)
- [260203 09:20] Jest 컴포넌트 테스트 환경 구축 (61개 테스트 추가)
- [260202 22:42] Desk → Workspace/Conversation 2단계 구조 정리 완료
- [260202 21:55] 메시지 타입 통합 (Core ← Pylon, Client)
- [260202 17:30] Device ID 체계 정리 (숫자 기반 대역)
- [260202] Mock E2E 테스트 환경 구축 (1,078개 테스트)
- [260202] v1 → v2 UI 마이그레이션 완료 (38항목)
- [260202 19:00] v1 → v2 마이그레이션 3단계 완료

---

*작성일: 2026-01-31*
*갱신일: 2026-02-11*
