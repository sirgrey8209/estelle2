import { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '../../lib/utils';

interface ThemedFlatListProps<T> {
  data: T[];
  renderItem: (info: { item: T; index: number }) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  /** 스크롤바 색상 (기본: violet) */
  scrollbarColor?: string;
  /** 스크롤바 너비 (기본: 4) */
  scrollbarWidth?: number;
  /** 스크롤바 자동 숨김 지연 시간 ms (기본: 1500, 0이면 항상 표시) */
  autoHideDelay?: number;
  /** 리스트가 변경될 때 맨 아래로 스크롤 */
  inverted?: boolean;
  className?: string;
  contentContainerClassName?: string;
  ListEmptyComponent?: React.ReactNode;
  ListHeaderComponent?: React.ReactNode;
  ListFooterComponent?: React.ReactNode;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
}

/**
 * 커스텀 스크롤바가 적용된 FlatList (웹 버전)
 */
export function ThemedFlatList<T>({
  data,
  renderItem,
  keyExtractor,
  scrollbarColor = 'rgba(139, 92, 246, 0.6)',
  scrollbarWidth = 4,
  autoHideDelay = 1500,
  inverted = false,
  className,
  contentContainerClassName,
  ListEmptyComponent,
  ListHeaderComponent,
  ListFooterComponent,
  onScroll,
  onEndReached,
  onEndReachedThreshold = 0.1,
}: ThemedFlatListProps<T>) {
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
      const newScrollInfo = {
        contentHeight: target.scrollHeight,
        containerHeight: target.clientHeight,
        scrollTop: target.scrollTop,
      };
      setScrollInfo(newScrollInfo);

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

      // onEndReached 체크
      if (onEndReached) {
        const distanceFromEnd =
          target.scrollHeight - target.scrollTop - target.clientHeight;
        const threshold = target.scrollHeight * onEndReachedThreshold;
        if (distanceFromEnd < threshold) {
          onEndReached();
        }
      }

      onScroll?.(event);
    },
    [onScroll, autoHideDelay, onEndReached, onEndReachedThreshold]
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

  // inverted일 때 맨 아래로 스크롤
  useEffect(() => {
    if (inverted && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [inverted, data.length]);

  const items = inverted ? [...data].reverse() : data;

  return (
    <div className={cn('relative flex-1', className)}>
      <div
        ref={containerRef}
        className={cn(
          'h-full overflow-y-auto scrollbar-none',
          inverted && 'flex flex-col-reverse',
          contentContainerClassName
        )}
        onScroll={handleScroll}
      >
        {ListHeaderComponent}

        {data.length === 0 && ListEmptyComponent}

        {items.map((item, index) => (
          <div key={keyExtractor(item, inverted ? data.length - 1 - index : index)}>
            {renderItem({ item, index: inverted ? data.length - 1 - index : index })}
          </div>
        ))}

        {ListFooterComponent}
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
