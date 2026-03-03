# Estelle MCP 도구 레퍼런스

> 코드 기반 분석 (2026-03-02)

## MCP 서버 구조

```
Pylon
  └── PylonMcpServer (stdio)
       ├── TCP 서버 (ESTELLE_MCP_PORT)
       └── Tools (11개)
```

### 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `ESTELLE_MCP_PORT` | MCP TCP 서버 포트 | 9880 |
| `ESTELLE_WORKING_DIR` | 상대 경로 기준 | - |
| `DATA_DIR` | 데이터/로그 디렉토리 | - |

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
| `path` | string | O | 전송할 파일 경로 |
| `description` | string | X | 파일 설명 |

### 반환값

```json
{
  "success": true,
  "file": { "path": "/path/to/file", "filename": "file.txt" }
}
```

### 처리 흐름

1. path 검증
2. PylonClient.sendFileByToolUseId() 호출
3. toolUseId → conversationId 매핑
4. 파일 청크 전송 시작

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
    "version": "(release)v0302_1",
    "workspace": { "name": "...", "workingDir": "..." },
    "conversation": { "name": "...", "linkedDocuments": [...] },
    "connectedClients": 3
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

### 반환값

```json
{
  "success": true,
  "conversation": {
    "conversationId": 132097,
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

## 10. deploy

stage/release 배포 실행

### 파라미터

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `target` | enum | O | "stage" / "release" / "promote" |

### 반환값

```json
{
  "success": true,
  "message": "Deployed to stage",
  "target": "stage",
  "output": "Build output..."
}
```

### 제약

| 현재 환경 | stage | release | promote |
|----------|-------|---------|---------|
| release | O | X | X |
| stage | X | O | O |
| dev | O | O | X |

- 자기 환경 배포 차단 (PM2 재시작 시 세션 끊김)
- promote는 stage에서만 가능 (stage 빌드 → release 복사)

---

## 11. continue_task

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
PylonClient (TCP 연결)
    ↓
PylonMcpServer (Pylon 내부)
    ↓
toolUseId → conversationId 매핑
    ↓
실제 처리 (Store, ClaudeManager 등)
```

### toolUseId 기반 라우팅

- Claude가 도구 호출 시 `toolUseId` 발급
- MCP 서버는 toolUseId로 어떤 대화의 요청인지 식별
- ClaudeManager.toolContextMap에서 conversationId 조회
