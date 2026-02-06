import { useResponsive } from '../hooks/useResponsive';
import { DesktopLayout } from './DesktopLayout';
import { MobileLayout } from './MobileLayout';

interface ResponsiveLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
}

/**
 * 반응형 레이아웃
 *
 * 화면 크기에 따라 데스크톱/모바일 레이아웃을 선택합니다.
 */
export function ResponsiveLayout({ sidebar, main }: ResponsiveLayoutProps) {
  const { isDesktop, isTablet } = useResponsive();

  if (isDesktop || isTablet) {
    return <DesktopLayout sidebar={sidebar} main={main} />;
  }

  return <MobileLayout sidebar={sidebar} main={main} />;
}
