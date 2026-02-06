import { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '../../lib/utils';

interface ThemedScrollViewProps {
  children: React.ReactNode;
  /** 스크롤바 색상 (기본: violet) */
  scrollbarColor?: string;
  /** 스크롤바 너비 (기본: 4) */
  scrollbarWidth?: number;
  /** 스크롤바 자동 숨김 지연 시간 ms (기본: 1500, 0이면 항상 표시) */
  autoHideDelay?: number;
  className?: string;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

/**
 * 커스텀 스크롤바가 적용된 ScrollView
 */
export function ThemedScrollView({
  children,
  scrollbarColor = 'rgba(139, 92, 246, 0.6)',
  scrollbarWidth = 4,
  autoHideDelay = 1500,
  className,
  onScroll,
}: ThemedScrollViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollInfo, setScrollInfo] = useState({
    contentHeight: 0,
    containerHeight: 0,
    scrollTop: 0,
  });
  const [isScrolling, setIsScrolling] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 스크롤바 표시 여부
  const showScrollbar =
    scrollInfo.contentHeight > scrollInfo.containerHeight &&
    (autoHideDelay === 0 || isScrolling);

  // 스크롤바 높이 비율 계산
  const scrollbarHeight =
    scrollInfo.contentHeight > 0
      ? Math.max(
          20,
          (scrollInfo.containerHeight / scrollInfo.contentHeight) *
            scrollInfo.containerHeight
        )
      : 0;

  // 스크롤바 위치 계산
  const scrollableHeight = scrollInfo.contentHeight - scrollInfo.containerHeight;
  const scrollbarTrackHeight = scrollInfo.containerHeight - scrollbarHeight;
  const scrollbarTop =
    scrollableHeight > 0
      ? (scrollInfo.scrollTop / scrollableHeight) * scrollbarTrackHeight
      : 0;

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      setScrollInfo({
        contentHeight: target.scrollHeight,
        containerHeight: target.clientHeight,
        scrollTop: target.scrollTop,
      });

      // 스크롤 중 표시
      setIsScrolling(true);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (autoHideDelay > 0) {
        hideTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, autoHideDelay);
      }

      onScroll?.(event);
    },
    [onScroll, autoHideDelay]
  );

  // 초기 크기 측정
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      setScrollInfo({
        contentHeight: container.scrollHeight,
        containerHeight: container.clientHeight,
        scrollTop: container.scrollTop,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className={cn('relative flex-1', className)}>
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scrollbar-none"
        onScroll={handleScroll}
      >
        {children}
      </div>

      {/* 커스텀 스크롤바 */}
      <div
        className="pointer-events-none absolute right-0.5 transition-opacity duration-200"
        style={{
          top: scrollbarTop,
          width: scrollbarWidth,
          height: scrollbarHeight,
          backgroundColor: scrollbarColor,
          borderRadius: scrollbarWidth / 2,
          opacity: showScrollbar ? 1 : 0,
        }}
      />
    </div>
  );
}
