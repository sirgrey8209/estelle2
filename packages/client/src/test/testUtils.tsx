/**
 * @file testUtils.tsx
 * @description 컴포넌트 테스트용 유틸리티
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

// Store mocks
export const createMockClaudeStore = (overrides: Record<string, unknown> = {}) => ({
  status: 'idle' as const,
  messages: [],
  textBuffer: '',
  pendingRequests: [],
  workStartTime: null,
  hasPendingRequests: false,
  setStatus: vi.fn(),
  addMessage: vi.fn(),
  setMessages: vi.fn(),
  clearMessages: vi.fn(),
  appendTextBuffer: vi.fn(),
  clearTextBuffer: vi.fn(),
  flushTextBuffer: vi.fn(),
  addPendingRequest: vi.fn(),
  removePendingRequest: vi.fn(),
  switchDesk: vi.fn(),
  handleClaudeEvent: vi.fn(),
  reset: vi.fn(),
  ...overrides,
});

export const createMockWorkspaceStore = (overrides: Record<string, unknown> = {}) => ({
  workspacesByPylon: new Map(),
  connectedPylons: [],
  selectedConversation: null,
  setWorkspaces: vi.fn(),
  clearWorkspaces: vi.fn(),
  addConnectedPylon: vi.fn(),
  removeConnectedPylon: vi.fn(),
  updateConversationStatus: vi.fn(),
  selectConversation: vi.fn(),
  clearSelection: vi.fn(),
  getWorkspacesByPylon: vi.fn(() => []),
  getAllWorkspaces: vi.fn(() => []),
  getConversation: vi.fn(() => null),
  reset: vi.fn(),
  ...overrides,
});

export const createMockImageUploadStore = (overrides: Record<string, unknown> = {}) => ({
  uploads: new Map(),
  attachedImage: null,
  attachedImages: [],
  recentFileIds: [],
  queuedMessage: null,
  hasActiveUpload: false,
  setAttachedImage: vi.fn(),
  addAttachedImage: vi.fn(),
  removeAttachedImage: vi.fn(),
  clearAttachedImages: vi.fn(),
  startUpload: vi.fn(),
  updateProgress: vi.fn(),
  completeUpload: vi.fn(),
  failUpload: vi.fn(),
  removeUpload: vi.fn(),
  queueMessage: vi.fn(),
  dequeueMessage: vi.fn(() => null),
  consumeRecentFileIds: vi.fn(() => []),
  reset: vi.fn(),
  ...overrides,
});

export const createMockRelayStore = (overrides: Record<string, unknown> = {}) => ({
  connectionStatus: 'disconnected' as const,
  setConnectionStatus: vi.fn(),
  reset: vi.fn(),
  ...overrides,
});

// 선택된 대화 mock
export const createMockSelectedConversation = (overrides: Record<string, unknown> = {}) => ({
  workspaceId: 'ws-1',
  workspaceName: 'Test Workspace',
  workingDir: '/test/path',
  conversationId: 'conv-1',
  conversationName: 'Main',
  status: 'idle' as const,
  unread: false,
  ...overrides,
});

// 워크스페이스 mock
export const createMockWorkspace = (overrides: Record<string, unknown> = {}) => ({
  workspaceId: 'ws-1',
  name: 'Test Workspace',
  workingDir: '/test/path',
  isActive: true,
  conversations: [
    {
      conversationId: 'conv-1',
      name: 'Main',
      status: 'idle' as const,
      unread: false,
    },
  ],
  ...overrides,
});

// Pylon mock
export const createMockPylon = (overrides: Record<string, unknown> = {}) => ({
  deviceId: 1,
  deviceName: 'Test PC',
  ...overrides,
});

// 권한 요청 mock
export const createMockPermissionRequest = (overrides: Record<string, unknown> = {}) => ({
  type: 'permission' as const,
  toolUseId: 'tool-1',
  toolName: 'Bash',
  toolInput: { command: 'ls -la' },
  ...overrides,
});

// 질문 요청 mock
export const createMockQuestionRequest = (overrides: Record<string, unknown> = {}) => ({
  type: 'question' as const,
  toolUseId: 'tool-2',
  question: '어떤 옵션을 선택하시겠습니까?',
  options: ['옵션 1', '옵션 2', '옵션 3'],
  ...overrides,
});

// Custom render with providers (필요시 확장)
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
