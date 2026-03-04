# Widget Protocol Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Claude를 거치지 않고 복잡한 유저 인터랙션을 처리하는 범용 Widget 프레임워크 구현

**Architecture:** CLI 프로세스가 JSON Lines로 렌더링 데이터를 출력하고, Pylon의 WidgetManager가 이를 Client로 전달. Client의 WidgetRenderer가 JSON/HTML을 렌더링하고 유저 인풋을 다시 CLI로 전달. 세션 완료 시 MCP 응답으로 결과 반환.

**Tech Stack:** TypeScript, React, MCP SDK, DOMPurify (HTML sanitization)

---

## Task 1: Core - Widget 타입 정의

**Files:**
- Create: `packages/core/src/types/widget.ts`
- Modify: `packages/core/src/types/index.ts`

**Step 1: Write the type definitions**

```typescript
// packages/core/src/types/widget.ts

/**
 * @file widget.ts
 * @description Widget Protocol 타입 정의
 *
 * CLI ↔ Pylon ↔ Client 간 Widget 통신에 사용되는 타입들
 */

// ============================================================================
// View Types (렌더링)
// ============================================================================

/**
 * 텍스트 뷰 노드
 */
export interface TextViewNode {
  type: 'text';
  content: string;
  style?: 'title' | 'body' | 'caption';
}

/**
 * 레이아웃 뷰 노드 (row/column)
 */
export interface LayoutViewNode {
  type: 'row' | 'column';
  children: ViewNode[];
  gap?: number;
}

/**
 * 이미지 뷰 노드
 */
export interface ImageViewNode {
  type: 'image';
  src: string;
}

/**
 * 스페이서 뷰 노드
 */
export interface SpacerViewNode {
  type: 'spacer';
  size?: number;
}

/**
 * HTML 뷰 노드
 */
export interface HtmlViewNode {
  type: 'html';
  content: string;
}

/**
 * 모든 뷰 노드 유니온
 */
export type ViewNode =
  | TextViewNode
  | LayoutViewNode
  | ImageViewNode
  | SpacerViewNode
  | HtmlViewNode;

// ============================================================================
// Input Types (유저 입력)
// ============================================================================

/**
 * 버튼 인풋 노드
 */
export interface ButtonsInputNode {
  type: 'buttons';
  id: string;
  options: string[];
  disabled?: string[];
}

/**
 * 텍스트 인풋 노드
 */
export interface TextInputNode {
  type: 'text';
  id: string;
  placeholder?: string;
}

/**
 * 슬라이더 인풋 노드
 */
export interface SliderInputNode {
  type: 'slider';
  id: string;
  min: number;
  max: number;
  step?: number;
}

/**
 * 확인 버튼 인풋 노드
 */
export interface ConfirmInputNode {
  type: 'confirm';
  id: string;
  label: string;
}

/**
 * 모든 인풋 노드 유니온
 */
export type InputNode =
  | ButtonsInputNode
  | TextInputNode
  | SliderInputNode
  | ConfirmInputNode;

// ============================================================================
// CLI Protocol Messages
// ============================================================================

/**
 * CLI → Pylon: 렌더 메시지
 */
export interface WidgetCliRenderMessage {
  type: 'render';
  view: ViewNode;
  inputs: InputNode[];
}

/**
 * CLI → Pylon: 완료 메시지
 */
export interface WidgetCliCompleteMessage {
  type: 'complete';
  result: unknown;
}

/**
 * CLI → Pylon: 에러 메시지
 */
export interface WidgetCliErrorMessage {
  type: 'error';
  message: string;
}

/**
 * CLI → Pylon 메시지 유니온
 */
export type WidgetCliMessage =
  | WidgetCliRenderMessage
  | WidgetCliCompleteMessage
  | WidgetCliErrorMessage;

/**
 * Pylon → CLI: 인풋 메시지
 */
export interface WidgetPylonInputMessage {
  type: 'input';
  data: Record<string, unknown>;
}

/**
 * Pylon → CLI: 취소 메시지
 */
export interface WidgetPylonCancelMessage {
  type: 'cancel';
}

/**
 * Pylon → CLI 메시지 유니온
 */
export type WidgetPylonMessage =
  | WidgetPylonInputMessage
  | WidgetPylonCancelMessage;

// ============================================================================
// Pylon ↔ Client Messages (WebSocket)
// ============================================================================

/**
 * Pylon → Client: 위젯 렌더 메시지
 */
export interface WidgetRenderMessage {
  type: 'widget_render';
  sessionId: string;
  view: ViewNode;
  inputs: InputNode[];
}

/**
 * Pylon → Client: 위젯 닫기 메시지
 */
export interface WidgetCloseMessage {
  type: 'widget_close';
  sessionId: string;
}

/**
 * Client → Pylon: 위젯 인풋 메시지
 */
export interface WidgetInputMessage {
  type: 'widget_input';
  sessionId: string;
  data: Record<string, unknown>;
}

/**
 * Client → Pylon: 위젯 취소 메시지
 */
export interface WidgetCancelMessage {
  type: 'widget_cancel';
  sessionId: string;
}

// ============================================================================
// Type Guards
// ============================================================================

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isWidgetCliRenderMessage(value: unknown): value is WidgetCliRenderMessage {
  return isObject(value) && value.type === 'render' && 'view' in value && 'inputs' in value;
}

export function isWidgetCliCompleteMessage(value: unknown): value is WidgetCliCompleteMessage {
  return isObject(value) && value.type === 'complete' && 'result' in value;
}

export function isWidgetCliErrorMessage(value: unknown): value is WidgetCliErrorMessage {
  return isObject(value) && value.type === 'error' && typeof value.message === 'string';
}

export function isWidgetRenderMessage(value: unknown): value is WidgetRenderMessage {
  return isObject(value) && value.type === 'widget_render' && typeof value.sessionId === 'string';
}

export function isWidgetCloseMessage(value: unknown): value is WidgetCloseMessage {
  return isObject(value) && value.type === 'widget_close' && typeof value.sessionId === 'string';
}

export function isWidgetInputMessage(value: unknown): value is WidgetInputMessage {
  return isObject(value) && value.type === 'widget_input' && typeof value.sessionId === 'string';
}

export function isWidgetCancelMessage(value: unknown): value is WidgetCancelMessage {
  return isObject(value) && value.type === 'widget_cancel' && typeof value.sessionId === 'string';
}
```

**Step 2: Export from index**

```typescript
// packages/core/src/types/index.ts 에 추가
export * from './widget.js';
```

**Step 3: Build and verify**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/core build`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add packages/core/src/types/widget.ts packages/core/src/types/index.ts
git commit -m "feat(core): add Widget Protocol type definitions"
```

---

## Task 2: Pylon - WidgetManager 구현

**Files:**
- Create: `packages/pylon/src/managers/widget-manager.ts`
- Modify: `packages/pylon/src/managers/index.ts`

**Step 1: Write WidgetManager class**

```typescript
// packages/pylon/src/managers/widget-manager.ts

/**
 * @file widget-manager.ts
 * @description Widget 세션 관리자
 *
 * CLI 프로세스를 spawn하고 stdin/stdout으로 Widget Protocol 통신을 관리합니다.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import readline from 'readline';
import {
  ViewNode,
  InputNode,
  WidgetCliMessage,
  isWidgetCliRenderMessage,
  isWidgetCliCompleteMessage,
  isWidgetCliErrorMessage,
} from '@estelle/core';

// ============================================================================
// Types
// ============================================================================

export interface WidgetSession {
  sessionId: string;
  process: ChildProcess;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  result?: unknown;
  error?: string;
}

export interface WidgetStartOptions {
  command: string;
  cwd: string;
  args?: string[];
}

export interface WidgetRenderEvent {
  sessionId: string;
  view: ViewNode;
  inputs: InputNode[];
}

export interface WidgetCompleteEvent {
  sessionId: string;
  result: unknown;
}

export interface WidgetErrorEvent {
  sessionId: string;
  error: string;
}

// ============================================================================
// WidgetManager
// ============================================================================

export class WidgetManager extends EventEmitter {
  private sessions: Map<string, WidgetSession> = new Map();
  private sessionCounter = 0;

  /**
   * 새 Widget 세션 시작
   */
  async startSession(options: WidgetStartOptions): Promise<string> {
    const sessionId = `widget-${++this.sessionCounter}-${Date.now()}`;

    const proc = spawn(options.command, options.args ?? [], {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    const session: WidgetSession = {
      sessionId,
      process: proc,
      status: 'running',
    };

    this.sessions.set(sessionId, session);

    // stdout 라인 파싱
    const rl = readline.createInterface({
      input: proc.stdout!,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      this.handleCliOutput(sessionId, line);
    });

    // stderr 로깅
    proc.stderr?.on('data', (data) => {
      console.error(`[Widget ${sessionId}] stderr:`, data.toString());
    });

    // 프로세스 종료 처리
    proc.on('close', (code) => {
      const sess = this.sessions.get(sessionId);
      if (sess && sess.status === 'running') {
        if (code === 0) {
          sess.status = 'completed';
        } else {
          sess.status = 'error';
          sess.error = `Process exited with code ${code}`;
          this.emit('error', { sessionId, error: sess.error });
        }
      }
    });

    proc.on('error', (err) => {
      const sess = this.sessions.get(sessionId);
      if (sess) {
        sess.status = 'error';
        sess.error = err.message;
        this.emit('error', { sessionId, error: err.message });
      }
    });

    return sessionId;
  }

  /**
   * CLI stdout 라인 처리
   */
  private handleCliOutput(sessionId: string, line: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      const message: WidgetCliMessage = JSON.parse(line);

      if (isWidgetCliRenderMessage(message)) {
        this.emit('render', {
          sessionId,
          view: message.view,
          inputs: message.inputs,
        } as WidgetRenderEvent);
      } else if (isWidgetCliCompleteMessage(message)) {
        session.status = 'completed';
        session.result = message.result;
        this.emit('complete', {
          sessionId,
          result: message.result,
        } as WidgetCompleteEvent);
      } else if (isWidgetCliErrorMessage(message)) {
        session.status = 'error';
        session.error = message.message;
        this.emit('error', {
          sessionId,
          error: message.message,
        } as WidgetErrorEvent);
      }
    } catch (err) {
      // JSON 파싱 실패 - 일반 로그로 처리
      console.log(`[Widget ${sessionId}] output:`, line);
    }
  }

  /**
   * 유저 인풋 전송
   */
  sendInput(sessionId: string, data: Record<string, unknown>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') {
      return false;
    }

    const message = JSON.stringify({ type: 'input', data }) + '\n';
    session.process.stdin?.write(message);
    return true;
  }

  /**
   * 세션 취소
   */
  cancelSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'running') {
      return false;
    }

    // 취소 메시지 전송
    const message = JSON.stringify({ type: 'cancel' }) + '\n';
    session.process.stdin?.write(message);

    // 프로세스 종료
    session.process.kill('SIGTERM');
    session.status = 'cancelled';

    return true;
  }

  /**
   * 세션 조회
   */
  getSession(sessionId: string): WidgetSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 완료 대기 (MCP 도구용)
   */
  waitForCompletion(sessionId: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        reject(new Error('Session not found'));
        return;
      }

      if (session.status === 'completed') {
        resolve(session.result);
        return;
      }

      if (session.status === 'error') {
        reject(new Error(session.error));
        return;
      }

      if (session.status === 'cancelled') {
        reject(new Error('Session cancelled'));
        return;
      }

      const onComplete = (event: WidgetCompleteEvent) => {
        if (event.sessionId === sessionId) {
          cleanup();
          resolve(event.result);
        }
      };

      const onError = (event: WidgetErrorEvent) => {
        if (event.sessionId === sessionId) {
          cleanup();
          reject(new Error(event.error));
        }
      };

      const cleanup = () => {
        this.off('complete', onComplete);
        this.off('error', onError);
      };

      this.on('complete', onComplete);
      this.on('error', onError);
    });
  }

  /**
   * 모든 세션 정리
   */
  cleanup(): void {
    for (const [sessionId, session] of this.sessions) {
      if (session.status === 'running') {
        session.process.kill('SIGTERM');
        session.status = 'cancelled';
      }
    }
    this.sessions.clear();
  }
}
```

**Step 2: Export from managers/index.ts**

```typescript
// packages/pylon/src/managers/index.ts 에 추가

// ============================================================================
// WidgetManager
// ============================================================================

export {
  WidgetManager,
  type WidgetSession,
  type WidgetStartOptions,
  type WidgetRenderEvent,
  type WidgetCompleteEvent,
  type WidgetErrorEvent,
} from './widget-manager.js';
```

**Step 3: Build and verify**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/pylon build`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add packages/pylon/src/managers/widget-manager.ts packages/pylon/src/managers/index.ts
git commit -m "feat(pylon): add WidgetManager for interactive CLI sessions"
```

---

## Task 3: Pylon - run_widget MCP 도구

**Files:**
- Create: `packages/pylon/src/mcp/tools/run-widget.ts`
- Modify: `packages/pylon/src/mcp/server.ts`

**Step 1: Write run_widget tool**

```typescript
// packages/pylon/src/mcp/tools/run-widget.ts

/**
 * @file run-widget.ts
 * @description run_widget MCP 도구 구현
 *
 * 인터랙티브 Widget 세션을 시작하고 완료까지 대기합니다.
 */

import { PylonClient } from '../pylon-client.js';

// ============================================================================
// Types
// ============================================================================

interface RunWidgetArgs {
  command?: string;
  cwd?: string;
  args?: string[];
}

interface ToolMeta {
  toolUseId: string;
}

interface McpTextContent {
  type: 'text';
  text: string;
}

interface McpResponse {
  content: McpTextContent[];
  isError?: boolean;
}

// ============================================================================
// Tool Definition
// ============================================================================

export function getRunWidgetToolDefinition() {
  return {
    name: 'run_widget',
    description: '인터랙티브 위젯 세션을 시작합니다. 유저와의 상호작용이 완료될 때까지 대기합니다.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          description: '실행할 CLI 명령어 (예: pnpm dev)',
        },
        cwd: {
          type: 'string',
          description: '작업 디렉토리 (절대 경로)',
        },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'CLI 인자 (선택)',
        },
      },
      required: ['command', 'cwd'],
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function createSuccessResponse(data: Record<string, unknown>): McpResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

function createErrorResponse(message: string): McpResponse {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function createPylonClient(): PylonClient {
  const mcpPort = parseInt(process.env.ESTELLE_MCP_PORT || '9880', 10);
  return new PylonClient({
    host: '127.0.0.1',
    port: mcpPort,
  });
}

// ============================================================================
// Main
// ============================================================================

export async function executeRunWidget(
  args: RunWidgetArgs,
  meta: ToolMeta,
): Promise<McpResponse> {
  if (!args.command) {
    return createErrorResponse('command is required');
  }

  if (!args.cwd) {
    return createErrorResponse('cwd is required');
  }

  try {
    const pylonClient = createPylonClient();
    const result = await pylonClient.runWidget({
      command: args.command,
      cwd: args.cwd,
      args: args.args,
      toolUseId: meta.toolUseId,
    });

    if (!result.success) {
      return createErrorResponse(result.error ?? 'Widget session failed');
    }

    return createSuccessResponse({
      success: true,
      result: result.result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return createErrorResponse(`Widget session failed: ${message}`);
  }
}
```

**Step 2: Register in MCP server**

```typescript
// packages/pylon/src/mcp/server.ts 에 추가

// import 추가
import {
  executeRunWidget,
  getRunWidgetToolDefinition,
} from './tools/run-widget.js';

// tools 배열에 추가
getRunWidgetToolDefinition(),

// switch case 추가
case 'run_widget': {
  const result = await executeRunWidget(
    args as { command?: string; cwd?: string; args?: string[] },
    { toolUseId }
  );
  return result as unknown as Record<string, unknown>;
}
```

**Step 3: Build and verify**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/pylon build`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add packages/pylon/src/mcp/tools/run-widget.ts packages/pylon/src/mcp/server.ts
git commit -m "feat(pylon): add run_widget MCP tool"
```

---

## Task 4: Pylon - PylonClient Widget 메서드

**Files:**
- Modify: `packages/pylon/src/mcp/pylon-client.ts`

**Step 1: Add runWidget method to PylonClient**

PylonClient에 runWidget 메서드를 추가합니다. 기존 파일을 읽고 메서드를 추가해야 합니다.

**Step 2: Build and verify**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/pylon build`
Expected: BUILD SUCCESS

**Step 3: Commit**

```bash
git add packages/pylon/src/mcp/pylon-client.ts
git commit -m "feat(pylon): add runWidget method to PylonClient"
```

---

## Task 5: Pylon - Widget 메시지 핸들러

**Files:**
- Modify: `packages/pylon/src/pylon.ts` (또는 적절한 핸들러 파일)

Widget 관련 메시지 (widget_input, widget_cancel)를 처리하고 WidgetManager로 라우팅하는 핸들러를 추가합니다.

**Step 1: Integrate WidgetManager into Pylon**

Pylon 메인 클래스에서 WidgetManager 인스턴스를 생성하고, render/complete 이벤트를 Client로 전달하도록 구성합니다.

**Step 2: Build and verify**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/pylon build`
Expected: BUILD SUCCESS

**Step 3: Commit**

```bash
git add packages/pylon/src/pylon.ts
git commit -m "feat(pylon): integrate WidgetManager and add message handlers"
```

---

## Task 6: Client - WidgetRenderer 컴포넌트

**Files:**
- Create: `packages/client/src/components/widget/WidgetRenderer.tsx`
- Create: `packages/client/src/components/widget/WidgetView.tsx`
- Create: `packages/client/src/components/widget/WidgetInputs.tsx`
- Create: `packages/client/src/components/widget/index.ts`

**Step 1: Write WidgetView component**

```tsx
// packages/client/src/components/widget/WidgetView.tsx

import DOMPurify from 'dompurify';
import type { ViewNode } from '@estelle/core';
import { cn } from '../../lib/utils';

interface WidgetViewProps {
  node: ViewNode;
}

export function WidgetView({ node }: WidgetViewProps) {
  switch (node.type) {
    case 'text':
      return (
        <p className={cn(
          'select-text',
          node.style === 'title' && 'text-lg font-semibold',
          node.style === 'body' && 'text-sm',
          node.style === 'caption' && 'text-xs text-muted-foreground',
        )}>
          {node.content}
        </p>
      );

    case 'row':
      return (
        <div className="flex flex-row items-center" style={{ gap: node.gap ?? 8 }}>
          {node.children.map((child, i) => (
            <WidgetView key={i} node={child} />
          ))}
        </div>
      );

    case 'column':
      return (
        <div className="flex flex-col" style={{ gap: node.gap ?? 8 }}>
          {node.children.map((child, i) => (
            <WidgetView key={i} node={child} />
          ))}
        </div>
      );

    case 'image':
      return (
        <img
          src={node.src}
          alt=""
          className="max-w-full rounded"
        />
      );

    case 'spacer':
      return <div style={{ height: node.size ?? 16 }} />;

    case 'html':
      const sanitized = DOMPurify.sanitize(node.content, {
        FORBID_TAGS: ['script', 'style'],
        FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
      });
      return (
        <div
          className="widget-html"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      );

    default:
      return null;
  }
}
```

**Step 2: Write WidgetInputs component**

```tsx
// packages/client/src/components/widget/WidgetInputs.tsx

import { useState } from 'react';
import type { InputNode } from '@estelle/core';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

interface WidgetInputsProps {
  inputs: InputNode[];
  onInput: (id: string, value: unknown) => void;
}

export function WidgetInputs({ inputs, onInput }: WidgetInputsProps) {
  return (
    <div className="flex flex-col gap-3 mt-4">
      {inputs.map((input, i) => (
        <WidgetInput key={i} input={input} onInput={onInput} />
      ))}
    </div>
  );
}

interface WidgetInputProps {
  input: InputNode;
  onInput: (id: string, value: unknown) => void;
}

function WidgetInput({ input, onInput }: WidgetInputProps) {
  const [textValue, setTextValue] = useState('');
  const [sliderValue, setSliderValue] = useState(input.type === 'slider' ? input.min : 0);

  switch (input.type) {
    case 'buttons':
      return (
        <div className="flex flex-wrap gap-2">
          {input.options.map((option) => {
            const disabled = input.disabled?.includes(option);
            return (
              <Button
                key={option}
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => onInput(input.id, option)}
              >
                {option}
              </Button>
            );
          })}
        </div>
      );

    case 'text':
      return (
        <div className="flex gap-2">
          <Input
            placeholder={input.placeholder}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && textValue.trim()) {
                onInput(input.id, textValue.trim());
                setTextValue('');
              }
            }}
          />
          <Button
            variant="default"
            size="sm"
            disabled={!textValue.trim()}
            onClick={() => {
              onInput(input.id, textValue.trim());
              setTextValue('');
            }}
          >
            전송
          </Button>
        </div>
      );

    case 'slider':
      return (
        <div className="flex flex-col gap-2">
          <input
            type="range"
            min={input.min}
            max={input.max}
            step={input.step ?? 1}
            value={sliderValue}
            onChange={(e) => setSliderValue(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">{input.min}</span>
            <span className="text-sm font-medium">{sliderValue}</span>
            <span className="text-xs text-muted-foreground">{input.max}</span>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => onInput(input.id, sliderValue)}
          >
            확인
          </Button>
        </div>
      );

    case 'confirm':
      return (
        <Button
          variant="default"
          onClick={() => onInput(input.id, true)}
        >
          {input.label}
        </Button>
      );

    default:
      return null;
  }
}
```

**Step 3: Write WidgetRenderer component**

```tsx
// packages/client/src/components/widget/WidgetRenderer.tsx

import { X } from 'lucide-react';
import type { ViewNode, InputNode } from '@estelle/core';
import { Button } from '../ui/button';
import { WidgetView } from './WidgetView';
import { WidgetInputs } from './WidgetInputs';

interface WidgetRendererProps {
  sessionId: string;
  view: ViewNode;
  inputs: InputNode[];
  onInput: (sessionId: string, data: Record<string, unknown>) => void;
  onCancel: (sessionId: string) => void;
}

export function WidgetRenderer({
  sessionId,
  view,
  inputs,
  onInput,
  onCancel,
}: WidgetRendererProps) {
  const handleInput = (id: string, value: unknown) => {
    onInput(sessionId, { [id]: value });
  };

  return (
    <div className="my-2 mx-2 p-4 rounded-lg border border-primary/30 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">Interactive Widget</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onCancel(sessionId)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* View */}
      <div className="widget-view">
        <WidgetView node={view} />
      </div>

      {/* Inputs */}
      {inputs.length > 0 && (
        <WidgetInputs inputs={inputs} onInput={handleInput} />
      )}
    </div>
  );
}
```

**Step 4: Write index export**

```typescript
// packages/client/src/components/widget/index.ts

export { WidgetRenderer } from './WidgetRenderer';
export { WidgetView } from './WidgetView';
export { WidgetInputs } from './WidgetInputs';
```

**Step 5: Install DOMPurify**

Run: `cd /home/estelle/estelle2/packages/client && pnpm add dompurify && pnpm add -D @types/dompurify`

**Step 6: Build and verify**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client build`
Expected: BUILD SUCCESS

**Step 7: Commit**

```bash
git add packages/client/src/components/widget/
git commit -m "feat(client): add WidgetRenderer components"
```

---

## Task 7: Client - Widget 메시지 핸들러 및 Store 통합

**Files:**
- Modify: `packages/client/src/stores/conversationStore.ts`
- Modify: `packages/client/src/components/chat/MessageList.tsx`

**Step 1: Add widget state to conversationStore**

conversationStore에 activeWidget 상태를 추가하고 widget_render/widget_close 메시지를 처리합니다.

**Step 2: Integrate WidgetRenderer into MessageList**

MessageList에서 activeWidget이 있으면 WidgetRenderer를 렌더링합니다.

**Step 3: Build and verify**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/client build`
Expected: BUILD SUCCESS

**Step 4: Commit**

```bash
git add packages/client/src/stores/conversationStore.ts packages/client/src/components/chat/MessageList.tsx
git commit -m "feat(client): integrate WidgetRenderer into message flow"
```

---

## Task 8: 블랙잭 CLI - Widget Protocol 지원

**Files:**
- Modify: `/home/estelle/qos/blackjack/src/index.ts`

**Step 1: Add widget mode to blackjack CLI**

기존 블랙잭 CLI에 `--widget` 플래그를 추가하여 Widget Protocol 모드로 동작하게 합니다.

- stdout으로 JSON Lines 출력 (render/complete)
- stdin에서 JSON Lines 입력 수신 (input/cancel)
- deal 후 자동으로 첫 render 출력
- 유저 인풋에 따라 hit/stand 실행
- 게임 종료 시 complete 출력

**Step 2: Test widget mode**

Run: `cd /home/estelle/qos/blackjack && echo '{"type":"input","data":{"action":"Stand"}}' | pnpm dev --widget`
Expected: JSON Lines 출력

**Step 3: Commit**

```bash
cd /home/estelle/qos/blackjack
git add src/index.ts
git commit -m "feat: add Widget Protocol mode for Estelle integration"
```

---

## Task 9: E2E 테스트

**Files:**
- Create: `packages/pylon/src/managers/widget-manager.test.ts`

**Step 1: Write unit tests for WidgetManager**

```typescript
// packages/pylon/src/managers/widget-manager.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WidgetManager } from './widget-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('WidgetManager', () => {
  let manager: WidgetManager;
  let tmpDir: string;

  beforeEach(() => {
    manager = new WidgetManager();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-test-'));
  });

  afterEach(() => {
    manager.cleanup();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should start a session and receive render event', async () => {
    // 테스트용 스크립트 생성
    const scriptPath = path.join(tmpDir, 'test.sh');
    fs.writeFileSync(scriptPath, `#!/bin/bash
echo '{"type":"render","view":{"type":"text","content":"Hello"},"inputs":[]}'
sleep 0.1
echo '{"type":"complete","result":{"done":true}}'
`);
    fs.chmodSync(scriptPath, '755');

    const renders: unknown[] = [];
    manager.on('render', (e) => renders.push(e));

    const sessionId = await manager.startSession({
      command: scriptPath,
      cwd: tmpDir,
    });

    const result = await manager.waitForCompletion(sessionId);

    expect(renders.length).toBeGreaterThan(0);
    expect(result).toEqual({ done: true });
  });
});
```

**Step 2: Run tests**

Run: `cd /home/estelle/estelle2 && pnpm --filter @estelle/pylon test`
Expected: TESTS PASS

**Step 3: Commit**

```bash
git add packages/pylon/src/managers/widget-manager.test.ts
git commit -m "test(pylon): add WidgetManager unit tests"
```

---

## Summary

| Task | Description | Estimated Time |
|------|-------------|----------------|
| 1 | Core - Widget 타입 정의 | 10 min |
| 2 | Pylon - WidgetManager | 20 min |
| 3 | Pylon - run_widget MCP 도구 | 15 min |
| 4 | Pylon - PylonClient Widget 메서드 | 10 min |
| 5 | Pylon - Widget 메시지 핸들러 | 20 min |
| 6 | Client - WidgetRenderer 컴포넌트 | 25 min |
| 7 | Client - Store 통합 | 20 min |
| 8 | 블랙잭 CLI Widget 모드 | 30 min |
| 9 | E2E 테스트 | 15 min |

**Total: ~2.5 hours**
