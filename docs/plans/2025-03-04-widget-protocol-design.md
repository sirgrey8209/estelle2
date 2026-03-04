# Widget Protocol 설계

## 개요

Claude를 거치지 않고 복잡한 유저 인터랙션을 처리하는 범용 프레임워크.
MCP 도구가 인터랙티브 UI를 띄워서 여러 턴의 유저 입력(버튼, 텍스트, 그림 등)을 받고,
완료 시 결과를 MCP 응답으로 Claude에게 전달한다.

## 핵심 컴포넌트

### 1. MCP 도구: `run_widget`

```typescript
{
  name: "run_widget",
  description: "인터랙티브 위젯 세션을 시작합니다. 유저 인터랙션이 완료될 때까지 대기합니다.",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string", description: "실행할 CLI 명령어" },
      cwd: { type: "string", description: "작업 디렉토리" },
      args: { type: "array", items: { type: "string" }, description: "CLI 인자" }
    },
    required: ["command", "cwd"]
  }
}
```

### 2. WidgetManager (Pylon)

- CLI 프로세스 spawn (stdin/stdout pipe 연결 유지)
- stdout 파싱 → Client로 렌더링 데이터 전송
- Client 인풋 → stdin으로 전달
- "complete" 메시지 수신 시 MCP 응답 반환

### 3. WidgetRenderer (Client)

- JSON 스키마 기반 범용 렌더러
- view는 HTML 또는 JSON 컴포넌트 지원 (하이브리드)
- inputs는 JSON 스키마로 정의

## 데이터 타입

### View (렌더링)

```typescript
type ViewNode =
  // JSON 컴포넌트
  | { type: "text"; content: string; style?: "title" | "body" | "caption" }
  | { type: "row" | "column"; children: ViewNode[]; gap?: number }
  | { type: "image"; src: string }
  | { type: "spacer"; size?: number }
  // HTML 렌더링
  | { type: "html"; content: string };
```

### Input (유저 입력)

```typescript
type InputNode =
  | { type: "buttons"; id: string; options: string[]; disabled?: string[] }
  | { type: "text"; id: string; placeholder?: string }
  | { type: "slider"; id: string; min: number; max: number; step?: number }
  | { type: "confirm"; id: string; label: string };
```

## 프로토콜

### CLI ↔ Pylon (JSON Lines over stdin/stdout)

**CLI → Pylon (stdout):**
```json
{"type": "render", "view": ViewNode, "inputs": InputNode[]}
{"type": "complete", "result": any}
{"type": "error", "message": string}
```

**Pylon → CLI (stdin):**
```json
{"type": "input", "data": Record<string, unknown>}
{"type": "cancel"}
```

### Pylon ↔ Client (WebSocket)

**Pylon → Client:**
```typescript
interface WidgetRenderMessage {
  type: 'widget_render';
  sessionId: string;
  view: ViewNode;
  inputs: InputNode[];
}

interface WidgetCloseMessage {
  type: 'widget_close';
  sessionId: string;
}
```

**Client → Pylon:**
```typescript
interface WidgetInputMessage {
  type: 'widget_input';
  sessionId: string;
  data: Record<string, unknown>;
}

interface WidgetCancelMessage {
  type: 'widget_cancel';
  sessionId: string;
}
```

## 시퀀스 다이어그램

```
Claude                 Pylon                    CLI                    Client
  │                      │                       │                        │
  │──run_widget(cmd)────▶│                       │                        │
  │                      │──spawn process───────▶│                        │
  │                      │                       │                        │
  │                      │◀──{"type":"render"}───│                        │
  │                      │──widget_render───────────────────────────────▶│
  │                      │                       │                        │
  │                      │◀─────────────────────widget_input─────────────│
  │                      │──{"type":"input"}────▶│                        │
  │                      │                       │                        │
  │                      │◀──{"type":"render"}───│  (반복)                │
  │                      │──widget_render───────────────────────────────▶│
  │                      │                       │                        │
  │                      │◀──{"type":"complete"}─│                        │
  │                      │──widget_close────────────────────────────────▶│
  │◀──MCP response───────│                       │                        │
```

## 예시: 블랙잭

### CLI 출력 (render)
```json
{
  "type": "render",
  "view": {
    "type": "html",
    "content": "<div class='blackjack'><div class='dealer'>Dealer: 4♥ ??</div><div class='player'>Player: Q♥ K♣ (20)</div></div>"
  },
  "inputs": [
    { "type": "buttons", "id": "action", "options": ["Hit", "Stand"] }
  ]
}
```

### 유저 인풋
```json
{"type": "input", "data": {"action": "Stand"}}
```

### 게임 완료
```json
{
  "type": "complete",
  "result": {
    "winner": "player",
    "playerHand": ["Q♥", "K♣"],
    "dealerHand": ["4♥", "9♦", "10♠"],
    "playerTotal": 20,
    "dealerTotal": 23,
    "stats": { "wins": 4, "losses": 5, "pushes": 0 }
  }
}
```

## 보안

- HTML 렌더링 시 DOMPurify로 sanitize
- `<script>` 태그 제거
- inline event handler 제거

## 구현 범위

### Pylon
- [ ] WidgetManager 클래스
- [ ] run_widget MCP 도구
- [ ] widget_render/widget_close 메시지 타입
- [ ] widget_input/widget_cancel 핸들러

### Client
- [ ] WidgetRenderer 컴포넌트
- [ ] WidgetView (JSON/HTML 렌더링)
- [ ] WidgetInputs (버튼, 텍스트 등)
- [ ] widget_render 메시지 핸들러

### Core
- [ ] 메시지 타입 정의 추가

### 블랙잭 CLI 수정
- [ ] Widget Protocol 형식으로 출력
- [ ] stdin으로 유저 인풋 수신
