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
- **계정 전환** - 회사/개인 Claude 계정 간 전환
- **PWA 지원** - 모바일에서 앱처럼 설치 가능

## 빠른 시작 (Claude Code)

> 이 프로젝트는 Claude Code가 자동으로 설치를 진행합니다.

### 로컬 환경 (같은 PC에서만 접속)

Claude Code에게 요청:
```
Estelle을 로컬 환경으로 설치해줘
```

자세한 내용: [로컬 배포 가이드](doc/deploy-local.md)

### 원격 환경 (모바일/외부 접속)

Claude Code에게 요청:
```
Estelle을 원격 환경으로 설치해줘
```

**사용자가 준비해야 할 것:**
1. Fly.io 계정 (무료)
2. Google Cloud Console에서 OAuth Client ID

자세한 내용: [원격 배포 가이드](doc/deploy-remote.md)

## 계정 전환 설정

여러 Claude 계정(회사/개인)을 사용하려면 각 계정의 토큰을 백업해야 합니다.

### 1. 토큰 생성

각 계정에 대해:
```bash
claude setup-token
```
브라우저에서 해당 계정으로 로그인하면 1년 유효 토큰이 생성됩니다.

### 2. 토큰 백업

```bash
# 회사 계정 로그인 후
cp ~/.claude-release/.credentials.json ~/.claude-credentials/linegames.json

# 개인 계정 로그인 후
cp ~/.claude-release/.credentials.json ~/.claude-credentials/personal.json
```

설정 완료 후 Estelle Settings에서 계정 전환이 가능합니다.

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

## 기술 스택

- **TypeScript** - 전체 타입 안전성
- **pnpm workspaces** - 모노레포 관리
- **Vitest** - TDD 방식의 빠른 단위 테스트
- **React + Vite** - shadcn/ui를 활용한 모던 웹 클라이언트
- **Claude SDK** - Claude Code와 직접 통합

## 개발

### 명령어

```bash
pnpm install      # 의존성 설치
pnpm build        # 전체 빌드
pnpm test         # 테스트 실행
pnpm dev          # 개발 서버 시작
pnpm dev:stop     # 개발 서버 종료
```

### MCP 포트

| 환경 | 포트 |
|------|------|
| dev | 9878 |
| stage | 9877 |
| release | 9876 |

## 설계 원칙

### Pylon = Single Source of Truth

모든 상태는 Pylon에 있습니다. 클라이언트는 데이터를 직접 수정하지 않고 표시만 합니다.

```
Client → 요청 → Pylon → 처리 → 모든 클라이언트에 브로드캐스트
```

### 순수 함수와 테스트 용이성

- **Relay**: 상태 없음, 라우팅을 위한 순수 함수
- **Pylon**: 순수 데이터 클래스, 모킹 없이 테스트 가능

## 라이선스

MIT

---

*Claude Code와 함께 만들었습니다*
