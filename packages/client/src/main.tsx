import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './index.css';

// Service Worker 등록 및 자동 업데이트
// 새 버전이 있으면 즉시 활성화하고 페이지 새로고침
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // 새 SW가 대기 중일 때 즉시 활성화
    console.log('[SW] New content available, updating...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[SW] App ready for offline use');
  },
  onRegisteredSW(swUrl, registration) {
    // 주기적으로 업데이트 체크 (1시간마다)
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    }
  },
});

// Tab 키 네비게이션 비활성화 (입력 필드 제외)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    if (!isInput) {
      e.preventDefault();
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/relay">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
