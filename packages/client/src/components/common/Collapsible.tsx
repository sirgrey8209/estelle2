import React, { useState, useCallback } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';

interface CollapsibleProps {
  expanded: boolean;
  children: React.ReactNode;
  duration?: number;
}

/**
 * 높이 애니메이션이 적용된 접기/펼치기 컴포넌트
 * Reanimated 4 CSS Transitions 사용
 */
export function Collapsible({
  expanded,
  children,
  duration = 250,
}: CollapsibleProps) {
  const [contentHeight, setContentHeight] = useState(0);

  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) {
      setContentHeight(height);
    }
  }, []);

  return (
    <View>
      {/* 높이 측정용 숨겨진 뷰 */}
      <View
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
        }}
        onLayout={onContentLayout}
      >
        {children}
      </View>

      {/* Reanimated 4 CSS Transitions */}
      <Animated.View
        style={{
          height: expanded ? contentHeight : 0,
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
          // Reanimated 4 CSS Transitions
          transitionProperty: ['height', 'opacity'],
          transitionDuration: duration,
          transitionTimingFunction: 'ease-in-out',
        } as any}
      >
        {children}
      </Animated.View>
    </View>
  );
}
