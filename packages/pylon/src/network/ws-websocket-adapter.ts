/**
 * @file ws-websocket-adapter.ts
 * @description Node.js 환경용 WebSocket 어댑터 (ws 라이브러리 래핑)
 */

import WebSocket from 'ws';
import type { WebSocketAdapter } from '@estelle/core';

/**
 * ws 라이브러리를 사용하는 WebSocketAdapter 구현
 *
 * Node.js 환경(Pylon)에서 실제 WebSocket 연결에 사용됩니다.
 */
export class WsWebSocketAdapter implements WebSocketAdapter {
  onOpen: (() => void) | null = null;
  onClose: (() => void) | null = null;
  onMessage: ((data: string) => void) | null = null;
  onError: ((error: Error) => void) | null = null;

  private ws: WebSocket | null = null;
  private _isConnected = false;

  constructor(private readonly url: string) {}

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      this._isConnected = true;
      this.onOpen?.();
    });

    this.ws.on('message', (data) => {
      this.onMessage?.(data.toString());
    });

    this.ws.on('close', () => {
      this._isConnected = false;
      this.onClose?.();
    });

    this.ws.on('error', (err) => {
      this.onError?.(err);
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: string): void {
    if (this.ws && this._isConnected) {
      this.ws.send(data);
    }
  }
}

/**
 * WsWebSocketAdapter 팩토리 생성
 *
 * @param url - WebSocket 서버 URL
 * @returns WebSocketAdapter 팩토리 함수
 */
export function createWsAdapterFactory(url: string): () => WebSocketAdapter {
  return () => new WsWebSocketAdapter(url);
}
