# 크로스 플랫폼 배포 스크립트 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Windows/Linux 모두에서 동작하는 Node.js 기반 배포 스크립트 구현

**Architecture:** PowerShell/Bash 스크립트를 TypeScript로 대체. MCP에서 detached 프로세스로 실행하여 Pylon 재시작 후에도 배포 계속 진행. CLI와 MCP 양쪽에서 동일한 스크립트 사용.

**Tech Stack:** TypeScript, tsx (ts-node 대체), PM2, child_process (spawn)

---

## Task 1: 버전 생성 모듈

**Files:**
- Create: `scripts/deploy/version.ts`
- Create: `scripts/deploy/version.test.ts`

**Step 1: Write the failing test**

```typescript
// scripts/deploy/version.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('generateVersion', () => {
  const counterPath = '/tmp/test-build-counter.json';

  beforeEach(() => {
    if (fs.existsSync(counterPath)) {
      fs.unlinkSync(counterPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(counterPath)) {
      fs.unlinkSync(counterPath);
    }
    vi.useRealTimers();
  });

  it('should generate version with date and counter', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15'));

    const { generateVersion } = await import('./version.js');
    const version = generateVersion(counterPath);

    expect(version).toBe('v0315_1');
  });

  it('should increment counter on same day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15'));

    const { generateVersion } = await import('./version.js');
    generateVersion(counterPath);
    const version2 = generateVersion(counterPath);

    expect(version2).toBe('v0315_2');
  });

  it('should reset counter on new day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15'));

    const { generateVersion } = await import('./version.js');
    generateVersion(counterPath);

    vi.setSystemTime(new Date('2026-03-16'));
    // Need fresh import to reset module cache
    vi.resetModules();
    const { generateVersion: genV2 } = await import('./version.js');
    const version = genV2(counterPath);

    expect(version).toBe('v0316_1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/estelle/estelle2 && pnpm exec vitest run scripts/deploy/version.test.ts`
Expected: FAIL with "Cannot find module './version.js'"

**Step 3: Write minimal implementation**

```typescript
// scripts/deploy/version.ts
import fs from 'fs';

interface BuildCounter {
  date: string;
  counter: number;
}

export function generateVersion(counterPath: string): string {
  const today = new Date().toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
  }).replace('/', '');

  let counter: BuildCounter = { date: '', counter: 0 };

  if (fs.existsSync(counterPath)) {
    try {
      const raw = fs.readFileSync(counterPath, 'utf-8');
      counter = JSON.parse(raw);
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
```

**Step 4: Run test to verify it passes**

Run: `cd /home/estelle/estelle2 && pnpm exec vitest run scripts/deploy/version.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/deploy/version.ts scripts/deploy/version.test.ts
git commit -m "feat(deploy): add cross-platform version generator"
```

---

## Task 2: Builder 모듈

**Files:**
- Create: `scripts/deploy/builder.ts`
- Create: `scripts/deploy/builder.test.ts`

**Step 1: Write the failing test**

```typescript
// scripts/deploy/builder.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('build', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run pnpm build in repo root', async () => {
    const mockExecSync = vi.mocked(execSync);
    mockExecSync.mockReturnValue(Buffer.from('Build complete'));

    const { build } = await import('./builder.js');
    const result = await build('/test/repo');

    expect(mockExecSync).toHaveBeenCalledWith('pnpm build', {
      cwd: '/test/repo',
      stdio: 'inherit',
    });
    expect(result.success).toBe(true);
  });

  it('should return error on build failure', async () => {
    const mockExecSync = vi.mocked(execSync);
    mockExecSync.mockImplementation(() => {
      throw new Error('Build failed');
    });

    vi.resetModules();
    const { build } = await import('./builder.js');
    const result = await build('/test/repo');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Build failed');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/estelle/estelle2 && pnpm exec vitest run scripts/deploy/builder.test.ts`
Expected: FAIL with "Cannot find module './builder.js'"

**Step 3: Write minimal implementation**

```typescript
// scripts/deploy/builder.ts
import { execSync } from 'child_process';

export interface BuildResult {
  success: boolean;
  error?: string;
}

export async function build(repoRoot: string): Promise<BuildResult> {
  try {
    execSync('pnpm build', {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd /home/estelle/estelle2 && pnpm exec vitest run scripts/deploy/builder.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/deploy/builder.ts scripts/deploy/builder.test.ts
git commit -m "feat(deploy): add cross-platform builder module"
```

---

## Task 3: PM2 Manager 모듈

**Files:**
- Create: `scripts/deploy/pm2-manager.ts`
- Create: `scripts/deploy/pm2-manager.test.ts`

**Step 1: Write the failing test**

```typescript
// scripts/deploy/pm2-manager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('pm2Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('stopService', () => {
    it('should stop pm2 service by name', async () => {
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockReturnValue(Buffer.from(''));

      const { stopService } = await import('./pm2-manager.js');
      stopService('estelle-pylon');

      expect(mockExecSync).toHaveBeenCalledWith(
        'pm2 delete estelle-pylon',
        expect.any(Object)
      );
    });

    it('should not throw on already stopped service', async () => {
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockImplementation(() => {
        throw new Error('Process not found');
      });

      vi.resetModules();
      const { stopService } = await import('./pm2-manager.js');

      // Should not throw
      expect(() => stopService('estelle-pylon')).not.toThrow();
    });
  });

  describe('startService', () => {
    it('should start pm2 service with config', async () => {
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockReturnValue(Buffer.from(''));

      vi.resetModules();
      const { startService } = await import('./pm2-manager.js');
      const result = startService({
        name: 'estelle-relay',
        script: 'dist/bin.js',
        cwd: '/app/relay',
        env: { PORT: '8080' },
      });

      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/estelle/estelle2 && pnpm exec vitest run scripts/deploy/pm2-manager.test.ts`
Expected: FAIL with "Cannot find module './pm2-manager.js'"

**Step 3: Write minimal implementation**

```typescript
// scripts/deploy/pm2-manager.ts
import { execSync } from 'child_process';

export interface PM2ServiceConfig {
  name: string;
  script: string;
  cwd: string;
  env?: Record<string, string>;
}

export interface PM2Result {
  success: boolean;
  error?: string;
}

export function stopService(name: string): void {
  try {
    execSync(`pm2 delete ${name}`, { stdio: 'pipe' });
  } catch {
    // Ignore errors (service might not exist)
  }
}

export function startService(config: PM2ServiceConfig): PM2Result {
  try {
    const envStr = config.env
      ? Object.entries(config.env)
          .map(([k, v]) => `${k}="${v}"`)
          .join(' ')
      : '';

    const cmd = envStr
      ? `${envStr} pm2 start ${config.script} --name ${config.name} --cwd ${config.cwd}`
      : `pm2 start ${config.script} --name ${config.name} --cwd ${config.cwd}`;

    execSync(cmd, { stdio: 'inherit', shell: true });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export function saveServices(): void {
  try {
    execSync('pm2 save', { stdio: 'pipe' });
  } catch {
    // Ignore errors
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd /home/estelle/estelle2 && pnpm exec vitest run scripts/deploy/pm2-manager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add scripts/deploy/pm2-manager.ts scripts/deploy/pm2-manager.test.ts
git commit -m "feat(deploy): add cross-platform PM2 manager module"
```

---

## Task 4: 메인 배포 스크립트

**Files:**
- Create: `scripts/deploy/index.ts`
- Create: `scripts/deploy.ts`

**Step 1: Create the deploy orchestrator**

```typescript
// scripts/deploy/index.ts
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateVersion } from './version.js';
import { build } from './builder.js';
import { stopService, startService, saveServices } from './pm2-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type DeployTarget = 'stage' | 'release';

export interface DeployOptions {
  target: DeployTarget;
  repoRoot?: string;
}

export interface DeployResult {
  success: boolean;
  version?: string;
  error?: string;
}

interface EnvironmentConfig {
  relay: {
    port: number;
    pm2Name: string;
  };
  pylon: {
    pm2Name: string;
    relayUrl: string;
    mcpPort: number;
    configDir: string;
    credentialsBackupDir: string;
    dataDir: string;
    defaultWorkingDir: string;
  };
  envId: number;
}

function log(phase: string, message: string): void {
  console.log(`[${phase}] ${message}`);
}

function logDetail(message: string): void {
  console.log(`  ${message}`);
}

function loadConfig(repoRoot: string, target: DeployTarget): EnvironmentConfig {
  const configPath = path.join(repoRoot, 'config', 'environments.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(raw);
  return config[target];
}

function expandPath(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(process.env.HOME || process.env.USERPROFILE || '', p.slice(2));
  }
  return p;
}

export async function deploy(options: DeployOptions): Promise<DeployResult> {
  const repoRoot = options.repoRoot || path.resolve(__dirname, '..', '..');
  const target = options.target;

  log('Phase 0', 'Loading configuration...');
  const config = loadConfig(repoRoot, target);
  logDetail(`Target: ${target}`);

  // Version
  log('Version', 'Generating build version...');
  const counterPath = path.join(repoRoot, 'config', 'build-counter.json');
  const version = generateVersion(counterPath);
  logDetail(`Version: (${target})${version}`);

  // Build
  log('Phase 1', 'Building TypeScript packages...');
  const buildResult = await build(repoRoot);
  if (!buildResult.success) {
    return { success: false, error: buildResult.error };
  }
  logDetail('TypeScript build completed');

  // Stop services
  log('Phase 2', 'Stopping PM2 services...');
  stopService(config.relay.pm2Name);
  stopService(config.pylon.pm2Name);
  logDetail('Services stopped');

  // Generate version.json for client
  log('Phase 3', 'Generating version.json...');
  const relayPublic = path.join(repoRoot, 'packages', 'relay', 'public');
  const versionJson = JSON.stringify({
    env: target,
    version,
    buildTime: new Date().toISOString(),
  });
  fs.writeFileSync(path.join(relayPublic, 'version.json'), versionJson);
  logDetail('version.json created');

  // Data directory
  const dataDirName = target === 'release' ? 'release-data' : 'stage-data';
  const dataDir = path.join(repoRoot, dataDirName);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Build ESTELLE_ENV_CONFIG
  const envConfig = JSON.stringify({
    envId: config.envId,
    pylon: {
      relayUrl: config.pylon.relayUrl,
      configDir: expandPath(config.pylon.configDir),
      credentialsBackupDir: expandPath(config.pylon.credentialsBackupDir),
      dataDir: path.resolve(repoRoot, config.pylon.dataDir),
      mcpPort: config.pylon.mcpPort,
      defaultWorkingDir: expandPath(config.pylon.defaultWorkingDir),
    },
  });

  // Start Relay
  log('Phase 4', 'Starting PM2 services...');
  const relayResult = startService({
    name: config.relay.pm2Name,
    script: 'dist/bin.js',
    cwd: path.join(repoRoot, 'packages', 'relay'),
    env: {
      PORT: String(config.relay.port),
      STATIC_DIR: relayPublic,
    },
  });
  if (!relayResult.success) {
    return { success: false, error: `Relay start failed: ${relayResult.error}` };
  }
  logDetail(`Relay started: ${config.relay.pm2Name}`);

  // Start Pylon
  const pylonResult = startService({
    name: config.pylon.pm2Name,
    script: 'dist/bin.js',
    cwd: path.join(repoRoot, 'packages', 'pylon'),
    env: {
      ESTELLE_VERSION: version,
      ESTELLE_ENV_CONFIG: envConfig,
    },
  });
  if (!pylonResult.success) {
    return { success: false, error: `Pylon start failed: ${pylonResult.error}` };
  }
  logDetail(`Pylon started: ${config.pylon.pm2Name}`);

  saveServices();

  log('Done', `Deploy complete: (${target})${version}`);
  return { success: true, version };
}
```

**Step 2: Create CLI entry point**

```typescript
// scripts/deploy.ts
import { deploy, DeployTarget } from './deploy/index.js';

const validTargets = ['stage', 'release'];
const target = process.argv[2] as DeployTarget;

if (!target || !validTargets.includes(target)) {
  console.error(`Usage: npx tsx scripts/deploy.ts [${validTargets.join('|')}]`);
  process.exit(1);
}

const startTime = Date.now();
console.log(`\n=== Estelle v2 Build & Deploy (${target}) ===\n`);

deploy({ target })
  .then((result) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (result.success) {
      console.log(`\n=== Deploy Complete (${target}) - ${elapsed}s ===`);
      console.log(`  Version: ${result.version}`);
    } else {
      console.error(`\n[ERROR] ${result.error}`);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error(`\n[ERROR] ${err.message}`);
    process.exit(1);
  });
```

**Step 3: Run integration test manually**

Run: `cd /home/estelle/estelle2 && npx tsx scripts/deploy.ts`
Expected: Shows usage message

**Step 4: Commit**

```bash
git add scripts/deploy/index.ts scripts/deploy.ts
git commit -m "feat(deploy): add main deploy orchestrator and CLI"
```

---

## Task 5: package.json 스크립트 추가

**Files:**
- Modify: `package.json`

**Step 1: Add deploy scripts**

```json
{
  "scripts": {
    "deploy:stage": "npx tsx scripts/deploy.ts stage",
    "deploy:release": "npx tsx scripts/deploy.ts release"
  }
}
```

**Step 2: Verify scripts work**

Run: `cd /home/estelle/estelle2 && pnpm deploy:stage --help || echo "Script exists"`
Expected: Shows usage or runs

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add deploy:stage and deploy:release scripts"
```

---

## Task 6: MCP 서버 수정 (detached 실행)

**Files:**
- Modify: `packages/pylon/src/servers/pylon-mcp-server.ts`

**Step 1: Find and replace _runScript method**

기존 코드 (약 1048-1111행):
```typescript
private _runScript(
  scriptPath: string,
  args: string[],
  cwd: string,
): Promise<{ success: boolean; output?: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      ...args,
    ], {
      cwd,
      windowsHide: true,
    });
    // ... rest of the code
  });
}
```

새 코드:
```typescript
/**
 * 배포 스크립트를 detached 프로세스로 실행합니다.
 * 부모(Pylon)가 재시작되어도 배포는 계속 진행됩니다.
 */
private _runDeployScript(
  target: string,
  cwd: string,
  logFilePath: string,
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

    const child = spawn('npx', ['tsx', 'scripts/deploy.ts', target], {
      cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // 로그 파일에 기록
    child.stdout?.pipe(logStream);
    child.stderr?.pipe(logStream);

    // 부모와 분리
    child.unref();

    // 즉시 응답 (배포는 백그라운드에서 진행)
    resolve({
      success: true,
      message: `배포가 시작되었습니다. 로그: ${path.basename(logFilePath)}`,
    });
  });
}
```

**Step 2: Update _handleDeploy to use new method**

`_handleDeploy` 함수에서 `_runScript` 호출 부분을 `_runDeployScript`로 변경:

```typescript
// 기존: const result = await this._runScript(scriptPath, args, repoRoot);
// 변경:
const result = await this._runDeployScript(target, repoRoot, logFilePath);

if (!result.success) {
  return {
    success: false,
    error: result.message,
  };
}

return {
  success: true,
  target,
  output: result.message,
  logFile: logFileName,
};
```

**Step 3: Verify compilation**

Run: `cd /home/estelle/estelle2 && pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/pylon/src/servers/pylon-mcp-server.ts
git commit -m "feat(pylon): use cross-platform detached deploy script"
```

---

## Task 7: 기존 스크립트 삭제

**Files:**
- Delete: `scripts/build-deploy.ps1`
- Delete: `scripts/deploy-common.ps1`
- Delete: `scripts/build-deploy.sh`

**Step 1: Remove old scripts**

```bash
rm scripts/build-deploy.ps1 scripts/deploy-common.ps1 scripts/build-deploy.sh
```

**Step 2: Verify no references remain**

Run: `grep -r "build-deploy.ps1\|deploy-common.ps1\|build-deploy.sh" --include="*.ts" --include="*.md" .`
Expected: No matches (or only in git history references)

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove legacy PowerShell/Bash deploy scripts"
```

---

## Task 8: 통합 테스트

**Step 1: Test CLI on Linux**

```bash
cd /home/estelle/estelle2
pnpm deploy:release
```

Expected: Build succeeds, PM2 services restart

**Step 2: Verify PM2 status**

```bash
pm2 status
```

Expected: estelle-relay and estelle-pylon running

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete cross-platform deploy implementation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Version generator | `scripts/deploy/version.ts` |
| 2 | Builder module | `scripts/deploy/builder.ts` |
| 3 | PM2 manager | `scripts/deploy/pm2-manager.ts` |
| 4 | Deploy orchestrator | `scripts/deploy/index.ts`, `scripts/deploy.ts` |
| 5 | package.json scripts | `package.json` |
| 6 | MCP server update | `pylon-mcp-server.ts` |
| 7 | Remove old scripts | Delete `.ps1`, `.sh` files |
| 8 | Integration test | Verify end-to-end |
