# 원격 환경 배포 가이드

> 이 문서는 Claude Code가 읽고 자동으로 설치를 진행합니다.
> 사용자에게 필요한 정보만 요청하고, 나머지는 자동으로 처리합니다.

## 구조

```
┌─────────────────────────────────────────────────────┐
│              Hetzner 서버 (5.223.72.58)             │
│                                                      │
│  ┌──────────┐    ┌──────────┐                       │
│  │  Pylon   │◄──►│  Relay   │◄────────┐             │
│  │ (PM2)    │    │ (PM2)    │         │             │
│  └──────────┘    └──────────┘         │             │
│       │                               │             │
│  Claude Code                    WebSocket           │
└───────────────────────────────────────┼─────────────┘
                                        │
              ┌─────────────────────────┼────────────┐
              │                         │            │
        ┌─────┴─────┐            ┌─────┴─────┐ ┌────┴────┐
        │  Client   │            │  Client   │ │ Client  │
        │ (브라우저)│            │ (모바일)  │ │ (다른PC)│
        └───────────┘            └───────────┘ └─────────┘
```

**특징:**
- 어디서든 접속 가능 (모바일, 다른 PC)
- Relay + Pylon이 같은 서버에서 실행
- PM2로 프로세스 관리

**필요한 것:**
- Linux 서버 (Ubuntu 20.04+)
- Node.js 20+, pnpm, PM2

---

## Claude Code 설치 지침

### 1단계: 환경 확인 및 설치

```bash
# 필수 프로그램 확인
node --version   # 20+ 필요
pnpm --version   # 8+ 필요
pm2 --version
jq --version     # JSON 파싱용
```

**설치 안내 (필요시):**
- Node.js: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs`
- pnpm: `npm install -g pnpm`
- PM2: `npm install -g pm2`
- jq: `sudo apt install -y jq`

### 2단계: 설정 파일 생성

```bash
# 설정 파일 생성
cp .env.example .env
cp config/environments.example.json config/environments.json
```

**`config/environments.json` 파일의 `release` 섹션 확인:**
```json
{
  "release": {
    "relay": {
      "port": 8080,
      "url": "ws://localhost:8080",
      "pm2Name": "estelle-relay"
    },
    "pylon": {
      "relayUrl": "ws://localhost:8080",
      "pm2Name": "estelle-pylon",
      "mcpPort": 9876
    }
  }
}
```

### 3단계: 빌드 및 배포

```bash
# 의존성 설치
pnpm install

# 배포 (크로스 플랫폼)
pnpm deploy:release
```

**성공 시:**
- PM2로 Relay + Pylon 시작됨
- `pm2 status`로 확인 가능

### 4단계: MCP 서버 연결

Claude Code 설정 파일에 추가:

**설정 파일 위치:**
- `~/.claude/settings.json`

```json
{
  "mcpServers": {
    "estelle": {
      "transport": "tcp",
      "host": "localhost",
      "port": 9876
    }
  }
}
```

> ⚠️ release 환경은 포트 `9876` (dev는 `9878`)

**사용자에게 안내:**
> 브라우저에서 http://{서버IP}:8080 으로 접속하세요.

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

## 원격 배포 (estelle-updater)

### 개요

estelle-updater는 Git 기반 크로스 플랫폼 배포 시스템입니다.
- Windows와 Linux 환경 간 코드 동기화
- WebSocket 기반 실시간 로그 스트리밍
- MCP 도구 또는 CLI로 트리거

### 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Master (5.223.72.58:9900)                │
│  - WebSocket 서버                                            │
│  - 에이전트 관리 및 명령 브로드캐스트                         │
│  - 실시간 로그 수집                                          │
└─────────────────────────────────────────────────────────────┘
          ▲                           ▲
          │ WebSocket                 │ WebSocket
          │                           │
┌─────────┴─────────┐       ┌─────────┴─────────┐
│   Agent (Linux)   │       │  Agent (Windows)  │
│   5.223.72.58     │       │   121.x.x.x       │
└───────────────────┘       └───────────────────┘
```

### 설정

**1. 설정 파일 생성:**

`config/updater.json`:
```json
{
  "masterUrl": "ws://5.223.72.58:9900",
  "whitelist": ["5.223.72.58", "YOUR_IP"]
}
```

> ⚠️ `whitelist`에 연결을 허용할 모든 IP를 추가하세요.

**2. 빌드:**

```bash
pnpm install
pnpm --filter @estelle/updater build
```

**3. PM2로 실행:**

```bash
pm2 start packages/updater/start.cjs --name estelle-updater
pm2 save
```

> ⚠️ ESM 모듈 호환성을 위해 `start.cjs` wrapper를 사용합니다.

**4. 역할 자동 감지:**

- 로컬 IP가 `masterUrl`의 IP와 일치하면 → **Master** 모드로 시작
- 일치하지 않으면 → **Agent** 모드로 시작 (Master에 자동 연결)

### 사용법

**MCP 도구:**
```typescript
update({ target: 'all', branch: 'master' })
update({ target: '121.x.x.x', branch: 'hotfix' })
```

**CLI:**
```bash
npx estelle-updater trigger all master
npx estelle-updater trigger 5.223.72.58 hotfix
```

### 동작 방식

1. 명령 수신
2. `git fetch && git checkout {branch} && git pull`
3. `pnpm deploy:release` 자동 실행
4. 실시간 로그 스트리밍
5. 완료/실패 알림

### 상태 확인

```bash
pm2 show estelle-updater    # 프로세스 상태
pm2 logs estelle-updater    # 실시간 로그
```

---

## 운영 관리

### PM2 관리

```bash
pm2 status                    # 전체 상태 확인
pm2 logs estelle-pylon        # Pylon 로그 보기
pm2 logs estelle-relay        # Relay 로그 보기
pm2 restart all               # 전체 재시작
```

### 업데이트 배포

```bash
# 크로스 플랫폼 (Linux/Windows 모두)
pnpm deploy:release
```

**MCP를 통한 배포:**
Claude Code에서 `deploy` MCP 도구를 사용하면 자동 배포됩니다.
배포는 detached 프로세스로 실행되어 Pylon 재시작 후에도 계속됩니다.

---

## 모바일 PWA 설치

**사용자에게 안내:**

**iPhone (Safari):**
1. Safari로 `http://{서버IP}:8080` 접속
2. 공유 버튼 (□↑) → "홈 화면에 추가"

**Android (Chrome):**
1. Chrome으로 접속
2. 메뉴(⋮) → "홈 화면에 추가"

---

## 문제 해결

| 문제 | 해결 |
|------|------|
| PM2 서비스 안 뜸 | `pm2 logs` 로 에러 확인 |
| WebSocket 연결 실패 | `pm2 status`로 Relay 상태 확인 |
| MCP 연결 실패 | Pylon 실행 여부 및 포트 확인 |
| 배포 실패 | `release-data/logs/build-*.log` 확인 |
| 계정 전환 안됨 | 백업 파일 존재 여부 확인 |
