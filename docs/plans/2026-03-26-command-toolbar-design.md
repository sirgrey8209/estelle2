# Command Toolbar Design

입력창 위에 워크스페이스별 커맨드 버튼을 배치하고, 클릭하면 해당 커맨드를 현재 대화에 전송하는 기능.

## 데이터 모델

Pylon SQLite에 두 테이블 추가:

```sql
CREATE TABLE IF NOT EXISTS commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS command_assignments (
  command_id INTEGER NOT NULL REFERENCES commands(id) ON DELETE CASCADE,
  workspace_id INTEGER,
  UNIQUE(command_id, workspace_id)
);
```

- `icon`: Lucide 아이콘 이름 또는 이모지
- `color`: 아이콘 색상 (nullable, Lucide 아이콘에만 적용)
- `command_assignments.workspace_id`: NULL이면 글로벌 (모든 워크스페이스에 표시)

## 메시지 타입

### Client → Pylon

| 타입 | Payload | 설명 |
|------|---------|------|
| `COMMAND_LIST_REQUEST` | `{ workspaceId }` | 워크스페이스의 커맨드 목록 요청 |
| `COMMAND_EXECUTE` | `{ commandId, conversationId }` | 커맨드 실행 (ID만 전송, Pylon이 content 조회) |
| `COMMAND_CREATE` | `{ name, icon?, color?, content, workspaceIds? }` | 커맨드 생성 |
| `COMMAND_UPDATE` | `{ commandId, name?, icon?, color?, content? }` | 커맨드 수정 |
| `COMMAND_DELETE` | `{ commandId }` | 커맨드 삭제 |
| `COMMAND_ASSIGN` | `{ commandId, workspaceId, assign }` | 워크스페이스 할당/해제 |

### Pylon → Client

| 타입 | Payload | 설명 |
|------|---------|------|
| `COMMAND_LIST` | `[{ id, name, icon, color }]` | 커맨드 목록 응답 (content 미포함) |
| `COMMAND_CHANGED` | - | 커맨드 변경 알림 (클라이언트가 목록 재요청) |

## 실행 흐름

```
버튼 클릭
→ Client: COMMAND_EXECUTE { commandId, conversationId } 전송
→ Pylon: DB에서 commands.content 조회
→ Pylon: 기존 CLAUDE_SEND 처리와 동일하게 Claude에게 전달
```

클라이언트는 커맨드의 content를 알 필요 없음. 목록 표시용 id, name, icon, color만 수신.

## MCP 도구

| 도구 | 파라미터 | 설명 |
|------|---------|------|
| `create_command` | `name`, `icon?`, `color?`, `content`, `workspaceIds?` | 커맨드 생성 (workspaceIds 생략 시 글로벌) |
| `update_command` | `commandId`, `name?`, `icon?`, `color?`, `content?` | 커맨드 수정 |
| `delete_command` | `commandId` | 커맨드 삭제 |
| `list_commands` | `workspaceId?` | 커맨드 목록 조회 |
| `assign_command` | `commandId`, `workspaceIds` | 워크스페이스 할당 변경 |

## 클라이언트 UI

```
InputBar 영역
├── CommandToolbar          ← 새로 추가
│   ├── CommandButton x N   (아이콘 + 이름, 클릭 → COMMAND_EXECUTE)
│   └── EditButton          (+ 버튼, 인라인 편집 모드 진입)
├── SuggestionChips         (기존)
├── 첨부 파일 미리보기       (기존)
└── 입력 영역               (기존)
```

- 현재 워크스페이스의 커맨드 버튼을 가로로 나열
- 인라인 편집: + 버튼으로 추가, 버튼 롱프레스/우클릭으로 수정/삭제
- 커맨드가 없으면 툴바 영역 숨김

## Pylon 처리

`command-store.ts` (새 파일):

- `_initSchema()`: 테이블 생성
- `getCommands(workspaceId)`: `WHERE workspace_id IS NULL OR workspace_id = ?`
- `createCommand(name, icon, color, content)`: INSERT
- `updateCommand(id, fields)`: UPDATE
- `deleteCommand(id)`: DELETE (CASCADE)
- `assignCommand(commandId, workspaceId)`: INSERT assignment
- `unassignCommand(commandId, workspaceId)`: DELETE assignment
- `getContent(commandId)`: content 조회 (실행 시)

`handleMessage`에 커맨드 메시지 타입 라우팅 추가.

## 에러 처리

- 존재하지 않는 commandId 실행 → 클라이언트에 에러 메시지 응답
- 커맨드 삭제 시 → CASCADE로 assignments 자동 정리
- 워크스페이스 삭제 시 → 해당 workspace_id의 assignments만 삭제 (커맨드 자체 유지)
