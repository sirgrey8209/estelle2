import { create } from 'zustand';

export interface CommandItem {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
}

interface CommandState {
  commands: CommandItem[];
  setCommands: (commands: CommandItem[]) => void;
  reset: () => void;
}

export const useCommandStore = create<CommandState>((set) => ({
  commands: [],
  setCommands: (commands) => set({ commands }),
  reset: () => set({ commands: [] }),
}));
