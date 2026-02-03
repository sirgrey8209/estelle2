import { create } from 'zustand';
import type {
  Workspace,
  WorkspaceWithActive,
  Conversation,
  ConversationStatusValue,
} from '@estelle/core';

/**
 * 연결된 Pylon 정보
 */
export interface ConnectedPylon {
  deviceId: number;
  deviceName: string;
}

/**
 * 선택된 대화 정보 (UI 표시용)
 */
export interface SelectedConversation {
  pylonId: number;
  workspaceId: string;
  workspaceName: string;
  workingDir: string;
  conversationId: string;
  conversationName: string;
  status: ConversationStatusValue;
  unread: boolean;
}

/**
 * 워크스페이스 스토어 상태 인터페이스
 */
export interface WorkspaceState {
  /** 전체 워크스페이스 목록 (Pylon별) */
  workspacesByPylon: Map<number, WorkspaceWithActive[]>;

  /** 연결된 Pylon 목록 */
  connectedPylons: ConnectedPylon[];

  /** 선택된 대화 정보 */
  selectedConversation: SelectedConversation | null;

  // Actions
  setWorkspaces: (pylonId: number, workspaces: WorkspaceWithActive[]) => void;
  clearWorkspaces: (pylonId: number) => void;
  addConnectedPylon: (pylon: ConnectedPylon) => void;
  removeConnectedPylon: (deviceId: number) => void;
  updateConversationStatus: (
    pylonId: number,
    workspaceId: string,
    conversationId: string,
    status: ConversationStatusValue,
    unread?: boolean
  ) => void;
  selectConversation: (
    pylonId: number,
    workspaceId: string,
    conversationId: string
  ) => void;
  clearSelection: () => void;

  // Getters
  getWorkspacesByPylon: (pylonId: number) => WorkspaceWithActive[];
  getAllWorkspaces: () => { pylonId: number; workspaces: WorkspaceWithActive[] }[];
  getConversation: (
    pylonId: number,
    workspaceId: string,
    conversationId: string
  ) => Conversation | null;

  reset: () => void;
}

/**
 * 초기 상태
 */
const initialState = {
  workspacesByPylon: new Map<number, WorkspaceWithActive[]>(),
  connectedPylons: [] as ConnectedPylon[],
  selectedConversation: null as SelectedConversation | null,
};

/**
 * 워크스페이스 관리 스토어
 *
 * Pylon별 워크스페이스/대화 목록 및 선택 상태를 관리합니다.
 */
export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  ...initialState,

  setWorkspaces: (pylonId, workspaces) => {
    const newMap = new Map(get().workspacesByPylon);
    newMap.set(pylonId, workspaces);

    // 현재 선택된 대화가 이 Pylon의 것인지 확인하고 업데이트
    const selected = get().selectedConversation;
    let updatedSelected = selected;

    if (selected) {
      // 선택된 대화가 여전히 유효한지 확인
      const workspace = workspaces.find(
        (w) => w.workspaceId === selected.workspaceId
      );
      if (workspace) {
        const conversation = workspace.conversations.find(
          (c) => c.conversationId === selected.conversationId
        );
        if (conversation) {
          // 상태 업데이트
          updatedSelected = {
            ...selected,
            conversationName: conversation.name,
            status: conversation.status,
            unread: conversation.unread,
          };
        }
      }
    }

    // 선택된 대화가 없으면 첫 번째 활성 대화 자동 선택
    if (!updatedSelected && workspaces.length > 0) {
      const activeWorkspace = workspaces.find((w) => w.isActive);
      const firstWorkspace = activeWorkspace || workspaces[0];
      const firstConversation = firstWorkspace.conversations[0];

      if (firstConversation) {
        updatedSelected = {
          pylonId,
          workspaceId: firstWorkspace.workspaceId,
          workspaceName: firstWorkspace.name,
          workingDir: firstWorkspace.workingDir,
          conversationId: firstConversation.conversationId,
          conversationName: firstConversation.name,
          status: firstConversation.status,
          unread: firstConversation.unread,
        };
      }
    }

    set({
      workspacesByPylon: newMap,
      selectedConversation: updatedSelected,
    });
  },

  clearWorkspaces: (pylonId) => {
    const newMap = new Map(get().workspacesByPylon);
    newMap.delete(pylonId);
    set({ workspacesByPylon: newMap });
  },

  addConnectedPylon: (pylon) => {
    const existing = get().connectedPylons;
    const filtered = existing.filter((p) => p.deviceId !== pylon.deviceId);
    set({ connectedPylons: [...filtered, pylon] });
  },

  removeConnectedPylon: (deviceId) => {
    const filtered = get().connectedPylons.filter(
      (p) => p.deviceId !== deviceId
    );
    // 해당 Pylon의 워크스페이스도 제거
    const newMap = new Map(get().workspacesByPylon);
    newMap.delete(deviceId);

    // 선택된 대화가 이 Pylon의 것이면 해제
    const selected = get().selectedConversation;
    const newSelected =
      selected &&
      get()
        .getWorkspacesByPylon(deviceId)
        .some((w) => w.workspaceId === selected.workspaceId)
        ? null
        : selected;

    set({
      connectedPylons: filtered,
      workspacesByPylon: newMap,
      selectedConversation: newSelected,
    });
  },

  updateConversationStatus: (pylonId, workspaceId, conversationId, status, unread) => {
    const workspaces = get().workspacesByPylon.get(pylonId);
    if (!workspaces) return;

    const updatedWorkspaces = workspaces.map((workspace) => {
      if (workspace.workspaceId !== workspaceId) return workspace;

      return {
        ...workspace,
        conversations: workspace.conversations.map((conv) => {
          if (conv.conversationId !== conversationId) return conv;
          return {
            ...conv,
            status,
            unread: unread !== undefined ? unread : conv.unread,
          };
        }),
      };
    });

    const newMap = new Map(get().workspacesByPylon);
    newMap.set(pylonId, updatedWorkspaces);

    // 선택된 대화 상태도 업데이트
    const selected = get().selectedConversation;
    const updatedSelected =
      selected?.conversationId === conversationId
        ? {
            ...selected,
            status,
            unread: unread !== undefined ? unread : selected.unread,
          }
        : selected;

    set({
      workspacesByPylon: newMap,
      selectedConversation: updatedSelected,
    });
  },

  selectConversation: (pylonId, workspaceId, conversationId) => {
    const workspaces = get().workspacesByPylon.get(pylonId);
    if (!workspaces) return;

    const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
    if (!workspace) return;

    const conversation = workspace.conversations.find(
      (c) => c.conversationId === conversationId
    );
    if (!conversation) return;

    set({
      selectedConversation: {
        pylonId,
        workspaceId: workspace.workspaceId,
        workspaceName: workspace.name,
        workingDir: workspace.workingDir,
        conversationId: conversation.conversationId,
        conversationName: conversation.name,
        status: conversation.status,
        unread: conversation.unread,
      },
    });
  },

  clearSelection: () => {
    set({ selectedConversation: null });
  },

  getWorkspacesByPylon: (pylonId) => {
    return get().workspacesByPylon.get(pylonId) || [];
  },

  getAllWorkspaces: () => {
    const result: { pylonId: number; workspaces: WorkspaceWithActive[] }[] = [];
    get().workspacesByPylon.forEach((workspaces, pylonId) => {
      result.push({ pylonId, workspaces });
    });
    return result;
  },

  getConversation: (pylonId, workspaceId, conversationId) => {
    const workspaces = get().workspacesByPylon.get(pylonId);
    if (!workspaces) return null;

    const workspace = workspaces.find((w) => w.workspaceId === workspaceId);
    if (!workspace) return null;

    return (
      workspace.conversations.find(
        (c) => c.conversationId === conversationId
      ) || null
    );
  },

  reset: () => {
    set({
      workspacesByPylon: new Map(),
      connectedPylons: [],
      selectedConversation: null,
    });
  },
}));
