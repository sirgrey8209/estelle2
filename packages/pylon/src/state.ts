// PylonState - 순수 데이터 클래스
// 모킹 없이 테스트 가능한 핵심 상태 관리

import type { PromptMessage, ClaudeMessage } from '@estelle/core';

/**
 * 대화 메시지
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * 대화 상태
 */
export interface Conversation {
  id: string;
  workspaceId: string;
  messages: ConversationMessage[];
  isStreaming: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Claude 이벤트 (SDK에서 오는 이벤트 추상화)
 */
export interface ClaudeEvent {
  type: 'message' | 'stream_start' | 'stream_chunk' | 'stream_end' | 'error';
  conversationId: string;
  content?: string;
  error?: string;
}

/**
 * 상태 변경 후 발생하는 출력 이벤트
 */
export interface OutputEvent {
  type: 'send_to_app';
  message: ClaudeMessage;
}

/**
 * PylonState - 순수 데이터 클래스
 *
 * 입력:
 * - handlePacket(): App/Relay에서 오는 패킷
 * - handleClaude(): Claude SDK에서 오는 이벤트
 *
 * 상태:
 * - conversations: 대화 목록
 *
 * 출력:
 * - pendingEvents: 외부로 보낼 이벤트 큐
 */
export class PylonState {
  conversations = new Map<string, Conversation>();
  pendingEvents: OutputEvent[] = [];

  /**
   * App/Relay에서 오는 패킷 처리
   */
  handlePacket(packet: PromptMessage): void {
    const { conversationId, content } = packet;

    // 대화 가져오기 또는 생성
    let conversation = this.conversations.get(conversationId);
    if (!conversation) {
      conversation = {
        id: conversationId,
        workspaceId: 'default', // TODO: 워크스페이스 관리
        messages: [],
        isStreaming: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.conversations.set(conversationId, conversation);
    }

    // 사용자 메시지 추가
    conversation.messages.push({
      role: 'user',
      content,
      timestamp: Date.now(),
    });
    conversation.updatedAt = Date.now();
  }

  /**
   * Claude SDK에서 오는 이벤트 처리
   */
  handleClaude(event: ClaudeEvent): void {
    const conversation = this.conversations.get(event.conversationId);
    if (!conversation) return;

    switch (event.type) {
      case 'stream_start':
        conversation.isStreaming = true;
        break;

      case 'stream_end':
        conversation.isStreaming = false;
        break;

      case 'message':
        if (event.content) {
          conversation.messages.push({
            role: 'assistant',
            content: event.content,
            timestamp: Date.now(),
          });
          conversation.updatedAt = Date.now();

          // App에 전송할 이벤트 큐에 추가
          this.pendingEvents.push({
            type: 'send_to_app',
            message: {
              type: 'claude_message',
              conversationId: event.conversationId,
              role: 'assistant',
              content: event.content,
              broadcast: true,
            },
          });
        }
        break;

      case 'error':
        conversation.isStreaming = false;
        // TODO: 에러 처리
        break;
    }
  }

  /**
   * 대기 중인 출력 이벤트 가져오기 (가져온 후 큐에서 제거)
   */
  flushEvents(): OutputEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }
}
