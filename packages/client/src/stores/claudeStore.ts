import { create } from 'zustand';
import {
  StoreMessage,
  AssistantTextMessage,
  ToolStartMessage,
  ToolCompleteMessage,
  ErrorMessage,
  ResultMessage,
  AbortedMessage,
  FileAttachmentMessage,
  Attachment,
  FileInfo,
  ResultInfo,
} from '@estelle/core';

// Core 타입 re-export (하위 호환성 및 편의성)
export type { StoreMessage, Attachment, FileInfo, ResultInfo };

/**
 * Claude 상태 타입
 */
export type ClaudeStatus = 'idle' | 'working' | 'permission';

/**
 * @deprecated Core의 StoreMessage 타입을 사용하세요
 * 기존 코드와의 호환성을 위해 유지됩니다.
 */
export type ClaudeMessage = StoreMessage;

/**
 * 이미지 첨부 파싱 유틸 (v1 UserTextMessage.parseContent 대응)
 */
export function parseAttachments(rawContent: string): { text: string; attachments: Attachment[] } {
  const attachments: Attachment[] = [];
  let text = rawContent;

  // [image:파일명] 또는 [image:/전체/경로] 패턴 파싱
  const imageRegex = /\[image:([^\]]+)\]/g;
  let match;

  while ((match = imageRegex.exec(rawContent)) !== null) {
    const imagePath = match[1];
    const filename = imagePath.split('/').pop()?.split('\\').pop() || imagePath;

    attachments.push({
      filename,
      path: imagePath,
    });

    text = text.replace(match[0], '');
  }

  return { text: text.trim(), attachments };
}

/**
 * 중단 메시지 표시 텍스트
 */
export function getAbortDisplayText(reason?: string): string {
  switch (reason) {
    case 'user':
      return '실행 중지됨';
    case 'session_ended':
      return '세션 종료됨';
    default:
      return '중단됨';
  }
}

/**
 * 파일 크기 포맷팅
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 권한 요청
 */
export interface PermissionRequest {
  type: 'permission';
  toolUseId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
}

/**
 * 개별 질문 항목
 */
export interface QuestionItem {
  question: string;
  header?: string;
  options: string[];
  multiSelect?: boolean;
}

/**
 * 질문 요청
 */
export interface QuestionRequest {
  type: 'question';
  toolUseId: string;
  questions: QuestionItem[];
}

/**
 * 대기 중인 요청 타입
 */
export type PendingRequest = PermissionRequest | QuestionRequest;

/**
 * 실시간 토큰 사용량
 */
export interface RealtimeUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  /** 마지막 업데이트 타입 */
  lastUpdateType: 'input' | 'output';
}

/**
 * Claude 상태 인터페이스
 */
export interface ClaudeState {
  /** Claude 상태 */
  status: ClaudeStatus;

  /** 메시지 목록 */
  messages: StoreMessage[];

  /** 스트리밍 텍스트 버퍼 */
  textBuffer: string;

  /** 대기 중인 요청 (권한/질문) */
  pendingRequests: PendingRequest[];

  /** 작업 시작 시간 */
  workStartTime: number | null;

  /** 실시간 토큰 사용량 */
  realtimeUsage: RealtimeUsage | null;

  /** 대기 중인 요청 존재 여부 (계산된 값) */
  hasPendingRequests: boolean;

  /** 데스크별 메시지 캐시 */
  _messageCache: Map<string, StoreMessage[]>;

  /** 데스크별 요청 캐시 */
  _requestCache: Map<string, PendingRequest[]>;

  // Actions
  setStatus: (status: ClaudeStatus) => void;
  addMessage: (message: StoreMessage) => void;
  setMessages: (messages: StoreMessage[]) => void;
  clearMessages: () => void;
  appendTextBuffer: (text: string) => void;
  clearTextBuffer: () => void;
  flushTextBuffer: () => void;
  addPendingRequest: (request: PendingRequest) => void;
  removePendingRequest: (toolUseId: string) => void;
  switchDesk: (fromDeskId: string, toDeskId: string) => void;
  handleClaudeEvent: (payload: Record<string, unknown>) => void;
  reset: () => void;
}

/**
 * 초기 상태
 */
const initialState = {
  status: 'idle' as ClaudeStatus,
  messages: [] as StoreMessage[],
  textBuffer: '',
  pendingRequests: [] as PendingRequest[],
  workStartTime: null as number | null,
  realtimeUsage: null as RealtimeUsage | null,
  hasPendingRequests: false,
  _messageCache: new Map<string, StoreMessage[]>(),
  _requestCache: new Map<string, PendingRequest[]>(),
};

/**
 * UUID 생성 (간단한 버전)
 */
function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Claude 상태 관리 스토어
 *
 * 메시지, 스트리밍, 권한/질문 요청을 관리합니다.
 */
export const useClaudeStore = create<ClaudeState>((set, get) => ({
  ...initialState,

  setStatus: (status) => {
    const updates: Partial<ClaudeState> = { status };

    if (status === 'working') {
      updates.workStartTime = Date.now();
      updates.realtimeUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        lastUpdateType: 'input',
      };
    } else if (status === 'idle') {
      updates.workStartTime = null;
      updates.realtimeUsage = null;
    }

    set(updates);
  },

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  setMessages: (messages) => {
    set({ messages });
  },

  clearMessages: () => {
    set({ messages: [], pendingRequests: [], hasPendingRequests: false });
  },

  appendTextBuffer: (text) => {
    set((state) => ({
      textBuffer: state.textBuffer + text,
    }));
  },

  clearTextBuffer: () => {
    set({ textBuffer: '' });
  },

  flushTextBuffer: () => {
    const { textBuffer, messages } = get();

    if (!textBuffer.trim()) {
      return;
    }

    const newMessage: AssistantTextMessage = {
      id: generateId(),
      role: 'assistant',
      type: 'text',
      content: textBuffer,
      timestamp: Date.now(),
    };

    set({
      messages: [...messages, newMessage],
      textBuffer: '',
    });
  },

  addPendingRequest: (request) => {
    set((state) => ({
      pendingRequests: [...state.pendingRequests, request],
      hasPendingRequests: true,
    }));
  },

  removePendingRequest: (toolUseId) => {
    set((state) => {
      const newRequests = state.pendingRequests.filter(
        (r) => r.toolUseId !== toolUseId
      );
      return {
        pendingRequests: newRequests,
        hasPendingRequests: newRequests.length > 0,
      };
    });
  },

  switchDesk: (fromDeskId, toDeskId) => {
    const state = get();

    // 현재 데스크의 메시지/요청 캐시
    const newMessageCache = new Map(state._messageCache);
    const newRequestCache = new Map(state._requestCache);

    newMessageCache.set(fromDeskId, [...state.messages]);
    newRequestCache.set(fromDeskId, [...state.pendingRequests]);

    // 새 데스크의 캐시 로드
    const cachedMessages = newMessageCache.get(toDeskId) || [];
    const cachedRequests = newRequestCache.get(toDeskId) || [];

    set({
      messages: cachedMessages,
      pendingRequests: cachedRequests,
      hasPendingRequests: cachedRequests.length > 0,
      textBuffer: '',
      _messageCache: newMessageCache,
      _requestCache: newRequestCache,
    });
  },

  handleClaudeEvent: (payload) => {
    const event = payload.event as Record<string, unknown> | undefined;
    if (!event) return;

    const eventType = event.type as string;
    const state = get();

    switch (eventType) {
      case 'state': {
        const newStatus = event.state as ClaudeStatus;
        if (newStatus) {
          state.setStatus(newStatus);
        }
        break;
      }

      case 'text': {
        const text = event.text as string;
        if (text) {
          state.appendTextBuffer(text);
        }
        break;
      }

      case 'textComplete': {
        state.flushTextBuffer();
        break;
      }

      // Pylon sends 'toolInfo', client also accepts 'tool_start' for compatibility
      case 'toolInfo':
      case 'tool_start': {
        const toolUseId = event.toolUseId as string | undefined;
        const parentToolUseId = event.parentToolUseId as string | null | undefined;
        const message: ToolStartMessage = {
          id: toolUseId || generateId(),
          role: 'assistant',
          type: 'tool_start',
          timestamp: Date.now(),
          toolName: event.toolName as string,
          toolInput: (event.toolInput || event.input) as Record<string, unknown>,
          ...(parentToolUseId ? { parentToolUseId } : {}),
        };
        state.addMessage(message);
        break;
      }

      case 'toolProgress': {
        // tool_start 메시지를 찾아서 elapsedSeconds 업데이트
        const toolName = event.toolName as string;
        const elapsedSeconds = event.elapsedSeconds as number | undefined;

        const messages = [...state.messages];
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg.type === 'tool_start' && (msg as ToolStartMessage).toolName === toolName) {
            (messages[i] as ToolStartMessage).elapsedSeconds = elapsedSeconds;
            set({ messages });
            break;
          }
        }
        break;
      }

      // Pylon sends 'toolComplete', client also accepts 'tool_complete' for compatibility
      case 'toolComplete':
      case 'tool_complete': {
        const toolUseId = event.toolUseId as string | undefined;
        const toolName = event.toolName as string;
        const toolInput = (event.toolInput || event.input || {}) as Record<string, unknown>;
        const success = (event.success as boolean) ?? true;
        const output = (event.toolOutput || event.result) as string | undefined;
        const parentToolUseId = event.parentToolUseId as string | null | undefined;

        // 기존 tool_start 메시지를 찾아서 tool_complete로 교체
        // toolUseId가 있으면 id로 매칭, 없으면 toolName으로 매칭 (하위 호환)
        const messages = [...state.messages];
        let replaced = false;

        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg.type === 'tool_start') {
            const toolStartMsg = msg as ToolStartMessage;
            // toolUseId가 있으면 정확히 매칭, 없으면 toolName으로 매칭
            const isMatch = toolUseId
              ? toolStartMsg.id === toolUseId
              : toolStartMsg.toolName === toolName;

            if (isMatch) {
              const completeMsg: ToolCompleteMessage = {
                id: toolStartMsg.id,
                role: 'assistant',
                type: 'tool_complete',
                timestamp: toolStartMsg.timestamp,
                toolName,
                toolInput: toolStartMsg.toolInput,
                success,
                ...(success ? { output } : { error: output }),
                ...(toolStartMsg.parentToolUseId ? { parentToolUseId: toolStartMsg.parentToolUseId } : {}),
              };
              messages[i] = completeMsg;
              replaced = true;
              break;
            }
          }
        }

        if (replaced) {
          set({ messages });
        } else {
          // tool_start가 없으면 새 메시지로 추가 (fallback)
          const message: ToolCompleteMessage = {
            id: toolUseId || generateId(),
            role: 'assistant',
            type: 'tool_complete',
            timestamp: Date.now(),
            toolName,
            toolInput,
            success,
            ...(success ? { output } : { error: output }),
            ...(parentToolUseId ? { parentToolUseId } : {}),
          };
          state.addMessage(message);
        }
        break;
      }

      case 'permission_request': {
        const request: PermissionRequest = {
          type: 'permission',
          toolUseId: event.toolUseId as string,
          toolName: event.toolName as string,
          toolInput: event.toolInput as Record<string, unknown>,
        };
        state.addPendingRequest(request);
        state.setStatus('permission');
        break;
      }

      // Pylon sends 'askQuestion', client also accepts 'ask_question' for compatibility
      case 'askQuestion':
      case 'ask_question': {
        // questions 배열 전체 변환 (AskUserQuestion 형식)
        const rawQuestions = event.questions as Array<{
          question: string;
          header?: string;
          options?: Array<{ label: string }>;
          multiSelect?: boolean;
        }> | undefined;

        const questionItems: QuestionItem[] = rawQuestions?.map(q => ({
          question: q.question,
          header: q.header,
          options: q.options?.map(o => o.label) || [],
          multiSelect: q.multiSelect,
        })) || [{
          question: (event.question as string) || '',
          options: (event.options as string[]) || [],
        }];

        const request: QuestionRequest = {
          type: 'question',
          toolUseId: event.toolUseId as string,
          questions: questionItems,
        };
        state.addPendingRequest(request);
        state.setStatus('permission');
        break;
      }

      case 'result': {
        state.flushTextBuffer();
        // ResultMessage 추가
        // Pylon은 데이터를 event에 직접 보냄 (event.result가 아님)
        // duration_ms는 snake_case, 토큰 정보는 usage 객체 안에 있음
        const usage = event.usage as Record<string, unknown> | undefined;
        const resultMessage: ResultMessage = {
          id: generateId(),
          role: 'system',
          type: 'result',
          timestamp: Date.now(),
          resultInfo: {
            durationMs: (event.duration_ms as number) || 0,
            inputTokens: (usage?.inputTokens as number) || 0,
            outputTokens: (usage?.outputTokens as number) || 0,
            cacheReadTokens: (usage?.cacheReadInputTokens as number) || 0,
          },
        };
        state.addMessage(resultMessage);
        state.setStatus('idle');
        break;
      }

      case 'error': {
        const message: ErrorMessage = {
          id: generateId(),
          role: 'system',
          type: 'error',
          content: (event.message as string) || 'Unknown error',
          timestamp: Date.now(),
        };
        state.addMessage(message);
        state.setStatus('idle');
        break;
      }

      case 'aborted': {
        // Claude 프로세스 중단 메시지
        const message: AbortedMessage = {
          id: generateId(),
          role: 'system',
          type: 'aborted',
          timestamp: Date.now(),
          reason: (event.reason as 'user' | 'session_ended') || 'user',
        };
        state.addMessage(message);
        state.setStatus('idle');
        break;
      }

      case 'file_attachment': {
        // 파일 첨부 메시지 (Claude -> 사용자)
        const fileInfo = event.file as Record<string, unknown>;
        if (fileInfo) {
          const message: FileAttachmentMessage = {
            id: generateId(),
            role: 'assistant',
            type: 'file_attachment',
            timestamp: Date.now(),
            file: {
              path: (fileInfo.path as string) || '',
              filename: (fileInfo.filename as string) || '',
              mimeType: (fileInfo.mimeType as string) || '',
              fileType: (fileInfo.fileType as string) || 'text',
              size: (fileInfo.size as number) || 0,
              description: fileInfo.description as string | undefined,
            },
          };
          state.addMessage(message);
        }
        break;
      }

      case 'usage_update': {
        // 실시간 토큰 사용량 업데이트
        const usage = event.usage as Record<string, number> | undefined;
        if (usage) {
          const prev = get().realtimeUsage;
          const newInput = usage.inputTokens || 0;
          const newOutput = usage.outputTokens || 0;

          // 이전 값과 비교해서 어떤 값이 바뀌었는지 확인
          let lastUpdateType: 'input' | 'output' = 'input';
          if (prev) {
            if (newOutput > prev.outputTokens) {
              lastUpdateType = 'output';
            } else if (newInput > prev.inputTokens) {
              lastUpdateType = 'input';
            } else {
              lastUpdateType = prev.lastUpdateType;
            }
          }

          set({
            realtimeUsage: {
              inputTokens: newInput,
              outputTokens: newOutput,
              cacheReadInputTokens: usage.cacheReadInputTokens || 0,
              cacheCreationInputTokens: usage.cacheCreationInputTokens || 0,
              lastUpdateType,
            },
          });
        }
        break;
      }

      default:
        // Unknown event type - ignore
        break;
    }
  },

  reset: () => {
    set({
      status: 'idle',
      messages: [],
      textBuffer: '',
      pendingRequests: [],
      workStartTime: null,
      hasPendingRequests: false,
      _messageCache: new Map(),
      _requestCache: new Map(),
    });
  },
}));
