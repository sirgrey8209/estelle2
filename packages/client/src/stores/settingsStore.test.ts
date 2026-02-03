import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, DeployPhase } from './settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
  });

  describe('초기 상태', () => {
    it('should have default initial state', () => {
      const state = useSettingsStore.getState();

      expect(state.deployPhase).toBe('initial');
      expect(state.deployLogs).toEqual([]);
      expect(state.claudeUsage).toBeNull();
    });
  });

  describe('배포 상태 관리', () => {
    it('should update deploy phase', () => {
      const { setDeployPhase } = useSettingsStore.getState();

      setDeployPhase('building');

      expect(useSettingsStore.getState().deployPhase).toBe('building');
    });

    it('should track all deploy phases', () => {
      const { setDeployPhase } = useSettingsStore.getState();
      const phases: DeployPhase[] = [
        'initial',
        'building',
        'buildReady',
        'preparing',
        'ready',
        'deploying',
        'error',
      ];

      phases.forEach((phase) => {
        setDeployPhase(phase);
        expect(useSettingsStore.getState().deployPhase).toBe(phase);
      });
    });

    it('should set deploy error', () => {
      const { setDeployError } = useSettingsStore.getState();

      setDeployError('Build failed');

      const state = useSettingsStore.getState();
      expect(state.deployPhase).toBe('error');
      expect(state.deployErrorMessage).toBe('Build failed');
    });

    it('should clear deploy error when phase changes', () => {
      const { setDeployError, setDeployPhase } = useSettingsStore.getState();

      setDeployError('Build failed');
      setDeployPhase('building');

      expect(useSettingsStore.getState().deployErrorMessage).toBeNull();
    });
  });

  describe('배포 로그', () => {
    it('should add deploy log', () => {
      const { addDeployLog } = useSettingsStore.getState();

      addDeployLog('Starting build...');
      addDeployLog('Compiling...');

      const logs = useSettingsStore.getState().deployLogs;
      expect(logs).toHaveLength(2);
      expect(logs[0]).toBe('Starting build...');
      expect(logs[1]).toBe('Compiling...');
    });

    it('should limit deploy logs to 100 entries', () => {
      const { addDeployLog } = useSettingsStore.getState();

      for (let i = 0; i < 150; i++) {
        addDeployLog(`Log ${i}`);
      }

      const logs = useSettingsStore.getState().deployLogs;
      expect(logs).toHaveLength(100);
      expect(logs[0]).toBe('Log 50'); // 처음 50개가 제거됨
    });

    it('should clear deploy logs', () => {
      const { addDeployLog, clearDeployLogs } = useSettingsStore.getState();

      addDeployLog('Test log');
      clearDeployLogs();

      expect(useSettingsStore.getState().deployLogs).toEqual([]);
    });
  });

  describe('배포 빌드 태스크', () => {
    it('should update build task status', () => {
      const { updateBuildTask } = useSettingsStore.getState();

      updateBuildTask('relay', 'building');
      updateBuildTask('pylon', 'ready');

      const tasks = useSettingsStore.getState().buildTasks;
      expect(tasks.relay).toBe('building');
      expect(tasks.pylon).toBe('ready');
    });

    it('should clear build tasks on reset deploy', () => {
      const { updateBuildTask, resetDeploy } = useSettingsStore.getState();

      updateBuildTask('relay', 'building');
      resetDeploy();

      expect(useSettingsStore.getState().buildTasks).toEqual({});
    });
  });

  describe('Claude 사용량', () => {
    it('should update claude usage', () => {
      const { setClaudeUsage } = useSettingsStore.getState();

      setClaudeUsage({
        totalCostUsd: 0.05,
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 200,
        cacheCreationTokens: 0,
        sessionCount: 1,
      });

      const usage = useSettingsStore.getState().claudeUsage;
      expect(usage?.inputTokens).toBe(1000);
      expect(usage?.outputTokens).toBe(500);
      expect(usage?.cacheReadTokens).toBe(200);
    });
  });

  describe('버전 정보', () => {
    it('should update version info', () => {
      const { setVersionInfo } = useSettingsStore.getState();

      setVersionInfo({
        version: '1.2.3',
        commit: 'abc123',
        buildTime: '2024-01-01T00:00:00Z',
      });

      const info = useSettingsStore.getState().versionInfo;
      expect(info?.version).toBe('1.2.3');
      expect(info?.commit).toBe('abc123');
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      const store = useSettingsStore.getState();

      store.setDeployPhase('building');
      store.addDeployLog('test');
      store.setClaudeUsage({
        totalCostUsd: 0.01,
        inputTokens: 100,
        outputTokens: 50,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        sessionCount: 1,
      });

      store.reset();

      const state = useSettingsStore.getState();
      expect(state.deployPhase).toBe('initial');
      expect(state.deployLogs).toEqual([]);
      expect(state.claudeUsage).toBeNull();
    });
  });
});
