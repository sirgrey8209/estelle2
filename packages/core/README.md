# @estelle/core

Estelle의 공유 타입 및 메시지 스키마 패키지입니다.

## 개요

이 패키지에 포함된 것:

- **메시지 타입** - Pylon ↔ Relay ↔ Client 간 WebSocket 메시지 스키마
- **엔티티 타입** - Conversation, Workspace, Message 정의
- **ID 시스템** - 24비트 통합 ID 생성
- **유틸리티** - 공유 헬퍼 함수

## 사용법

```typescript
import {
  Packet,
  Conversation,
  Message,
  generateId
} from '@estelle/core';

// 메시지 패킷 생성
const packet: Packet = {
  type: 'prompt',
  conversationId: 'conv-123',
  content: '안녕, Claude!'
};

// 고유 ID 생성
const id = generateId();
```

## 주요 타입

### 패킷 (WebSocket 메시지)

```typescript
type Packet =
  | { type: 'prompt'; conversationId: string; content: string }
  | { type: 'assistant_message'; content: string }
  | { type: 'sync_state'; state: PylonState }
  // ... 더 많은 패킷 타입
```

### 엔티티

```typescript
interface Conversation {
  id: string;
  title: string;
  workspaceId: string;
  messages: Message[];
  status: 'idle' | 'thinking' | 'tool_use';
}

interface Workspace {
  id: string;
  name: string;
  path: string;
}
```

## 개발

```bash
# 테스트 실행
pnpm test

# Watch 모드
pnpm test:watch

# 타입 체크
pnpm typecheck
```
