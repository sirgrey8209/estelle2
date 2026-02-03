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
  - [x] `.env` 파일 (루트 레벨)
  - [x] 포트 번호 통일 (Relay: 8081, Pylon: 9101, App: 10000)

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

### Phase 3: 배포 시스템 구축

**목표**: 안정적인 프로덕션 배포

- [ ] **Relay 배포**
  - [ ] Fly.io 설정
  - [ ] 환경변수 관리
  - [ ] 도메인 설정

- [ ] **Pylon 배포**
  - [ ] Windows 서비스 등록 스크립트
  - [ ] 자동 시작 설정

- [ ] **App 배포 (Expo)**
  - [ ] Web 빌드 & 호스팅
  - [ ] Android APK/AAB 빌드 (EAS Build)
  - [ ] iOS 빌드 (선택)

- [ ] **v1 제거**
  - [ ] v1 Relay 중단
  - [ ] v1 Pylon 제거
  - [ ] v1 코드 아카이브

---

## 현재 상태

| 컴포넌트 | 상태 | 포트 | 비고 |
|----------|------|------|------|
| Relay v2 | ✅ 동작 | 8081 | `pnpm dev` |
| Pylon v2 | ✅ 동작 | 9101 | 핵심 기능 완료 |
| Client (Expo) | ✅ 동작 | 10000 | `pnpm dev:client` |

### v1 → v2 마이그레이션 완료 (2026-02-02)

3단계 마이그레이션 완료:
- **Phase 1**: Pylon 핵심 동작 (Claude SDK Adapter, 영속 저장소)
- **Phase 2**: Client 상태 동기화 (MessageType 62개, 메시지 라우터)
- **Phase 3**: 통합 테스트 (1,035개 테스트 통과)

상세: `log/2026-02-02-v2-migration-plan.md`

### 테스트 현황

```
✓ Core:    445 tests
✓ Relay:   100+ tests
✓ Pylon:   497 tests
✓ Client:  179 tests (vitest 118 + jest 61)
─────────────────────
  Total: 1,200+ tests passing
```

---

## 다음 작업

**Phase 3: 배포 시스템 구축**
- [ ] Relay Fly.io 배포
- [ ] Pylon Windows 서비스 등록
- [ ] App 빌드 및 배포

---

## 작업 로그

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
*갱신일: 2026-02-03*
