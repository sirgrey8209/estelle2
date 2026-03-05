# Widget 시스템 리팩토링 설계

> **Goal:** inputs 제거 + run_widget_inline 추가로 위젯 시스템 단순화

## 배경

### 현재 상태
- **v1 (inputs 기반)**: CLI가 `inputs` 배열로 버튼/텍스트/슬라이더 정의 → Client의 `WidgetInputs` 컴포넌트가 렌더링
- **v2 (ScriptViewNode)**: `view: { type: 'script', html, code }` 형태로 모든 UI를 script 내부에서 자체 렌더링

### 문제점
1. v2에서는 inputs가 무의미 (Script에서 직접 UI 구현)
2. run_widget은 CLI 프로세스 필수 → 간단한 위젯에도 외부 스크립트 필요
3. inputs 관련 코드가 불필요하게 남아있음

## 설계

### Part 1: inputs 제거

#### 제거 대상

**Core 타입:**
- `ButtonsInputNode`, `TextInputNode`, `SliderInputNode`, `ConfirmInputNode`
- `InputNode` union type
- `inputs` 필드 (WidgetCliRenderMessage, WidgetRenderMessage 등)

**Client 컴포넌트:**
- `WidgetInputs` 컴포넌트 (전체 삭제)
- `WidgetView` 컴포넌트 (v1 전용, 삭제)
- `WidgetRenderer`에서 inputs 관련 로직 제거

**Pylon:**
- `WidgetRenderEvent.inputs` 제거
- `_onWidgetRender` 콜백에서 inputs 파라미터 제거

**Store:**
- `setWidgetSession`에서 inputs 파라미터 제거
- `WidgetSession.inputs` 제거

#### 유지 대상

- `ScriptViewNode` (type: 'script', html, code, assets, height)
- `ViewNode` union (ScriptViewNode만 남김 또는 간소화)
- `api.sendInput()`, `api.complete()`, `api.cancel()` (script 내부 통신)
- `WidgetScriptRenderer` (v2 렌더러)

---

### Part 2: run_widget_inline 도구

#### MCP 스키마

```typescript
{
  name: 'run_widget_inline',
  description: '인라인 위젯을 렌더링합니다. CLI 프로세스 없이 Client에서 직접 실행됩니다.',
  inputSchema: {
    type: 'object',
    properties: {
      html: {
        type: 'string',
        description: 'HTML 템플릿 (CSS 포함 가능)',
      },
      code: {
        type: 'string',
        description: 'JavaScript 코드 (선택)',
      },
      height: {
        type: 'number',
        description: '초기 높이 픽셀 (선택, 기본 auto)',
      },
    },
    required: ['html'],
  },
}
```

#### 동작 흐름

```
Claude → run_widget_inline({ html, code, height })
  ↓
PylonMcpServer._handleRunWidgetInline()
  ├─ sessionId 생성 (inline-widget-{counter}-{timestamp})
  ├─ pendingWidgets에 등록 (기존 Map 공유)
  ├─ Client에 widget_render 전송:
  │    {
  │      type: 'widget_render',
  │      payload: {
  │        conversationId,
  │        toolUseId,
  │        sessionId,
  │        view: { type: 'script', html, code, height }
  │      }
  │    }
  └─ Promise 대기 (complete/cancel)
        ↓
      완료 시 결과 반환
```

#### 세션 관리 (기존 run_widget과 동일)

| 이벤트 | 처리 |
|--------|------|
| 대화 이탈 | pendingWidget 유지 |
| 대화 복귀 | Client → widget_check → Pylon → widget_check_result(valid=true) |
| 대화 삭제 | cancelWidgetForConversation() 호출 |
| api.complete(result) | resolve(result), pendingWidget 제거 |
| api.cancel() | reject, pendingWidget 제거 |

#### run_widget vs run_widget_inline 비교

| 항목 | run_widget | run_widget_inline |
|------|------------|-------------------|
| CLI 프로세스 | 필요 (spawn) | 불필요 |
| WidgetManager | 사용 | 미사용 |
| widget_check 시 | 프로세스 상태 확인 | 항상 valid (프로세스 없음) |
| 용도 | 복잡한 위젯 (외부 스크립트) | 간단한 인라인 위젯 |

#### widget_check 처리 수정

```typescript
// handleWidgetCheck에서
const pending = this.deps.mcpServer?.getPendingWidget(conversationId);

if (!pending || pending.widgetSessionId !== sessionId) {
  // invalid
  return;
}

// inline widget인 경우 (sessionId가 'inline-'으로 시작)
if (pending.widgetSessionId.startsWith('inline-')) {
  // 프로세스 없음 → 항상 valid
  this.sendWidgetCheckResult(conversationId, sessionId, true);
  return;
}

// CLI widget인 경우 → WidgetManager로 프로세스 상태 확인
const session = this.deps.widgetManager?.getSession(pending.widgetSessionId);
// ...기존 로직
```

---

## 마이그레이션 영향

### 제거되는 기능
- v1 스타일 inputs (buttons, text, slider, confirm)
- WidgetInputs, WidgetView 컴포넌트

### 대체 방법
- 모든 UI는 ScriptViewNode의 html/code 내부에서 구현
- `api.sendInput({ key: value })` 로 입력 전송

---

## 파일 변경 목록

### Core
- `packages/core/src/types/widget.ts` - InputNode 관련 타입 제거
- `packages/core/src/types/conversation-claude.ts` - inputs 필드 제거 (있다면)

### Pylon
- `packages/pylon/src/servers/pylon-mcp-server.ts` - _handleRunWidgetInline 추가
- `packages/pylon/src/pylon.ts` - widget_check에서 inline 분기 처리
- `packages/pylon/src/managers/widget-manager.ts` - inputs 관련 제거
- `packages/pylon/src/mcp/tools/run-widget-inline.ts` - 신규 도구
- `packages/pylon/src/mcp/server.ts` - 도구 등록

### Client
- `packages/client/src/components/widget/WidgetInputs.tsx` - 삭제
- `packages/client/src/components/widget/WidgetView.tsx` - 삭제
- `packages/client/src/components/widget/WidgetRenderer.tsx` - inputs 로직 제거
- `packages/client/src/components/widget/index.ts` - export 정리
- `packages/client/src/hooks/useMessageRouter.ts` - inputs 파라미터 제거
- `packages/client/src/stores/conversationStore.ts` - inputs 제거
