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

- [x] **릴리즈 빌드 시스템**
  - [x] `release/` 폴더 구조 (dist만 복사)
  - [x] `scripts/build-release.ps1` 빌드 스크립트
  - [x] PM2 ecosystem 설정 (.cjs 확장자)

- [x] **Relay 배포** ✅
  - [x] Fly.io 설정 (estelle-relay-v2)
  - [x] Dockerfile, fly.toml 생성
  - [x] 배포 완료: https://estelle-relay-v2.fly.dev

- [x] **Pylon 배포** ✅
  - [x] PM2 ecosystem 설정
  - [x] 로컬 실행 완료 (포트 9000)

- [x] **App 웹 배포** ✅
  - [x] Expo web export
  - [x] PM2 + serve 설정 (포트 3000)

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
| Relay v2 | ✅ 동작 | 3000 | Fly.io (wss://estelle-relay-v2.fly.dev) |
| Pylon v2 | ✅ 동작 | - | PM2 (release/pylon) |
| Client (Vite) | ✅ 동작 | 5173 | Relay 내장 (8080) |

환경 설정: `config/environments.json`

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

---

## 작업 로그

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
*갱신일: 2026-02-05*
