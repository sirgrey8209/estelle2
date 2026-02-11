import { create } from 'zustand';
import type {
  Workspace,
  WorkspaceWithActive,
  Conversation,
  ConversationStatusValue,
  PermissionModeValue,
  LinkedDocument,
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
  /** 엔티티 고유 식별자 (숫자) - Pylon과 통신 시 사용 */
  entityId: number;
  conversationId: string;
  conversationName: string;
  status: ConversationStatusValue;
  unread: boolean;
  permissionMode: PermissionModeValue;
  /** 연결된 문서 목록 */
  linkedDocuments: LinkedDocument[];
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
  setWorkspaces: (
    pylonId: number,
    workspaces: WorkspaceWithActive[],
    activeInfo?: { workspaceId: string; conversationId: string }
  ) => void;
  clearWorkspaces: (pylonId: number) => void;
  addConnectedPylon: (pylon: ConnectedPylon) => void;
  removeConnectedPylon: (deviceId: number) => void;
  updateConversationStatus: (
    pylonId: number,
    entityId: number,
    status?: ConversationStatusValue,
    unread?: boolean
  ) => void;
  updatePermissionMode: (
    entityId: number,
    mode: PermissionModeValue
  ) => void;
  selectConversation: (
    pylonId: number,
    entityId: number
  ) => void;
  clearSelection: () => void;
  reorderWorkspaces: (pylonId: number, workspaceIds: string[]) => void;
  reorderConversations: (pylonId: number, workspaceId: string, conversationIds: string[]) => void;

  // Getters
  getWorkspacesByPylon: (pylonId: number) => WorkspaceWithActive[];
  getAllWorkspaces: () => { pylonId: number; workspaces: WorkspaceWithActive[] }[];
  getConversation: (
    pylonId: number,
    entityId: number
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

  setWorkspaces: (pylonId, workspaces, activeInfo) => {
    const newMap = new Map(get().workspacesByPylon);
    newMap.set(pylonId, workspaces);

    // 현재 선택된 대화가 이 Pylon의 것인지 확인하고 업데이트
    const selected = get().selectedConversation;
    let updatedSelected = selected;

    if (selected) {
      // 선택된 대화가 여전히 유효한지 확인 (entityId로 매칭)
      for (const workspace of workspaces) {
        const conversation = workspace.conversations.find(
          (c) => c.entityId === selected.entityId
        );
        if (conversation) {
          // 상태 업데이트
          updatedSelected = {
            ...selected,
            conversationName: conversation.name,
            status: conversation.status,
            unread: conversation.unread,
            permissionMode: conversation.permissionMode,
          };
          break;
        }
      }
    }

    // 선택된 대화가 없으면 서버의 active 정보 또는 첫 번째 대화 선택
    if (!updatedSelected && workspaces.length > 0) {
      let targetWorkspace: WorkspaceWithActive | undefined;
      let targetConversation: Conversation | undefined;

      // 서버에서 받은 active 정보가 있으면 우선 사용
      if (activeInfo) {
        targetWorkspace = workspaces.find(
          (w) => w.workspaceId === activeInfo.workspaceId
        );
        if (targetWorkspace) {
          targetConversation = targetWorkspace.conversations.find(
            (c) => c.conversationId === activeInfo.conversationId
          );
        }
      }

      // active 정보가 없거나 찾지 못하면 첫 번째 대화 선택
      if (!targetWorkspace || !targetConversation) {
        const activeWorkspace = workspaces.find((w) => w.isActive);
        targetWorkspace = activeWorkspace || workspaces[0];
        targetConversation = targetWorkspace.conversations[0];
      }

      if (targetWorkspace && targetConversation) {
        updatedSelected = {
          pylonId,
          workspaceId: String(targetWorkspace.workspaceId),
          workspaceName: targetWorkspace.name,
          workingDir: targetWorkspace.workingDir,
          entityId: targetConversation.entityId,
          conversationId: String(targetConversation.entityId),
          conversationName: targetConversation.name,
          status: targetConversation.status,
          unread: targetConversation.unread,
          permissionMode: targetConversation.permissionMode,
          linkedDocuments: targetConversation.linkedDocuments ?? [],
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

  updateConversationStatus: (pylonId, entityId, status, unread) => {
    const workspaces = get().workspacesByPylon.get(pylonId);
    if (!workspaces) return;

    // status와 unread 모두 undefined면 업데이트할 게 없음
    if (status === undefined && unread === undefined) return;

    const updatedWorkspaces = workspaces.map((workspace) => ({
      ...workspace,
      conversations: workspace.conversations.map((conv) => {
        if (conv.entityId !== entityId) return conv;
        return {
          ...conv,
          status: status !== undefined ? status : conv.status,
          unread: unread !== undefined ? unread : conv.unread,
        };
      }),
    }));

    const newMap = new Map(get().workspacesByPylon);
    newMap.set(pylonId, updatedWorkspaces);

    // 선택된 대화 상태도 업데이트
    const selected = get().selectedConversation;
    const updatedSelected =
      selected?.entityId === entityId
        ? {
            ...selected,
            status: status !== undefined ? status : selected.status,
            unread: unread !== undefined ? unread : selected.unread,
          }
        : selected;

    set({
      workspacesByPylon: newMap,
      selectedConversation: updatedSelected,
    });
  },

  updatePermissionMode: (entityId, mode) => {
    // 선택된 대화의 permissionMode 즉시 업데이트
    const selected = get().selectedConversation;
    if (selected?.entityId === entityId) {
      set({
        selectedConversation: {
          ...selected,
          permissionMode: mode,
        },
      });
    }
  },

  selectConversation: (pylonId, entityId) => {
    const workspaces = get().workspacesByPylon.get(pylonId);
    if (!workspaces) return;

    for (const workspace of workspaces) {
      const conversation = workspace.conversations.find(
        (c) => c.entityId === entityId
      );
      if (conversation) {
        set({
          selectedConversation: {
            pylonId,
            workspaceId: String(workspace.workspaceId),
            workspaceName: workspace.name,
            workingDir: workspace.workingDir,
            entityId: conversation.entityId,
            conversationId: String(conversation.entityId),
            conversationName: conversation.name,
            status: conversation.status,
            unread: conversation.unread,
            permissionMode: conversation.permissionMode,
            linkedDocuments: conversation.linkedDocuments ?? [],
          },
        });
        return;
      }
    }
  },

  clearSelection: () => {
    set({ selectedConversation: null });
  },

  reorderWorkspaces: (pylonId, workspaceIds) => {
    const workspaces = get().workspacesByPylon.get(pylonId);
    if (!workspaces) return;

    // workspaceIds 순서대로 정렬
    const reordered = workspaceIds
      .map((id) => workspaces.find((w) => w.workspaceId === id))
      .filter((w): w is WorkspaceWithActive => w !== undefined);

    const newMap = new Map(get().workspacesByPylon);
    newMap.set(pylonId, reordered);
    set({ workspacesByPylon: newMap });
  },

  reorderConversations: (pylonId, workspaceId, conversationIds) => {
    const workspaces = get().workspacesByPylon.get(pylonId);
    if (!workspaces) return;

    const workspaceIndex = workspaces.findIndex((w) => w.workspaceId === workspaceId);
    if (workspaceIndex < 0) return;

    const workspace = workspaces[workspaceIndex];

    // conversationIds 순서대로 정렬
    const reordered = conversationIds
      .map((id) => workspace.conversations.find((c) => c.conversationId === id))
      .filter((c): c is Conversation => c !== undefined);

    // 업데이트된 워크스페이스 생성
    const updatedWorkspace = {
      ...workspace,
      conversations: reordered,
    };

    const updatedWorkspaces = [...workspaces];
    updatedWorkspaces[workspaceIndex] = updatedWorkspace;

    const newMap = new Map(get().workspacesByPylon);
    newMap.set(pylonId, updatedWorkspaces);
    set({ workspacesByPylon: newMap });
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

  getConversation: (pylonId, entityId) => {
    const workspaces = get().workspacesByPylon.get(pylonId);
    if (!workspaces) return null;

    for (const workspace of workspaces) {
      const conversation = workspace.conversations.find(
        (c) => c.entityId === entityId
      );
      if (conversation) return conversation;
    }
    return null;
  },

  reset: () => {
    set({
      workspacesByPylon: new Map(),
      connectedPylons: [],
      selectedConversation: null,
    });
  },
}));
