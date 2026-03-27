import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CommandStore } from '../../src/stores/command-store.js';

describe('CommandStore', () => {
  let store: CommandStore;

  beforeEach(() => {
    store = new CommandStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  describe('createCommand', () => {
    it('should create a command and return its id', () => {
      const id = store.createCommand('Review', 'search', '#ff0000', 'Review this code');
      expect(id).toBe(1);
    });

    it('should create command with null icon and color', () => {
      const id = store.createCommand('Deploy', null, null, 'Deploy to production');
      expect(id).toBe(1);
    });
  });

  describe('getCommands', () => {
    it('should return global commands when workspace_id is null', () => {
      const id = store.createCommand('Global Cmd', 'star', null, 'global content');
      store.assignCommand(id, null);

      const commands = store.getCommands(999);
      expect(commands).toHaveLength(1);
      expect(commands[0]).toEqual({
        id, name: 'Global Cmd', icon: 'star', color: null, content: 'global content',
      });
    });

    it('should return workspace-specific commands', () => {
      const id = store.createCommand('WS Cmd', 'zap', '#00ff00', 'ws content');
      store.assignCommand(id, 42);

      const commands = store.getCommands(42);
      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe('WS Cmd');
    });

    it('should return both global and workspace commands', () => {
      const globalId = store.createCommand('Global', 'star', null, 'g');
      store.assignCommand(globalId, null);
      const wsId = store.createCommand('WS Only', 'zap', null, 'w');
      store.assignCommand(wsId, 42);

      const commands = store.getCommands(42);
      expect(commands).toHaveLength(2);
    });

    it('should not return commands for other workspaces', () => {
      const id = store.createCommand('Other', 'x', null, 'other');
      store.assignCommand(id, 99);

      const commands = store.getCommands(42);
      expect(commands).toHaveLength(0);
    });

    it('should include content in list response', () => {
      const id = store.createCommand('Cmd', null, null, 'secret content');
      store.assignCommand(id, null);

      const commands = store.getCommands(1);
      expect(commands[0]).toHaveProperty('content', 'secret content');
    });
  });

  describe('getContent', () => {
    it('should return content for a valid command id', () => {
      const id = store.createCommand('Cmd', null, null, 'the content');
      expect(store.getContent(id)).toBe('the content');
    });

    it('should return null for non-existent command id', () => {
      expect(store.getContent(999)).toBeNull();
    });
  });

  describe('updateCommand', () => {
    it('should update name', () => {
      const id = store.createCommand('Old', 'star', null, 'content');
      store.updateCommand(id, { name: 'New' });
      store.assignCommand(id, null);

      const commands = store.getCommands(1);
      expect(commands[0].name).toBe('New');
    });

    it('should update content', () => {
      const id = store.createCommand('Cmd', null, null, 'old content');
      store.updateCommand(id, { content: 'new content' });
      expect(store.getContent(id)).toBe('new content');
    });

    it('should return false for non-existent command', () => {
      const result = store.updateCommand(999, { name: 'x' });
      expect(result).toBe(false);
    });
  });

  describe('deleteCommand', () => {
    it('should delete command and its assignments', () => {
      const id = store.createCommand('Cmd', null, null, 'content');
      store.assignCommand(id, null);
      store.assignCommand(id, 42);

      store.deleteCommand(id);

      expect(store.getContent(id)).toBeNull();
      expect(store.getCommands(42)).toHaveLength(0);
    });
  });

  describe('getCommandsByWorkspaces', () => {
    it('should return commands grouped by workspaceId', () => {
      const globalCmd = store.createCommand('Global', 'star', null, 'g');
      store.assignCommand(globalCmd, null);
      const wsCmd = store.createCommand('WS', 'zap', null, 'w');
      store.assignCommand(wsCmd, 42);

      const result = store.getCommandsByWorkspaces([42, 99]);
      expect(result.get(42)).toHaveLength(2);
      expect(result.get(99)).toHaveLength(1);
    });
  });

  describe('getAssignedWorkspaceIds', () => {
    it('should return assigned workspace ids', () => {
      const id = store.createCommand('Cmd', null, null, 'c');
      store.assignCommand(id, null);
      store.assignCommand(id, 42);
      const wsIds = store.getAssignedWorkspaceIds(id);
      expect(wsIds).toContain(null);
      expect(wsIds).toContain(42);
    });

    it('should convert internal 0 back to null for global assignments', () => {
      const id = store.createCommand('Cmd', null, null, 'c');
      store.assignCommand(id, null);
      const wsIds = store.getAssignedWorkspaceIds(id);
      expect(wsIds).toEqual([null]);
    });
  });

  describe('getCommandById', () => {
    it('should return full command data', () => {
      const id = store.createCommand('Cmd', 'star', '#ff0', 'content');
      const cmd = store.getCommandById(id);
      expect(cmd).toEqual({ id, name: 'Cmd', icon: 'star', color: '#ff0', content: 'content' });
    });

    it('should return null for non-existent id', () => {
      expect(store.getCommandById(999)).toBeNull();
    });
  });

  describe('assignCommand / unassignCommand', () => {
    it('should assign command to workspace', () => {
      const id = store.createCommand('Cmd', null, null, 'c');
      store.assignCommand(id, 42);

      expect(store.getCommands(42)).toHaveLength(1);
    });

    it('should unassign command from workspace', () => {
      const id = store.createCommand('Cmd', null, null, 'c');
      store.assignCommand(id, 42);
      store.unassignCommand(id, 42);

      expect(store.getCommands(42)).toHaveLength(0);
    });

    it('should not duplicate assignments', () => {
      const id = store.createCommand('Cmd', null, null, 'c');
      store.assignCommand(id, 42);
      store.assignCommand(id, 42);

      expect(store.getCommands(42)).toHaveLength(1);
    });

    it('should not duplicate global (null) assignments', () => {
      const id = store.createCommand('Cmd', null, null, 'c');
      store.assignCommand(id, null);
      store.assignCommand(id, null); // duplicate

      const commands = store.getCommands(42);
      expect(commands).toHaveLength(1);
    });

    it('should not return duplicates when command is both global and workspace-assigned', () => {
      const id = store.createCommand('Both', 'star', null, 'both content');
      store.assignCommand(id, null); // global (internally 0)
      store.assignCommand(id, 42);  // workspace-specific

      const commands = store.getCommands(42);
      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe('Both');
    });
  });
});
