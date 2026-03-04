/**
 * @file WidgetRenderer.tsx
 * @description Widget의 최상위 렌더링 컴포넌트
 *
 * view와 inputs를 받아 위젯을 렌더링하고, 사용자 입력을 처리합니다.
 */

import { useCallback } from 'react';
import type { ViewNode, InputNode } from '@estelle/core';
import { WidgetView } from './WidgetView';
import { WidgetInputs } from './WidgetInputs';
import { cn } from '@/lib/utils';

export interface WidgetRendererProps {
  /** 렌더링할 뷰 노드 */
  view: ViewNode;
  /** 입력 노드 배열 */
  inputs: InputNode[];
  /** 입력 제출 콜백 - 모든 입력 값을 Record로 전달 */
  onInput: (data: Record<string, unknown>) => void;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * Widget Protocol의 Client 측 렌더러
 *
 * - view: 위젯의 시각적 콘텐츠를 렌더링
 * - inputs: 사용자 입력 UI를 렌더링
 * - 입력 발생 시 onInput 콜백 호출
 */
export function WidgetRenderer({
  view,
  inputs,
  onInput,
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
