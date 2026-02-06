import { useEffect, useRef, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useRelayStore } from './stores';
import { RelayConfig, AppConfig } from './utils/config';
import { routeMessage } from './hooks/useMessageRouter';
import { setWebSocket, requestWorkspaceList } from './services/relaySender';
import { blobService } from './services/blobService';
import type { RelayMessage } from './services/relayService';
import { HomePage } from './pages/HomePage';

/**
 * 웹 문서 타이틀 설정
 */
function useDocumentTitle() {
  useEffect(() => {
    document.title = AppConfig.title;
  }, []);
}

/**
 * WebSocket 연결 및 메시지 처리
 */
function useRelayConnection() {
  const { setConnected, setAuthenticated, setDeviceId } = useRelayStore();
  const wsRef = useRef<WebSocket | null>(null);

  const handleMessage = useCallback(
    (message: RelayMessage) => {
      console.log('[Relay] Message:', message.type);

      // 인증 결과는 로컬에서 처리
      if (message.type === 'auth_result') {
        const payload = message.payload as {
          success: boolean;
          device?: { deviceId: number };
        };
        if (payload.success && payload.device?.deviceId) {
          setAuthenticated(true);
          setDeviceId(String(payload.device.deviceId));

          // 워크스페이스 목록 요청
          requestWorkspaceList();
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
    // 개발 환경에서는 localUrl 사용
    const wsUrl = AppConfig.debug ? RelayConfig.localUrl : RelayConfig.url;

    console.log('[Relay] Connecting to:', wsUrl);

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        setWebSocket(ws);

        ws.onopen = () => {
          console.log('[Relay] Connected');
          setConnected(true);

          // blobService에 sender 설정
          blobService.setSender({
            send: (data) => ws.send(JSON.stringify(data)),
          });

          // 인증 요청
          ws.send(
            JSON.stringify({
              type: 'auth',
              payload: {
                token: 'dev-token', // TODO: 실제 토큰 사용
                deviceType: 'app',
              },
            })
          );
        };

        ws.onclose = () => {
          console.log('[Relay] Disconnected');
          setConnected(false);
          setWebSocket(null);

          // 재연결 시도
          if (!reconnectTimer) {
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
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setWebSocket(null);
      }
    };
  }, [setConnected, handleMessage]);
}

export function App() {
  useDocumentTitle();
  useRelayConnection();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  );
}
