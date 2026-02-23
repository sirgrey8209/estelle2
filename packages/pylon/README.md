# @estelle/pylon

Estelle의 PC 백그라운드 서비스입니다.

## 개요

Pylon은 PC에서 실행되며:

- **Claude SDK 통합** - Claude Code와 직접 통신
- **상태 관리** - 모든 대화, 워크스페이스, 메시지의 Single Source of Truth
- **MCP 서버** - Claude Code에서 사용하는 도구 제공
- **실시간 동기화** - 모든 연결된 클라이언트에 상태 브로드캐스트

## 아키텍처

```
┌─────────────────────────────────────────────────┐
│                    Pylon                         │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ Claude SDK   │  │  MCP Server  │             │
│  │   Adapter    │  │  (TCP 9876)  │             │
│  └──────┬───────┘  └──────────────┘             │
│         │                                        │
│  ┌──────▼───────────────────────────────────┐   │
│  │            PylonState (순수)              │   │
│  │  - handlePacket()  : 클라이언트 메시지    │   │
│  │  - handleClaude()  : Claude SDK 이벤트    │   │
│  └──────────────────────────────────────────┘   │
│         │                                        │
│  ┌──────▼───────┐  ┌──────────────┐             │
│  │  WebSocket   │  │  FileSystem  │             │
│  │   Adapter    │  │  Persistence │             │
│  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────┘
```

## 주요 컴포넌트

| 컴포넌트 | 역할 |
|----------|------|
| **ClaudeSDKAdapter** | Claude SDK 직접 호출, 이벤트 스트리밍 |
| **ClaudeManager** | 세션 관리, toolUseId 역매핑 |
| **PylonMcpServer** | MCP TCP 서버 (send_file, deploy 등) |
| **PylonState** | 순수 데이터 클래스, 모든 상태 관리 |

## MCP 포트 할당

| 포트 | 환경 |
|------|------|
| 9876 | release |
| 9877 | stage |
| 9878 | dev |
| 9879 | test |

## 개발

```bash
# 테스트 실행
pnpm test

# Watch 모드
pnpm test:watch

# 개발 서버 (단독)
pnpm dev
```

## 설계 원칙

### Single Source of Truth

모든 상태는 Pylon에 있습니다:

```
Client → 요청 → Pylon → 처리 → 브로드캐스트
```

- 클라이언트는 상태를 직접 수정하지 않음
- 모든 클라이언트는 동일한 상태를 봄
- 재연결 시 전체 상태 동기화

### 순수 데이터 클래스

`PylonState`는 외부 의존성 없이 테스트 가능합니다:

```typescript
const state = new PylonState();

// 패킷 입력
state.handlePacket({
  type: 'prompt',
  conversationId: 'conv1',
  content: 'hello'
});

expect(state.conversations.get('conv1').messages).toHaveLength(1);
```

## PM2로 실행

```bash
# 시작
pm2 start ecosystem.config.cjs

# 상태 확인
pm2 status

# 로그 보기
pm2 logs estelle-pylon
```
