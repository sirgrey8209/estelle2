import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '../lib/utils';
import { AppHeader } from './AppHeader';
import { BugReportDialog } from '../components/common/BugReportDialog';
import { useWorkspaceStore } from '../stores/workspaceStore';

interface MobileLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
}

export const MobileLayoutContext = createContext<{
  openSidebar: () => void;
  closeSidebar: () => void;
}>({
  openSidebar: () => {},
  closeSidebar: () => {},
});

/**
 * 모바일 레이아웃
 */
export function MobileLayout({ sidebar, main }: MobileLayoutProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [showBugReport, setShowBugReport] = useState(false);
  const { selectedConversation } = useWorkspaceStore();

  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef<number | null>(null);

  // 새 대화 선택 시에만 메인 페이지로 이동
  const prevConversationIdRef = useRef<number | null>(null);
  useEffect(() => {
    const currentId = selectedConversation?.conversationId ?? null;
    const prevId = prevConversationIdRef.current;

    // 대화가 새로 선택된 경우에만 채팅창으로 이동
    if (currentId && currentId !== prevId) {
      setPageIndex(1);
    }
    prevConversationIdRef.current = currentId;
  }, [selectedConversation?.conversationId]);

  const goToPage = useCallback((index: number) => {
    setPageIndex(index);
  }, []);

  // 트리플 탭 → 버그 리포트
  const handleTouchStart = () => {
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
      <div
        className="flex flex-col bg-background"
        style={{
          height: 'var(--app-height, 100vh)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onTouchStart={handleTouchStart}
      >
        <AppHeader />

        {/* 스와이프 영역 */}
        <div className="flex-1 overflow-hidden relative">
          <div
            className={cn(
              'flex h-full transition-transform duration-300 ease-out',
              pageIndex === 1 && '-translate-x-1/2'
            )}
            style={{ width: '200%' }}
          >
            {/* 사이드바 페이지 */}
            <div className="w-1/2 h-full">{sidebar}</div>

            {/* 메인 페이지 */}
            <div className="w-1/2 h-full">{main}</div>
          </div>
        </div>

        <BugReportDialog
          open={showBugReport}
          onClose={() => setShowBugReport(false)}
        />
      </div>
    </MobileLayoutContext.Provider>
  );
}
