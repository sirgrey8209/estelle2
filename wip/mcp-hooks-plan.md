# MCP-Pylon TCP 통신 구현 계획

## 구현 목표

MCP 서버가 TCP로 Pylon에 조회/요청하여 entityId 기반 작업을 수행할 수 있게 한다.

## 구현 방향

1. **Pylon TCP 서버**: localhost:9876에서 MCP 요청 처리
2. **toolUseId → entityId 매핑**: content_block_start 시점에 저장
3. **MCP 도구**: TCP로 Pylon에 요청, 결과 즉시 반환

## MCP 도구 목록

| 도구명 | 요청 | 응답 |
|--------|------|------|
| `link_doc` | `{ action: 'link', toolUseId, path }` | `{ success, docs }` |
| `unlink_doc` | `{ action: 'unlink', toolUseId, path }` | `{ success, docs }` |
| `list_docs` | `{ action: 'list', toolUseId }` | `{ docs }` |

## 영향 범위

- 수정 필요:
  - `packages/pylon/src/pylon.ts` — TCP 서버 시작
  - `packages/pylon/src/claude/claude-manager.ts` — toolUseId→entityId 매핑
  - `packages/pylon/src/mcp/server.ts` — 새 도구 등록, TCP 클라이언트
- 신규 생성:
  - `packages/pylon/src/mcp/pylon-bridge.ts` — TCP 클라이언트 (MCP→Pylon)
  - `packages/pylon/src/mcp/tools/link-document.ts` — MCP 도구

## 파일 구조

```
packages/pylon/src/
├── pylon.ts                    # TCP 서버 추가
├── claude/
│   └── claude-manager.ts       # toolUseId→entityId 매핑 추가
└── mcp/
    ├── server.ts               # 도구 등록
    ├── pylon-bridge.ts         # TCP 클라이언트 (신규)
    └── tools/
        ├── send-file.ts
        ├── deploy.ts
        └── link-document.ts    # 신규
```

## 통신 프로토콜

```
MCP (별도 프로세스) ─── TCP localhost:9876 ──→ Pylon (PM2)
                                                  │
                                                  ├── toolUseId → entityId 조회
                                                  └── workspaceStore 조작
```
