# Estelle Core 배포 구조 (Linux Cloud)

이 문서는 리눅스 클라우드 환경(89.167.4.124)에서 Estelle 코어가 어떻게 배포되고 로드되는지 설명합니다.

## 1. 디렉토리 구조

```
/home/estelle/
├── estelle2/                      # 메인 저장소 (Git clone)
│   ├── packages/                  # 소스 코드
│   │   ├── core/                  # 공용 타입/유틸리티
│   │   ├── pylon/                 # Pylon (Claude 세션 관리)
│   │   ├── relay/                 # Relay (WebSocket 서버)
│   │   ├── client/                # Web Client
│   │   └── updater/               # 자동 업데이트 시스템
│   │
│   ├── release/                   # 빌드 산출물 (PM2가 실행)
│   │   ├── core/dist/
│   │   ├── pylon/dist/            # ← PM2가 실행하는 경로
│   │   ├── relay/dist/            # ← PM2가 실행하는 경로
│   │   ├── updater/dist/
│   │   ├── node_modules/          # @estelle 심볼릭 링크
│   │   └── ecosystem.config.cjs   # PM2 설정 (자동 생성)
│   │
│   ├── release-data/              # 런타임 데이터
│   │   ├── messages.db            # SQLite 메시지 저장소
│   │   └── logs/                  # 업데이트 로그
│   │
│   ├── config/                    # 설정 파일
│   │   ├── version.json           # 현재 버전
│   │   ├── updater.json           # Updater 설정
│   │   └── environments.cloud.json  # 클라우드 환경 설정
│   │
│   └── node_modules/              # 의존성 (pnpm workspace)
│
├── .claude/                       # Claude Code 설정
│   ├── .claude.json               # MCP 서버 설정
│   └── skills/                    # 스킬 정의
│
└── .pm2/                          # PM2 런타임
    ├── logs/                      # estelle-*.log
    └── pids/                      # PID 파일
```

## 2. PM2 프로세스

현재 실행 중인 Estelle 관련 프로세스:

| 이름 | 스크립트 | 작업 디렉토리 | 역할 |
|------|---------|--------------|------|
| `estelle-relay` | `release/relay/dist/bin.js` | `/home/estelle/estelle2/release/relay` | WebSocket 서버 (포트 8080) |
| `estelle-pylon` | `release/pylon/dist/bin.js` | `/home/estelle/estelle2/release/pylon` | Claude 세션 관리 |
| `estelle-updater` | `packages/updater/start.cjs` | `/home/estelle/estelle2` | 자동 배포 시스템 |

### 2.1 Relay
- **포트**: 8080
- **역할**: 클라이언트-Pylon 간 WebSocket 브릿지
- **환경변수**:
  - `PORT=8080`
  - `STATIC_DIR=/home/estelle/estelle2/release/relay/public`

### 2.2 Pylon
- **역할**: Claude SDK 세션 관리, MCP 서버 호스팅
- **환경변수**:
  - `ESTELLE_VERSION`: 현재 버전 (예: `v0306_4`)
  - `ESTELLE_ENV_CONFIG`: JSON 설정 (아래 참조)

```json
{
  "envId": 0,
  "pylon": {
    "pylonIndex": "3",
    "relayUrl": "ws://localhost:8080",
    "configDir": "/home/estelle/.claude",
    "credentialsBackupDir": "/home/estelle/.claude-credentials",
    "dataDir": "/home/estelle/estelle2/release-data",
    "mcpPort": 9876,
    "defaultWorkingDir": "/home/estelle"
  }
}
```

### 2.3 Updater
- **역할**: 원격 배포 명령 수신 및 실행
- **모드**: 이 서버는 **Master** 모드로 실행 (IP 89.167.4.124)
- **포트**: 9900 (WebSocket)

## 3. 배포 흐름

### 3.1 수동 배포
```bash
cd /home/estelle/estelle2
git pull origin master
pnpm install
pnpm build

# release/ 디렉토리로 복사 (updater의 executeUpdate 참조)
# PM2 재시작
pm2 restart estelle-relay estelle-pylon
pm2 save
```

### 3.2 자동 배포 (estelle-updater)

1. **버전 범프**: `config/version.json` 수정 및 커밋
2. **Updater가 WebSocket으로 명령 수신**
3. **executeUpdate() 실행**:
   ```
   [1/8] git fetch origin
   [2/8] git checkout master
   [3/8] git pull origin master
   [4/8] pnpm install
   [5/8] pnpm build
   [6/8] dist 파일을 release/로 복사
   [7/8] PM2 delete + start (ecosystem.config.cjs 기반)
   [8/8] pm2 save
   ```

### 3.3 복사되는 파일

| 소스 | 대상 |
|------|------|
| `packages/core/dist` | `release/core/dist` |
| `packages/updater/dist` | `release/updater/dist` |
| `packages/pylon/dist` | `release/pylon/dist` |
| `packages/relay/dist` | `release/relay/dist` (Master만) |
| `packages/relay/public` | `release/relay/public` (Master만) |

## 4. 설정 파일

### 4.1 config/version.json
```json
{
  "version": "v0306_4",
  "buildTime": "2026-03-06T08:27:50.394Z"
}
```

### 4.2 config/updater.json
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

### 4.3 config/environments.cloud.json
```json
{
  "envId": 0,
  "relay": {
    "port": 8080,
    "url": "ws://89.167.4.124:8080",
    "pm2Name": "estelle-relay"
  },
  "pylon": {
    "pylonIndex": "3",
    "relayUrl": "ws://localhost:8080",
    "pm2Name": "estelle-pylon",
    "configDir": "~/.claude",
    "credentialsBackupDir": "~/.claude-credentials",
    "mcpPort": 9876,
    "dataDir": "./release-data",
    "defaultWorkingDir": "/home/estelle"
  }
}
```

## 5. Git 저장소

- **Remote**: `https://github.com/sirgrey8209/estelle2.git`
- **Branch**: `master`

## 6. 로그 위치

| 로그 | 경로 |
|------|------|
| PM2 Pylon 출력 | `~/.pm2/logs/estelle-pylon-out.log` |
| PM2 Pylon 에러 | `~/.pm2/logs/estelle-pylon-error.log` |
| PM2 Relay 출력 | `~/.pm2/logs/estelle-relay-out.log` |
| PM2 Relay 에러 | `~/.pm2/logs/estelle-relay-error.log` |
| PM2 Updater | `~/.pm2/logs/estelle-updater-*.log` |
| 업데이트 로그 | `release-data/logs/update-*.log` |
| SDK 메시지 로그 | `release-data/sdk-logs/sdk-YYYY-MM-DD.jsonl` |

## 7. 유용한 명령어

```bash
# PM2 상태 확인
pm2 list

# 로그 실시간 확인
pm2 logs estelle-pylon
pm2 logs estelle-relay

# 재시작
pm2 restart estelle-pylon
pm2 restart estelle-relay

# 전체 재시작 (ecosystem 사용)
pm2 start /home/estelle/estelle2/release/ecosystem.config.cjs

# 현재 버전 확인
cat /home/estelle/estelle2/config/version.json
```

## 8. 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                     Linux Cloud (89.167.4.124)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐     ┌──────────────────────────────────┐ │
│   │  estelle-relay  │◄────│  Web Clients (브라우저)          │ │
│   │   (포트 8080)    │     └──────────────────────────────────┘ │
│   └────────┬────────┘                                          │
│            │ WebSocket                                          │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │  estelle-pylon  │──────► Claude SDK (세션 관리)            │
│   │   (포트 9876)    │                                          │
│   │   MCP Server    │                                          │
│   └─────────────────┘                                          │
│                                                                 │
│   ┌─────────────────┐     ┌──────────────────────────────────┐ │
│   │ estelle-updater │◄────│  Office Agents (원격 머신)       │ │
│   │   (포트 9900)    │     │  112.170.250.11                  │ │
│   │   Master Mode   │     │  112.170.250.136                 │ │
│   └─────────────────┘     └──────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

*문서 작성일: 2026-03-06*
*현재 버전: v0306_4*
