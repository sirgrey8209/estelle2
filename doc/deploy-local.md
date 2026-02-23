# 로컬 환경 배포 가이드

> PC에서 Relay를 로컬로 실행하고, 같은 PC의 브라우저에서 접속하는 구조

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

**장점:**
- 외부 서비스 가입 불필요 (Google OAuth 없이 동작)
- 네트워크 설정 불필요
- 빠른 시작 가능

**제한:**
- 같은 PC에서만 접속 가능
- 모바일 접속 불가

> 💡 **로컬 환경에서는 Google 로그인이 필요 없어요!** `.env` 파일에 `VITE_GOOGLE_CLIENT_ID`를 설정하지 않으면 자동으로 로그인 화면 없이 바로 사용할 수 있습니다.

---

## 1단계: 필수 프로그램 설치

### 1-1. Node.js 설치

Node.js는 JavaScript를 실행하는 프로그램이에요.

1. https://nodejs.org/ 접속
2. **LTS** 버전 다운로드 (왼쪽 초록색 버튼)
3. 다운로드된 설치 파일 실행
4. 설치 중 모든 옵션은 기본값으로 **Next** 클릭
5. 설치 완료

**설치 확인:**

Windows: `Win + R` → `cmd` 입력 → 확인

```bash
node --version
```

`v20.x.x` 이상이 나오면 성공!

### 1-2. pnpm 설치

pnpm은 프로젝트 의존성을 관리하는 도구예요.

명령 프롬프트(cmd) 또는 PowerShell에서:

```bash
npm install -g pnpm
```

**설치 확인:**

```bash
pnpm --version
```

`8.x.x` 이상이 나오면 성공!

### 1-3. Git 설치

Git은 코드를 다운로드하는 도구예요.

1. https://git-scm.com/download/win 접속
2. **Click here to download** 클릭
3. 다운로드된 설치 파일 실행
4. 설치 중 모든 옵션은 기본값으로 **Next** 클릭
5. 설치 완료

**설치 확인:**

새 명령 프롬프트를 열고:

```bash
git --version
```

`git version 2.x.x` 가 나오면 성공!

### 1-4. Claude Code CLI 설치

Claude Code는 Anthropic의 AI 코딩 어시스턴트예요.

```bash
npm install -g @anthropic-ai/claude-code
```

설치 후 로그인:

```bash
claude login
```

브라우저가 열리면 Anthropic 계정으로 로그인하세요.

---

## 2단계: Estelle 다운로드

### 2-1. 프로젝트 다운로드

원하는 폴더에서 명령 프롬프트를 열고:

```bash
git clone https://github.com/your-username/estelle.git
```

### 2-2. 프로젝트 폴더로 이동

```bash
cd estelle
```

> 💡 **팁**: 파일 탐색기에서 estelle 폴더를 열고, 주소창에 `cmd`를 입력하면 해당 위치에서 명령 프롬프트가 열려요.

---

## 3단계: 프로젝트 설정

### 3-1. 의존성 설치

estelle 폴더에서:

```bash
pnpm install
```

여러 패키지가 설치되며 시간이 좀 걸릴 수 있어요 (1-3분).

### 3-2. 환경 설정 파일 복사

**Windows (명령 프롬프트):**
```bash
copy .env.example .env
```

**Windows (PowerShell):**
```bash
Copy-Item .env.example .env
```

> 💡 로컬 환경에서는 `.env` 파일을 수정하지 않아도 됩니다. `VITE_GOOGLE_CLIENT_ID`가 비어있으면 Google 로그인 없이 바로 사용할 수 있어요!

### 3-3. 프로젝트 빌드

```bash
pnpm build
```

빌드가 완료되면 준비 끝!

---

## 4단계: Estelle 실행

### 4-1. 서버 시작

```bash
pnpm dev
```

다음과 같은 메시지가 나타나면 성공:

```
[Relay] Server started on http://localhost:3000
[Pylon] Started
[Client] Local: http://localhost:5173
```

### 4-2. 브라우저에서 접속

브라우저를 열고 주소창에 입력:

```
http://localhost:5173
```

Estelle 화면이 나타나면 성공!

---

## 5단계: 서버 관리

### 서버 상태 확인

새 명령 프롬프트를 열고:

```bash
cd estelle
pnpm dev:status
```

### 서버 종료

```bash
pnpm dev:stop
```

### 서버 재시작

```bash
pnpm dev:restart
```

---

## 6단계: Claude Code와 연결

Estelle을 Claude Code의 MCP 서버로 연결하면, Claude가 Estelle을 통해 파일을 전송하거나 배포할 수 있어요.

### 6-1. 설정 파일 위치 찾기

**Windows:** `C:\Users\{사용자이름}\.claude\` 폴더

### 6-2. 설정 파일 수정

`claude_desktop_config.json` 파일을 메모장으로 열고 다음 내용 추가:

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

> ⚠️ 기존 내용이 있다면 `mcpServers` 안에 `"estelle": {...}` 부분만 추가하세요.

### 6-3. Claude Code 재시작

Claude Code를 껐다가 다시 켜면 Estelle이 연결됩니다.

---

## 문제 해결

### "node를 찾을 수 없습니다" 오류

Node.js 설치 후 명령 프롬프트를 새로 열어야 합니다.

### "pnpm을 찾을 수 없습니다" 오류

```bash
npm install -g pnpm
```

실행 후 명령 프롬프트를 새로 여세요.

### 포트 3000이 이미 사용 중

다른 프로그램이 3000 포트를 사용 중일 수 있어요.

**확인 방법:**
```bash
netstat -ano | findstr :3000
```

**해결 방법:**
해당 프로그램을 종료하거나, Estelle을 재시작하세요.

### 브라우저에서 접속이 안 됨

1. 서버가 실행 중인지 확인: `pnpm dev:status`
2. 주소가 정확한지 확인: `http://localhost:5173` (https가 아닌 http)
3. 방화벽에서 차단하는지 확인

### Claude Code 연결 실패

1. Estelle 서버가 실행 중인지 확인
2. 설정 파일의 JSON 형식이 올바른지 확인 (쉼표, 중괄호 등)
3. Claude Code를 완전히 종료 후 재시작

---

## 다음 단계

모바일에서도 접속하고 싶다면 [원격 배포 가이드](./deploy-remote.md)를 참고하세요.
