/**
 * @file jestTestUtils.tsx
 * @description Jest 컴포넌트 테스트용 유틸리티
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';

// Store mocks
export const createMockClaudeStore = (overrides: Record<string, unknown> = {}) => ({
  status: 'idle' as const,
  messages: [],
  textBuffer: '',
  pendingRequests: [],
  workStartTime: null,
  hasPendingRequests: false,
  setStatus: jest.fn(),
  addMessage: jest.fn(),
  setMessages: jest.fn(),
  clearMessages: jest.fn(),
  appendTextBuffer: jest.fn(),
  clearTextBuffer: jest.fn(),
  flushTextBuffer: jest.fn(),
  addPendingRequest: jest.fn(),
  removePendingRequest: jest.fn(),
  switchDesk: jest.fn(),
  handleClaudeEvent: jest.fn(),
  reset: jest.fn(),
  ...overrides,
});

export const createMockWorkspaceStore = (overrides: Record<string, unknown> = {}) => ({
  workspacesByPylon: new Map(),
  connectedPylons: [],
  selectedConversation: null,
  setWorkspaces: jest.fn(),
  clearWorkspaces: jest.fn(),
  addConnectedPylon: jest.fn(),
  removeConnectedPylon: jest.fn(),
  updateConversationStatus: jest.fn(),
  selectConversation: jest.fn(),
  clearSelection: jest.fn(),
  getWorkspacesByPylon: jest.fn(() => []),
  getAllWorkspaces: jest.fn(() => []),
  getConversation: jest.fn(() => null),
  reset: jest.fn(),
  ...overrides,
});

export const createMockImageUploadStore = (overrides: Record<string, unknown> = {}) => ({
  uploads: new Map(),
  attachedImage: null,
  attachedImages: [],
  recentFileIds: [],
  queuedMessage: null,
  hasActiveUpload: false,
  setAttachedImage: jest.fn(),
  addAttachedImage: jest.fn(),
  removeAttachedImage: jest.fn(),
  clearAttachedImages: jest.fn(),
  startUpload: jest.fn(),
  updateProgress: jest.fn(),
  completeUpload: jest.fn(),
  failUpload: jest.fn(),
  removeUpload: jest.fn(),
  queueMessage: jest.fn(),
  dequeueMessage: jest.fn(() => null),
  consumeRecentFileIds: jest.fn(() => []),
  reset: jest.fn(),
  ...overrides,
});

export const createMockRelayStore = (overrides: Record<string, unknown> = {}) => ({
  desksLoaded: false,
  connectionStatus: 'disconnected' as const,
  setDesksLoaded: jest.fn(),
  setConnectionStatus: jest.fn(),
  reset: jest.fn(),
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

export * from '@testing-library/react-native';
export { customRender as render };
