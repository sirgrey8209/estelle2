import { useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useRelayStore } from './stores';
import { useAuthStore } from './stores/authStore';
import { RelayConfig, AppConfig } from './utils/config';
import { loadVersionInfo } from './utils/buildInfo';
import { routeMessage } from './hooks/useMessageRouter';
import { setWebSocket } from './services/relaySender';
import { syncOrchestrator } from './services/syncOrchestrator';
import { blobService } from './services/blobService';
import type { RelayMessage } from './services/relayService';
import { HomePage } from './pages/HomePage';
import { SharePage } from './pages/SharePage';
import { useViewportHeight } from './hooks/useViewportHeight';

/**
 * 버전 정보 로드 (version.json)
 */
function useVersionInfo() {
  useEffect(() => {
    loadVersionInfo();
  }, []);
}

/**
 * 웹 문서 타이틀 설정
 */
function useDocumentTitle() {
  useEffect(() => {
    document.title = AppConfig.title;
  }, []);
}

/**
 * WebSocket 연결 및 메시지 처리 (메인 앱용)
 *
 * SharePage는 별도의 useShareConnection을 사용하므로
 * /share 경로에서는 이 훅이 연결하지 않습니다.
 */
function useRelayConnection() {
  const location = useLocation();
  const { setConnected, setAuthenticated, setDeviceId } = useRelayStore();
  const { isAuthenticated: isGoogleAuthenticated, idToken } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);

  // SharePage 경로인지 확인
  const isSharePage = location.pathname.startsWith('/share');

  const handleMessage = useCallback(
    (message: RelayMessage) => {
      console.log('[Relay] Message:', message.type);

      // 인증 결과는 로컬에서 처리
      if (message.type === 'auth_result') {
        const payload = message.payload as {
          success: boolean;
          device?: { deviceId: number };
        };
        // deviceId가 0일 수 있으므로 !== undefined로 체크
        if (payload.success && payload.device?.deviceId !== undefined) {
          setAuthenticated(true);
          setDeviceId(String(payload.device.deviceId));

          // 워크스페이스 목록 요청 (syncOrchestrator 경유)
          syncOrchestrator.startInitialSync();
        }
        return;
      }

      // blob 메시지는 blobService로 전달
      if (message.type.startsWith('blob_')) {
        blobService.handleMessage(message as unknown as Record<string, unknown>);
        return;
      }

      // 나머지 메시지는 routeMessage로 처리
      routeMessage(message);
    },
    [setAuthenticated, setDeviceId]
  );

  useEffect(() => {
    // SharePage에서는 연결하지 않음 (별도 useShareConnection 사용)
    if (isSharePage) {
      return;
    }

    // Google 로그인하지 않은 경우 연결하지 않음
    if (!isGoogleAuthenticated) {
      return;
    }

    const wsUrl = RelayConfig.url;

    console.log('[Relay] Connecting to:', wsUrl);

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let intentionalClose = false; // cleanup에서 닫는 경우

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws; // 새 연결을 현재 활성 연결로 지정
        setWebSocket(ws);

        ws.onopen = () => {
          console.log('[Relay] Connected');
          setConnected(true);

          // blobService에 sender 설정
          blobService.setSender({
            send: (data) => ws.send(JSON.stringify(data)),
          });

          // 인증 요청 (Google idToken 포함)
          const authPayload: Record<string, unknown> = {
            deviceType: 'app',
          };

          // Google 로그인한 경우 idToken 포함
          const currentIdToken = useAuthStore.getState().idToken;
          if (currentIdToken) {
            authPayload.idToken = currentIdToken;
          }

          ws.send(
            JSON.stringify({
              type: 'auth',
              payload: authPayload,
            })
          );
        };

        ws.onclose = () => {
          console.log('[Relay] Disconnected');

          // 이 연결이 현재 활성 연결인 경우에만 처리
          // (HMR 등으로 새 연결이 이미 만들어진 경우 무시)
          if (wsRef.current !== ws) {
            console.log('[Relay] Ignoring close from stale connection');
            return;
          }

          syncOrchestrator.cleanup();
          setConnected(false);
          setWebSocket(null);

          // 의도적 종료(cleanup)가 아닌 경우에만 재연결
          if (!intentionalClose && !reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              connect();
            }, RelayConfig.reconnectInterval);
          }
        };

        ws.onerror = (error) => {
          console.error('[Relay] Error:', error);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as RelayMessage;
            handleMessage(message);
          } catch (e) {
            console.error('[Relay] Failed to parse message:', e);
          }
        };
      } catch (error) {
        console.error('[Relay] Connection error:', error);
      }
    };

    connect();

    return () => {
      intentionalClose = true; // cleanup에서 닫는 것임을 표시
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setWebSocket(null);
      }
    };
  }, [setConnected, handleMessage, isGoogleAuthenticated, idToken, isSharePage]);
}

/**
 * /hub 경로는 서버에서 별도로 서빙하는 Dev Hub 대시보드
 * SPA에서 접근 시 전체 페이지 리로드로 서버 응답을 받음
 */
function HubRedirect() {
  useEffect(() => {
    window.location.href = '/hub';
  }, []);
  return null;
}

export function App() {
  useVersionInfo();
  useDocumentTitle();
  useViewportHeight();
  useRelayConnection();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/share/:shareId" element={<SharePage />} />
      {/* /hub는 서버에서 별도로 서빙하므로 전체 페이지 리로드 */}
      <Route path="/hub" element={<HubRedirect />} />
    </Routes>
  );
}
