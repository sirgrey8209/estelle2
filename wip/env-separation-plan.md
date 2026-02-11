# 환경 분리 통합 계획

## 상태
🚧 진행 중

## 배경

두 가지 분리 요구사항을 통합 해결:
1. **계정 분리**: 회사/개인 Claude 구독 계정
2. **환경 분리**: dev/stage/release Pylon 환경

---

## 최종 구조

### 환경별 CLAUDE_CONFIG_DIR

각 Pylon 환경마다 별도의 config 디렉토리 사용:

```
~/.claude-dev/                  ← dev Pylon 전용
    ├── .credentials.json       ← 스왑 대상
    └── projects/               ← 세션 데이터

~/.claude-stage/                ← stage Pylon 전용
    ├── .credentials.json
    └── projects/

~/.claude-release/              ← release Pylon 전용 (또는 기본 ~/.claude/)
    ├── .credentials.json
    └── projects/
```

### 계정 인증 백업

```
~/.claude-credentials/          ← 인증 백업 (전체 공유)
    ├── linegames.json          ← 회사 계정
    └── personal.json           ← 개인 계정
```

### 스왑 동작 흐름

```
1. 설정창에서 [LineGames] ↔ [Personal] 토글
2. Client → Pylon: ACCOUNT_SWITCH 메시지 전송
3. Pylon → 모든 SDK 세션 abort
4. Pylon → 해당 환경의 .credentials.json 파일 교체
5. Pylon → Client: ACCOUNT_STATUS 메시지 전송 (새 계정 정보)
6. 다음 대화 입력 시 resume (세션 유지!)
```

**장점:**
- ✅ 같은 Pylon 내에서 세션 데이터 공유 → Resume 가능
- ✅ 히스토리, 설정 모두 공유
- ✅ 구현 간단

**제약:**
- ⚠️ 같은 Pylon 내에서 동시에 두 계정 사용 불가
- ⚠️ 다른 환경(dev/stage/release) 간에는 세션 공유 안 됨

### MCP 서버 (esbuild로 3벌 빌드)

| 환경 | TCP 포트 | 빌드 출력 |
|------|----------|-----------|
| dev | 9876 | `packages/pylon/dist/mcp/server.js` |
| stage | 9877 | `release-stage/pylon/dist/mcp/server.js` |
| release | 9878 | `release/pylon/dist/mcp/server.js` |

### Pylon 환경 설정

| 환경 | 실행 방식 | CLAUDE_CONFIG_DIR | MCP TCP 포트 |
|------|----------|-------------------|--------------|
| dev | `pnpm dev` | `~/.claude-dev/` | 9876 |
| stage | PM2 `estelle-pylon-stage` | `~/.claude-stage/` | 9877 |
| release | PM2 `estelle-pylon` | `~/.claude-release/` | 9878 |

---

## Phase 1: Client 설정창 정리

### 1.1 기존 설정 컴포넌트 제거

**삭제할 파일:**
- `packages/client/src/components/settings/ClaudeUsageCard.tsx`
- `packages/client/src/components/settings/DeploySection.tsx`
- `packages/client/src/components/settings/DeployStatusCard.tsx`
- `packages/client/src/components/settings/AppUpdateSection.tsx`

**수정할 파일:**
- `packages/client/src/components/settings/SettingsScreen.tsx`
  - 기존 컴포넌트 import 제거
  - 새 `AccountSection` 컴포넌트로 교체

**settingsStore 정리:**
- `packages/client/src/stores/settingsStore.ts`
  - 사용하지 않는 상태 제거: `usageSummary`, `isLoadingUsage`, `usageError`, `deployPhase`, `deployLogs`, `buildTasks`, `versionInfo` 등
  - 새 상태 추가: `currentAccount`, `isAccountSwitching`

### 1.2 계정 선택 UI 추가

**새 파일 생성:**
- `packages/client/src/components/settings/AccountSection.tsx`

**UI 구조:**
```
┌─────────────────────────────────────┐
│  🔐 계정                            │
├─────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐   │
│  │ [LineGames] │ │  Personal   │   │
│  └─────────────┘ └─────────────┘   │
│                                     │
│  현재: LineGames (team)             │
│  ⚠️ 계정 변경 시 모든 세션이        │
│     재시작됩니다                    │
└─────────────────────────────────────┘
```

**동작:**
1. 버튼 클릭 시 `requestAccountSwitch('linegames' | 'personal')` 호출
2. Pylon에 `ACCOUNT_SWITCH` 메시지 전송
3. 응답 대기 중 로딩 표시
4. 완료 시 UI 업데이트

### 1.3 메시지 타입 정의 (@estelle/core)

**수정할 파일:**
- `packages/core/src/constants/message-type.ts`

**추가할 메시지 타입:**
```typescript
// === Account ===
/** 계정 전환 요청 */
ACCOUNT_SWITCH: 'account_switch',
/** 계정 상태 알림 */
ACCOUNT_STATUS: 'account_status',
```

**새 파일 생성:**
- `packages/core/src/types/account.ts`

```typescript
/**
 * 계정 타입
 */
export type AccountType = 'linegames' | 'personal';

/**
 * 계정 전환 요청 페이로드
 */
export interface AccountSwitchPayload {
  account: AccountType;
}

/**
 * 계정 상태 페이로드
 */
export interface AccountStatusPayload {
  current: AccountType;
  subscriptionType?: string;  // 'team', 'max' 등
}
```

**index.ts 업데이트:**
- `packages/core/src/types/index.ts`에 export 추가

---

## Phase 2: Pylon 계정 스왑 기능

### 2.1 인증 파일 관리 모듈

**새 파일 생성:**
- `packages/pylon/src/auth/credential-manager.ts`

```typescript
/**
 * CredentialManager
 *
 * 인증 파일(.credentials.json)을 관리하는 클래스
 *
 * 주요 기능:
 * - 현재 계정 정보 읽기
 * - 인증 파일 스왑 (계정 전환)
 * - 백업 파일에서 복원
 */
export class CredentialManager {
  private configDir: string;      // CLAUDE_CONFIG_DIR 경로
  private backupDir: string;      // ~/.claude-credentials 경로

  constructor(options: { configDir: string; backupDir: string });

  /**
   * 현재 활성 계정 정보 조회
   * @returns { account: AccountType, subscriptionType: string } | null
   */
  getCurrentAccount(): Promise<AccountInfo | null>;

  /**
   * 계정 전환 (인증 파일 스왑)
   * @param account - 전환할 계정 ('linegames' | 'personal')
   * @throws 백업 파일이 없는 경우 에러
   */
  switchAccount(account: AccountType): Promise<void>;

  /**
   * 백업 파일 존재 여부 확인
   */
  hasBackup(account: AccountType): Promise<boolean>;
}
```

**구현 세부사항:**

1. `getCurrentAccount()`:
   - `{configDir}/.credentials.json` 읽기
   - `claudeAiOauth.subscriptionType`으로 계정 구분
     - `'team'` → `'linegames'`
     - `'max'` → `'personal'`

2. `switchAccount(account)`:
   - 백업 파일 존재 확인: `{backupDir}/{account}.json`
   - 파일 복사: `{backupDir}/{account}.json` → `{configDir}/.credentials.json`

### 2.2 세션 관리자 수정

**수정할 파일:**
- `packages/pylon/src/claude/claude-manager.ts`

**추가할 메서드:**
```typescript
/**
 * 모든 세션 강제 종료
 * 계정 전환 시 호출됨
 */
async abortAllSessions(): Promise<void>;
```

**구현:**
1. 모든 활성 세션의 `abortController.abort()` 호출
2. 세션 상태를 'idle'로 변경
3. 클라이언트에 상태 변경 알림

### 2.3 메시지 핸들러 추가

**수정할 파일:**
- `packages/pylon/src/pylon.ts` (또는 메시지 핸들러 파일)

**추가할 핸들러:**
```typescript
case MessageType.ACCOUNT_SWITCH: {
  const { account } = payload as AccountSwitchPayload;

  // 1. 모든 세션 중단
  await claudeManager.abortAllSessions();

  // 2. 인증 파일 스왑
  await credentialManager.switchAccount(account);

  // 3. 새 계정 정보 조회
  const accountInfo = await credentialManager.getCurrentAccount();

  // 4. 클라이언트에 상태 알림
  send({
    type: MessageType.ACCOUNT_STATUS,
    payload: accountInfo,
  });

  break;
}
```

### 2.4 초기화 시 계정 상태 전송

**수정할 파일:**
- `packages/pylon/src/pylon.ts`

Pylon 시작 시 또는 클라이언트 연결 시:
```typescript
// 현재 계정 정보를 클라이언트에 전송
const accountInfo = await credentialManager.getCurrentAccount();
if (accountInfo) {
  send({
    type: MessageType.ACCOUNT_STATUS,
    payload: accountInfo,
  });
}
```

---

## Phase 3: MCP 빌드 시스템

### 3.1 esbuild 설정 추가

**새 파일 생성:**
- `packages/pylon/scripts/build-mcp.ts`

```typescript
import * as esbuild from 'esbuild';

const env = process.argv[2] as 'dev' | 'stage' | 'release';

const ports = {
  dev: 9876,
  stage: 9877,
  release: 9878,
};

await esbuild.build({
  entryPoints: ['src/mcp/server.ts'],
  outfile: `dist/mcp/server.js`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  define: {
    'process.env.ESTELLE_MCP_PORT': String(ports[env]),
    'process.env.ESTELLE_ENV': JSON.stringify(env),
  },
  external: ['@modelcontextprotocol/sdk'],  // 외부 의존성
});

console.log(`MCP server built for ${env} (port ${ports[env]})`);
```

### 3.2 pylon-bridge.ts 수정

**수정할 파일:**
- `packages/pylon/src/mcp/pylon-bridge.ts`

**변경 전:**
```typescript
const DEFAULT_PORT = 9876;
```

**변경 후:**
```typescript
// 빌드 시 주입됨 (esbuild define)
declare const __MCP_PORT__: number;
const DEFAULT_PORT = typeof __MCP_PORT__ !== 'undefined' ? __MCP_PORT__ : 9876;
```

또는 환경변수 방식:
```typescript
const DEFAULT_PORT = parseInt(process.env.ESTELLE_MCP_PORT || '9876', 10);
```

### 3.3 tcp-server.ts 수정

**수정할 파일:**
- `packages/pylon/src/mcp/tcp-server.ts`

동일하게 포트 설정 변경

### 3.4 package.json 스크립트 추가

**수정할 파일:**
- `packages/pylon/package.json`

```json
{
  "scripts": {
    "build:mcp": "tsx scripts/build-mcp.ts",
    "build:mcp:dev": "tsx scripts/build-mcp.ts dev",
    "build:mcp:stage": "tsx scripts/build-mcp.ts stage",
    "build:mcp:release": "tsx scripts/build-mcp.ts release"
  }
}
```

---

## Phase 4: dev 환경 정상화

### 4.1 환경 설정 업데이트

**수정할 파일:**
- `config/environments.json`

```json
{
  "dev": {
    "relay": { "url": "ws://localhost:3000" },
    "client": { "title": "Estelle (dev)" },
    "pylon": {
      "configDir": "~/.claude-dev"
    },
    "mcp": {
      "tcpPort": 9876
    }
  },
  "stage": {
    "pylon": {
      "configDir": "~/.claude-stage",
      "pm2Name": "estelle-pylon-stage"
    },
    "mcp": {
      "tcpPort": 9877
    }
  },
  "release": {
    "pylon": {
      "configDir": "~/.claude-release",
      "pm2Name": "estelle-pylon"
    },
    "mcp": {
      "tcpPort": 9878
    }
  }
}
```

### 4.2 Pylon 시작 스크립트 수정

**수정할 파일:**
- `packages/pylon/package.json`

```json
{
  "scripts": {
    "dev": "cross-env CLAUDE_CONFIG_DIR=$HOME/.claude-dev RELAY_URL=ws://localhost:3000 DEVICE_ID=1 node dist/bin.js"
  }
}
```

### 4.3 인증 파일 백업 구조 확인

이미 완료:
```
~/.claude-credentials/dev/
    ├── linegames.json   ← 회사 계정
    └── personal.json    ← 개인 계정
```

추가 필요:
```bash
# stage, release 환경에도 동일하게 로그인 후 백업 필요
mkdir -p ~/.claude-credentials
# 공통 백업 사용 (환경별 분리 불필요)
```

### 4.4 MCP 서버 등록 (settings.json)

**파일 경로:**
- `~/.claude-dev/settings.json`

```json
{
  "mcpServers": {
    "estelle-mcp": {
      "command": "node",
      "args": ["C:\\WorkSpace\\estelle2\\packages\\pylon\\dist\\mcp\\server.js"],
      "env": {
        "ESTELLE_MCP_PORT": "9876"
      }
    }
  }
}
```

---

## Phase 5: stage → release 순차 적용

### 5.1 stage 환경

1. **config 디렉토리 생성 및 로그인:**
   ```powershell
   $env:CLAUDE_CONFIG_DIR = "$env:USERPROFILE\.claude-stage"
   claude  # 로그인
   ```

2. **인증 백업:**
   ```powershell
   cp "$env:USERPROFILE\.claude-stage\.credentials.json" "$env:USERPROFILE\.claude-credentials\stage-linegames.json"
   # 개인 계정으로 다시 로그인 후
   cp "$env:USERPROFILE\.claude-stage\.credentials.json" "$env:USERPROFILE\.claude-credentials\stage-personal.json"
   ```

3. **MCP 빌드:**
   ```bash
   pnpm --filter @estelle/pylon build:mcp:stage
   ```

4. **빌드 스크립트 수정:**
   - `scripts/build-deploy.ps1`에 CLAUDE_CONFIG_DIR 설정 추가
   - PM2 실행 시 환경변수 설정

5. **settings.json 설정:**
   - `~/.claude-stage/settings.json`에 MCP 서버 등록

### 5.2 release 환경

stage와 동일한 과정 반복

---

## 검증 체크리스트

### Phase 1 완료 조건
- [x] 기존 설정 컴포넌트 제거됨
- [x] AccountSection UI 표시됨
- [x] 계정 버튼 클릭 시 메시지 전송됨

### Phase 2 완료 조건
- [x] Pylon이 ACCOUNT_SWITCH 메시지 처리
- [x] 계정 전환 시 모든 세션 abort됨
- [x] 인증 파일이 정상적으로 스왑됨
- [ ] 새 대화 시작 시 새 계정으로 동작 (수동 테스트 필요)

### Phase 3 완료 조건
- [x] `pnpm build:mcp:dev` 성공
- [x] 생성된 server.js에 올바른 포트 주입됨

### Phase 4 완료 조건
- [x] `pnpm dev` 실행 시 ~/.claude-dev 사용
- [x] MCP 서버가 9876 포트로 연결
- [ ] 계정 스왑 동작 확인 (수동 테스트 필요)

### Phase 5 완료 조건
- [ ] stage 배포 성공 (9877 포트)
- [ ] release 배포 성공 (9878 포트)
- [ ] 3개 환경 동시 실행 시 충돌 없음

---

## 기술 결정 사항

### SDK와 CLAUDE_CONFIG_DIR
- ✅ **확인됨**: Claude Agent SDK는 `CLAUDE_CONFIG_DIR` 환경변수를 존중함
- ✅ **확인됨**: SDK `env` 옵션으로 세션별 환경변수 주입 가능
- ✅ **확인됨**: 같은 폴더 내에서 인증 파일 스왑 시 정상 동작

### MCP 빌드 방식
- **esbuild** 사용
- 빌드 타임에 포트 주입 (`define` 옵션)
- 환경별 단일 파일 번들 생성

### 포트 할당
```
dev:     9876
stage:   9877
release: 9878
```

---

## 참고 문서
- `wip/mcp-env-separation.md` (이전 분석)
- `wip/claude-code-multi-account.md` (이전 분석)

## 테스트 로그

### 2025-02-09: 인증 파일 스왑 테스트
1. `~/.claude-dev/` 생성 후 회사 계정 로그인 → 성공
2. 개인 계정으로 로그인 → 성공
3. 인증 파일 백업: `~/.claude-credentials/dev/linegames.json`, `personal.json`
4. 인증 파일 스왑 후 SDK 실행 → **성공!**
