# Estelle MCP 도구 레퍼런스

> 코드 기반 분석 (2026-03-16)

## MCP 서버 구조

```
Pylon
  └── PylonMcpServer (stdio)
       ├── TCP 서버 (ESTELLE_MCP_PORT)
       └── Tools (12개)
```

### 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `ESTELLE_MCP_PORT` | MCP TCP 서버 포트 | 9880 |
| `ESTELLE_WORKING_DIR` | 상대 경로 기준 | - |
| `DATA_DIR` | 데이터/로그 디렉토리 | - |
| `MCP_TIMEOUT` | MCP 요청 타임아웃 (밀리초) | 5000 |

### 포트 할당

| 환경 | 포트 |
|------|------|
| release | 9876 |
| stage | 9877 |
| dev | 9878 |
| test | 9879 |

---

## 1. send_file

파일을 사용자에게 전송

### 파라미터

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `path` | string | O | 전송할 파일 경로 (절대 또는 상대) |
| `description` | string | X | 파일 설명 |

### 반환값

```json
{
  "success": true,
  "file": {
    "path": "/path/to/file",
    "filename": "file.txt",
    "mimeType": "text/plain",
    "size": 1024,
    "description": "optional description"
  }
}
```

### 처리 흐름

1. path 검증 (필수)
2. PylonClient.sendFileByToolUseId() 호출
3. toolUseId → conversationId 매핑
4. 파일 존재 여부 확인
5. 청크 단위로 파일 전송

---

## 2. get_status

현재 대화 및 Pylon 상태 조회

### 파라미터

없음 (toolUseId로 대화 식별)

### 반환값

```json
{
  "success": true,
  "status": {
    "environment": "release",
    "version": "v0313_3",
    "workspace": { "id": 1, "name": "..." },
    "conversationId": 132097,
    "linkedDocuments": [{ "path": "/docs/spec.md", "addedAt": 1710524400000 }]
  }
}
```

---

## 3. create_conversation

현재 워크스페이스에 새 대화 생성

### 파라미터

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | X | 대화 이름 (기본: "새 대화") |
| `files` | string[] | X | 연결할 파일 경로 |
| `agent` | string | X | 에이전트 선택 ("claude" 또는 "codex", 기본: "claude") |

### 반환값

```json
{
  "success": true,
  "conversation": {
    "conversationId": 132098,
    "name": "새 대화",
    "linkedDocuments": []
  }
}
```

---

## 4. delete_conversation

대화 삭제

### 파라미터

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `target` | string | O | 대화 이름 또는 ID |

### 반환값

```json
{
  "success": true,
  "deleted": { "conversationId": 132097, "name": "삭제된 대화" }
}
```

### 제약

- 현재 대화는 삭제 불가

---

## 5. rename_conversation

대화 이름 변경

### 파라미터

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `newName` | string | O | 새 이름 |
| `target` | string | X | 대화 이름/ID (없으면 현재 대화) |

### 반환값

```json
{
  "success": true,
  "conversation": { "conversationId": 132097, "name": "새 이름" }
}
```

---

## 6. link_doc

현재 대화에 문서 연결

### 파라미터

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `path` | string | O | 문서 경로 |

### 반환값

```json
{
  "success": true,
  "path": "/path/to/doc.md",
  "docs": ["/path/to/doc.md", "/other/doc.md"]
}
```

### 동작

- WorkspaceStore.linkDocument() 호출
- 브로드캐스트로 클라이언트 동기화
- 활성 세션에 "문서 추가됨" 리마인더 전송

---

## 7. unlink_doc

문서 연결 해제

### 파라미터

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `path` | string | O | 문서 경로 |

### 반환값

```json
{
  "success": true,
  "path": "/path/to/doc.md"
}
```

---

## 8. list_docs

연결된 문서 목록 조회

### 파라미터

없음

### 반환값

```json
{
  "success": true,
  "docs": ["/path/to/doc1.md", "/path/to/doc2.md"]
}
```

---

## 9. add_prompt

파일 내용을 시스템 프롬프트로 설정

### 파라미터

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `path` | string | O | 프롬프트 파일 경로 |

### 반환값

```json
{
  "success": true,
  "message": "System prompt set",
  "newSession": true,
  "path": "/path/to/prompt.md"
}
```

### 동작

1. ESTELLE_WORKING_DIR 기준 절대 경로 해석
2. 파일 존재 및 타입 확인
3. UTF-8로 읽기
4. PylonClient.setSystemPromptByToolUseId() 호출
5. 새 세션 자동 시작

---

## 10. continue_task

세션 재시작 (히스토리 유지)

### 파라미터

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `reason` | string | X | 재시작 사유 (예: "토큰 한도 초과") |

### 반환값

```json
{
  "success": true,
  "message": "Session restarted",
  "newSession": true,
  "systemMessageAdded": true,
  "historyPreserved": true
}
```

### 동작

1. 현재 세션 종료
2. 재시작 로그 메시지 추가
3. 새 세션 시작 (히스토리 유지)

---

## 11. run_widget

인터랙티브 위젯 세션 시작 (CLI 프로세스)

### 파라미터

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `command` | string | O | 실행할 CLI 명령어 |
| `cwd` | string | O | 작업 디렉토리 (절대 경로) |
| `args` | string[] | X | CLI 인자 |

### 반환값

```json
{
  "success": true,
  "result": {
    "exitCode": 0,
    "stdout": "...",
    "stderr": ""
  }
}
```

### 동작

1. command, cwd 검증
2. PylonClient.runWidget() 호출
3. Widget 세션 생성 → WIDGET_READY 브로드캐스트
4. 클라이언트가 WIDGET_CLAIM → CLI 프로세스 실행
5. WIDGET_RENDER/WIDGET_INPUT으로 양방향 통신
6. CLI 완료 시 WIDGET_COMPLETE 브로드캐스트
7. **타임아웃 없음** - 사용자 인터랙션 대기

---

## 12. run_widget_inline

인라인 위젯 세션 시작 (HTML/JavaScript)

### 파라미터

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `html` | string | O | HTML 템플릿 (CSS 포함 가능) |
| `code` | string | X | JavaScript 코드 |
| `height` | number | X | 초기 높이 (px) |

### 반환값

```json
{
  "success": true,
  "result": {
    "data": {},
    "action": "submit"
  }
}
```

### 동작

1. html 검증
2. PylonClient.runWidgetInline() 호출
3. CLI 프로세스 없이 클라이언트가 HTML을 직접 렌더링
4. 사용자 액션 제출까지 대기
5. **타임아웃 없음**

### run_widget과의 차이

- CLI 프로세스 불필요 (클라이언트 사이드 실행)
- HTML/CSS/JS로 커스텀 UI 구성
- 더 가볍고 빠름

---

## 공통 응답 형식

### 성공

```json
{
  "content": [{ "type": "text", "text": "{...JSON...}" }]
}
```

### 실패

```json
{
  "content": [{ "type": "text", "text": "{\"success\":false,\"error\":\"...\"}" }],
  "isError": true
}
```

---

## PylonClient 통신

### 연결 방식

```
MCP 도구 호출
    ↓
PylonClient (TCP 연결 127.0.0.1:ESTELLE_MCP_PORT)
    ↓
PylonMcpServer (Pylon 내부 TCP 서버)
    ↓
toolUseId → conversationId 매핑
    ↓
실제 처리 (Store, AgentManager, WidgetManager 등)
```

### toolUseId 기반 라우팅

- Claude가 도구 호출 시 `toolUseId` 발급
- MCP 서버에서 `meta['claudecode/toolUseId']` 추출
- PylonClient에 toolUseId 전달
- PylonMcpServer에서 `lookup_and_*` 액션으로 변환
- AgentManager.toolContextMap에서 conversationId 조회

### 요청 액션 매핑

| 도구 | Pylon 액션 |
|------|-----------|
| send_file | lookup_and_send_file |
| link_doc | lookup_and_link |
| unlink_doc | lookup_and_unlink |
| list_docs | lookup_and_list |
| get_status | lookup_and_get_status |
| create_conversation | lookup_and_create_conversation |
| delete_conversation | lookup_and_delete_conversation |
| rename_conversation | lookup_and_rename_conversation |
| add_prompt | lookup_and_set_system_prompt |
| continue_task | lookup_and_continue_task |
| run_widget | lookup_and_run_widget |
| run_widget_inline | lookup_and_run_widget_inline |

---

## 파일 위치

| 구성 | 경로 |
|------|------|
| MCP 서버 | `pylon/src/mcp/server.ts` |
| PylonClient | `pylon/src/mcp/pylon-client.ts` |
| send_file | `pylon/src/mcp/tools/send-file.ts` |
| 문서 도구 | `pylon/src/mcp/tools/link-document.ts` |
| 상태 조회 | `pylon/src/mcp/tools/get-status.ts` |
| 대화 관리 | `pylon/src/mcp/tools/conversation.ts` |
| 시스템 프롬프트 | `pylon/src/mcp/tools/system-prompt.ts` |
| 작업 계속 | `pylon/src/mcp/tools/continue-task.ts` |
| Widget 실행 | `pylon/src/mcp/tools/run-widget.ts` |
| Inline Widget | `pylon/src/mcp/tools/run-widget-inline.ts` |

---

## 주요 업데이트 (2026-03-03 이후)
- `run_widget` 도구 추가 (CLI 기반 인터랙티브 위젯)
- `run_widget_inline` 도구 추가 (HTML/JS 인라인 위젯)
- `create_conversation`에 `agent` 파라미터 추가 ("claude" 또는 "codex")
- Widget 도구 타임아웃 비활성화 (사용자 상호작용 기반)
