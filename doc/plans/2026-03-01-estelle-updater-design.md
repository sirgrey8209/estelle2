# estelle-updater 설계

## 개요

Git 기반 크로스 플랫폼 배포 시스템. Windows와 Linux 환경 간 코드 동기화 및 자동 배포를 지원한다.

## 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    estelle-updater                           │
│              (단일 코드, 역할 자동 분기)                       │
│                                                              │
│   myIp == masterIp → Master 모드 (서버 + 자체 배포)           │
│   myIp != masterIp → Agent 모드 (클라이언트)                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Hetzner (5.223.72.58)                           │
│              myIp == masterIp → Master 모드                  │
│                                                              │
│   - WebSocket 서버 (포트 9900)                               │
│   - IP whitelist 인증                                        │
│   - MCP 도구 / CLI 수신                                      │
│   - 자기 자신도 배포 대상                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ WebSocket (실시간 로그 스트리밍)
          ┌────────────────┼────────────────┐
          ▼                                 ▼
   ┌──────────────┐                  ┌──────────────┐
   │estelle-updater│                  │estelle-updater│
   │  (Windows)    │                  │   (기타)      │
   │  Agent 모드   │                  │   Agent 모드  │
   └──────────────┘                  └──────────────┘
```

## 역할 자동 분기

```typescript
const config = loadConfig('config/updater.json');
const myIp = getMyExternalIp();
const masterIp = parseIp(config.masterUrl);

if (myIp === masterIp) {
  startAsMaster(config);  // WebSocket 서버 + 자체 agent
} else {
  startAsAgent(config);   // Master에 연결
}
```

## 설정 파일

```json
// config/updater.json (Git 커밋)
{
  "masterUrl": "ws://5.223.72.58:9900",
  "whitelist": ["5.223.72.58", "121.x.x.x"]
}
```

- `masterUrl`: Master WebSocket 서버 주소
- `whitelist`: 연결 허용 IP 목록 (Master가 검증)

## 명령 인터페이스

### MCP 도구

```typescript
// 모든 agent + master 배포
update({ target: 'all', branch: 'master' })

// 특정 IP만 배포
update({ target: '121.x.x.x', branch: 'hotfix-123' })
```

### CLI

```bash
# 모든 agent + master 배포
npx estelle-updater trigger all master

# 특정 IP만 배포
npx estelle-updater trigger 121.x.x.x hotfix-123
```

## Agent 동작 흐름

1. 명령 수신 (WebSocket 또는 로컬)
2. `git fetch origin`
3. `git checkout {branch}`
4. `git pull origin {branch}`
5. `pnpm deploy:release` 실행
6. 로그 실시간 스트리밍 → Master → 명령자
7. 완료/실패 알림

## 실시간 로그 스트리밍

```
Agent → Master → CLI/MCP

[5.223.72.58] git pull origin master...
[5.223.72.58] Already up to date.
[5.223.72.58] pnpm deploy:release...
[121.x.x.x] git pull origin master...
[5.223.72.58] ✓ 완료 v0301_4
[121.x.x.x] Building...
[121.x.x.x] ✓ 완료 v0301_4
```

## 보안

- IP whitelist 기반 인증
- whitelist에 없는 IP는 연결 거부
- whitelist는 Git에 커밋되어 버전 관리

## PM2 서비스

- 서비스명: `estelle-updater` (모든 환경 동일)
- 역할은 설정 파일과 자기 IP 비교로 자동 결정

## 실패 처리

- 실패 시 알림만 (자동 롤백 없음)
- 수동으로 상황 판단 후 대응

## 파일 구조

```
packages/updater/
├── src/
│   ├── index.ts          # 진입점, 역할 분기
│   ├── master.ts         # Master 모드 로직
│   ├── agent.ts          # Agent 모드 로직
│   ├── deploy.ts         # git pull + deploy 실행
│   ├── config.ts         # 설정 로드
│   └── types.ts          # 타입 정의
├── package.json
└── tsconfig.json

config/
└── updater.json          # 설정 파일 (Git 커밋)
```
