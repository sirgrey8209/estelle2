import { useState, useEffect } from 'react';
import { AppHeader } from './AppHeader';
import { BugReportDialog } from '../components/common/BugReportDialog';

interface DesktopLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
}

/**
 * 데스크톱 레이아웃
 */
export function DesktopLayout({ sidebar, main }: DesktopLayoutProps) {
  const [showBugReport, setShowBugReport] = useState(false);

  // 키보드 단축키 (백틱 → 버그 리포트)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        setShowBugReport(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* 사이드바 */}
        <aside className="w-64 shrink-0 border-r border-border">
          {sidebar}
        </aside>

        {/* 메인 영역 */}
        <main className="flex-1 overflow-hidden">{main}</main>
      </div>

      <BugReportDialog
        open={showBugReport}
        onClose={() => setShowBugReport(false)}
      />
    </div>
  );
}
