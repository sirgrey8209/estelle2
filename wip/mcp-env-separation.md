# MCP 환경별 분리 문제

## 상태
🤔 설계 검토 필요

## 문제 상황

현재 MCP-Pylon TCP 통신 구조:
```
MCP 서버 (Claude가 spawn) ──TCP 9876──> Pylon (PM2)
```

dev/stage/release가 **동시에 실행**될 수 있음:
- dev: `pnpm dev` (직접 실행)
- stage: PM2 `estelle-pylon-stage`
- release: PM2 `estelle-pylon`

### 충돌 포인트

1. **TCP 포트**
   - 현재 9876 하드코딩
   - 3개 환경이 동시 실행 시 포트 충돌

2. **MCP 서버 경로**
   - Claude SDK에 등록되는 MCP 서버 경로가 환경별로 달라야 함
   - dev: `packages/pylon/dist/mcp/server.js`
   - stage: `release-stage/pylon/dist/mcp/server.js`
   - release: `release/pylon/dist/mcp/server.js`

3. **MCP 서버가 어느 Pylon에 연결할지**
   - MCP 서버는 Claude가 spawn → 자신의 환경을 알아야 함
   - 환경변수? 빌드 시 주입?

## 해결 방안 후보

### 방안 A: 환경별 포트 분리
```
dev:     TCP 9876
stage:   TCP 9877
release: TCP 9878
```

**장점**: 단순, 명확
**단점**: 포트 3개 관리 필요

구현:
```typescript
// environments.json에 추가
"dev": { "mcp": { "tcpPort": 9876 } }
"stage": { "mcp": { "tcpPort": 9877 } }
"release": { "mcp": { "tcpPort": 9878 } }

// 빌드 시 ESTELLE_MCP_PORT 주입
// pylon-bridge.ts, tcp-server.ts에서 환경변수로 포트 결정
```

### 방안 B: MCP 서버 통합 (하나만 유지)
release MCP만 사용, 모든 환경이 release MCP에 연결

**장점**: 관리 단순
**단점**:
- dev/stage 테스트 시 release MCP 필요
- MCP 변경 시 바로 테스트 불가

### 방안 C: Unix 소켓 사용 (Windows 미지원)
환경별 소켓 파일: `/tmp/estelle-mcp-{env}.sock`

**장점**: 포트 충돌 없음
**단점**: Windows 미지원 → 탈락

### 방안 D: Named Pipe (Windows)
Windows Named Pipe + Unix Socket 하이브리드

**장점**: OS 네이티브
**단점**: 구현 복잡

## 추가 고려사항

1. **MCP 서버 등록 위치**
   - `claude_desktop_config.json`에서 MCP 서버 경로 설정
   - 환경별로 다른 설정 필요?
   - 아니면 Pylon이 동적으로 등록?

2. **Claude SDK mcpServers 설정**
   - Pylon에서 `process.spawn()`으로 MCP 서버 실행
   - 환경별 다른 경로 지정 필요

3. **dev 환경에서의 MCP 테스트**
   - `pnpm dev` 실행 시 MCP도 같이 동작해야 함
   - 현재는 PM2 배포 환경만 고려

## 결론

**방안 A (환경별 포트 분리)** 가 가장 현실적

구현 단계:
1. `environments.json`에 `mcp.tcpPort` 추가
2. 빌드 스크립트에서 `ESTELLE_MCP_PORT` 주입
3. `pylon-bridge.ts`, `tcp-server.ts`에서 환경변수로 포트 결정
4. MCP 서버 등록 경로도 환경별로 분리

## 질문

- [ ] MCP 서버가 환경을 어떻게 알 수 있나? (빌드 시 주입 vs 런타임 감지)
- [ ] dev 환경에서 MCP 테스트 방법은?
- [ ] Claude SDK에 MCP 등록하는 시점/방법 확인 필요
