import { create } from 'zustand';

export interface CommandItem {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  content: string;
}

export interface CommandDelta {
  added?: { command: CommandItem; workspaceIds: (number | null)[] }[];
  removed?: number[];
  updated?: CommandItem[];
}

interface CommandState {
  commandsByWorkspace: Map<number, CommandItem[]>;
  setWorkspaceCommands: (workspaceId: number, commands: CommandItem[]) => void;
  getCommandsForWorkspace: (workspaceId: number) => CommandItem[];
  applyDelta: (delta: CommandDelta) => void;
  reset: () => void;
}

export const useCommandStore = create<CommandState>((set, get) => ({
  commandsByWorkspace: new Map(),

  setWorkspaceCommands: (workspaceId, commands) => {
    set((state) => {
      const newMap = new Map(state.commandsByWorkspace);
      newMap.set(workspaceId, commands);
      return { commandsByWorkspace: newMap };
    });
  },

  getCommandsForWorkspace: (workspaceId) => {
    return get().commandsByWorkspace.get(workspaceId) ?? [];
  },

  applyDelta: (delta) => {
    set((state) => {
      const newMap = new Map(state.commandsByWorkspace);

      // removed: 모든 워크스페이스에서 해당 커맨드 제거
      if (delta.removed) {
        for (const cmdId of delta.removed) {
          for (const [wsId, cmds] of newMap) {
            newMap.set(wsId, cmds.filter((c) => c.id !== cmdId));
          }
        }
      }

      // updated: 모든 워크스페이스에서 해당 커맨드 업데이트
      if (delta.updated) {
        for (const updated of delta.updated) {
          for (const [wsId, cmds] of newMap) {
            newMap.set(
              wsId,
              cmds.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
            );
          }
        }
      }

      // added: 지정된 워크스페이스에 추가 (null = 모든 알려진 워크스페이스)
      if (delta.added) {
        for (const { command, workspaceIds } of delta.added) {
          const isGlobal = workspaceIds.includes(null);
          if (isGlobal) {
            for (const [wsId, cmds] of newMap) {
              if (!cmds.some((c) => c.id === command.id)) {
                newMap.set(wsId, [...cmds, command]);
              }
            }
          } else {
            for (const wsId of workspaceIds) {
              if (wsId !== null) {
                const existing = newMap.get(wsId) ?? [];
                if (!existing.some((c) => c.id === command.id)) {
                  newMap.set(wsId, [...existing, command]);
                }
              }
            }
          }
        }
      }

      return { commandsByWorkspace: newMap };
    });
  },

  reset: () => set({ commandsByWorkspace: new Map() }),
}));
