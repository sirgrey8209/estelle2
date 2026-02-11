import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
  });

  describe('초기 상태', () => {
    it('should have correct initial values', () => {
      const state = useSettingsStore.getState();
      expect(state.currentAccount).toBeNull();
      expect(state.subscriptionType).toBeNull();
      expect(state.isAccountSwitching).toBe(false);
    });
  });

  describe('setAccountStatus', () => {
    it('should update account status', () => {
      useSettingsStore.getState().setAccountStatus({
        current: 'linegames',
        subscriptionType: 'team',
      });

      const state = useSettingsStore.getState();
      expect(state.currentAccount).toBe('linegames');
      expect(state.subscriptionType).toBe('team');
      expect(state.isAccountSwitching).toBe(false);
    });

    it('should clear switching state when status is set', () => {
      useSettingsStore.getState().setAccountSwitching(true);
      useSettingsStore.getState().setAccountStatus({
        current: 'personal',
        subscriptionType: 'max',
      });

      expect(useSettingsStore.getState().isAccountSwitching).toBe(false);
    });
  });

  describe('setAccountSwitching', () => {
    it('should set switching state', () => {
      useSettingsStore.getState().setAccountSwitching(true);
      expect(useSettingsStore.getState().isAccountSwitching).toBe(true);

      useSettingsStore.getState().setAccountSwitching(false);
      expect(useSettingsStore.getState().isAccountSwitching).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      // 상태 변경
      useSettingsStore.getState().setAccountStatus({
        current: 'linegames',
        subscriptionType: 'team',
      });
      useSettingsStore.getState().setAccountSwitching(true);

      // 리셋
      useSettingsStore.getState().reset();

      const state = useSettingsStore.getState();
      expect(state.currentAccount).toBeNull();
      expect(state.subscriptionType).toBeNull();
      expect(state.isAccountSwitching).toBe(false);
    });
  });
});
