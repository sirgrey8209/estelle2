import { describe, it, expect, beforeEach } from 'vitest';
import { useCommandStore } from './commandStore';

describe('commandStore', () => {
  beforeEach(() => {
    useCommandStore.getState().reset();
  });

  it('초기 상태는 빈 Map', () => {
    expect(useCommandStore.getState().commandsByWorkspace.size).toBe(0);
  });

  it('setWorkspaceCommands로 워크스페이스별 커맨드 설정', () => {
    useCommandStore.getState().setWorkspaceCommands(386, [
      { id: 1, name: 'Deploy', icon: 'rocket', color: '#22c55e', content: 'deploy' },
    ]);
    expect(useCommandStore.getState().commandsByWorkspace.get(386)).toHaveLength(1);
  });

  it('getCommandsForWorkspace로 특정 워크스페이스 커맨드 조회', () => {
    useCommandStore.getState().setWorkspaceCommands(386, [
      { id: 1, name: 'Cmd', icon: null, color: null, content: 'c' },
    ]);
    expect(useCommandStore.getState().getCommandsForWorkspace(386)).toHaveLength(1);
    expect(useCommandStore.getState().getCommandsForWorkspace(999)).toHaveLength(0);
  });

  it('applyDelta — added', () => {
    useCommandStore.getState().setWorkspaceCommands(386, []);
    useCommandStore.getState().applyDelta({
      added: [{ command: { id: 1, name: 'New', icon: null, color: null, content: 'c' }, workspaceIds: [386] }],
    });
    expect(useCommandStore.getState().getCommandsForWorkspace(386)).toHaveLength(1);
  });

  it('applyDelta — removed', () => {
    useCommandStore.getState().setWorkspaceCommands(386, [
      { id: 1, name: 'Cmd', icon: null, color: null, content: 'c' },
    ]);
    useCommandStore.getState().applyDelta({ removed: [1] });
    expect(useCommandStore.getState().getCommandsForWorkspace(386)).toHaveLength(0);
  });

  it('applyDelta — updated', () => {
    useCommandStore.getState().setWorkspaceCommands(386, [
      { id: 1, name: 'Old', icon: null, color: null, content: 'c' },
    ]);
    useCommandStore.getState().applyDelta({
      updated: [{ id: 1, name: 'New', icon: null, color: null, content: 'c' }],
    });
    expect(useCommandStore.getState().getCommandsForWorkspace(386)![0].name).toBe('New');
  });

  it('applyDelta — added with null workspaceId (global)', () => {
    useCommandStore.getState().setWorkspaceCommands(386, []);
    useCommandStore.getState().setWorkspaceCommands(512, []);
    useCommandStore.getState().applyDelta({
      added: [{ command: { id: 1, name: 'Global', icon: null, color: null, content: 'g' }, workspaceIds: [null] }],
    });
    expect(useCommandStore.getState().getCommandsForWorkspace(386)).toHaveLength(1);
    expect(useCommandStore.getState().getCommandsForWorkspace(512)).toHaveLength(1);
  });

  it('reset으로 초기화', () => {
    useCommandStore.getState().setWorkspaceCommands(386, [
      { id: 1, name: 'Cmd', icon: null, color: null, content: 'c' },
    ]);
    useCommandStore.getState().reset();
    expect(useCommandStore.getState().commandsByWorkspace.size).toBe(0);
  });
});
