import { useRef, useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

interface CollapsibleProps {
  expanded: boolean;
  children: React.ReactNode;
  duration?: number;
  className?: string;
}

/**
 * 높이 애니메이션이 적용된 접기/펼치기 컴포넌트
 */
export function Collapsible({
  expanded,
  children,
  duration = 250,
  className,
}: CollapsibleProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>(expanded ? 'auto' : 0);

  useEffect(() => {
    if (expanded) {
      // 펼칠 때: 실제 높이 측정 후 설정
      const contentHeight = contentRef.current?.scrollHeight || 0;
      setHeight(contentHeight);
      // 애니메이션 완료 후 auto로 변경 (내용 변경 대응)
      const timer = setTimeout(() => setHeight('auto'), duration);
      return () => clearTimeout(timer);
    } else {
      // 접을 때: 현재 높이에서 0으로
      const contentHeight = contentRef.current?.scrollHeight || 0;
      setHeight(contentHeight);
      // 다음 프레임에서 0으로 설정 (transition 트리거)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0));
      });
    }
  }, [expanded, duration]);

  return (
    <div
      ref={contentRef}
      className={cn('overflow-hidden', className)}
      style={{
        height: height === 'auto' ? 'auto' : height,
        opacity: expanded ? 1 : 0,
        transition: `height ${duration}ms ease-in-out, opacity ${duration}ms ease-in-out`,
      }}
    >
      {children}
    </div>
  );
}
