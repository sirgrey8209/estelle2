# 원격 환경 배포 가이드

> Relay를 클라우드(Fly.io)에 배포하고, 로컬 PC + 모바일에서 접속하는 구조

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

**장점:**
- 어디서든 접속 가능 (모바일, 다른 PC)
- HTTPS/WSS 보안 연결
- 안정적인 클라우드 호스팅

**필요한 것:**
- Fly.io 계정 (무료)
- Google Cloud Console 프로젝트 (무료)

---

## 사전 준비

> ⚠️ 이 가이드는 [로컬 배포 가이드](./deploy-local.md)의 **1단계 필수 프로그램 설치**가 완료되었다고 가정합니다. 아직 안 했다면 먼저 진행해주세요.

---

## 1단계: PM2 설치

PM2는 Pylon을 백그라운드에서 안정적으로 실행해주는 프로세스 관리자예요.

### 1-1. PM2 설치

명령 프롬프트 또는 PowerShell에서:

```bash
npm install -g pm2
```

### 1-2. 설치 확인

```bash
pm2 --version
```

`5.x.x` 같은 버전이 나오면 성공!

---

## 2단계: Fly.io 설정

Fly.io는 Relay를 호스팅할 클라우드 서비스예요. 무료 티어로 충분합니다.

### 2-1. Fly.io 계정 만들기

1. https://fly.io/ 접속
2. **Get Started** 또는 **Sign Up** 클릭
3. GitHub 또는 이메일로 회원가입
4. 이메일 인증 완료

### 2-2. Fly.io CLI 설치

**PowerShell을 관리자 권한으로 실행** (시작 메뉴에서 PowerShell 우클릭 → 관리자 권한으로 실행)

```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

설치 완료 후 **PowerShell을 닫고 새로 열기**

### 2-3. 설치 확인

```bash
fly version
```

버전 정보가 나오면 성공!

### 2-4. Fly.io 로그인

```bash
fly auth login
```

브라우저가 열리면 Fly.io 계정으로 로그인하세요.

### 2-5. Fly.io 앱 만들기

```bash
fly apps create my-estelle-relay
```

> ⚠️ `my-estelle-relay` 부분을 원하는 이름으로 변경하세요. 이 이름은 전 세계에서 고유해야 합니다!
>
> 예: `estelle-홍길동`, `my-claude-remote` 등

**성공 메시지:**
```
New app created: my-estelle-relay
```

---

## 3단계: Google OAuth 설정

외부에서 접속할 때 본인만 사용할 수 있도록 Google 로그인 인증을 설정해요.

### 3-1. Google Cloud Console 접속

1. https://console.cloud.google.com/ 접속
2. Google 계정으로 로그인
3. 이용약관 동의

### 3-2. 새 프로젝트 만들기

1. 화면 상단의 프로젝트 선택 드롭다운 클릭
2. **새 프로젝트** 클릭
3. 프로젝트 이름 입력: `Estelle` (원하는 이름 가능)
4. **만들기** 클릭
5. 프로젝트 생성까지 잠시 대기 (30초~1분)

### 3-3. OAuth 동의 화면 설정

1. 왼쪽 메뉴에서 **APIs & Services** → **OAuth consent screen** 클릭
2. User Type: **External** 선택 → **만들기**
3. 앱 정보 입력:
   - **앱 이름**: `Estelle`
   - **사용자 지원 이메일**: 본인 이메일 선택
   - **개발자 연락처 정보**: 본인 이메일 입력
4. **저장 후 계속** 클릭
5. Scopes 페이지: 그냥 **저장 후 계속** 클릭
6. Test users 페이지: **저장 후 계속** 클릭
7. Summary 페이지: **대시보드로 돌아가기** 클릭

### 3-4. OAuth 클라이언트 ID 만들기

1. 왼쪽 메뉴에서 **APIs & Services** → **Credentials** 클릭
2. 상단의 **+ CREATE CREDENTIALS** → **OAuth client ID** 클릭
3. Application type: **Web application** 선택
4. 이름: `Estelle Web Client` (원하는 이름 가능)
5. **Authorized JavaScript origins** 섹션에서 **+ ADD URI** 클릭
6. URI 입력: `https://my-estelle-relay.fly.dev`
   > ⚠️ `my-estelle-relay`를 2-5단계에서 만든 앱 이름으로 변경하세요!
7. **만들기** 클릭

### 3-5. Client ID 복사

생성 완료 화면에서 **Client ID**를 복사해두세요.

형식: `123456789-xxxxxxxxxxxx.apps.googleusercontent.com`

> 💡 나중에 다시 보려면: Credentials 페이지 → OAuth 2.0 Client IDs 목록에서 확인 가능

---

## 4단계: Estelle 설정

### 4-1. 프로젝트 다운로드 (아직 안 했다면)

```bash
git clone https://github.com/your-username/estelle.git
cd estelle
pnpm install
```

### 4-2. 환경 변수 설정

**Windows (명령 프롬프트):**
```bash
copy .env.example .env
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

### 4-3. .env 파일 수정

메모장으로 `.env` 파일을 열고 수정:

```env
VITE_GOOGLE_CLIENT_ID=여기에-3-5단계에서-복사한-Client-ID-붙여넣기
GOOGLE_CLIENT_ID=여기에-3-5단계에서-복사한-Client-ID-붙여넣기
```

예시:
```env
VITE_GOOGLE_CLIENT_ID=123456789-xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_ID=123456789-xxxxxxxxxxxx.apps.googleusercontent.com
```

### 4-4. 환경 설정 파일 수정

메모장으로 `config/environments.json` 파일을 열고 수정:

`your-estelle-relay` 부분을 2-5단계에서 만든 앱 이름으로 변경:

```json
{
  "release": {
    "relay": {
      "url": "wss://my-estelle-relay.fly.dev",
      "flyApp": "my-estelle-relay"
    },
    "pylon": {
      "pm2Name": "estelle-pylon"
    }
  }
}
```

> ⚠️ `my-estelle-relay`를 본인이 만든 앱 이름으로 변경하세요!

---

## 5단계: 빌드 및 배포

### 5-1. 배포 실행

PowerShell에서 estelle 폴더로 이동 후:

```powershell
.\scripts\build-deploy.ps1 -Target release
```

이 명령어가 자동으로 수행하는 작업:
1. ✅ 프로젝트 빌드
2. ✅ Fly.io에 Relay 배포
3. ✅ PM2로 Pylon 시작

**소요 시간:** 약 3-5분

### 5-2. 배포 확인

```bash
fly status -a my-estelle-relay
```

`deployed` 상태가 보이면 성공!

```bash
pm2 status
```

`estelle-pylon`이 `online` 상태면 성공!

---

## 6단계: 접속하기

### 6-1. PC 브라우저에서 접속

브라우저를 열고:

```
https://my-estelle-relay.fly.dev
```

> `my-estelle-relay`를 본인이 만든 앱 이름으로 변경하세요!

1. Google 로그인 버튼 클릭
2. 본인 Google 계정으로 로그인
3. Estelle 화면이 나타나면 성공!

### 6-2. 모바일에서 접속 (PWA 설치)

**iPhone (Safari):**
1. Safari로 `https://my-estelle-relay.fly.dev` 접속
2. Google 로그인
3. 하단 공유 버튼 (□↑) 탭
4. **"홈 화면에 추가"** 선택
5. **"추가"** 탭

**Android (Chrome):**
1. Chrome으로 `https://my-estelle-relay.fly.dev` 접속
2. Google 로그인
3. 상단에 나타나는 **"앱 설치"** 배너 탭
4. 또는: 메뉴(⋮) → **"홈 화면에 추가"**

이제 홈 화면에서 앱처럼 실행할 수 있어요!

---

## 7단계: Claude Code 연결

### 7-1. 설정 파일 위치

**Windows:** `C:\Users\{사용자이름}\.claude\claude_desktop_config.json`

### 7-2. 설정 파일 수정

메모장으로 열고 다음 내용 추가:

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

> 💡 release 환경에서는 포트 `9876`을 사용합니다 (로컬 환경의 `9878`과 다름).

### 7-3. Claude Code 재시작

Claude Code를 완전히 종료 후 다시 실행하면 Estelle이 연결됩니다.

---

## 운영 관리

### Pylon 관리 (PM2)

```bash
# 상태 확인
pm2 status

# 로그 보기 (실시간)
pm2 logs estelle-pylon

# 재시작
pm2 restart estelle-pylon

# 중지
pm2 stop estelle-pylon
```

### Relay 관리 (Fly.io)

```bash
# 상태 확인
fly status -a my-estelle-relay

# 로그 보기
fly logs -a my-estelle-relay
```

### 업데이트 배포

코드를 수정한 후 다시 배포:

```powershell
.\scripts\build-deploy.ps1 -Target release
```

---

## 문제 해결

### "fly를 찾을 수 없습니다" 오류

Fly.io CLI 설치 후 PowerShell을 새로 열어야 합니다.

### Fly.io 배포 실패

```bash
# 로그 확인
fly logs -a my-estelle-relay
```

### Google 로그인이 안 됨

1. Google Cloud Console에서 **Authorized JavaScript origins**에 올바른 URL이 있는지 확인
2. URL이 `https://`로 시작하는지 확인
3. 앱 이름이 정확한지 확인
4. 브라우저 캐시/쿠키 삭제 후 재시도

### 모바일에서 접속 안 됨

1. 주소가 `https://`로 시작하는지 확인 (http는 안 됨)
2. 모바일 네트워크에서 해당 사이트에 접근 가능한지 확인
3. Wi-Fi와 모바일 데이터 모두 시도

### WebSocket 연결 실패

1. Fly.io 앱 상태 확인: `fly status -a my-estelle-relay`
2. PM2 상태 확인: `pm2 status`
3. 둘 다 정상이면 몇 분 후 재시도 (배포 직후 연결 지연 가능)

---

## 비용 안내

### Fly.io

- **무료 티어**: 3개의 공유 CPU VM, 256MB RAM
- Estelle Relay는 매우 가벼워서 **무료 티어로 충분**합니다
- 신용카드 등록 필요 없음 (무료 범위 내 사용 시)

### Google OAuth

- **완전 무료**
- API 호출 제한이 있지만 개인 사용에는 충분

---

## 다음 단계

- 로컬에서만 테스트하고 싶다면 [로컬 배포 가이드](./deploy-local.md)를 참고하세요
- 문제가 발생하면 GitHub Issues에 질문해주세요
