import { describe, it, expect, beforeEach } from 'vitest';
import { useRelayStore } from './relayStore';

describe('relayStore', () => {
  beforeEach(() => {
    // 각 테스트 전에 스토어 초기화
    useRelayStore.getState().reset();
  });

  describe('초기 상태', () => {
    it('should have disconnected initial state', () => {
      const state = useRelayStore.getState();

      expect(state.isConnected).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.deviceId).toBeNull();
    });
  });

  describe('연결 상태 관리', () => {
    it('should update connection state', () => {
      const { setConnected } = useRelayStore.getState();

      setConnected(true);

      expect(useRelayStore.getState().isConnected).toBe(true);
    });

    it('should reset auth state when disconnected', () => {
      const { setConnected, setAuthenticated, setDeviceId } = useRelayStore.getState();

      // 먼저 연결 및 인증 상태 설정
      setConnected(true);
      setAuthenticated(true);
      setDeviceId('device-123');

      // 연결 해제
      setConnected(false);

      const state = useRelayStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.deviceId).toBeNull();
    });
  });

  describe('인증 상태 관리', () => {
    it('should update authentication state', () => {
      const { setAuthenticated } = useRelayStore.getState();

      setAuthenticated(true);

      expect(useRelayStore.getState().isAuthenticated).toBe(true);
    });

    it('should update device ID', () => {
      const { setDeviceId } = useRelayStore.getState();

      setDeviceId('device-456');

      expect(useRelayStore.getState().deviceId).toBe('device-456');
    });
  });

  describe('로딩 상태', () => {
    it('should be "connecting" when not connected', () => {
      const state = useRelayStore.getState();

      expect(state.loadingState).toBe('connecting');
    });

    it('should be "loadingDesks" when connected but no desks loaded', () => {
      const { setConnected, setAuthenticated } = useRelayStore.getState();

      setConnected(true);
      setAuthenticated(true);

      expect(useRelayStore.getState().loadingState).toBe('loadingDesks');
    });

    it('should be "ready" when connected and desks loaded', () => {
      const { setConnected, setAuthenticated, setDesksLoaded } = useRelayStore.getState();

      setConnected(true);
      setAuthenticated(true);
      setDesksLoaded(true);

      expect(useRelayStore.getState().loadingState).toBe('ready');
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      const store = useRelayStore.getState();

      // 상태 변경
      store.setConnected(true);
      store.setAuthenticated(true);
      store.setDeviceId('device-789');
      store.setDesksLoaded(true);

      // 리셋
      store.reset();

      const state = useRelayStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.deviceId).toBeNull();
      expect(state.desksLoaded).toBe(false);
    });
  });
});
