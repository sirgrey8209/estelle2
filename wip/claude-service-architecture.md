# ClaudeBeacon 아키텍처

## 배경

- 현재: 환경별 (dev/stage/release) Claude Code 인스턴스 3개 + credentials 3개
- 문제: 안 쓰는 환경의 토큰 만료 → 인증 불안정
- 해결: 전역 ClaudeBeacon으로 통합

## 목표 구조

```
┌─────────────────────────────────────────────────────────┐
│  ClaudeBeacon (전역)                                     │
│                                                         │
│  - Claude SDK 실행 (credentials 단일 관리)               │
│  - 계정 전환: 회사/개인 교체 기능                         │
│  - ToolContextMap: toolUseId → Pylon 주소 매핑          │
│  - 역할: 라우터 (주소록) - 데이터 해석 X                  │
└─────────────────────────────────────────────────────────┘
        │
        ├── Dev Pylon (상태 관리, 도구 로직)
        ├── Stage Pylon
        └── Release Pylon
```

## 설계 원칙

1. **ClaudeBeacon은 라우터 역할만** - toolUseId → Pylon 주소 알려주기
2. **수정 최소화** - raw 데이터 전달로 확장성 확보
3. **실제 로직은 Pylon에서** - Beacon은 데이터 해석 안 함

## 핵심 기능

### 1. Claude SDK 실행 + 단일 credentials 관리
- ClaudeBeacon이 Claude SDK 실행
- 하나의 credentials로 모든 환경 처리
- 토큰 갱신이 자연스럽게 유지됨

### 2. 계정 전환
- 회사 계정 (team) ↔ 개인 계정 (max) 전환
- ClaudeBeacon이 credentials 교체 담당

### 3. toolUseId → Pylon 라우팅 (방식 B)

ClaudeBeacon이 SDK 이벤트를 직접 받아서 맵 등록:

```
ClaudeBeacon (Claude SDK 실행)
  │
  │ content_block_start (tool_use)
  │ → 바로 map.set(toolUseId, { pylonAddress, raw })
  │
  │     ... SDK가 MCP 스폰 ...
  │
MCP ─────── lookup ────────────► map.get() → pylonAddress 반환
  │
  └─────── 직접 연결 ──────────► Pylon (실제 작업)
```

### 4. 통신 프로토콜

**MCP → ClaudeBeacon (조회)**
```json
{ "action": "lookup", "toolUseId": "toolu_xxx" }
```

**ClaudeBeacon → MCP (응답)**
```json
{
  "pylonAddress": "127.0.0.1:9878",
  "raw": { ... }  // SDK 이벤트 데이터 그대로 전달
}
```

**MCP → Pylon (직접 연결해서 작업)**

## 검증 필요 사항

### tool_use 이벤트 타이밍
- [x] content_block_start (tool_use) 가 MCP 실행보다 먼저인지 확인 ✅
  - **결과**: content_block_start가 약 2.8초 먼저 발생
  - content_block_start: `1770687980168` (01:46:20.168)
  - MCP call: `1770687982955` (01:46:22.955)
  - **결론**: Service가 맵 빌드할 충분한 시간 있음

## TODO

- [x] 타이밍 테스트 ✅
- [x] 아키텍처 설계 ✅
- [ ] ClaudeBeacon 패키지 생성 (`packages/claude-beacon`)
- [ ] TDD 구현
  - [ ] ToolContextMap (lookup 기능)
  - [ ] TCP 서버 (MCP 조회 응답)
  - [ ] credentials 관리 / 계정 전환
- [ ] Pylon 수정 (ClaudeBeacon 연동)
- [ ] MCP 수정 (ClaudeBeacon에서 주소 조회 후 Pylon 연결)
