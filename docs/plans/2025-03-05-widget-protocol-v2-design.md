# Widget Protocol v2 설계

## 개요

Claude를 거치지 않고 복잡한 유저 인터랙션을 처리하는 범용 프레임워크의 v2 설계.

**핵심 변경점 (v1 대비):**
- `inputs` 제거 → **이벤트 기반** 통신
- **클라이언트 드리븐**: 게임 루프/렌더링은 Client에서 담당
- **JS 코드 전송**: CLI가 실행할 코드를 Client로 전송
- **양방향 이벤트**: CLI ↔ Client 간 실시간 메시지 교환

## 배경

### v1의 문제점

1. `inputs`가 UI 컴포넌트와 이벤트를 혼합하여 어중간함
2. 요청-응답 모델로 실시간 인터랙션(애니메이션, 게임) 불가
3. 매 프레임 render 전송은 비현실적
4. 복잡한 인터랙션(드래그, 캔버스 클릭 좌표 등) 표현 어려움

### v2 목표

- 텍스트 애니메이션 출력 지원
- 실시간 게임 (퐁, 블랙잭 등) 지원
- CLI 정의 기반의 유연한 위젯 개발
- 모바일/데스크탑 플랫폼 추상화

## 아키텍처

```
Claude ──MCP──▶ Pylon ──spawn──▶ CLI
                  │                 │
                  │◀── stdout ──────┤ (JSON Lines)
                  │──── stdin ─────▶│
                  │
                  │◀── WebSocket ──▶ Client
                                      │
                                      ├── 코드 실행 (eval)
                                      ├── 게임 루프
                                      └── 유저 입력 처리
```

**역할 분담:**
- **CLI (서버)**: 초기 상태/코드 전송, 이벤트 수신, 최종 결과 반환
- **Client**: 게임 렌더링/루프, 입력 처리, 의미 있는 이벤트만 서버로 전송
- **Pylon**: 중계 + 에셋 서빙 + 로깅

## 프로토콜 메시지

### CLI → Pylon (stdout, JSON Lines)

```typescript
// 렌더 메시지 (코드 전송)
interface WidgetRenderMessage {
  type: 'render';
  view: {
    type: 'script';
    code?: string;                      // 인라인 JS 코드
    file?: string;                      // 또는 JS 파일 경로
    html: string;                       // HTML 템플릿
    assets?: Record<string, string>;    // 에셋 경로 맵
    height?: number;                    // 초기 높이 (선택, 없으면 auto)
  };
}

// 이벤트 메시지 (실행 중인 코드에 전달)
interface WidgetEventMessage {
  type: 'event';
  data: unknown;
}

// 완료 메시지
interface WidgetCompleteMessage {
  type: 'complete';
  result: unknown;
}

// 에러 메시지
interface WidgetErrorMessage {
  type: 'error';
  message: string;
}

type WidgetCliMessage =
  | WidgetRenderMessage
  | WidgetEventMessage
  | WidgetCompleteMessage
  | WidgetErrorMessage;
```

### Pylon → CLI (stdin, JSON Lines)

```typescript
// 클라이언트 이벤트
interface WidgetInputMessage {
  type: 'event';
  data: unknown;
}

// 취소
interface WidgetCancelMessage {
  type: 'cancel';
}

type WidgetPylonMessage =
  | WidgetInputMessage
  | WidgetCancelMessage;
```

### Pylon ↔ Client (WebSocket)

```typescript
// Pylon → Client
interface WidgetRenderWsMessage {
  type: 'widget_render';
  sessionId: string;
  view: {
    type: 'script';
    code?: string;
    file?: string;
    html: string;
    assets?: Record<string, string>;  // URL로 변환됨
    height?: number;
  };
}

interface WidgetEventWsMessage {
  type: 'widget_event';
  sessionId: string;
  data: unknown;
}

interface WidgetCloseWsMessage {
  type: 'widget_close';
  sessionId: string;
}

// Client → Pylon
interface WidgetClientEventMessage {
  type: 'widget_event';
  sessionId: string;
  data: unknown;
}

interface WidgetCancelWsMessage {
  type: 'widget_cancel';
  sessionId: string;
}
```

## Client API

위젯 코드에 주입되는 API:

```typescript
interface WidgetAPI {
  // 코어
  sendEvent(data: unknown): void;
  onMessage(callback: (data: unknown) => void): void;
  onCancel(callback: () => void): void;

  // 에셋
  getAssetUrl(key: string): string;

  // 버블 컨텍스트
  bubble: {
    getSize(): { width: number; height: number };
    onResize(callback: (size: { width: number; height: number }) => void): void;
    isMobile(): boolean;
    isFullscreen(): boolean;
    requestHeight(height: number): void;  // 세로만 요청 가능
  };

  // 플랫폼 추상화 - 입력
  input: {
    onKey(callback: (e: KeyEvent) => void): void;
    onTouch(callback: (e: TouchEvent) => void): void;
    onSwipe(callback: (e: SwipeEvent) => void): void;
  };

  // 플랫폼 추상화 - 출력
  output: {
    vibrate(ms: number): void;
    playSound(assetKey: string): void;
    showToast(message: string): void;
  };
}
```

## 버블 UI

```
┌─────────────────────────────────[X]┐
│ 🔧 run_widget                      │
│ ┌────────────────────────────────┐ │
│ │                                │ │
│ │   [위젯 렌더링 영역]            │ │
│ │   - 가로: 버블 너비에 맞춤      │ │
│ │   - 세로: CLI 지정 또는 반응형  │ │
│ │                                │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**크기 정책:**
- **가로**: 고정 (버블 너비 = 컨테이너 너비), CLI가 변경 불가
- **세로**: CLI가 `height` 지정하거나 컨텐츠에 따라 반응형

**X 버튼 (강제 종료):**
1. CLI에 `cancel` 이벤트 전송
2. 잠깐 대기 (graceful shutdown 기회)
3. 응답 없으면 프로세스 강제 종료

## 에셋 처리

### 현재 (v2.0)

로컬 파일 경로 참조:

```typescript
{
  type: 'render',
  view: {
    type: 'script',
    file: './dist/game.js',
    html: '<canvas id="game"></canvas>',
    assets: {
      'paddle': './assets/paddle.png',
      'ball': './assets/ball.png',
      'hit': './assets/hit.wav'
    }
  }
}
```

- Pylon이 파일 경로를 읽어서 Client에 서빙
- Client에서 `api.getAssetUrl('paddle')` → 실제 URL 반환

### 미래 (확장)

`lib://` 스킴으로 공유 에셋 라이브러리 지원:

```typescript
assets: {
  'paddle': 'lib://common-sprites/paddle.png'
}
```

## 시퀀스 다이어그램

```
Claude              Pylon                CLI                 Client
  │                   │                   │                     │
  │──run_widget──────▶│                   │                     │
  │                   │──spawn───────────▶│                     │
  │                   │                   │                     │
  │                   │◀──render──────────│                     │
  │                   │      {code, html, assets}               │
  │                   │──widget_render────────────────────────▶│
  │                   │                   │                     │ eval(code)
  │                   │                   │                     │ 게임루프 시작
  │                   │                   │                     │
  │                   │◀───────────────────────widget_event────│ (유저 액션)
  │                   │──event───────────▶│                     │
  │                   │                   │                     │
  │                   │◀──event───────────│                     │ (CLI→Client)
  │                   │──widget_event─────────────────────────▶│
  │                   │                   │                     │
  │                   │◀──complete────────│                     │
  │                   │──widget_close─────────────────────────▶│
  │◀──MCP response────│                   │                     │
```

## 상태 관리

`render` 메시지가 새 페이지로 교체할 때:
- Client는 **항상 기존 코드 정리(cleanup) 후 새 코드 실행**
- 상태 유지가 필요하면 **CLI가 새 코드에 상태를 포함**해서 전송

```javascript
// CLI가 상태 유지하면서 새 화면 보낼 때
{
  type: 'render',
  view: {
    type: 'script',
    code: `
      const state = ${JSON.stringify(currentState)};
      // 새 코드 시작...
    `,
    html: '...'
  }
}
```

## 로깅

**위치:** 위젯 프로젝트 폴더 `/logs/widget-{timestamp}.log`

**기록 내용 (이벤트 중심):**
- 세션 시작/종료
- render, event, complete 메시지 (양방향)
- 에러 (CLI, Client, 통신)
- 타임스탬프 포함

**예시:**
```
[2025-03-05 14:30:22.123] SESSION_START widget-1-1709642422000
[2025-03-05 14:30:22.150] CLI→PYLON render {view: {type: 'script', ...}}
[2025-03-05 14:30:22.200] PYLON→CLIENT widget_render
[2025-03-05 14:30:25.500] CLIENT→PYLON widget_event {type: 'score', player: 1}
[2025-03-05 14:30:25.510] PYLON→CLI event {type: 'score', player: 1}
[2025-03-05 14:30:30.000] CLI→PYLON complete {result: {...}}
[2025-03-05 14:30:30.010] SESSION_END
```

## 에러 처리

| 에러 종류 | 처리 |
|----------|------|
| CLI 에러 | `error` 메시지 → 위젯 닫고 버블에 에러 표시 |
| Client JS 에러 | CLI에 `error` 이벤트 전송 → 로그 기록 |
| 통신 끊김 | 양쪽 정리, 세션 cancelled |
| 프로세스 비정상 종료 | 위젯 닫고 에러 표시 |

## 보안

- JS 코드 실행: 신뢰 기반 (샌드박스 없음)
- HTML: 기존과 동일하게 DOMPurify로 sanitize (선택적)

## 블랙잭 업데이트 계획

기존 요청-응답 방식에서 클라이언트 드리븐으로 변경:

- 카드 딜링 애니메이션 (CSS/JS)
- 카드 뒤집기 애니메이션
- 승패 결과 연출
- 칩/베팅 UI (나중에)

CLI는 초기 상태 + 게임 로직 JS를 전송, Client에서 렌더링과 애니메이션 처리.

## 구현 범위

### Core
- [x] 메시지 타입 정의 업데이트 (widget.ts)
  - [x] ScriptViewNode 추가
  - [x] WidgetCliEventMessage, WidgetPylonEventMessage 추가
  - [x] WidgetEventWsMessage 추가
  - [x] Type guards 추가

### Pylon
- [x] WidgetManager 업데이트
  - [x] `event` 메시지 타입 지원
  - [x] sendEvent 메서드 추가
- [x] 에셋 서빙 (widget-asset-handler.ts)
- [x] WebSocket 메시지 (widget_event 양방향)
- [x] 로깅 시스템 (WidgetLogger)

### Client
- [x] WidgetScriptRenderer 구현
  - [x] JS 코드 실행 (new Function)
  - [x] WidgetAPI 주입
  - [x] cleanup 로직
- [x] 버블 UI
  - [x] X 버튼 (강제 종료)
  - [x] 세로 리사이즈 (requestHeight)
- [x] 플랫폼 추상화 API (bubble, input, output)
- [x] widget_event 양방향 연동

### 블랙잭
- [x] Widget Protocol v2로 마이그레이션
- [x] 카드 딜링 애니메이션
- [x] 카드 뒤집기 애니메이션
- [x] 승패 결과 연출
