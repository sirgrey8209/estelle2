import React, { useState, useCallback, useRef } from 'react';
import {
  FlatList,
  FlatListProps,
  View,
  NativeScrollEvent,
  NativeSyntheticEvent,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import Animated from 'react-native-reanimated';

// 웹에서 네이티브 스크롤바 숨기기
const webScrollbarHideStyle = Platform.OS === 'web' ? {
  // @ts-ignore - 웹 전용 CSS 속성
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
} : {};

interface ThemedFlatListProps<T> extends FlatListProps<T> {
  /** 스크롤바 색상 (기본: violet) */
  scrollbarColor?: string;
  /** 스크롤바 너비 (기본: 4) */
  scrollbarWidth?: number;
  /** 스크롤바 자동 숨김 지연 시간 ms (기본: 1500, 0이면 항상 표시) */
  autoHideDelay?: number;
}

/**
 * 커스텀 스크롤바가 적용된 FlatList
 * 웹/모바일 모두 동일한 스타일의 스크롤바 표시
 */
export function ThemedFlatList<T>({
  scrollbarColor = 'rgba(139, 92, 246, 0.6)',
  scrollbarWidth = 4,
  autoHideDelay = 1500,
  onScroll,
  onContentSizeChange,
  onLayout,
  style,
  ...props
}: ThemedFlatListProps<T>) {
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
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = event.nativeEvent;
      setScrollInfo((prev) => ({ ...prev, scrollTop: contentOffset.y }));

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

  const handleContentSizeChange = useCallback(
    (w: number, h: number) => {
      setScrollInfo((prev) => ({ ...prev, contentHeight: h }));
      onContentSizeChange?.(w, h);
    },
    [onContentSizeChange]
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      setScrollInfo((prev) => ({ ...prev, containerHeight: height }));
      onLayout?.(event);
    },
    [onLayout]
  );

  return (
    <View style={[{ flex: 1 }, style]}>
      <FlatList
        style={[{ flex: 1 }, webScrollbarHideStyle]}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
        scrollEventThrottle={16}
        {...props}
      />

      {/* 커스텀 스크롤바 */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: 2,
          top: scrollbarTop,
          width: scrollbarWidth,
          height: scrollbarHeight,
          backgroundColor: scrollbarColor,
          borderRadius: scrollbarWidth / 2,
          opacity: showScrollbar ? 1 : 0,
          transitionProperty: 'opacity',
          transitionDuration: 200,
        } as any}
      />
    </View>
  );
}
