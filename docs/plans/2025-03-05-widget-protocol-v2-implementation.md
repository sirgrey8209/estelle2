# Widget Protocol v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Widget Protocol v2로 전환하여 클라이언트 드리븐 인터랙션 지원

**Architecture:** CLI가 JS 코드를 전송하면 Client가 실행하고, 양방향 이벤트로 통신. 기존 `inputs` 개념 제거.

**Tech Stack:** TypeScript, React, Node.js (spawn), WebSocket

---

## Task 1: Core 타입 정의 업데이트

**Files:**
- Modify: `packages/core/src/types/widget.ts`

**Step 1: 기존 타입 백업 및 새 타입 추가**

기존 ViewNode에 `ScriptViewNode` 추가하고, CLI/Pylon 메시지 타입 업데이트:

```typescript
// 새로 추가할 타입들

/**
 * 스크립트 뷰 노드 (v2)
 */
export interface ScriptViewNode {
  type: 'script';
  code?: string;                      // 인라인 JS 코드
  file?: string;                      // 또는 JS 파일 경로
  html: string;                       // HTML 템플릿
  assets?: Record<string, string>;    // 에셋 경로 맵
  height?: number;                    // 초기 높이 (없으면 auto)
}

// ViewNode에 ScriptViewNode 추가
export type ViewNode =
  | TextViewNode
  | LayoutViewNode
  | ImageViewNode
  | SpacerViewNode
  | HtmlViewNode
  | ScriptViewNode;

// CLI → Pylon: 이벤트 메시지 (새로 추가)
export interface WidgetCliEventMessage {
  type: 'event';
  data: unknown;
}

// WidgetCliMessage에 WidgetCliEventMessage 추가
export type WidgetCliMessage =
  | WidgetCliRenderMessage
  | WidgetCliEventMessage
  | WidgetCliCompleteMessage
  | WidgetCliErrorMessage;

// Pylon → CLI: 기존 WidgetPylonInputMessage를 event로 변경
export interface WidgetPylonEventMessage {
  type: 'event';
  data: unknown;
}

export type WidgetPylonMessage =
  | WidgetPylonEventMessage
  | WidgetPylonCancelMessage;

// Pylon → Client: 이벤트 메시지 (새로 추가)
export interface WidgetEventWsMessage {
  type: 'widget_event';
  sessionId: string;
  data: unknown;
}
```

**Step 2: type guard 함수 추가**

```typescript
export function isScriptViewNode(node: ViewNode): node is ScriptViewNode {
  return node.type === 'script';
}

export function isWidgetCliEventMessage(value: unknown): value is WidgetCliEventMessage {
  return isObject(value) && value.type === 'event' && 'data' in value;
}

export function isWidgetEventWsMessage(value: unknown): value is WidgetEventWsMessage {
  return isObject(value) && value.type === 'widget_event' && typeof value.sessionId === 'string';
}
```

**Step 3: 빌드 확인**

Run: `pnpm --filter @estelle/core build`
Expected: 빌드 성공

**Step 4: Commit**

```bash
git add packages/core/src/types/widget.ts
git commit -m "feat(core): Widget Protocol v2 타입 정의 추가

- ScriptViewNode 추가 (code, file, html, assets, height)
- WidgetCliEventMessage, WidgetEventWsMessage 추가
- type guard 함수 추가"
```

---

## Task 2: Pylon WidgetManager 업데이트

**Files:**
- Modify: `packages/pylon/src/managers/widget-manager.ts`

**Step 1: event 메시지 처리 추가**

`handleCliOutput`에서 `event` 타입 처리:

```typescript
// import에 추가
import {
  // ... 기존 imports
  isWidgetCliEventMessage,
} from '@estelle/core';

// WidgetEventEvent 인터페이스 추가
export interface WidgetEventEvent {
  sessionId: string;
  data: unknown;
}

// handleCliOutput에서 event 처리 추가
private handleCliOutput(sessionId: string, line: string): void {
  // ... 기존 코드 ...

  if (isWidgetCliRenderMessage(message)) {
    // ... 기존 코드 ...
  } else if (isWidgetCliEventMessage(message)) {
    this.emit('event', {
      sessionId,
      data: message.data,
    } as WidgetEventEvent);
  } else if (isWidgetCliCompleteMessage(message)) {
    // ... 기존 코드 ...
  }
  // ...
}
```

**Step 2: sendEvent 메서드 수정**

기존 `sendInput`을 `sendEvent`로 rename하고 data 구조 변경:

```typescript
/**
 * CLI로 이벤트 전송
 */
sendEvent(sessionId: string, data: unknown): boolean {
  const session = this.sessions.get(sessionId);
  if (!session || session.status !== 'running') {
    return false;
  }

  const message = JSON.stringify({ type: 'event', data }) + '\n';
  session.process.stdin?.write(message);
  return true;
}
```

**Step 3: 빌드 확인**

Run: `pnpm --filter @estelle/pylon build`
Expected: 빌드 성공

**Step 4: Commit**

```bash
git add packages/pylon/src/managers/widget-manager.ts
git commit -m "feat(pylon): WidgetManager v2 이벤트 처리

- CLI event 메시지 처리 추가
- sendInput → sendEvent로 변경
- WidgetEventEvent 타입 추가"
```

---

## Task 3: Pylon 에셋 서빙 추가

**Files:**
- Create: `packages/pylon/src/handlers/widget-asset-handler.ts`
- Modify: `packages/pylon/src/pylon.ts`

**Step 1: 에셋 핸들러 생성**

```typescript
/**
 * @file widget-asset-handler.ts
 * @description 위젯 에셋 파일 서빙
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

// MIME 타입 매핑
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.js': 'application/javascript',
  '.json': 'application/json',
};

// 세션별 에셋 경로 저장
const sessionAssets = new Map<string, Map<string, string>>();

/**
 * 세션에 에셋 등록
 */
export function registerAssets(
  sessionId: string,
  assets: Record<string, string>,
  cwd: string
): void {
  const assetMap = new Map<string, string>();
  for (const [key, filePath] of Object.entries(assets)) {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(cwd, filePath);
    assetMap.set(key, absolutePath);
  }
  sessionAssets.set(sessionId, assetMap);
}

/**
 * 세션 에셋 정리
 */
export function cleanupAssets(sessionId: string): void {
  sessionAssets.delete(sessionId);
}

/**
 * 에셋 URL 생성
 */
export function getAssetUrls(
  sessionId: string,
  assets: Record<string, string>,
  baseUrl: string
): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const key of Object.keys(assets)) {
    urls[key] = `${baseUrl}/widget-assets/${sessionId}/${encodeURIComponent(key)}`;
  }
  return urls;
}

/**
 * 에셋 요청 핸들러
 */
export async function handleAssetRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessionId: string,
  assetKey: string
): Promise<void> {
  const assetMap = sessionAssets.get(sessionId);
  if (!assetMap) {
    res.writeHead(404);
    res.end('Session not found');
    return;
  }

  const filePath = assetMap.get(decodeURIComponent(assetKey));
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404);
    res.end('Asset not found');
    return;
  }

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'max-age=3600',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500);
    res.end('Failed to read asset');
  }
}
```

**Step 2: Pylon에 라우트 추가**

pylon.ts의 HTTP 서버에 `/widget-assets/:sessionId/:assetKey` 라우트 추가.

**Step 3: 빌드 확인**

Run: `pnpm --filter @estelle/pylon build`
Expected: 빌드 성공

**Step 4: Commit**

```bash
git add packages/pylon/src/handlers/widget-asset-handler.ts packages/pylon/src/pylon.ts
git commit -m "feat(pylon): 위젯 에셋 서빙 추가

- widget-asset-handler.ts 생성
- 세션별 에셋 등록/정리
- /widget-assets/:sessionId/:assetKey 라우트"
```

---

## Task 4: Pylon WebSocket 메시지 업데이트

**Files:**
- Modify: `packages/pylon/src/pylon.ts` (또는 WebSocket 핸들러 파일)

**Step 1: widget_event 메시지 처리**

Client → Pylon `widget_event` 수신 시 CLI로 전달:

```typescript
// 메시지 핸들러에 추가
case 'widget_event': {
  const { sessionId, data } = message;
  widgetManager.sendEvent(sessionId, data);
  break;
}
```

**Step 2: Pylon → Client widget_event 전송**

WidgetManager의 `event` 이벤트 수신 시 Client로 전달:

```typescript
widgetManager.on('event', (event: WidgetEventEvent) => {
  broadcastToSession(event.sessionId, {
    type: 'widget_event',
    sessionId: event.sessionId,
    data: event.data,
  });
});
```

**Step 3: 빌드 확인**

Run: `pnpm --filter @estelle/pylon build`
Expected: 빌드 성공

**Step 4: Commit**

```bash
git add packages/pylon/src/pylon.ts
git commit -m "feat(pylon): widget_event WebSocket 메시지 처리

- Client → Pylon → CLI 이벤트 전달
- CLI → Pylon → Client 이벤트 전달"
```

---

## Task 5: Client WidgetRenderer v2

**Files:**
- Create: `packages/client/src/components/widget/WidgetScriptRenderer.tsx`
- Modify: `packages/client/src/components/widget/WidgetRenderer.tsx`

**Step 1: WidgetScriptRenderer 생성**

JS 코드 실행 및 API 주입을 담당하는 컴포넌트:

```typescript
/**
 * @file WidgetScriptRenderer.tsx
 * @description Script 타입 위젯 렌더러 - JS 코드 실행 및 API 주입
 */

import { useEffect, useRef, useCallback } from 'react';
import type { ScriptViewNode } from '@estelle/core';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface WidgetScriptRendererProps {
  sessionId: string;
  view: ScriptViewNode;
  assets: Record<string, string>;  // URL로 변환된 에셋
  onEvent: (data: unknown) => void;
  onCancel: () => void;
  className?: string;
}

export function WidgetScriptRenderer({
  sessionId,
  view,
  assets,
  onEvent,
  onCancel,
  className,
}: WidgetScriptRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const messageHandlerRef = useRef<((data: unknown) => void) | null>(null);

  // CLI → Client 메시지 수신 핸들러 등록
  const setMessageHandler = useCallback((handler: (data: unknown) => void) => {
    messageHandlerRef.current = handler;
  }, []);

  // 외부에서 메시지 전달받을 때 호출
  const handleMessage = useCallback((data: unknown) => {
    messageHandlerRef.current?.(data);
  }, []);

  // 코드 실행
  useEffect(() => {
    if (!containerRef.current) return;

    // 기존 cleanup
    cleanupRef.current?.();
    cleanupRef.current = null;
    messageHandlerRef.current = null;

    // HTML 삽입
    containerRef.current.innerHTML = view.html;

    // API 생성
    const api = createWidgetAPI({
      container: containerRef.current,
      assets,
      onEvent,
      onCancel,
      setMessageHandler,
    });

    // 코드 실행
    if (view.code) {
      try {
        const fn = new Function('api', view.code);
        const result = fn(api);

        // cleanup 함수 반환 시 저장
        if (typeof result === 'function') {
          cleanupRef.current = result;
        }
      } catch (err) {
        console.error('[WidgetScriptRenderer] Code execution error:', err);
        onEvent({ type: 'error', message: String(err) });
      }
    }

    return () => {
      cleanupRef.current?.();
    };
  }, [view, assets, onEvent, onCancel, setMessageHandler]);

  return (
    <div className={cn('widget-script-renderer relative', className)}>
      {/* X 버튼 */}
      <button
        onClick={onCancel}
        className="absolute top-2 right-2 p-1 rounded hover:bg-muted/80 z-10"
        aria-label="Close widget"
      >
        <X size={16} />
      </button>

      {/* 위젯 렌더링 영역 */}
      <div
        ref={containerRef}
        className="widget-content w-full"
        style={{ height: view.height ? `${view.height}px` : 'auto' }}
      />
    </div>
  );
}

// API 생성 함수
interface CreateWidgetAPIOptions {
  container: HTMLDivElement;
  assets: Record<string, string>;
  onEvent: (data: unknown) => void;
  onCancel: () => void;
  setMessageHandler: (handler: (data: unknown) => void) => void;
}

function createWidgetAPI(options: CreateWidgetAPIOptions) {
  const { container, assets, onEvent, onCancel, setMessageHandler } = options;

  return {
    // 코어
    sendEvent: (data: unknown) => onEvent(data),
    onMessage: (callback: (data: unknown) => void) => setMessageHandler(callback),
    onCancel: (callback: () => void) => {
      // cancel 시 호출할 콜백 등록
      // 실제 구현에서는 이벤트 리스너로 처리
    },

    // 에셋
    getAssetUrl: (key: string) => assets[key] || '',

    // 버블 컨텍스트
    bubble: {
      getSize: () => ({
        width: container.offsetWidth,
        height: container.offsetHeight,
      }),
      onResize: (callback: (size: { width: number; height: number }) => void) => {
        const observer = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry) {
            callback({
              width: entry.contentRect.width,
              height: entry.contentRect.height,
            });
          }
        });
        observer.observe(container);
        // cleanup에서 disconnect 필요
      },
      isMobile: () => window.innerWidth < 768,
      isFullscreen: () => false, // TODO: 구현
      requestHeight: (height: number) => {
        container.style.height = `${height}px`;
      },
    },

    // 플랫폼 추상화 - 입력
    input: {
      onKey: (callback: (e: KeyboardEvent) => void) => {
        document.addEventListener('keydown', callback);
        // cleanup에서 removeEventListener 필요
      },
      onTouch: (callback: (e: TouchEvent) => void) => {
        container.addEventListener('touchstart', callback);
      },
      onSwipe: (callback: (e: { direction: string }) => void) => {
        // swipe 감지 로직 구현
      },
    },

    // 플랫폼 추상화 - 출력
    output: {
      vibrate: (ms: number) => {
        if (navigator.vibrate) {
          navigator.vibrate(ms);
        }
      },
      playSound: (assetKey: string) => {
        const url = assets[assetKey];
        if (url) {
          const audio = new Audio(url);
          audio.play().catch(() => {});
        }
      },
      showToast: (message: string) => {
        // 간단한 토스트 표시
        console.log('[Toast]', message);
      },
    },
  };
}
```

**Step 2: WidgetRenderer 수정**

ScriptViewNode 분기 추가:

```typescript
import { WidgetScriptRenderer } from './WidgetScriptRenderer';
import type { ScriptViewNode } from '@estelle/core';

// view.type === 'script'일 때 WidgetScriptRenderer 사용
if (view.type === 'script') {
  return (
    <WidgetScriptRenderer
      sessionId={sessionId}
      view={view as ScriptViewNode}
      assets={assets}
      onEvent={onEvent}
      onCancel={onCancel}
    />
  );
}
```

**Step 3: 빌드 확인**

Run: `pnpm --filter @estelle/client build`
Expected: 빌드 성공

**Step 4: Commit**

```bash
git add packages/client/src/components/widget/
git commit -m "feat(client): WidgetScriptRenderer v2 구현

- JS 코드 실행 (eval)
- WidgetAPI 주입 (sendEvent, onMessage, bubble, input, output)
- X 버튼으로 강제 종료
- 세로 높이 지정/반응형"
```

---

## Task 6: Client 이벤트 연동

**Files:**
- Modify: `packages/client/src/hooks/useMessageRouter.ts` (또는 WebSocket 핸들러)
- Modify: `packages/client/src/stores/conversationStore.ts`

**Step 1: widget_event 수신 처리**

WebSocket에서 `widget_event` 수신 시 해당 위젯에 전달:

```typescript
case 'widget_event': {
  const { sessionId, data } = message;
  // 해당 위젯 세션에 메시지 전달
  widgetStore.handleMessage(sessionId, data);
  break;
}
```

**Step 2: widget_event 전송 처리**

위젯에서 `onEvent` 호출 시 Pylon으로 전송:

```typescript
function sendWidgetEvent(sessionId: string, data: unknown) {
  send({
    type: 'widget_event',
    sessionId,
    data,
  });
}
```

**Step 3: 빌드 확인**

Run: `pnpm --filter @estelle/client build`
Expected: 빌드 성공

**Step 4: Commit**

```bash
git add packages/client/src/
git commit -m "feat(client): widget_event 양방향 통신 연동

- widget_event 수신 → 위젯에 전달
- 위젯 onEvent → widget_event 전송"
```

---

## Task 7: 블랙잭 v2 마이그레이션

**Files:**
- Modify: `/home/estelle/qos/blackjack/src/widget.ts`
- Modify: `/home/estelle/qos/blackjack/src/index.ts`

**Step 1: 클라이언트 사이드 코드 분리**

게임 렌더링 + 애니메이션 로직을 클라이언트 코드로 분리:

```typescript
// src/client-code.ts - 클라이언트에서 실행될 코드
export const BLACKJACK_CLIENT_CODE = `
// 게임 상태
let state = null;
let animating = false;

// 카드 렌더링
function renderCard(card, hidden = false) {
  if (hidden) {
    return '<div class="card hidden">?</div>';
  }
  const suitSymbol = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  const color = card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black';
  return \`<div class="card" style="color: \${color}">\${card.rank}\${suitSymbol[card.suit]}</div>\`;
}

// 게임 렌더링
function render() {
  const container = document.getElementById('blackjack-game');
  // ... 렌더링 로직
}

// 카드 딜링 애니메이션
async function animateDeal(card, target) {
  animating = true;
  // CSS 애니메이션으로 카드 이동
  await new Promise(r => setTimeout(r, 300));
  animating = false;
}

// 이벤트 핸들러
document.getElementById('hit-btn')?.addEventListener('click', () => {
  if (!animating) api.sendEvent({ action: 'hit' });
});

document.getElementById('stand-btn')?.addEventListener('click', () => {
  if (!animating) api.sendEvent({ action: 'stand' });
});

document.getElementById('deal-btn')?.addEventListener('click', () => {
  if (!animating) api.sendEvent({ action: 'deal' });
});

// 서버 메시지 수신
api.onMessage((msg) => {
  if (msg.type === 'state') {
    state = msg.state;
    render();
  } else if (msg.type === 'deal_card') {
    animateDeal(msg.card, msg.target).then(render);
  }
});

// 초기 렌더
render();
`;
```

**Step 2: 서버 로직 수정**

stdin 이벤트 기반으로 변경:

```typescript
// index.ts
import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin });

// 초기 render 전송
sendRender();

// 이벤트 수신
rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.type === 'event') {
      handleAction(msg.data);
    } else if (msg.type === 'cancel') {
      process.exit(0);
    }
  } catch {}
});

function handleAction(data: { action: string }) {
  switch (data.action) {
    case 'deal':
      dealCards();
      break;
    case 'hit':
      playerHit();
      break;
    case 'stand':
      playerStand();
      break;
  }
}
```

**Step 3: 테스트**

Run: `pnpm --filter blackjack dev`
Expected: 위젯이 렌더링되고 게임 플레이 가능

**Step 4: Commit**

```bash
git add /home/estelle/qos/blackjack/
git commit -m "feat(blackjack): Widget Protocol v2 마이그레이션

- 클라이언트 사이드 렌더링으로 전환
- 카드 딜링/뒤집기 애니메이션 추가
- 이벤트 기반 통신"
```

---

## Task 8: 로깅 시스템

**Files:**
- Create: `packages/pylon/src/utils/widget-logger.ts`
- Modify: `packages/pylon/src/managers/widget-manager.ts`

**Step 1: 위젯 로거 생성**

```typescript
/**
 * @file widget-logger.ts
 * @description 위젯 세션 로깅
 */

import { appendFile, mkdir } from 'fs/promises';
import path from 'path';

export class WidgetLogger {
  private logPath: string;
  private sessionId: string;

  constructor(cwd: string, sessionId: string) {
    this.sessionId = sessionId;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logDir = path.join(cwd, 'logs');
    this.logPath = path.join(logDir, `widget-${timestamp}.log`);

    // 로그 디렉토리 생성
    mkdir(logDir, { recursive: true }).catch(() => {});
  }

  private async write(level: string, message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const line = data
      ? `[${timestamp}] ${level} ${message} ${JSON.stringify(data)}\n`
      : `[${timestamp}] ${level} ${message}\n`;

    await appendFile(this.logPath, line).catch(() => {});
  }

  sessionStart() {
    this.write('SESSION_START', this.sessionId);
  }

  sessionEnd() {
    this.write('SESSION_END', this.sessionId);
  }

  cliToPylon(type: string, data?: unknown) {
    this.write('CLI→PYLON', type, data);
  }

  pylonToCli(type: string, data?: unknown) {
    this.write('PYLON→CLI', type, data);
  }

  pylonToClient(type: string, data?: unknown) {
    this.write('PYLON→CLIENT', type, data);
  }

  clientToPylon(type: string, data?: unknown) {
    this.write('CLIENT→PYLON', type, data);
  }

  error(message: string, error?: unknown) {
    this.write('ERROR', message, error);
  }
}
```

**Step 2: WidgetManager에 로깅 통합**

세션 시작 시 로거 생성, 메시지 송수신 시 로깅.

**Step 3: 빌드 확인**

Run: `pnpm --filter @estelle/pylon build`
Expected: 빌드 성공

**Step 4: Commit**

```bash
git add packages/pylon/src/utils/widget-logger.ts packages/pylon/src/managers/widget-manager.ts
git commit -m "feat(pylon): 위젯 로깅 시스템

- WidgetLogger 클래스
- 세션별 로그 파일 생성
- 이벤트 중심 로깅 (render, event, complete, error)"
```

---

## Task 9: E2E 테스트

**Files:**
- Create: `packages/client/src/e2e/widget-v2.test.ts`

**Step 1: 위젯 v2 E2E 테스트 작성**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Widget Protocol v2', () => {
  test('script view renders and executes code', async ({ page }) => {
    // 테스트 위젯 세션 시작
    // JS 코드 실행 확인
    // 이벤트 송수신 확인
  });

  test('bidirectional events work correctly', async ({ page }) => {
    // Client → CLI 이벤트 전송
    // CLI → Client 이벤트 수신
  });

  test('X button cancels widget session', async ({ page }) => {
    // X 버튼 클릭
    // 세션 종료 확인
  });
});
```

**Step 2: 테스트 실행**

Run: `pnpm --filter @estelle/client test:e2e`
Expected: 테스트 통과

**Step 3: Commit**

```bash
git add packages/client/src/e2e/widget-v2.test.ts
git commit -m "test(client): Widget Protocol v2 E2E 테스트

- script view 렌더링/실행 테스트
- 양방향 이벤트 테스트
- 취소 기능 테스트"
```

---

## Task 10: 통합 테스트 및 정리

**Step 1: 전체 빌드**

Run: `pnpm build`
Expected: 모든 패키지 빌드 성공

**Step 2: 블랙잭으로 통합 테스트**

Run: MCP `run_widget` 도구로 블랙잭 실행
Expected: 게임 플레이 가능, 애니메이션 동작

**Step 3: 문서 업데이트**

설계 문서의 구현 범위 체크리스트 업데이트.

**Step 4: Final Commit**

```bash
git add .
git commit -m "feat: Widget Protocol v2 구현 완료

- Core: 새 타입 정의
- Pylon: 이벤트 처리, 에셋 서빙, 로깅
- Client: WidgetScriptRenderer, API 주입
- Blackjack: v2 마이그레이션 + 애니메이션"
```
