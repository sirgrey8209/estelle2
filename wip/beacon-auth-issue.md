# Beacon 인증 문제 디버깅

## 현재 상황 (2026-02-11)

### 문제
Dev 환경에서 대화 시도 시 다음 에러 발생:
1. `Invalid API key · Please run /login`
2. `Claude Code process exited with code 1`

### 아키텍처 확인

```
Dev Pylon ──(TCP)──> Beacon ──(SDK)──> Claude API
   │                   │
   │ BEACON_ENABLED    │ CLAUDE_CONFIG_DIR
   │ = true            │ = ~/.claude-release
   │                   │
   └── ~/.claude-dev   └── ~/.claude-release (설정)
       (MCP config)        (credentials)
```

### 확인된 사항

1. **Dev Pylon 설정** (정상)
   - `ESTELLE_ENV_CONFIG`로 beacon 설정 주입됨
   - `[Claude] Using ClaudeBeaconAdapter (127.0.0.1:9875, env=dev)` 로그 확인
   - 비콘에 연결됨: `[Beacon] Connected to 127.0.0.1:9875`

2. **Beacon 설정** (정상)
   - PM2 환경변수: `CLAUDE_CONFIG_DIR: C:\Users\LINEGAMES\.claude-release`
   - 비콘 로그에 `Connected Pylons: dev(1)` 확인

3. **Credentials 상태**
   - `~/.claude-release/.credentials.json`: **정상** (토큰 만료 안됨, ~6시간 남음)
   - `~/.claude-dev/.credentials.json`: **손상됨** (공백으로 가득 참)
   - `~/.claude-dev/.claude.json`: **손상됨** → 복구됨 (release에서 복사)

4. **SDK 로그** (`dev-data/sdk-logs/sdk-2026-02-11.jsonl`)
   ```json
   {"error":"authentication_failed"}
   {"text":"Invalid API key · Please run /login"}
   ```

### 핵심 의문점

**비콘이 `CLAUDE_CONFIG_DIR=~/.claude-release`로 설정되어 있는데, 왜 인증 에러가 발생하는가?**

가능한 원인:
1. SDK가 `CLAUDE_CONFIG_DIR` 외에 다른 경로도 참조
2. SDK가 `settingSources: ['user', 'project', 'local']`로 인해 프로젝트별 설정을 우선 사용
3. `cwd` 옵션으로 전달된 경로에서 credentials를 찾으려 시도

### 추가 확인 결과

1. `~/.claude/.credentials.json` (기본 경로): **유효함** (08:07까지)
2. `~/.claude-release/.credentials.json`: **유효함** (08:20까지)
3. `~/.claude-dev/.credentials.json`: **손상됨** → 복구됨

**가설**: SDK가 `CLAUDE_CONFIG_DIR` 환경변수를 무시하고 기본 경로 `~/.claude`를 사용할 수 있음.
하지만 `~/.claude`도 유효한데 왜 인증 에러가 나는지 추가 조사 필요.

### 임시 해결책 (적용됨)

- `~/.claude-dev/.credentials.json`을 `~/.claude-release`에서 복사
- `~/.claude-dev/.claude.json`을 `~/.claude-release`에서 복사

### 근본적 해결 필요

1. Beacon이 SDK 호출 시 credentials 경로를 명시적으로 지정하는 방법 조사
2. 또는 모든 환경이 동일한 credentials를 공유하도록 심볼릭 링크 설정

## 관련 파일

- `packages/claude-beacon/src/bin.ts`: Beacon SDK 어댑터
- `packages/claude-beacon/ecosystem.config.cjs`: PM2 설정 (CLAUDE_CONFIG_DIR)
- `packages/pylon/src/bin.ts`: Pylon beacon 연결 로직
- `scripts/dev-server.js`: Dev 환경 시작 스크립트

## 미해결 이슈

1. **Beacon 재접속 로직 없음**: Beacon 재시작 시 Pylon이 자동 재연결하지 않음
2. **SDK credentials 경로**: Beacon의 CLAUDE_CONFIG_DIR이 SDK에 적용되는지 확인 필요
