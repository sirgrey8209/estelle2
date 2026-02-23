# 원격 환경 배포 가이드

> 이 문서는 Claude Code가 읽고 자동으로 설치를 진행합니다.
> 사용자에게 필요한 정보만 요청하고, 나머지는 자동으로 처리합니다.

## 구조

```
                    ┌─────────────────┐
                    │  Estelle Relay  │
                    │   (Fly.io)      │
                    └────────┬────────┘
                             │ WebSocket (WSS)
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────┴─────┐  ┌─────┴─────┐  ┌─────┴─────┐
        │  Pylon    │  │  Client   │  │  Client   │
        │ (로컬 PC) │  │ (브라우저)│  │ (모바일)  │
        └───────────┘  └───────────┘  └───────────┘
              │
         Claude Code
```

**특징:**
- 어디서든 접속 가능 (모바일, 다른 PC)
- HTTPS/WSS 보안 연결
- Google OAuth 인증

**필요한 것:**
- Fly.io 계정 (무료)
- Google Cloud Console 프로젝트 (무료)

---

## Claude Code 설치 지침

### 1단계: 환경 확인 및 설치

```bash
# 필수 프로그램 확인
node --version   # 20+ 필요
pnpm --version   # 8+ 필요
pm2 --version
fly version
```

**설치 안내 (필요시):**
- Node.js: "https://nodejs.org/ 에서 LTS 버전 설치"
- pnpm: `npm install -g pnpm`
- PM2: `npm install -g pm2`
- Fly.io CLI: "https://fly.io/docs/flyctl/install/ 참고"

### 2단계: 사용자 정보 요청

**사용자에게 요청:**

1. **Fly.io 앱 이름** (전 세계 고유해야 함)
   > "Fly.io 앱 이름을 입력해주세요 (예: my-estelle-relay):"

2. **Google OAuth Client ID**
   > "Google Cloud Console에서 OAuth Client ID를 생성하고 입력해주세요."
   >
   > 생성 방법:
   > 1. https://console.cloud.google.com/ 접속
   > 2. APIs & Services → Credentials → Create Credentials → OAuth client ID
   > 3. Application type: Web application
   > 4. Authorized JavaScript origins에 `https://{앱이름}.fly.dev` 추가
   > 5. Client ID 복사 (형식: `123456789-xxx.apps.googleusercontent.com`)

### 3단계: Fly.io 앱 생성

```bash
# Fly.io 로그인 (브라우저 열림)
fly auth login

# 앱 생성
fly apps create {사용자가_입력한_앱이름}
```

### 4단계: 설정 파일 생성 및 수정

```bash
# 설정 파일 생성
# Windows
copy .env.example .env
copy config\environments.example.json config\environments.json

# Mac/Linux
cp .env.example .env
cp config/environments.example.json config/environments.json
```

**`.env` 파일 수정:**
```env
VITE_GOOGLE_CLIENT_ID={사용자가_입력한_Client_ID}
GOOGLE_CLIENT_ID={사용자가_입력한_Client_ID}
```

**`config/environments.json` 파일의 `release` 섹션 수정:**
```json
{
  "release": {
    "relay": {
      "url": "wss://{앱이름}.fly.dev",
      "flyApp": "{앱이름}"
    }
  }
}
```

### 5단계: 빌드 및 배포

```bash
# 의존성 설치
pnpm install

# 배포 (PowerShell)
.\scripts\build-deploy.ps1 -Target release
```

**성공 시:**
- Fly.io에 Relay 배포 완료
- PM2로 Pylon 시작됨

### 6단계: MCP 서버 연결

Claude Code 설정 파일에 추가:

**설정 파일 위치:**
- Windows: `%USERPROFILE%\.claude\settings.json`
- Mac/Linux: `~/.claude/settings.json`

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
> 브라우저에서 https://{앱이름}.fly.dev 로 접속하세요.
> Google 계정으로 로그인하면 Estelle을 사용할 수 있습니다.

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
cp ~/.claude-release/.credentials.json ~/.claude-credentials/linegames.json

# 개인 계정 로그인 후
cp ~/.claude-release/.credentials.json ~/.claude-credentials/personal.json
```

설정 완료 후 Estelle 앱의 Settings에서 계정 전환이 가능합니다.

---

## 운영 관리

### Pylon (PM2)

```bash
pm2 status                    # 상태 확인
pm2 logs estelle-pylon        # 로그 보기
pm2 restart estelle-pylon     # 재시작
```

### Relay (Fly.io)

```bash
fly status -a {앱이름}        # 상태 확인
fly logs -a {앱이름}          # 로그 보기
```

### 업데이트 배포

```powershell
.\scripts\build-deploy.ps1 -Target release
```

---

## 모바일 PWA 설치

**사용자에게 안내:**

**iPhone (Safari):**
1. Safari로 `https://{앱이름}.fly.dev` 접속
2. 공유 버튼 (□↑) → "홈 화면에 추가"

**Android (Chrome):**
1. Chrome으로 접속
2. 메뉴(⋮) → "홈 화면에 추가"

---

## 문제 해결

| 문제 | 해결 |
|------|------|
| Fly.io 배포 실패 | `fly logs -a {앱이름}` 으로 로그 확인 |
| Google 로그인 안됨 | Authorized JavaScript origins에 URL 확인 |
| WebSocket 연결 실패 | Fly.io 앱 상태, PM2 상태 확인 |
| 계정 전환 안됨 | 백업 파일 존재 여부 확인 |

---

## 비용

- **Fly.io**: 무료 티어로 충분 (3개 VM, 256MB RAM)
- **Google OAuth**: 완전 무료
