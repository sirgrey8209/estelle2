# Command Execute Bubble Design

커맨드 실행 시 히스토리와 브로드캐스트에서 "커맨드 실행" 특수 버블로 표시. 일반 텍스트 메시지도 임시 메시지 패턴으로 통일하여 멀티 클라이언트 동기화 해결.

## 1. 새 메시지 타입: command_execute

StoreMessage 유니온에 추가:

```typescript
interface CommandExecuteMessage {
  id: string;
  role: 'user';
  type: 'command_execute';
  content: string;            // 프롬프트 전문 (Claude에 전달된 텍스트)
  timestamp: number;
  commandId: number;
  commandName: string;
  commandIcon: string | null;
  commandColor: string | null;
  temporary?: boolean;
}
```

## 2. Pylon handleCommandExecute 변경

기존: `handleClaudeSend`를 호출하여 일반 텍스트로 처리
변경: 직접 처리

1. commandStore에서 id, name, icon, color, content 조회
2. messageStore에 `type: 'command_execute'`로 저장 (메타데이터 포함)
3. `claude_event(type: 'commandExecute')`로 브로드캐스트 (메타데이터 포함)
4. `agentManager.sendMessage`에는 content만 전달 (Claude는 일반 텍스트로 받음)

## 3. 임시 메시지 패턴 (일반 텍스트 + 커맨드 공통)

### 원칙

클라이언트가 메시지를 보낼 때 `temporary: true` 플래그를 가진 임시 메시지를 추가.
서버에서 실제 이벤트가 오면 교체.

### StoreMessage에 temporary 필드

```typescript
interface BaseStoreMessage {
  // ... 기존 필드
  temporary?: boolean;  // true면 서버 확인 대기 중
}
```

### 일반 텍스트 메시지

```
현재: ChatArea.handleSend → addMessage({ type: 'text' }) → sendClaudeMessage
      (userMessage 이벤트 무시)

변경: ChatArea.handleSend → addMessage({ type: 'text', temporary: true }) → sendClaudeMessage
      userMessage 이벤트 수신 → 마지막 temporary 교체 (또는 새로 추가)
```

### 커맨드 실행

```
CommandToolbar 클릭 → addMessage({ type: 'command_execute', temporary: true, ... }) → executeCommand
commandExecute 이벤트 수신 → 마지막 temporary 교체 (또는 새로 추가)
```

### 교체 로직

```typescript
case 'userMessage':
case 'commandExecute': {
  const messages = store.getState(conversationId)?.messages ?? [];
  const lastMsg = messages[messages.length - 1];

  if (lastMsg?.temporary) {
    // 임시 메시지 → 실제 메시지로 교체
    const realMessage = buildMessageFromEvent(event);
    const updated = [...messages.slice(0, -1), realMessage];
    store.setMessages(conversationId, updated);
  } else {
    // 임시 메시지 없음 (다른 클라이언트) → 새로 추가
    store.addMessage(conversationId, buildMessageFromEvent(event));
  }
  break;
}
```

효과:
- 보낸 클라이언트: 즉시 표시 → 서버 확인 후 교체
- 다른 클라이언트: 이벤트 수신 시 새로 추가 (멀티 클라이언트 동기화)

## 4. CommandBubble 컴포넌트

```
접힘: [🚀] 배포 ▶
펼침: [🚀] 배포 ▼
      /estelle-patch 배포 진행해줘
```

MessageBubble에서 `type === 'command_execute'`이면 CommandBubble로 렌더링.
ToolCard와 유사한 접기/펼치기 패턴.
Claude 응답은 평소대로 렌더링 (특수 처리 없음).

## 5. Pylon claude_event 브로드캐스트

userMessage 이벤트 (기존):
```typescript
{ type: 'userMessage', content, timestamp, attachments? }
```

commandExecute 이벤트 (신규):
```typescript
{ type: 'commandExecute', content, timestamp, commandId, commandName, commandIcon, commandColor }
```
