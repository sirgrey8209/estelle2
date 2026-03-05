/**
 * @file WidgetRenderer.tsx
 * @description Widget의 최상위 렌더링 컴포넌트
 *
 * ScriptViewNode를 받아 WidgetScriptRenderer로 렌더링합니다.
 */

import type { ViewNode, ScriptViewNode } from '@estelle/core';
import { isScriptViewNode } from '@estelle/core';
import { WidgetScriptRenderer } from './WidgetScriptRenderer';
import { cn } from '@/lib/utils';

export interface WidgetRendererProps {
  /** 세션 ID */
  sessionId: string;
  /** 렌더링할 뷰 노드 (ScriptViewNode만 지원) */
  view: ViewNode;
  /** 이벤트 콜백 */
  onEvent: (data: unknown) => void;
  /** 취소 콜백 */
  onCancel: () => void;
  /** 에셋 URL 맵 */
  assets?: Record<string, string>;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * Widget Protocol의 Client 측 렌더러
 *
 * - ScriptViewNode만 지원 (v2)
 * - 이벤트 기반 통신
 */
export function WidgetRenderer({
  sessionId,
  view,
  onEvent,
  onCancel,
  assets,
  className,
}: WidgetRendererProps) {
  // ScriptViewNode만 지원
  if (!isScriptViewNode(view)) {
    console.error('[WidgetRenderer] Only ScriptViewNode is supported');
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
