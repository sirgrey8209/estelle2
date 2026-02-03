# Phase 1: 로컬 개발 환경 안정화 (완료)

## 목표

누구나 쉽게 로컬에서 Relay / Pylon / App을 실행할 수 있는 환경 구축

---

## 완료된 작업

### 1. 환경 설정 표준화

- [x] 포트 번호 확정
  - Relay: 8081
  - Pylon Local: 9001
  - App Dev Server: 10000

- [x] `.env` 파일 생성 (루트 레벨)
  - `PYLON_TOKENS` - Pylon 인증 토큰
  - `FLUTTER_PATH` - Flutter SDK 경로

- [x] 환경변수 로딩 방식 통일
  - dotenv 사용
  - cross-env로 개별 패키지 실행 시 환경변수 전달

### 2. 실행 스크립트 정비

- [x] **package.json scripts**
  ```json
  // root package.json
  "scripts": {
    "dev": "node scripts/dev-server.js start",
    "dev:stop": "node scripts/dev-server.js stop",
    "dev:status": "node scripts/dev-server.js status",
    "dev:restart": "node scripts/dev-server.js restart",
    "dev:relay": "pnpm --filter @estelle/relay dev",
    "dev:pylon": "pnpm --filter @estelle/pylon dev"
  }
  ```

### 3. 올인원 실행 유틸리티

- [x] **`scripts/dev-server.js` 구현**
  - `pnpm dev` - Relay + Pylon + Flutter 앱 동시 실행
  - `pnpm dev:stop` - 전체 종료 (Flutter 터미널 포함)
  - `pnpm dev:status` - 실행 상태 확인
  - `pnpm dev:restart` - 재시작

- [x] **프로세스 관리**
  - PID 파일로 프로세스 추적 (`.dev-server.pid`)
  - tree-kill로 자식 프로세스까지 정리
  - Windows: PowerShell로 Flutter 터미널 PID 추적

- [x] **개별 실행 지원**
  - `pnpm dev:relay` - Relay만
  - `pnpm dev:pylon` - Pylon만

### 4. CLAUDE.md 문서화

- [x] 개발 서버 섹션 추가
  - 명령어 목록
  - 포트 구성
  - 환경변수 설명

---

## 구현 세부사항

### dev-server.js 주요 기능

1. **시작**: Relay와 Pylon은 현재 터미널에서 실행, Flutter는 새 터미널
2. **종료**: 저장된 PID로 모든 프로세스 종료
3. **로그**: `[relay]`, `[pylon]` prefix로 구분

### Windows 특수 처리

- PowerShell `Start-Process -PassThru`로 Flutter 터미널 PID 획득
- `-d web-server`로 브라우저 자동 실행 방지

---

## 테스트 결과

```
pnpm dev
  → Relay 8081 시작
  → Pylon 9001 시작
  → Flutter 터미널 새 창에서 10000 포트로 시작

pnpm dev:stop
  → Relay, Pylon, Flutter 모두 종료
  → Flutter 터미널 창도 자동으로 닫힘
```

---

*완료일: 2026-01-31*
