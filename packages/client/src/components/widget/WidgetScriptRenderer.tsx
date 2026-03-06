/**
 * @file WidgetScriptRenderer.tsx
 * @description Script 타입 위젯 렌더러 - JS 코드 실행 및 API 주입
 */

import { useEffect, useRef, useCallback } from 'react';
import type { ScriptViewNode } from '@estelle/core';
import { cn } from '@/lib/utils';
import { subscribeWidgetEvent } from '@/stores/conversationStore';

interface WidgetScriptRendererProps {
  sessionId: string;
  view: ScriptViewNode;
  assets: Record<string, string>; // URL로 변환된 에셋
  onEvent: (data: unknown) => void;
  onCancel: () => void;
  className?: string;
}

export function WidgetScriptRenderer({
  sessionId,
  view,
  assets,
  onEvent,
  onCancel,
  className,
}: WidgetScriptRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const messageHandlerRef = useRef<((data: unknown) => void) | null>(null);

  // CLI → Client 메시지 수신 핸들러 등록
  const setMessageHandler = useCallback((handler: (data: unknown) => void) => {
    messageHandlerRef.current = handler;
  }, []);

  // 외부에서 메시지 전달받을 때 호출 (나중에 widget_event 연동)
  const handleMessage = useCallback((data: unknown) => {
    messageHandlerRef.current?.(data);
  }, []);

  // 코드 실행
  useEffect(() => {
    if (!containerRef.current) return;

    // 기존 cleanup
    cleanupRef.current?.();
    cleanupRef.current = null;
    messageHandlerRef.current = null;

    // HTML 삽입
    containerRef.current.innerHTML = view.html;

    // API 생성
    const api = createWidgetAPI({
      container: containerRef.current,
      assets,
      onEvent,
      onCancel,
      setMessageHandler,
    });

    // 코드 실행
    if (view.code) {
      try {
        const fn = new Function('api', view.code);
        const result = fn(api);

        // cleanup 함수 반환 시 저장
        if (typeof result === 'function') {
          cleanupRef.current = result;
        }
      } catch (err) {
        console.error('[WidgetScriptRenderer] Code execution error:', err);
        onEvent({ type: 'error', message: String(err) });
      }
    }

    return () => {
      cleanupRef.current?.();
    };
  }, [view, assets, onEvent, onCancel, setMessageHandler]);

  // widget_event 구독 - CLI에서 오는 이벤트를 위젯에 전달
  useEffect(() => {
    const unsubscribe = subscribeWidgetEvent(sessionId, handleMessage);
    return () => {
      unsubscribe();
    };
  }, [sessionId, handleMessage]);

  return (
    <div className={cn('widget-script-renderer', className)}>
      {/* 위젯 렌더링 영역 */}
      <div
        ref={containerRef}
        className="widget-content w-full"
        style={{ minHeight: view.height ? `${view.height}px` : 'auto' }}
      />
    </div>
  );
}

// API 생성 함수
interface CreateWidgetAPIOptions {
  container: HTMLDivElement;
  assets: Record<string, string>;
  onEvent: (data: unknown) => void;
  onCancel: () => void;
  setMessageHandler: (handler: (data: unknown) => void) => void;
}

function createWidgetAPI(options: CreateWidgetAPIOptions) {
  const { container, assets, onEvent, onCancel, setMessageHandler } = options;
  const cleanupCallbacks: (() => void)[] = [];

  return {
    // 코어
    sendEvent: (data: unknown) => onEvent(data),
    // CLI → Client 이벤트 수신 (서버에서 오는 이벤트)
    onEvent: (callback: (data: unknown) => void) => setMessageHandler(callback),
    // onMessage는 onEvent의 alias (하위 호환)
    onMessage: (callback: (data: unknown) => void) => setMessageHandler(callback),
    onCancel: (callback: () => void) => {
      // TODO: cancel 이벤트 연동
    },

    // 에셋
    getAssetUrl: (key: string) => assets[key] || '',

    // 버블 컨텍스트
    bubble: {
      getSize: () => ({
        width: container.offsetWidth,
        height: container.offsetHeight,
      }),
      onResize: (
        callback: (size: { width: number; height: number }) => void
      ) => {
        const observer = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry) {
            callback({
              width: entry.contentRect.width,
              height: entry.contentRect.height,
            });
          }
        });
        observer.observe(container);
        cleanupCallbacks.push(() => observer.disconnect());
      },
      isMobile: () => window.innerWidth < 768,
      isFullscreen: () => false,
      requestHeight: (height: number) => {
        container.style.height = `${height}px`;
      },
    },

    // 플랫폼 추상화 - 입력
    input: {
      onKey: (callback: (e: KeyboardEvent) => void) => {
        document.addEventListener('keydown', callback);
        cleanupCallbacks.push(() =>
          document.removeEventListener('keydown', callback)
        );
      },
      onTouch: (callback: (e: TouchEvent) => void) => {
        container.addEventListener('touchstart', callback as EventListener);
        cleanupCallbacks.push(() =>
          container.removeEventListener('touchstart', callback as EventListener)
        );
      },
      onSwipe: (callback: (e: { direction: string }) => void) => {
        // TODO: swipe 감지 로직 구현
      },
    },

    // 플랫폼 추상화 - 출력
    output: {
      vibrate: (ms: number) => {
        if (navigator.vibrate) {
          navigator.vibrate(ms);
        }
      },
      playSound: (assetKey: string) => {
        const url = assets[assetKey];
        if (url) {
          const audio = new Audio(url);
          audio.play().catch(() => {});
        }
      },
      showToast: (message: string) => {
        console.log('[Toast]', message);
      },
    },

    // cleanup 함수 반환 (위젯 코드에서 return 가능)
    _cleanup: () => {
      cleanupCallbacks.forEach((cb) => cb());
    },
  };
}
