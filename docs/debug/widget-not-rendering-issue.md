# Widget이 MCP 툴 버블에 렌더링되지 않는 문제

## 현재 상황 요약

Widget Protocol을 통해 `run_widget` MCP 도구가 위젯을 ToolCard 내부에 렌더링하도록 구현했으나, 실제로 위젯이 화면에 표시되지 않음.

## 증상

1. `run_widget` MCP 도구 호출 시 위젯이 ToolCard 내부에 렌더링되지 않음
2. Relay 에러 로그: `[ROUTE ERROR] No routing target for message type: widget_render from pylon`
3. `broadcast: 'clients'` 필드가 설정되어 있음에도 라우팅 실패

## 데이터 흐름 분석

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              예상 데이터 흐름                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Claude Code CLI                                                         │
│     └── MCP 도구 호출: run_widget                                           │
│         └── toolUseId 생성됨                                                │
│                                                                             │
│  2. Pylon (PylonMcpServer._handleRunWidget)                                │
│     └── WidgetManager.startSession() 호출                                   │
│     └── CLI 프로세스 spawn                                                  │
│     └── widget_render 이벤트 발생 시 onWidgetRender 콜백 호출               │
│                                                                             │
│  3. bin.ts (onWidgetRender 콜백)                                           │
│     └── relayClient.send({                                                  │
│           type: 'widget_render',                                            │
│           payload: { conversationId, toolUseId, sessionId, view, inputs },  │
│           broadcast: 'clients'                                              │
│         })                                                                  │
│                                                                             │
│  4. Relay (message-handler → router)                                       │
│     └── routeMessage() 호출                                                 │
│     └── message.broadcast === 'clients' 확인                                │
│     └── routeByBroadcast() → broadcastExceptType('pylon') 호출              │
│     └── 모든 viewer/app 클라이언트에게 전송                                 │
│                                                                             │
│  5. Client (useMessageRouter)                                              │
│     └── widget_render 메시지 수신                                           │
│     └── conversationStore.setWidgetSession() 호출                           │
│     └── ToolCard에서 widgetSession 매칭 → WidgetRenderer 표시               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 확인된 사항

### ✅ 코드 배포 완료
- `/home/estelle/estelle2/release/pylon/dist/bin.js`: `broadcast: 'clients'` 포함됨
- `/home/estelle/estelle2/release/pylon/dist/servers/pylon-mcp-server.js`: `_handleRunWidget` 디버그 로그 포함됨
- `/home/estelle/estelle2/release/relay/dist/server.js`: DEBUG 로그 포함됨

### ❓ 미확인 사항

#### 1. Pylon에서 `_handleRunWidget`이 호출되는가?
- Pylon 로그에서 `[Widget] _handleRunWidget called` 로그가 **안 보임**
- **가설**: MCP 도구가 호출되지 않거나, case 분기에서 `run_widget`으로 매칭되지 않음

#### 2. WidgetManager가 생성되어 있는가?
- `bin.ts`에서 `deps.widgetManager`가 올바르게 생성되고 PylonMcpServer에 전달되는지 확인 필요

#### 3. widget_render 메시지가 Relay에 도달하는가?
- 최근 테스트에서 Relay 로그에 `widget_render` MSG 로그가 **안 보임**
- 에러 로그의 `[ROUTE ERROR]`는 이전 테스트 시점의 것으로 추정

#### 4. broadcast 필드가 Relay에서 제대로 파싱되는가?
- DEBUG 로그 (`[DEBUG] widget_render broadcast=...`)가 **안 나옴**
- 이는 widget_render 메시지가 Relay에 아예 도착하지 않았다는 증거

## 의심되는 근본 원인

### 가설 1: WidgetManager가 PylonMcpServer에 전달되지 않음

`bin.ts`의 `createDependencies()`에서 `widgetManager`를 생성하고 `PylonMcpServer`에 전달하는 과정을 확인해야 함.

```typescript
// bin.ts에서 확인 필요
const deps = createDependencies(...);
// deps.widgetManager가 undefined일 수 있음

mcpServer = new PylonMcpServer({
  ...
  widgetManager: deps.widgetManager, // 여기가 undefined?
  onWidgetRender: (...) => { ... },
});
```

### 가설 2: WidgetSession이 생성되지만 render 이벤트가 발생하지 않음

`WidgetManager.startSession()`이 호출되고 CLI 프로세스가 spawn되지만, CLI에서 `widget_render` JSON Lines 메시지를 보내지 않을 수 있음.

### 가설 3: MCP 도구 호출 자체가 실패

Claude Code CLI에서 `run_widget` MCP 도구를 호출할 때 에러가 발생하거나, Pylon의 MCP 핸들러가 도구를 인식하지 못할 수 있음.

## 다음 디버깅 단계

### 1단계: Pylon 로그 확인
```bash
pm2 restart estelle-pylon
# 위젯 테스트 실행 후
pm2 logs estelle-pylon --nostream --lines 100 | grep -i widget
```

예상 출력:
- `[Widget] _handleRunWidget called: ...` → 호출됨
- 출력 없음 → MCP 도구 호출 자체가 안 됨

### 2단계: WidgetManager 생성 확인

`bin.ts`의 `createDependencies()` 함수에서 `widgetManager` 생성 로그 추가:
```typescript
console.log('[Dependencies] widgetManager:', deps.widgetManager ? 'created' : 'undefined');
```

### 3단계: MCP 도구 등록 확인

PylonMcpServer에서 `run_widget` 도구가 제대로 등록되어 있는지 확인:
```bash
grep -n "run_widget" /home/estelle/estelle2/packages/pylon/src/servers/pylon-mcp-server.ts
```

### 4단계: CLI 프로세스 spawn 확인

WidgetManager에서 spawn한 CLI 프로세스가 실제로 실행되고 JSON Lines를 출력하는지 확인.

## 관련 파일

| 파일 | 역할 |
|------|------|
| `packages/pylon/src/bin.ts` | 의존성 생성, 콜백 설정 |
| `packages/pylon/src/servers/pylon-mcp-server.ts` | MCP 도구 처리, `_handleRunWidget` |
| `packages/pylon/src/widget/widget-manager.ts` | 위젯 세션 관리, CLI spawn |
| `packages/relay/src/router.ts` | 메시지 라우팅, broadcast 처리 |
| `packages/client/src/components/chat/ToolCard.tsx` | 위젯 렌더링 |

## 참고

- Widget Protocol 스펙: `docs/widget-protocol.md`
- 이전 컨텍스트 전사: `~/.claude/projects/-home-estelle-estelle2/ccec8e86-88f6-41f6-9698-147c773ae57b.jsonl`
