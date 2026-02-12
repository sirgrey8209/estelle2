# Beacon SDK 실행 에러

## 상태: 해결됨 (2026-02-12)

## 증상

Beacon을 통해 SDK 쿼리 시 `Claude Code process exited with code 1` 에러 발생.

```
[Beacon] Query error (conversationId=8520706): Claude Code process exited with code 1
```

## 원인

`bin.ts`의 SDK 어댑터에서 `env` 옵션을 명시적으로 설정했던 것이 문제였습니다.

```typescript
// 문제가 된 코드
env: {
  PATH: process.env.PATH || '',
  PATHEXT: process.env.PATHEXT || '',
  CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR || '',
  // ... 일부 환경변수만 전달
}
```

SDK는 `env` 옵션이 명시적으로 설정되면 **해당 값만 사용**하고, 전체 `process.env`를 상속받지 않습니다.
이로 인해 SDK 내부에서 필요한 일부 환경변수가 누락되어 Claude Code 프로세스가 실패했습니다.

## 해결

`env` 옵션을 제거하여 SDK 기본 동작(전체 `process.env` 상속)을 사용하도록 변경했습니다.

```typescript
// 수정된 코드 (bin.ts)
const sdkOptions = {
  cwd: options.cwd,
  abortController: options.abortController,
  includePartialMessages: (options.includePartialMessages ?? true),
  settingSources: (options.settingSources ?? ['user', 'project', 'local']),
  resume: options.resume,
  mcpServers: options.mcpServers,
  canUseTool: options.canUseTool,
  // env 옵션 제거 - SDK가 전체 process.env를 상속받음
  // CLAUDE_CONFIG_DIR은 PM2 ecosystem.config.cjs에서 이미 설정됨
  stderr: (data: string) => {
    console.error(`[Beacon] SDK stderr: ${data.trimEnd()}`);
  },
};
```

## 검증

시작 시 SDK 테스트 쿼리 추가 후 확인:

```
[ClaudeBeacon] Running startup SDK test...
[Beacon Test] msg.type=system
[Beacon Test] msg.type=assistant
[Beacon Test] msg.type=result
[Beacon Test] Result: success
[ClaudeBeacon] SDK test PASSED!
```

## 참고

- **하니엘봇**: `env` 옵션 미설정 → 정상 동작
- **Beacon**: `env` 옵션 명시적 설정 → 실패 → 제거 후 정상 동작
- `CLAUDE_CONFIG_DIR`은 PM2 ecosystem.config.cjs에서 설정하면 `process.env`를 통해 자동 전달됨

## 수정 파일

- `packages/claude-beacon/src/bin.ts`: `env` 옵션 제거
