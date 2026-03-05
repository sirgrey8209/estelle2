# Updater Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy script를 제거하고 executor로 일원화. 환경 설정을 git으로 공유하고, 머신별 매핑을 updater.json의 machines로 관리.

**Architecture:** Master가 updater.json의 machines 매핑에서 에이전트 IP로 environmentFile을 찾아 UpdateCommand에 포함해 전송. 각 머신의 executor가 해당 파일을 읽어 ESTELLE_ENV_CONFIG를 구성하고 pm2 delete+start로 환경변수를 세팅.

**Tech Stack:** TypeScript, ws, pm2, vitest

---

### Task 1: 환경 설정 파일 생성

**Files:**
- Create: `config/environments.office.json`
- Create: `config/environments.cloud.json`
- Modify: `.gitignore` (environments.json 제거)

**Step 1: 현재 environments.json 읽어서 office/cloud 파일 생성**

각 머신의 실제 `config/environments.json`은 로컬에만 있으므로, `environments.example.json`을 기반으로 office/cloud 파일을 만든다. release 키만 사용 (stage 제거).

`config/environments.office.json`:
```json
{
  "relay": {
    "port": 8080,
    "pm2Name": "estelle-relay"
  },
  "pylon": {
    "pylonIndex": "1",
    "relayUrl": "wss://estelle-relay.mooo.com",
    "pm2Name": "estelle-pylon",
    "configDir": "~/.claude",
    "credentialsBackupDir": "~/.claude-credentials",
    "mcpPort": 9876,
    "dataDir": "./release-data",
    "defaultWorkingDir": "C:\\workspace"
  },
  "envId": 0
}
```

**중요:** 실제 값은 주인님 확인 필요. 위는 example 기반 placeholder.

`config/environments.cloud.json`: 동일 구조, 클라우드 머신용 값.

**Step 2: .gitignore에서 environments.json 행 제거**

`.gitignore`에서 `config/environments.json` 줄을 삭제.

**Step 3: Commit**

```bash
git add config/environments.office.json config/environments.cloud.json .gitignore
git commit -m "feat(config): add environments.office.json and environments.cloud.json"
```

---

### Task 2: UpdaterConfig 타입과 updater.json 변경

**Files:**
- Modify: `packages/updater/src/types.ts`
- Test: `packages/updater/src/config.test.ts`

**Step 1: 타입 변경 — failing test 작성**

`packages/updater/src/config.test.ts`에 테스트 추가:

```typescript
it('should parse machines map and derive whitelist', () => {
  const configJson = JSON.stringify({
    masterUrl: 'ws://89.167.4.124:9900',
    machines: {
      '112.170.250.11': { environmentFile: 'environments.office.json' },
      '89.167.4.124': { environmentFile: 'environments.cloud.json' },
    },
  });

  vi.mocked(fs.readFileSync).mockReturnValue(configJson);
  vi.mocked(fs.existsSync).mockReturnValue(true);

  const config = loadConfig('/path/to/config.json');

  expect(config.machines).toBeDefined();
  expect(config.machines!['112.170.250.11'].environmentFile).toBe('environments.office.json');
  // whitelist는 machines 키에서 자동 파생
  expect(config.whitelist).toEqual(['112.170.250.11', '89.167.4.124']);
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/estelle/estelle2 && pnpm -C packages/updater test
```

Expected: FAIL — UpdaterConfig에 machines 필드 없음

**Step 3: types.ts 수정**

`packages/updater/src/types.ts`:
```typescript
export interface MachineConfig {
  environmentFile: string;
}

export interface UpdaterConfig {
  masterUrl: string;
  whitelist: string[];  // 하위 호환: machines에서 자동 파생 가능
  machines?: Record<string, MachineConfig>;
}
```

**Step 4: config.ts에서 machines → whitelist 자동 파생**

`packages/updater/src/config.ts`의 `loadConfig`를 수정:
```typescript
export function loadConfig(configPath: string): UpdaterConfig {
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw);

  // machines가 있으면 whitelist 자동 파생
  if (parsed.machines && !parsed.whitelist) {
    parsed.whitelist = Object.keys(parsed.machines);
  }

  return parsed as UpdaterConfig;
}
```

**Step 5: Run test to verify it passes**

```bash
cd /home/estelle/estelle2 && pnpm -C packages/updater test
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/updater/src/types.ts packages/updater/src/config.ts packages/updater/src/config.test.ts
git commit -m "feat(updater): add machines mapping to UpdaterConfig"
```

---

### Task 3: UpdateCommand에 environmentFile 추가

**Files:**
- Modify: `packages/updater/src/types.ts`
- Modify: `packages/updater/src/master.ts`
- Test: `packages/updater/src/master.test.ts`

**Step 1: failing test 작성**

`packages/updater/src/master.test.ts`에 테스트 추가:

```typescript
it('should include environmentFile in update command to agents', async () => {
  const mockWss = new EventEmitter() as any;
  mockWss.clients = new Set();
  vi.mocked(WebSocketServer).mockImplementation(() => mockWss as any);

  const { startMaster } = await import('./master.js');
  const master = startMaster({
    port: 9900,
    whitelist: ['1.2.3.4'],
    repoRoot: '/app',
    myIp: '89.167.4.124',
    machines: {
      '1.2.3.4': { environmentFile: 'environments.office.json' },
      '89.167.4.124': { environmentFile: 'environments.cloud.json' },
    },
  });

  const mockSocket = new EventEmitter() as any;
  mockSocket.close = vi.fn();
  mockSocket.send = vi.fn();
  mockSocket.readyState = WebSocket.OPEN;

  mockWss.emit('connection', mockSocket, { socket: { remoteAddress: '1.2.3.4' } });

  await master.triggerUpdate('all', 'master');

  // Agent에게 보낸 메시지에 environmentFile 포함
  const calls = mockSocket.send.mock.calls;
  // calls[0] = welcome, calls[1] = update
  const updateMsg = JSON.parse(calls[1][0]);
  expect(updateMsg.environmentFile).toBe('environments.office.json');
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/estelle/estelle2 && pnpm -C packages/updater test
```

**Step 3: types.ts에 environmentFile 추가**

```typescript
export interface UpdateCommand {
  type: 'update';
  target: 'all' | string;
  branch: string;
  environmentFile?: string;  // 추가
}
```

**Step 4: MasterOptions에 machines 추가, broadcast를 IP별로 분리**

`packages/updater/src/master.ts`:

```typescript
export interface MasterOptions {
  port: number;
  whitelist: string[];
  repoRoot: string;
  myIp: string;
  machines?: Record<string, MachineConfig>;  // 추가
}
```

`broadcast` 함수를 수정하여 각 에이전트에게 해당 IP의 environmentFile을 포함:

```typescript
function broadcast(baseCmd: UpdateCommand): void {
  for (const [ip, agent] of agents) {
    try {
      if (agent.ws.readyState === WebSocket.OPEN) {
        const cmd = {
          ...baseCmd,
          environmentFile: options.machines?.[ip]?.environmentFile,
        };
        agent.ws.send(JSON.stringify(cmd));
      }
    } catch (err) {
      console.error(`[Master] Failed to send to ${ip}:`, err);
    }
  }
}
```

`triggerUpdate`에서 self-update할 때도 environmentFile 전달:

```typescript
if (target === 'all' || target === myIp) {
  await executeUpdate({
    branch,
    repoRoot,
    isMaster: true,
    environmentFile: options.machines?.[myIp]?.environmentFile,
    onLog: (message) => { ... },
  });
}
```

**Step 5: Run test to verify it passes**

```bash
cd /home/estelle/estelle2 && pnpm -C packages/updater test
```

**Step 6: Commit**

```bash
git add packages/updater/src/types.ts packages/updater/src/master.ts packages/updater/src/master.test.ts
git commit -m "feat(updater): send environmentFile per agent in UpdateCommand"
```

---

### Task 4: index.ts에서 machines를 master에 전달

**Files:**
- Modify: `packages/updater/src/index.ts`

**Step 1: startMaster 호출에 machines 전달**

```typescript
if (myIp === masterIp) {
  log(`[Updater] Starting as MASTER`);
  const url = new URL(config.masterUrl);
  startMaster({
    port: parseInt(url.port, 10),
    whitelist: config.whitelist,
    repoRoot,
    myIp,
    machines: config.machines,  // 추가
  });
}
```

**Step 2: Run tests**

```bash
cd /home/estelle/estelle2 && pnpm -C packages/updater test
```

**Step 3: Commit**

```bash
git add packages/updater/src/index.ts
git commit -m "feat(updater): pass machines config to master"
```

---

### Task 5: Executor에 환경 설정 로딩 + PM2 delete/start 추가

**Files:**
- Modify: `packages/updater/src/executor.ts`
- Test: `packages/updater/src/executor.test.ts`

**Step 1: ExecuteOptions에 environmentFile 추가, failing test 작성**

`packages/updater/src/executor.test.ts`에 새 테스트:

```typescript
it('should load environment config and use pm2 delete+start instead of restart', async () => {
  // 8 spawns: fetch, checkout, pull, install, build,
  //   pm2 delete pylon, pm2 start pylon, pm2 save
  mockSuccessfulSpawns(8);

  // Mock reading version.json
  vi.mocked(fs.readFileSync).mockReturnValueOnce(
    JSON.stringify({ version: 'v0305_1', buildTime: '2026-03-05T00:00:00Z' })
  );

  // Mock reading environments.office.json
  vi.mocked(fs.readFileSync).mockReturnValueOnce(
    JSON.stringify({
      relay: { port: 8080, pm2Name: 'estelle-relay' },
      pylon: {
        pm2Name: 'estelle-pylon',
        relayUrl: 'wss://example.com',
        mcpPort: 9876,
        configDir: '~/.claude',
        credentialsBackupDir: '~/.claude-credentials',
        dataDir: './release-data',
        defaultWorkingDir: '/workspace',
      },
      envId: 0,
    })
  );

  const result = await executeUpdate({
    branch: 'master',
    repoRoot: '/app',
    onLog: () => {},
    isMaster: false,
    environmentFile: 'environments.office.json',
  });

  expect(result.success).toBe(true);
  expect(result.version).toBe('v0305_1');

  const calls = vi.mocked(spawn).mock.calls;
  // pm2 delete (not restart)
  expect(calls[5]).toEqual(['pm2', ['delete', 'estelle-pylon'], expect.any(Object)]);
  // pm2 start with env vars
  expect(calls[6][0]).toBe('pm2');
  expect(calls[6][1][0]).toBe('start');
  // pm2 save
  expect(calls[7]).toEqual(['pm2', ['save'], expect.any(Object)]);
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/estelle/estelle2 && pnpm -C packages/updater test
```

**Step 3: executor.ts 수정**

주요 변경:

1. `ExecuteOptions`에 `environmentFile?: string` 추가
2. `ExecuteResult`에 `version`을 반드시 반환
3. Step 6에서 pylon node_modules core 복사 제거 (EINVAL 원인)
4. Step 7을 pm2 delete + start로 변경, 환경변수 세팅
5. Step 8 추가: pm2 save

```typescript
export interface ExecuteOptions {
  branch: string;
  repoRoot: string;
  onLog: (message: string) => void;
  isMaster?: boolean;
  environmentFile?: string;  // 추가
}
```

Step 6 변경 — pylon node_modules core 복사 제거:
```typescript
// Step 6: Copy build artifacts to release/
// core/dist, updater/dist, pylon/dist 복사
// isMaster일 때 relay/dist, relay/public 추가
// !! pylon/node_modules/@estelle/core 복사 제거 (심링크가 이미 처리)
```

Step 7 변경 — 환경 설정 로딩 + pm2 delete/start:
```typescript
// Read version from config/version.json
const versionPath = path.join(repoRoot, 'config', 'version.json');
let version = 'dev';
try {
  const versionJson = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
  version = versionJson.version;
} catch {
  log('Warning: could not read config/version.json, using "dev"');
}

// Read environment config
let envConfig = '{}';
if (environmentFile) {
  const envPath = path.join(repoRoot, 'config', environmentFile);
  try {
    const env = JSON.parse(fs.readFileSync(envPath, 'utf-8'));
    envConfig = JSON.stringify({
      envId: env.envId,
      pylon: {
        pylonIndex: env.pylon.pylonIndex,
        relayUrl: env.pylon.relayUrl,
        configDir: expandPath(env.pylon.configDir),
        credentialsBackupDir: expandPath(env.pylon.credentialsBackupDir),
        dataDir: path.resolve(repoRoot, env.pylon.dataDir),
        mcpPort: env.pylon.mcpPort,
        defaultWorkingDir: expandPath(env.pylon.defaultWorkingDir),
      },
    });
  } catch (err) {
    log(`Warning: could not read ${environmentFile}`);
  }
}

// pm2 delete + start (instead of restart)
// delete는 실패해도 OK (프로세스가 없을 수 있음)
await runCommand('pm2', ['delete', pylonPm2Name], repoRoot, log);
await runCommand('pm2', ['start', 'dist/bin.js',
  '--name', pylonPm2Name,
  '--cwd', path.join(repoRoot, 'release', 'pylon'),
  '--', // pm2 start 옵션 구분
], repoRoot, log);
// 환경변수는 --env 또는 ecosystem 방식으로 전달

// pm2 save
await runCommand('pm2', ['save'], repoRoot, log);
```

`expandPath` 헬퍼 (deploy/index.ts에서 이동):
```typescript
function expandPath(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(process.env.HOME || process.env.USERPROFILE || '', p.slice(2));
  }
  return p;
}
```

**PM2 환경변수 전달 방식:**
pm2 CLI에서 환경변수를 직접 전달하기 어려우므로, ecosystem 파일을 임시 생성하는 방식 사용:

```typescript
const ecosystemPath = path.join(repoRoot, 'release', 'ecosystem.config.cjs');
const ecosystem = {
  apps: [{
    name: pylonPm2Name,
    script: 'dist/bin.js',
    cwd: path.join(repoRoot, 'release', 'pylon'),
    env: {
      ESTELLE_VERSION: version,
      ESTELLE_ENV_CONFIG: envConfig,
    },
  }],
};

// relay도 isMaster면 추가
if (isMaster && relayPm2Name) {
  ecosystem.apps.unshift({
    name: relayPm2Name,
    script: 'dist/bin.js',
    cwd: path.join(repoRoot, 'release', 'relay'),
    env: {
      PORT: String(relayPort),
      STATIC_DIR: path.join(repoRoot, 'release', 'relay', 'public'),
    },
  });
}

fs.writeFileSync(ecosystemPath, `module.exports = ${JSON.stringify(ecosystem, null, 2)};`);
await runCommand('pm2', ['start', ecosystemPath], repoRoot, log);
```

**Step 4: 기존 테스트 업데이트**

기존 agent/master 테스트의 cpSync 호출 횟수, spawn 호출 횟수, pm2 명령 패턴을 수정.

**Step 5: Run tests**

```bash
cd /home/estelle/estelle2 && pnpm -C packages/updater test
```

**Step 6: Commit**

```bash
git add packages/updater/src/executor.ts packages/updater/src/executor.test.ts
git commit -m "feat(updater): load env config, pm2 delete+start, remove symlink copy"
```

---

### Task 6: Agent에서 environmentFile 전달

**Files:**
- Modify: `packages/updater/src/agent.ts`

**Step 1: agent.ts에서 UpdateCommand의 environmentFile을 executor에 전달**

```typescript
if (msg.type === 'update') {
  const updateMsg = msg as UpdateCommand;
  if (updateMsg.target !== 'all' && updateMsg.target !== myIp) {
    log(`[Agent] Ignoring update for ${updateMsg.target} (I am ${myIp})`);
    return;
  }

  log(`[Agent] Received update command: branch=${updateMsg.branch}, env=${updateMsg.environmentFile}`);

  const result = await executeUpdate({
    branch: updateMsg.branch,
    repoRoot,
    environmentFile: updateMsg.environmentFile,  // 추가
    onLog: (message) => {
      const logMsg: LogMessage = { type: 'log', ip: myIp, message };
      safeSend(ws, logMsg);
    },
  }).catch((err) => ({
    success: false as const,
    version: undefined,
    error: err instanceof Error ? err.message : 'Unknown error',
  }));
  // ...
}
```

**Step 2: Run tests**

```bash
cd /home/estelle/estelle2 && pnpm -C packages/updater test
```

**Step 3: Commit**

```bash
git add packages/updater/src/agent.ts
git commit -m "feat(updater): agent passes environmentFile to executor"
```

---

### Task 7: updater.json 업데이트

**Files:**
- Modify: `config/updater.json`

**Step 1: machines 매핑 추가, whitelist 제거**

```json
{
  "masterUrl": "ws://89.167.4.124:9900",
  "machines": {
    "112.170.250.11": { "environmentFile": "environments.office.json" },
    "112.170.250.136": { "environmentFile": "environments.office.json" },
    "89.167.4.124": { "environmentFile": "environments.cloud.json" }
  }
}
```

**Step 2: Commit**

```bash
git add config/updater.json
git commit -m "feat(config): replace whitelist with machines mapping in updater.json"
```

---

### Task 8: Deploy script 제거

**Files:**
- Delete: `scripts/deploy/index.ts`
- Delete: `scripts/deploy/version.ts`
- Delete: `scripts/deploy/builder.ts`
- Delete: `scripts/deploy/pm2-manager.ts`
- Delete: `scripts/deploy.ts` (진입점)
- Delete: `config/environments.example.json`
- Modify: `package.json` (deploy 스크립트 제거)
- Modify: `packages/pylon/src/servers/pylon-mcp-server.ts` (deploy 핸들러 수정)

**Step 1: package.json에서 deploy 스크립트 제거**

`deploy:stage`, `deploy:release`, `deploy:release-pylon` 제거.

**Step 2: pylon MCP server에서 deploy 핸들러 수정**

- `_runDeployScript` 제거
- `_runPromoteScript` 제거
- stage/promote 분기 제거
- deploy action → release만 남기고, `_handleDeployViaUpdater`로 통일

**Step 3: deploy 스크립트 파일들 삭제**

```bash
rm -rf scripts/deploy/
rm scripts/deploy.ts
rm config/environments.example.json
```

**Step 4: Run full test suite**

```bash
cd /home/estelle/estelle2 && pnpm test
```

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove deploy scripts, unify on updater executor"
```

---

### Task 9: estelle-patch 스킬 업데이트

**Files:**
- Modify: `.claude/skills/estelle-patch/SKILL.md`

**Step 1: 스킬 문서 갱신**

주요 변경:
- 모니터링 단계 `[1/4]` → `[1/8]` 반영
- `pnpm deploy:release` 참조 제거
- "What Happens" 섹션을 executor 플로우로 갱신
- promote/stage 관련 내용 제거

**Step 2: Commit**

```bash
git add .claude/skills/estelle-patch/SKILL.md
git commit -m "docs: update estelle-patch skill for updater unification"
```

---

### Task 10: 통합 테스트

**Step 1: 빌드 확인**

```bash
cd /home/estelle/estelle2 && pnpm build
```

**Step 2: 전체 테스트**

```bash
cd /home/estelle/estelle2 && pnpm test
```

**Step 3: 로컬에서 executor dry-run**

업데이터를 재시작하고 로그 확인:
```bash
pm2 restart estelle-updater
pm2 logs estelle-updater --lines 10 --nostream
```

**Step 4: 실제 패치 테스트**

```bash
npx tsx scripts/bump-version.ts
cd packages/client && pnpm build && cd ../..
git add config/version.json packages/relay/public/
git commit -m "chore: bump version to $(cat config/version.json | jq -r .version)"
git push origin master
npx tsx packages/updater/src/cli.ts trigger all master
```

pm2 logs로 전체 플로우 확인.
