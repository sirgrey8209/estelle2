/**
 * @file WidgetView.tsx
 * @description ViewNode를 렌더링하는 컴포넌트
 */

import DOMPurify from 'dompurify';
import type {
  ViewNode,
  TextViewNode,
  LayoutViewNode,
  ImageViewNode,
  SpacerViewNode,
  HtmlViewNode,
} from '@estelle/core';
import { cn } from '@/lib/utils';

interface WidgetViewProps {
  node: ViewNode;
  className?: string;
}

/**
 * ViewNode를 렌더링하는 컴포넌트
 */
export function WidgetView({ node, className }: WidgetViewProps) {
  switch (node.type) {
    case 'text':
      return <TextView node={node} className={className} />;
    case 'row':
    case 'column':
      return <LayoutView node={node} className={className} />;
    case 'image':
      return <ImageView node={node} className={className} />;
    case 'spacer':
      return <SpacerView node={node} className={className} />;
    case 'html':
      return <HtmlView node={node} className={className} />;
    default:
      return null;
  }
}

// ============================================================================
// Text View
// ============================================================================

interface TextViewProps {
  node: TextViewNode;
  className?: string;
}

function TextView({ node, className }: TextViewProps) {
  const styleClasses = getTextStyleClasses(node.style);

  return (
    <span className={cn(styleClasses, className)}>
      {node.content}
    </span>
  );
}

function getTextStyleClasses(style?: TextViewNode['style']): string {
  switch (style) {
    case 'title':
      return 'text-base font-semibold text-foreground';
    case 'caption':
      return 'text-xs text-muted-foreground';
    case 'body':
    default:
      return 'text-sm text-foreground';
  }
}

// ============================================================================
// Layout View (row/column)
// ============================================================================

interface LayoutViewProps {
  node: LayoutViewNode;
  className?: string;
}

function LayoutView({ node, className }: LayoutViewProps) {
  const isRow = node.type === 'row';
  const gap = node.gap ?? 2;

  const layoutClasses = cn(
    'flex',
    isRow ? 'flex-row items-center' : 'flex-col',
    className
  );

  // gap을 inline style로 적용 (Tailwind gap 클래스는 동적 값에 제한이 있음)
  const gapStyle = { gap: `${gap * 4}px` };

  return (
    <div className={layoutClasses} style={gapStyle}>
      {node.children.map((child, index) => (
        <WidgetView key={index} node={child} />
      ))}
    </div>
  );
}

// ============================================================================
// Image View
// ============================================================================

interface ImageViewProps {
  node: ImageViewNode;
  className?: string;
}

function ImageView({ node, className }: ImageViewProps) {
  return (
    <img
      src={node.src}
      alt=""
      className={cn('max-w-full h-auto rounded', className)}
    />
  );
}

// ============================================================================
// Spacer View
// ============================================================================

interface SpacerViewProps {
  node: SpacerViewNode;
  className?: string;
}

function SpacerView({ node, className }: SpacerViewProps) {
  const size = node.size ?? 1;
  // size를 rem 단위로 변환 (1 = 0.25rem = 4px)
  const spacerStyle = { height: `${size * 4}px`, width: `${size * 4}px` };

  return <div className={cn('flex-shrink-0', className)} style={spacerStyle} />;
}

// ============================================================================
// HTML View
// ============================================================================

interface HtmlViewProps {
  node: HtmlViewNode;
  className?: string;
}

function HtmlView({ node, className }: HtmlViewProps) {
  // XSS 방지를 위해 DOMPurify로 sanitize
  const sanitized = DOMPurify.sanitize(node.content, {
    FORBID_TAGS: ['script', 'style'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
  });

  return (
    <div
      className={cn('widget-html text-sm', className)}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
