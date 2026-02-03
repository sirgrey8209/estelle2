import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Animated,
  Dimensions,
  GestureResponderEvent,
  LayoutChangeEvent,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { AppHeader } from './AppHeader';
import { BugReportDialog } from '../components/common/BugReportDialog';
import { useWorkspaceStore } from '../stores/workspaceStore';

interface MobileLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
}

/**
 * 스와이프 제스처 로직
 */
function dragToPageOffset(dragRatio: number): number {
  const deadZone = 0.1;
  const maxZone = 0.4;

  if (Math.abs(dragRatio) < deadZone) return 0;

  const sign = dragRatio < 0 ? -1 : 1;
  const ratio = (Math.abs(dragRatio) - deadZone) / (maxZone - deadZone);
  return sign * Math.min(Math.max(ratio, 0), 1);
}

/**
 * 모바일 레이아웃
 */
export function MobileLayout({ sidebar, main }: MobileLayoutProps) {
  const theme = useTheme();
  const [pageIndex, setPageIndex] = useState(0);
  const [showBugReport, setShowBugReport] = useState(false);
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width);
  const { selectedConversation } = useWorkspaceStore();

  const scrollX = useRef(new Animated.Value(0)).current;

  const dragStartX = useRef<number | null>(null);
  const dragStartPage = useRef<number | null>(null);

  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (selectedConversation && pageIndex === 0) {
      goToPage(1);
    }
  }, [selectedConversation]);

  const goToPage = useCallback(
    (index: number) => {
      setPageIndex(index);
      Animated.spring(scrollX, {
        toValue: index * containerWidth,
        useNativeDriver: true,
        tension: 100,
        friction: 15,
      }).start();
    },
    [containerWidth, scrollX]
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (width !== containerWidth) {
      setContainerWidth(width);
      scrollX.setValue(pageIndex * width);
    }
  };

  const handlePointerDown = (e: GestureResponderEvent) => {
    dragStartX.current = e.nativeEvent.pageX;
    dragStartPage.current = pageIndex;
  };

  const handlePointerMove = (e: GestureResponderEvent) => {
    if (dragStartX.current === null || dragStartPage.current === null) return;

    const delta = e.nativeEvent.pageX - dragStartX.current;
    const dragRatio = -delta / containerWidth;
    const pageOffset = dragToPageOffset(dragRatio);

    const newPage = Math.max(0, Math.min(1, dragStartPage.current + pageOffset));
    scrollX.setValue(newPage * containerWidth);
  };

  const handlePointerUp = (e: GestureResponderEvent) => {
    if (dragStartX.current === null || dragStartPage.current === null) return;

    const delta = e.nativeEvent.pageX - dragStartX.current;
    const dragRatio = -delta / containerWidth;
    const pageOffset = dragToPageOffset(dragRatio);
    const startPage = dragStartPage.current;

    dragStartX.current = null;
    dragStartPage.current = null;

    let targetPage: number;
    if (Math.abs(pageOffset) >= 1.0) {
      targetPage = pageOffset > 0
        ? Math.min(startPage + 1, 1)
        : Math.max(startPage - 1, 0);
    } else {
      targetPage = startPage;
    }

    goToPage(targetPage);
  };

  const handleTouchStart = (e: GestureResponderEvent) => {
    const now = Date.now();
    if (lastTapTimeRef.current && now - lastTapTimeRef.current < 400) {
      tapCountRef.current++;
      if (tapCountRef.current >= 3) {
        tapCountRef.current = 0;
        lastTapTimeRef.current = null;
        setShowBugReport(true);
      }
    } else {
      tapCountRef.current = 1;
    }
    lastTapTimeRef.current = now;
  };

  const contextValue = {
    openSidebar: () => goToPage(0),
    closeSidebar: () => goToPage(1),
  };

  return (
    <MobileLayoutContext.Provider value={contextValue}>
      <View
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        onTouchStart={handleTouchStart}
      >
        <AppHeader />

        {/* PageView 스와이프 영역 */}
        <View
          style={{ flex: 1, overflow: 'hidden' }}
          onLayout={handleLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handlePointerDown}
          onResponderMove={handlePointerMove}
          onResponderRelease={handlePointerUp}
        >
          <Animated.View
            style={{
              flex: 1,
              flexDirection: 'row',
              width: containerWidth * 2,
              transform: [{ translateX: Animated.multiply(scrollX, -1) }],
            }}
          >
            <View style={{ width: containerWidth, flex: 1 }}>
              {sidebar}
            </View>

            <View style={{ width: containerWidth, flex: 1 }}>
              {main}
            </View>
          </Animated.View>
        </View>

        <BugReportDialog
          visible={showBugReport}
          onClose={() => setShowBugReport(false)}
        />
      </View>
    </MobileLayoutContext.Provider>
  );
}

export const MobileLayoutContext = React.createContext<{
  openSidebar: () => void;
  closeSidebar: () => void;
}>({
  openSidebar: () => {},
  closeSidebar: () => {},
});
