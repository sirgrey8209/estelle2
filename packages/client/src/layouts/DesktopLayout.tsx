import React, { useState, useEffect } from 'react';
import { View, Platform } from 'react-native';
import { Surface, useTheme } from 'react-native-paper';
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
  const theme = useTheme();
  const [showBugReport, setShowBugReport] = useState(false);

  // 키보드 단축키 (백틱 → 버그 리포트)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

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
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader />

      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* 사이드바 */}
        <Surface
          style={{
            width: 260,
            borderRightWidth: 1,
            borderRightColor: theme.colors.outlineVariant,
          }}
          elevation={0}
        >
          {sidebar}
        </Surface>

        {/* 메인 영역 */}
        <View style={{ flex: 1 }}>{main}</View>
      </View>

      <BugReportDialog
        visible={showBugReport}
        onClose={() => setShowBugReport(false)}
      />
    </View>
  );
}
