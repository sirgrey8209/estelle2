import { describe, it, expect, beforeEach } from 'vitest';
import { useCommandStore } from './commandStore';

describe('commandStore', () => {
  beforeEach(() => {
    useCommandStore.getState().reset();
  });

  it('초기 상태는 빈 배열', () => {
    expect(useCommandStore.getState().commands).toEqual([]);
  });

  it('setCommands로 커맨드 목록 설정', () => {
    const { setCommands } = useCommandStore.getState();
    setCommands([
      { id: 1, name: 'Review', icon: 'search', color: '#ff0000' },
    ]);
    expect(useCommandStore.getState().commands).toHaveLength(1);
  });

  it('reset으로 초기화', () => {
    const { setCommands, reset } = useCommandStore.getState();
    setCommands([{ id: 1, name: 'Cmd', icon: null, color: null }]);
    reset();
    expect(useCommandStore.getState().commands).toEqual([]);
  });
});
