# Widget Complete 종료 페이지 미표시 문제

> 작성일: 2026-03-07
> 상태: 디버깅 중

## 문제 정의

**현상:**
- 위젯 종료 시 종료 페이지(widget_complete)가 모든 클라이언트에 브로드캐스트되어야 하지만, 실제로 표시되지 않음
- 소유자 클라이언트에서도, 비소유자 클라이언트에서도 종료 페이지가 안 보임

**기대 동작:**
- 위젯 종료 시 Pylon이 `widget_complete` 메시지를 `broadcast: 'clients'`로 전송
- Relay가 이를 모든 클라이언트(pylon 제외)에 라우팅
- Client가 `widget_complete`를 받아 `setWidgetComplete`로 상태 업데이트
- ToolCard가 `completed` 상태의 view를 렌더링

## 현재까지 확인된 사항

### 1. Pylon 측 (정상 동작)

로그 확인 결과:
```
[Widget] Complete event received for session widget-1-1772855816221, owner=16, result: ...
[Widget] lastView: exists
[Widget] Calling onWidgetComplete for session widget-1-1772855816221
[Pylon] onWidgetComplete: sessionId=widget-1-1772855816221, toolUseId=toolu_0177vLjv31jtuMgLZUeS3gMd
[Widget] sendWidgetComplete: session=widget-1-1772855816221, toolUseId=toolu_0177vLjv31jtuMgLZUeS3gMd
```

- `lastView`가 존재함 (OK)
- `onWidgetComplete` 콜백 호출됨 (OK)
- `sendWidgetComplete` 함수 호출됨 (OK)

### 2. Relay 측 (문제 의심)

로그 확인 결과:
- `widget_complete` 타입의 메시지 라우팅 로그가 **없음**
- 다른 메시지들 (`claude_event`)은 정상 라우팅됨

**가설 1:** Pylon의 `send()`가 실제로 Relay에 메시지를 전송하지 못함
**가설 2:** Relay가 메시지를 받았지만 라우팅하지 못함

### 3. Client 측 (미확인)

- `widget_complete` 메시지를 받는지 확인 필요
- `useMessageRouter`의 핸들러가 호출되는지 확인 필요

## 구현된 코드

### Core: WidgetSession 타입
```typescript
// packages/core/src/types/conversation-claude.ts
status: 'pending' | 'claiming' | 'running' | 'completed';
```

### Pylon: sendWidgetComplete
```typescript
// packages/pylon/src/pylon.ts
sendWidgetComplete(conversationId, toolUseId, sessionId, view, result): void {
  console.log(`[Widget] sendWidgetComplete: session=${sessionId}, toolUseId=${toolUseId}`);
  this.send({
    type: 'widget_complete',
    payload: { conversationId, sessionId, toolUseId, view, result },
    broadcast: 'clients',
  });
}
```

### Client: useMessageRouter
```typescript
// packages/client/src/hooks/useMessageRouter.ts
case 'widget_complete': {
  const { conversationId, sessionId, toolUseId, view } = payload as {...};
  if (!conversationId || !sessionId || !toolUseId || !view) {
    console.warn('[MessageRouter] widget_complete missing required fields');
    break;
  }
  console.log(`[MessageRouter] widget_complete: session=${sessionId}, toolUseId=${toolUseId}`);
  useConversationStore.getState().setWidgetComplete(conversationId, toolUseId, sessionId, view);
  break;
}
```

### Client: conversationStore
```typescript
// packages/client/src/stores/conversationStore.ts
setWidgetComplete: (conversationId, toolUseId, sessionId, view) => {
  const states = new Map(get().states);
  const state = getOrCreateState(states, conversationId);
  states.set(conversationId, {
    ...state,
    widgetSession: { toolUseId, sessionId, view, status: 'completed' },
  });
  set({ states });
},
```

### Client: ToolCard
```typescript
// packages/client/src/components/chat/ToolCard.tsx
{matchedWidget && matchedWidget.status === 'completed' && matchedWidget.view && (
  <div className="border-t border-border">
    <WidgetRenderer
      sessionId={matchedWidget.sessionId}
      view={matchedWidget.view}
      onEvent={() => {}}
      onCancel={() => {}}
      assets={widgetAssets}
    />
  </div>
)}
```

## 진행 상황 (2026-03-07)

### 테스트 수정 완료

코드 분석 중 WidgetManager API 변경으로 인한 테스트 실패 발견 및 수정:

1. **API 변경**: `startSession()` → `prepareSession()` + `startSessionProcess()` (2단계 분리)

2. **수정된 파일**:
   - `packages/pylon/tests/managers/widget-manager.test.ts`
   - `packages/pylon/tests/servers/pylon-mcp-server.test.ts`

3. **수정 내용**:
   - 테스트용 `startSession` 헬퍼 함수 추가
   - Mock 객체를 새 API에 맞게 업데이트
   - Error 이벤트 리스너 추가 (unhandled error 방지)
   - 삭제된 `handleHandshakeAck` 테스트 제거

4. **결과**: 전체 950개 테스트 통과

### 배포 완료

- 버전: `v0307_10`
- 커밋: `9e18c6d`
- 배포 상태: 트리거 완료 (모든 머신)

## 다음 디버깅 단계

코드 분석 결과 구현은 정상으로 보임. 주인님의 가설 검증 필요:

1. **메시지 형식이 틀렸다** - `type: 'widget_complete'`와 payload 구조 확인
2. **대상 지정이 잘못됐다** - `broadcast: 'clients'` 라우팅 확인
3. **클라이언트 핸들러가 등록이 안됐다** - useMessageRouter switch case 확인

### 확인 방법

1. **Pylon → Relay 전송 확인**
   - Pylon의 `send()` 함수 내부에서 실제로 WebSocket 전송이 되는지 로그 추가
   - `deps.relayClient.send()` 호출 직전/직후 로그

2. **Relay 메시지 수신 확인**
   - Relay에서 모든 수신 메시지를 로깅 (message-handler.ts 또는 server.ts)
   - `widget_complete` 타입 메시지가 도착하는지 확인

3. **Relay 라우팅 확인**
   - `routeMessage()` 함수에서 `broadcast: 'clients'` 처리 확인
   - 라우팅 결과가 0개 클라이언트인지 확인

4. **Client 수신 확인**
   - 브라우저 콘솔에서 `widget_complete` 로그 확인
   - `routeMessage()` 함수 호출 여부 확인

## 관련 파일

- `/home/estelle/estelle2/packages/core/src/types/conversation-claude.ts`
- `/home/estelle/estelle2/packages/pylon/src/pylon.ts`
- `/home/estelle/estelle2/packages/pylon/src/bin.ts`
- `/home/estelle/estelle2/packages/pylon/src/servers/pylon-mcp-server.ts`
- `/home/estelle/estelle2/packages/relay/src/router.ts`
- `/home/estelle/estelle2/packages/relay/src/message-handler.ts`
- `/home/estelle/estelle2/packages/client/src/hooks/useMessageRouter.ts`
- `/home/estelle/estelle2/packages/client/src/stores/conversationStore.ts`
- `/home/estelle/estelle2/packages/client/src/components/chat/ToolCard.tsx`
