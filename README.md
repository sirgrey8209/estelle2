# Estelle

> 여러 PC와 모바일에서 Claude Code를 원격 제어하는 시스템

Estelle을 사용하면 PC에서 실행 중인 Claude Code를 어디서든 - 휴대폰, 태블릿, 다른 컴퓨터에서 - 제어할 수 있어요. 모든 기기가 완벽하게 동기화됩니다.

## 아키텍처

```
                         ┌─────────────────┐
                         │  Estelle Relay  │
                         │   (클라우드)     │
                         └────────┬────────┘
                                  │ WebSocket
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
   ┌─────┴─────┐            ┌─────┴─────┐            ┌─────┴─────┐
   │  Pylon    │            │  Pylon    │            │  Client   │
   │  (집 PC)  │            │ (회사 PC) │            │ (모바일)  │
   └───────────┘            └───────────┘            └───────────┘
        │                        │
   Claude Code             Claude Code
```

| 컴포넌트 | 설명 |
|----------|------|
| **Relay** | 클라우드 메시지 라우터 (Fly.io) - 상태 없음, 인증 및 라우팅만 담당 |
| **Pylon** | PC 백그라운드 서비스 - Claude SDK를 통해 Claude Code 세션 관리 |
| **Client** | 웹 앱 (PWA) - 브라우저가 있는 모든 기기에서 동작 |

## 현재 상태

> ⚠️ **주의**: 현재 단일 Pylon 환경에서만 테스트되었습니다. 여러 PC에 Pylon을 설치하는 멀티 Pylon 환경은 아직 테스트되지 않았어요.

## 주요 기능

- **멀티 디바이스 동기화** - 어떤 기기에서든 대화 이어가기
- **실시간 스트리밍** - Claude의 응답을 생성되는 대로 확인
- **파일 전송** - Claude에게 파일 전송, 생성된 파일 수신
- **워크스페이스 관리** - 대화를 워크스페이스로 정리
- **PWA 지원** - 모바일에서 앱처럼 설치 가능

## 기술 스택

- **TypeScript** - 전체 타입 안전성
- **pnpm workspaces** - 모노레포 관리
- **Vitest** - TDD 방식의 빠른 단위 테스트
- **React + Vite** - shadcn/ui를 활용한 모던 웹 클라이언트
- **Claude SDK** - Claude Code와 직접 통합

## 빠른 시작

### 사전 요구사항

- Node.js 20+
- pnpm 8+
- Claude Code CLI 설치

### 설치

```bash
# 저장소 클론
git clone https://github.com/your-username/estelle2.git
cd estelle2

# 의존성 설치
pnpm install

# 전체 패키지 빌드
pnpm build
```

### 개발

```bash
# 개발 서버 시작 (Relay + Pylon + Client)
pnpm dev

# 개발 서버 종료
pnpm dev:stop

# 상태 확인
pnpm dev:status
```

개발 서버가 실행하는 것:
- Relay: `http://localhost:3000`
- Client: `http://localhost:5173`
- Pylon 백그라운드 서비스

### 테스트 실행

```bash
# 전체 테스트
pnpm test

# 특정 패키지 테스트
pnpm --filter @estelle/pylon test

# Watch 모드
pnpm --filter @estelle/core test:watch
```

## 프로젝트 구조

```
estelle2/
├── packages/
│   ├── core/      # 공유 타입 및 메시지 스키마
│   ├── relay/     # Relay 서버 (Fly.io 배포)
│   ├── pylon/     # Pylon 서비스 (Claude SDK 통합)
│   └── client/    # React 웹 클라이언트 (Vite + shadcn/ui)
├── config/        # 환경 설정
├── scripts/       # 빌드 및 배포 스크립트
└── doc/           # 설계 문서
```

## 배포

사용 환경에 따라 두 가지 배포 방식 중 선택하세요:

| 방식 | 설명 | 가이드 |
|------|------|--------|
| **로컬 환경** | PC에서 모든 것을 실행, 같은 PC 브라우저에서만 접속 | [로컬 배포 가이드](doc/deploy-local.md) |
| **원격 환경** | Relay를 클라우드에 배포, 모바일/외부에서도 접속 가능 | [원격 배포 가이드](doc/deploy-remote.md) |

### 빠른 시작 (로컬)

```bash
pnpm dev          # 개발 서버 시작
pnpm dev:stop     # 종료
```

브라우저에서 `http://localhost:5173` 접속

## 설정

`.env.example`을 `.env`로 복사하고 설정하세요:

```bash
cp .env.example .env
```

필수 환경 변수:
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth 클라이언트 ID (인증용)

## 설계 원칙

### Pylon = Single Source of Truth

모든 상태는 Pylon에 있습니다. 클라이언트는 데이터를 직접 수정하지 않고 표시만 합니다.

```
Client → 요청 → Pylon → 처리 → 모든 클라이언트에 브로드캐스트
```

### 순수 함수와 테스트 용이성

- **Relay**: 상태 없음, 라우팅을 위한 순수 함수
- **Pylon**: `handlePacket()`과 `handleClaude()` 메서드를 가진 순수 데이터 클래스
- **모킹 최소화**: 모킹 없이 테스트 가능한 구조 설계

### TDD 워크플로우

1. 실패하는 테스트 작성
2. 테스트를 통과하는 최소 코드 작성
3. 리팩토링
4. 반복

## 기여하기

1. 저장소 포크
2. 기능 브랜치 생성
3. 테스트 먼저 작성 (TDD)
4. 기능 구현
5. Pull Request 제출

## 라이선스

MIT

---

*Claude Code와 함께 만들었습니다*
