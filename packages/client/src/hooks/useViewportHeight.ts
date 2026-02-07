import { useEffect } from 'react';

/**
 * 모바일 PWA에서 viewport 높이를 관리하는 훅
 *
 * --app-height를 visualViewport.height에 동기화하여
 * 키보드가 올라와도 앱이 가시 영역 안에 확실히 들어가도록 함.
 */
export function useViewportHeight() {
  useEffect(() => {
    const setHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${height}px`);
    };

    setHeight();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', setHeight);
      vv.addEventListener('scroll', setHeight);

      window.addEventListener('orientationchange', () => {
        setTimeout(setHeight, 100);
      });

      return () => {
        vv.removeEventListener('resize', setHeight);
        vv.removeEventListener('scroll', setHeight);
      };
    }

    window.addEventListener('resize', setHeight);
    return () => window.removeEventListener('resize', setHeight);
  }, []);
}
