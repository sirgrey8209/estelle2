# 버전 관리 시스템 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 단일 버전 파일(`config/version.json`)을 git에 커밋하고, Relay/Pylon/Client가 동일한 버전을 공유하며, 설정창에 버전 정보와 계정 전환 버튼을 표시한다.

**Architecture:** 빌드 시 `config/version.json`을 생성하여 git 커밋. 각 컴포넌트는 시작 시 이 파일을 읽어 버전 정보 획득. Pylon은 Relay 연결 시 버전 전송, Client는 Relay 접속 시 버전 수신.

**Tech Stack:** TypeScript, Vite (Client 빌드), Zustand (Client 상태), WebSocket 프로토콜

---

## Task 1: 버전 파일 구조 설정

**Files:**
- Create: `config/version.json`
- Modify: `.gitignore`
- Create: `scripts/bump-version.ts`

**Step 1: config/version.json 생성**

```json
{
  "version": "v0303_3",
  "buildTime": "2026-03-03T03:53:07.731Z"
}
```

**Step 2: .gitignore에서 config/version.json 제거**

현재 `.gitignore`에 `config/version.json`이 없지만, 명시적으로 추적되도록 확인.

**Step 3: 버전 증가 스크립트 작성**

```typescript
// scripts/bump-version.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const counterPath = path.join(repoRoot, 'config', 'build-counter.json');
const versionPath = path.join(repoRoot, 'config', 'version.json');

interface BuildCounter {
  date: string;
  counter: number;
}

function generateVersion(): string {
  const today = new Date().toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
  }).replace('/', '');

  let counter: BuildCounter = { date: '', counter: 0 };

  if (fs.existsSync(counterPath)) {
    try {
      counter = JSON.parse(fs.readFileSync(counterPath, 'utf-8'));
    } catch {
      counter = { date: '', counter: 0 };
    }
  }

  if (counter.date === today) {
    counter.counter += 1;
  } else {
    counter.date = today;
    counter.counter = 1;
  }

  fs.writeFileSync(counterPath, JSON.stringify(counter));
  return `v${today}_${counter.counter}`;
}

const version = generateVersion();
const versionJson = {
  version,
  buildTime: new Date().toISOString(),
};

fs.writeFileSync(versionPath, JSON.stringify(versionJson, null, 2));
console.log(`Version bumped to: ${version}`);
```

**Step 4: 스크립트 실행 테스트**

Run: `npx tsx scripts/bump-version.ts`
Expected: `Version bumped to: v0303_4` (또는 현재 날짜 기준)

**Step 5: 커밋**

```bash
git add config/version.json scripts/bump-version.ts
git commit -m "feat: add version management system"
```

---

## Task 2: Relay에서 버전 로드 및 전송

**Files:**
- Create: `packages/relay/src/version.ts`
- Modify: `packages/relay/src/server.ts`
- Modify: `packages/relay/src/message-handler.ts`

**Step 1: 버전 로더 모듈 작성**

```typescript
// packages/relay/src/version.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface VersionInfo {
  version: string;
  buildTime: string;
}

let cachedVersion: VersionInfo | null = null;

export function loadVersion(): VersionInfo {
  if (cachedVersion) return cachedVersion;

  // dist/version.ts → dist → relay → packages → estelle2 → config/version.json
  const versionPath = path.resolve(__dirname, '..', '..', '..', 'config', 'version.json');

  try {
    const raw = fs.readFileSync(versionPath, 'utf-8');
    cachedVersion = JSON.parse(raw);
    return cachedVersion!;
  } catch {
    cachedVersion = { version: 'dev', buildTime: new Date().toISOString() };
    return cachedVersion;
  }
}

export function getVersion(): string {
  return loadVersion().version;
}
```

**Step 2: RelayServerState에 버전 추가**

`packages/relay/src/server.ts`의 `RelayServerState`에 `version` 필드 추가:

```typescript
export interface RelayServerState {
  envId: 0 | 1 | 2;
  version: string;  // 새로 추가
  clients: Map<string, Client & { ws: WebSocket }>;
  clientAllocator: ClientIndexAllocator;
  devices: Record<number, DeviceConfig>;
}
```

`createRelayServer`에서 버전 로드:

```typescript
import { getVersion } from './version.js';

// state 초기화 시
const state: RelayServerState = {
  envId,
  version: getVersion(),  // 새로 추가
  clients: new Map(),
  clientAllocator: new ClientIndexAllocator(),
  devices: options.devices ?? DEVICES,
};
```

**Step 3: auth_result에 relayVersion 추가**

`packages/relay/src/message-handler.ts`의 `handleAuth`에서 auth_result payload에 `relayVersion` 추가.

**Step 4: 커밋**

```bash
git add packages/relay/src/version.ts packages/relay/src/server.ts packages/relay/src/message-handler.ts
git commit -m "feat(relay): load and send version info"
```

---

## Task 3: Pylon에서 버전 로드 및 Relay에 전송

**Files:**
- Create: `packages/pylon/src/version.ts`
- Modify: `packages/pylon/src/network/relay-client.ts`

**Step 1: 버전 로더 모듈 작성**

```typescript
// packages/pylon/src/version.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface VersionInfo {
  version: string;
  buildTime: string;
}

let cachedVersion: VersionInfo | null = null;

export function loadVersion(): VersionInfo {
  if (cachedVersion) return cachedVersion;

  // dist/version.ts → dist → pylon → packages → estelle2 → config/version.json
  const versionPath = path.resolve(__dirname, '..', '..', '..', 'config', 'version.json');

  try {
    const raw = fs.readFileSync(versionPath, 'utf-8');
    cachedVersion = JSON.parse(raw);
    return cachedVersion!;
  } catch {
    cachedVersion = { version: 'dev', buildTime: new Date().toISOString() };
    return cachedVersion;
  }
}

export function getVersion(): string {
  return loadVersion().version;
}
```

**Step 2: RelayClient의 auth 메시지에 version 추가**

`packages/pylon/src/network/relay-client.ts`의 `createIdentifyMessage`에서:

```typescript
import { getVersion } from '../version.js';

createIdentifyMessage(): Message<AuthPayload> {
  const payload: AuthPayload = {
    deviceId: this.deviceId,
    deviceType: 'pylon',
    version: getVersion(),  // 새로 추가
  };
  // ...
}
```

**Step 3: 커밋**

```bash
git add packages/pylon/src/version.ts packages/pylon/src/network/relay-client.ts
git commit -m "feat(pylon): send version to relay on connect"
```

---

## Task 4: Relay에서 Pylon 버전 저장 및 Client에 전송

**Files:**
- Modify: `packages/relay/src/types.ts`
- Modify: `packages/relay/src/message-handler.ts`
- Modify: `packages/relay/src/device-status.ts`

**Step 1: Client 타입에 version 필드 추가**

`packages/relay/src/types.ts`:

```typescript
export interface Client {
  deviceId: number | null;
  deviceType: RelayDeviceType | null;
  ip: string;
  connectedAt: Date;
  authenticated: boolean;
  conversationId?: number;
  shareId?: string;
  version?: string;  // 새로 추가
}
```

**Step 2: handleAuth에서 Pylon 버전 저장**

Pylon 인증 시 payload.version을 client.version에 저장.

**Step 3: device_status 메시지에 version 포함**

`packages/relay/src/device-status.ts`의 `DeviceListItem`에 version 추가:

```typescript
export interface DeviceListItem {
  deviceId: number;
  deviceType: RelayDeviceType;
  name: string;
  icon: string;
  role: string;
  version?: string;  // 새로 추가
}
```

**Step 4: 커밋**

```bash
git add packages/relay/src/types.ts packages/relay/src/message-handler.ts packages/relay/src/device-status.ts
git commit -m "feat(relay): store pylon version and include in device_status"
```

---

## Task 5: Client에 버전 임베드 (Vite)

**Files:**
- Modify: `packages/client/vite.config.ts`
- Create: `packages/client/src/version.ts`

**Step 1: Vite에서 버전 define**

```typescript
// packages/client/vite.config.ts
import fs from 'fs';

// 버전 파일 읽기
function loadVersion(): string {
  try {
    const versionPath = path.resolve(__dirname, '../../config/version.json');
    const raw = fs.readFileSync(versionPath, 'utf-8');
    const { version } = JSON.parse(raw);
    return version;
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  // ...
  define: {
    __APP_VERSION__: JSON.stringify(loadVersion()),
  },
  // ...
});
```

**Step 2: 타입 선언 추가**

```typescript
// packages/client/src/version.ts
declare const __APP_VERSION__: string;

export const CLIENT_VERSION = __APP_VERSION__;
```

**Step 3: 커밋**

```bash
git add packages/client/vite.config.ts packages/client/src/version.ts
git commit -m "feat(client): embed version at build time"
```

---

## Task 6: Client 설정 스토어에 버전 상태 추가

**Files:**
- Modify: `packages/client/src/stores/settingsStore.ts`

**Step 1: 버전 관련 상태 추가**

```typescript
export interface SettingsState {
  // 기존 필드들...

  // 버전 정보
  clientVersion: string;
  relayVersion: string | null;
  pylons: Array<{
    deviceId: number;
    name: string;
    version: string;
  }>;

  // Actions
  setRelayVersion: (version: string) => void;
  setPylons: (pylons: Array<{ deviceId: number; name: string; version: string }>) => void;
  // 기존 actions...
}
```

**Step 2: 초기 상태 및 actions 구현**

```typescript
import { CLIENT_VERSION } from '../version';

const initialState = {
  // 기존...
  clientVersion: CLIENT_VERSION,
  relayVersion: null as string | null,
  pylons: [] as Array<{ deviceId: number; name: string; version: string }>,
};
```

**Step 3: 커밋**

```bash
git add packages/client/src/stores/settingsStore.ts
git commit -m "feat(client): add version state to settings store"
```

---

## Task 7: Client에서 버전 정보 수신 처리

**Files:**
- Modify: `packages/client/src/services/relayHandler.ts` (또는 해당 파일)

**Step 1: auth_result에서 relayVersion 추출**

auth_result 메시지 수신 시 relayVersion을 settingsStore에 저장.

**Step 2: device_status에서 Pylon 버전 추출**

device_status 메시지 수신 시 pylon 목록의 version 정보를 settingsStore에 저장.

**Step 3: 커밋**

```bash
git add packages/client/src/services/relayHandler.ts
git commit -m "feat(client): handle version info from relay"
```

---

## Task 8: 설정창 UI 구현 - VersionSection 컴포넌트

**Files:**
- Create: `packages/client/src/components/settings/VersionSection.tsx`
- Modify: `packages/client/src/components/settings/SettingsScreen.tsx`

**Step 1: VersionSection 컴포넌트 작성**

```tsx
// packages/client/src/components/settings/VersionSection.tsx
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useSettingsStore } from '../../stores';
import { requestAccountSwitch } from '../../services/relaySender';
import type { AccountType } from '@estelle/core';
import { Loader2 } from 'lucide-react';

export function VersionSection() {
  const clientVersion = useSettingsStore((s) => s.clientVersion);
  const relayVersion = useSettingsStore((s) => s.relayVersion);
  const pylons = useSettingsStore((s) => s.pylons);
  const currentAccount = useSettingsStore((s) => s.currentAccount);
  const isAccountSwitching = useSettingsStore((s) => s.isAccountSwitching);
  const setAccountSwitching = useSettingsStore((s) => s.setAccountSwitching);

  // ID순 정렬
  const sortedPylons = [...pylons].sort((a, b) => a.deviceId - b.deviceId);
  const pylon1 = sortedPylons.find((p) => p.deviceId === 1);

  const handleAccountSwitch = () => {
    if (isAccountSwitching) return;
    const nextAccount: AccountType = currentAccount === 'linegames' ? 'personal' : 'linegames';
    setAccountSwitching(true);
    requestAccountSwitch(nextAccount);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">버전 정보</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Client</span>
          <span>{clientVersion}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Relay</span>
          <span>{relayVersion ?? '...'}</span>
        </div>
        {sortedPylons.map((pylon) => (
          <div key={pylon.deviceId} className="flex justify-between items-center">
            <span className="text-muted-foreground">
              Pylon {pylon.deviceId} ({pylon.name})
            </span>
            <div className="flex items-center gap-2">
              <span>{pylon.version}</span>
              {pylon.deviceId === 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={handleAccountSwitch}
                  disabled={isAccountSwitching}
                >
                  {isAccountSwitching ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    currentAccount === 'linegames' ? 'LineGames' : 'Personal'
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

**Step 2: SettingsScreen에 VersionSection 추가**

```tsx
// packages/client/src/components/settings/SettingsScreen.tsx
import { VersionSection } from './VersionSection';
import { AccountSection } from './AccountSection';

export function SettingsScreen() {
  return (
    <div className="flex-1 bg-background">
      <div className="h-full overflow-y-auto p-4 space-y-4">
        <VersionSection />
        <AccountSection />
      </div>
    </div>
  );
}
```

**Step 3: 커밋**

```bash
git add packages/client/src/components/settings/VersionSection.tsx packages/client/src/components/settings/SettingsScreen.tsx
git commit -m "feat(client): add version section to settings"
```

---

## Task 9: /estelle-patch 스킬 업데이트

**Files:**
- Modify: `/home/estelle/.claude/skills/estelle-patch/README.md`

**Step 1: 스킬 내용 업데이트**

```markdown
# estelle-patch

Estelle 패치 배포 (버전 증가 → git 커밋 → updater 트리거)

## 패치 절차

### 1. 버전 증가

```bash
cd /home/estelle/estelle2
npx tsx scripts/bump-version.ts
```

### 2. Git 커밋 & 푸시

```bash
git add config/version.json
git add <other-changed-files>
git commit -m "patch: vMMDD_N - <변경 내용>"
git push origin master
```

### 3. Updater 트리거

```bash
npx tsx packages/updater/src/cli.ts trigger all master
```

### 4. 모니터링

```bash
pm2 logs estelle-updater --lines 50
```

## 전체 명령어 (복사용)

```bash
cd /home/estelle/estelle2 && \
npx tsx scripts/bump-version.ts && \
git add -A && \
git commit -m "patch: $(cat config/version.json | jq -r .version)" && \
git push origin master && \
npx tsx packages/updater/src/cli.ts trigger all master
```
```

**Step 2: 커밋**

```bash
git add /home/estelle/.claude/skills/estelle-patch/README.md
git commit -m "docs: update estelle-patch skill with version bump"
```

---

## Task 10: 정리 - 불필요한 deploy 코드 제거

**Files:**
- Remove: `packages/relay/public/version.json` (git에서 제거)
- Modify: `packages/client/vite.config.ts` (versionJsonPlugin 제거)

**Step 1: relay/public/version.json 제거**

```bash
git rm packages/relay/public/version.json 2>/dev/null || true
```

**Step 2: versionJsonPlugin 제거**

`packages/client/vite.config.ts`에서 `versionJsonPlugin` 함수와 plugins 배열에서 호출 제거.

**Step 3: 커밋**

```bash
git add packages/client/vite.config.ts
git commit -m "refactor: remove legacy version.json generation"
```

---

## Task 11: 통합 테스트

**Step 1: 빌드 테스트**

```bash
cd /home/estelle/estelle2
pnpm build
```

**Step 2: 버전 파일 확인**

```bash
cat config/version.json
```

**Step 3: 로컬 실행 테스트**

```bash
pnpm dev
```

설정창에서 버전 정보가 올바르게 표시되는지 확인.

**Step 4: 최종 커밋**

```bash
git add -A
git commit -m "feat: complete version management system"
```
