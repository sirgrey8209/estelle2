# 크로스 플랫폼 배포 스크립트 설계

> 작성일: 2026-03-01

## 개요

MCP 배포 도구가 Linux 환경에서 동작하지 않는 문제를 해결하기 위해 크로스 플랫폼 배포 스크립트를 설계합니다.

## 문제

### Root Cause

`pylon-mcp-server.ts`의 `_runScript()` 함수가 Windows PowerShell 전용으로 하드코딩:

```typescript
// 기존 코드 (Windows 전용)
const child = spawn('powershell.exe', [
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', scriptPath,
  ...args,
]);
```

### 영향

- Linux 서버(Hetzner)에서 MCP 배포 도구 실패
- `build-deploy.sh`와 `build-deploy.ps1` 기능 불일치

## 설계

### 핵심 변경

1. **Node.js 기반 배포 스크립트** - 플랫폼 독립적
2. **CLI 우선** - Pylon이 죽어도 배포 가능
3. **Detached 실행** - MCP에서 호출 시 부모 프로세스와 분리
4. **Fly.io 제거** - PM2 로컬 배포로 통합

### 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    배포 트리거                           │
├─────────────────────────────────────────────────────────┤
│  CLI 직접 실행         │  MCP 도구 호출                  │
│  pnpm deploy:release   │  deploy({ target: 'release' }) │
└───────────┬────────────┴────────────┬───────────────────┘
            │                         │
            │                         │ spawn(detached)
            ▼                         ▼
┌─────────────────────────────────────────────────────────┐
│              scripts/deploy.ts (Node.js)                │
├─────────────────────────────────────────────────────────┤
│  1. 버전 생성 (vMMDD_N)                                 │
│  2. TypeScript 빌드 (pnpm build)                        │
│  3. PM2 재시작 (Relay + Pylon)                          │
│  4. 로그 파일 기록                                       │
└─────────────────────────────────────────────────────────┘
```

### 파일 구조

```
scripts/
├── deploy.ts              # CLI 진입점
├── deploy/
│   ├── builder.ts         # pnpm build 실행
│   ├── pm2-manager.ts     # PM2 stop/start
│   └── version.ts         # 버전 생성 (vMMDD_N)
```

### MCP 서버 수정

```typescript
// pylon-mcp-server.ts
private _runScript(target: string, cwd: string): Promise<Result> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', 'scripts/deploy.ts', target], {
      cwd,
      detached: true,    // 부모와 분리
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // 로그 파일에 기록
    const logStream = fs.createWriteStream(logFilePath);
    child.stdout?.pipe(logStream);
    child.stderr?.pipe(logStream);

    child.unref();  // 부모가 자식을 기다리지 않음

    // 즉시 응답 (배포는 백그라운드에서 진행)
    resolve({ success: true, message: '배포가 시작되었습니다' });
  });
}
```

### 삭제 대상

- `scripts/build-deploy.ps1`
- `scripts/deploy-common.ps1`
- `scripts/build-deploy.sh`
- `scripts/promote-stage.ps1` (있다면)
- Fly.io 관련 코드 (`New-Dockerfile`, `New-FlyToml`, `Deploy-FlyRelay`)

### package.json 추가

```json
{
  "scripts": {
    "deploy:stage": "npx tsx scripts/deploy.ts stage",
    "deploy:release": "npx tsx scripts/deploy.ts release"
  }
}
```

## 흐름

### CLI 실행

```bash
pnpm deploy:release
```

1. 버전 생성
2. `pnpm build` 실행
3. PM2 stop (estelle-relay, estelle-pylon)
4. PM2 start
5. 로그 출력

### MCP 호출

```
MCP 호출 → spawn(detached) → 즉시 응답 "배포 시작됨"
                ↓
           배포 스크립트 (독립 실행)
                ↓
           Pylon 재시작 (기존 Pylon 종료)
                ↓
           배포 완료 → 로그 파일에 기록
```

## 제약사항

1. **자기 환경 배포 불가** - release에서 release 배포 X
2. **promote 지원** - stage에서 release로 승격 (stage에서만)
3. **타임아웃** - 3분 초과 시 실패 처리

## 테스트 계획

1. Linux에서 `pnpm deploy:release` 동작 확인
2. Windows에서 `pnpm deploy:stage` 동작 확인
3. MCP 도구 호출 시 detached 실행 확인
4. Pylon 재시작 후 배포 계속 진행 확인

## 마이그레이션

1. Node.js 배포 스크립트 구현
2. `pylon-mcp-server.ts` 수정
3. package.json에 스크립트 추가
4. 기존 PowerShell/Bash 스크립트 삭제
5. 문서 업데이트 (완료)
