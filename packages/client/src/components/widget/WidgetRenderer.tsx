/**
 * @file WidgetRenderer.tsx
 * @description Widget의 최상위 렌더링 컴포넌트
 *
 * view와 inputs를 받아 위젯을 렌더링하고, 사용자 입력을 처리합니다.
 * v2: ScriptViewNode일 경우 WidgetScriptRenderer로 분기합니다.
 */

import { useCallback } from 'react';
import type { ViewNode, InputNode, ScriptViewNode } from '@estelle/core';
import { isScriptViewNode } from '@estelle/core';
import { WidgetView } from './WidgetView';
import { WidgetInputs } from './WidgetInputs';
import { WidgetScriptRenderer } from './WidgetScriptRenderer';
import { cn } from '@/lib/utils';

export interface WidgetRendererProps {
  /** 세션 ID (v2 스크립트 위젯용) */
  sessionId?: string;
  /** 렌더링할 뷰 노드 */
  view: ViewNode;
  /** 입력 노드 배열 */
  inputs: InputNode[];
  /** 입력 제출 콜백 - 모든 입력 값을 Record로 전달 */
  onInput: (data: Record<string, unknown>) => void;
  /** v2: 이벤트 콜백 (ScriptViewNode용) */
  onEvent?: (data: unknown) => void;
  /** v2: 취소 콜백 (ScriptViewNode용) */
  onCancel?: () => void;
  /** v2: 에셋 URL 맵 (ScriptViewNode용) */
  assets?: Record<string, string>;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * Widget Protocol의 Client 측 렌더러
 *
 * - view: 위젯의 시각적 콘텐츠를 렌더링
 * - inputs: 사용자 입력 UI를 렌더링
 * - 입력 발생 시 onInput 콜백 호출
 * - v2: ScriptViewNode일 경우 WidgetScriptRenderer 사용
 */
export function WidgetRenderer({
  sessionId,
  view,
  inputs,
  onInput,
  onEvent,
  onCancel,
  assets,
  className,
}: WidgetRendererProps) {
  // 개별 입력 처리 - 즉시 전송 방식
  const handleInput = useCallback(
    (id: string, value: unknown) => {
      onInput({ [id]: value });
    },
    [onInput]
  );

  const hasInputs = inputs.length > 0;

  // v2: ScriptViewNode일 경우 WidgetScriptRenderer 사용
  if (isScriptViewNode(view)) {
    // ScriptViewNode는 sessionId, onEvent, onCancel이 필수
    if (!sessionId || !onEvent || !onCancel) {
      console.error(
        '[WidgetRenderer] ScriptViewNode requires sessionId, onEvent, and onCancel props'
      );
      return null;
    }

    return (
      <div
        className={cn(
          'widget-renderer',
          'p-3 rounded-lg border border-border bg-card',
          className
        )}
      >
        <WidgetScriptRenderer
          sessionId={sessionId}
          view={view}
          assets={assets || {}}
          onEvent={onEvent}
          onCancel={onCancel}
        />
      </div>
    );
  }

  // v1: 기존 WidgetView + WidgetInputs 렌더링
  return (
    <div
      className={cn(
        'widget-renderer',
        'p-3 rounded-lg border border-border bg-card',
        className
      )}
    >
      {/* View 영역 */}
      <div className="widget-view-container">
        <WidgetView node={view} />
      </div>

      {/* Inputs 영역 */}
      {hasInputs && (
        <div className="widget-inputs-container mt-3 pt-3 border-t border-border">
          <WidgetInputs inputs={inputs} onInput={handleInput} />
        </div>
      )}
    </div>
  );
}
