# 로컬 환경 배포 가이드

> 이 문서는 Claude Code가 읽고 자동으로 설치를 진행합니다.
> 사용자에게 필요한 정보만 요청하고, 나머지는 자동으로 처리합니다.

## 구조

```
┌─────────────────────────────────────────────────┐
│                    로컬 PC                       │
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  Pylon   │◄──►│  Relay   │◄──►│  Client  │  │
│  │          │    │ :3000    │    │  :5173   │  │
│  └──────────┘    └──────────┘    └──────────┘  │
│       │                              ▲          │
│  Claude Code                     브라우저       │
└─────────────────────────────────────────────────┘
```

**특징:**
- 외부 서비스 가입 불필요
- Google OAuth 없이 동작
- 같은 PC에서만 접속 가능

---

## Claude Code 설치 지침

### 1단계: 환경 확인 및 설치

다음 명령어로 필수 프로그램 설치 여부를 확인하고, 없으면 사용자에게 안내:

```bash
# Node.js 확인 (20+ 필요)
node --version

# pnpm 확인 (8+ 필요)
pnpm --version

# PM2 확인
pm2 --version
```

**설치 안내 메시지 (필요시):**
- Node.js 없음: "Node.js 20 이상이 필요합니다. https://nodejs.org/ 에서 LTS 버전을 설치해주세요."
- pnpm 없음: "pnpm을 설치합니다: `npm install -g pnpm`"
- PM2 없음: "PM2를 설치합니다: `npm install -g pm2`"

### 2단계: 프로젝트 설정

```bash
# 의존성 설치
pnpm install

# 설정 파일 생성
# Windows
copy .env.example .env
copy config\environments.example.json config\environments.json
# Mac/Linux
cp .env.example .env
cp config/environments.example.json config/environments.json

# 빌드
pnpm build
```

### 3단계: 개발 서버 시작

```bash
pnpm dev
```

**성공 시 출력:**
```
========================================
  Estelle v2 Development Server
========================================

  Relay:  ws://localhost:3000
  Client: http://localhost:5173
========================================
```

**사용자에게 안내:**
> 브라우저에서 http://localhost:5173 으로 접속하세요.

### 4단계: MCP 서버 연결

Claude Code 설정 파일에 Estelle MCP 서버 추가:

**설정 파일 위치:**
- Windows: `%USERPROFILE%\.claude\settings.json`
- Mac/Linux: `~/.claude/settings.json`

**추가할 내용:**
```json
{
  "mcpServers": {
    "estelle": {
      "transport": "tcp",
      "host": "localhost",
      "port": 9878
    }
  }
}
```

---

## 서버 관리 명령어

```bash
pnpm dev          # 시작
pnpm dev:stop     # 종료
pnpm dev:status   # 상태 확인
pnpm dev:restart  # 재시작
pnpm dev:logs     # 로그 보기
```

---

## 계정 전환 설정 (선택)

여러 Claude 계정을 사용하려면 각 계정의 인증 토큰을 백업해둬야 합니다.

### 토큰 생성 방법

**사용자에게 안내:**
> 각 Claude 계정에 대해 다음을 수행하세요:
>
> 1. `claude setup-token` 실행
> 2. 브라우저에서 해당 계정으로 로그인
> 3. 생성된 토큰 복사
>
> 이 토큰은 1년간 유효합니다.

### 토큰 백업

각 계정의 `.credentials.json` 파일을 백업 디렉토리에 저장:

```
~/.claude-credentials/
├── linegames.json   # 회사 계정
└── personal.json    # 개인 계정
```

**백업 방법:**
```bash
# 회사 계정 로그인 후
cp ~/.claude/.credentials.json ~/.claude-credentials/linegames.json

# 개인 계정 로그인 후
cp ~/.claude/.credentials.json ~/.claude-credentials/personal.json
```

설정 완료 후 Estelle 앱의 Settings에서 계정 전환이 가능합니다.

---

## 문제 해결

| 문제 | 해결 |
|------|------|
| 포트 3000 사용 중 | `netstat -ano \| findstr :3000` 으로 확인 후 해당 프로세스 종료 |
| 브라우저 접속 안됨 | `pnpm dev:status`로 서버 상태 확인 |
| MCP 연결 실패 | Estelle 서버 실행 확인, Claude Code 재시작 |

---

## 배포 스크립트

개발 환경에서 stage/release로 배포할 때:

```bash
# Stage 배포
pnpm deploy:stage

# Release 배포
pnpm deploy:release
```

> 배포 스크립트는 크로스 플랫폼으로 Windows/Linux 모두 지원합니다.

---

## 다음 단계

서버 환경에서 운영하려면 [원격 배포 가이드](./deploy-remote.md)를 참고하세요.
