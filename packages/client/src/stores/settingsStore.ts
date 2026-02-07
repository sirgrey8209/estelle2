import { create } from 'zustand';
import type { UsageSummary } from '@estelle/core';

/**
 * 배포 단계 타입
 */
export type DeployPhase =
  | 'initial'
  | 'building'
  | 'buildReady'
  | 'preparing'
  | 'ready'
  | 'deploying'
  | 'error';

/**
 * 빌드 태스크 상태 타입
 */
export type BuildTaskStatus = 'pending' | 'building' | 'ready' | 'error';

/**
 * Claude 사용량 정보 (v1 Flutter ClaudeUsage 대응)
 */
export interface ClaudeUsage {
  /** 총 비용 (USD) */
  totalCostUsd: number;
  /** 총 입력 토큰 */
  inputTokens: number;
  /** 총 출력 토큰 */
  outputTokens: number;
  /** 캐시 읽기 토큰 */
  cacheReadTokens: number;
  /** 캐시 생성 토큰 */
  cacheCreationTokens: number;
  /** 세션 수 */
  sessionCount: number;
  /** 마지막 업데이트 */
  lastUpdated?: Date;
}

/**
 * 버전 정보
 */
export interface VersionInfo {
  version: string;
  commit: string;
  buildTime: string;
  apkUrl?: string;
  exeUrl?: string;
}

/**
 * 설정 상태 인터페이스
 */
export interface SettingsState {
  /** 배포 단계 */
  deployPhase: DeployPhase;

  /** 배포 에러 메시지 */
  deployErrorMessage: string | null;

  /** 배포 로그 */
  deployLogs: string[];

  /** 빌드 태스크 상태 */
  buildTasks: Record<string, BuildTaskStatus>;

  /** 선택된 Pylon ID (배포 대상) */
  selectedPylonId: string | null;

  /** Pylon ACK 수신 개수 */
  pylonAckCount: number;

  /** Claude 사용량 */
  claudeUsage: ClaudeUsage | null;

  /** 버전 정보 */
  versionInfo: VersionInfo | null;

  /** ccusage 사용량 요약 */
  usageSummary: UsageSummary | null;

  /** 사용량 로딩 중 */
  isLoadingUsage: boolean;

  /** 사용량 에러 메시지 */
  usageError: string | null;

  // Actions
  setDeployPhase: (phase: DeployPhase) => void;
  setDeployError: (message: string) => void;
  addDeployLog: (log: string) => void;
  clearDeployLogs: () => void;
  updateBuildTask: (taskName: string, status: BuildTaskStatus) => void;
  setSelectedPylonId: (pylonId: string | null) => void;
  incrementPylonAck: () => void;
  resetDeploy: () => void;
  setClaudeUsage: (usage: ClaudeUsage) => void;
  setVersionInfo: (info: VersionInfo) => void;
  setUsageSummary: (summary: UsageSummary | null, error?: string) => void;
  setLoadingUsage: (loading: boolean) => void;
  reset: () => void;
}

/**
 * 최대 로그 개수
 */
const MAX_LOGS = 100;

/**
 * 초기 상태
 */
const initialState = {
  deployPhase: 'initial' as DeployPhase,
  deployErrorMessage: null as string | null,
  deployLogs: [] as string[],
  buildTasks: {} as Record<string, BuildTaskStatus>,
  selectedPylonId: null as string | null,
  pylonAckCount: 0,
  claudeUsage: null as ClaudeUsage | null,
  versionInfo: null as VersionInfo | null,
  usageSummary: null as UsageSummary | null,
  isLoadingUsage: false,
  usageError: null as string | null,
};

/**
 * 설정 스토어
 *
 * 배포 상태, Claude 사용량, 버전 정보를 관리합니다.
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  ...initialState,

  setDeployPhase: (phase) => {
    set({
      deployPhase: phase,
      deployErrorMessage: null, // 단계 변경 시 에러 클리어
    });
  },

  setDeployError: (message) => {
    set({
      deployPhase: 'error',
      deployErrorMessage: message,
    });
  },

  addDeployLog: (log) => {
    set((state) => {
      const newLogs = [...state.deployLogs, log];
      // 최대 개수 초과 시 앞에서 제거
      if (newLogs.length > MAX_LOGS) {
        return { deployLogs: newLogs.slice(newLogs.length - MAX_LOGS) };
      }
      return { deployLogs: newLogs };
    });
  },

  clearDeployLogs: () => {
    set({ deployLogs: [] });
  },

  updateBuildTask: (taskName, status) => {
    set((state) => ({
      buildTasks: { ...state.buildTasks, [taskName]: status },
    }));
  },

  setSelectedPylonId: (pylonId) => {
    set({ selectedPylonId: pylonId });
  },

  incrementPylonAck: () => {
    set((state) => ({ pylonAckCount: state.pylonAckCount + 1 }));
  },

  resetDeploy: () => {
    set({
      deployPhase: 'initial',
      deployErrorMessage: null,
      deployLogs: [],
      buildTasks: {},
      selectedPylonId: null,
      pylonAckCount: 0,
    });
  },

  setClaudeUsage: (usage) => {
    set({ claudeUsage: usage });
  },

  setVersionInfo: (info) => {
    set({ versionInfo: info });
  },

  setUsageSummary: (summary, error) => {
    set({
      usageSummary: summary,
      usageError: error || null,
      isLoadingUsage: false,
    });
  },

  setLoadingUsage: (loading) => {
    set({ isLoadingUsage: loading });
  },

  reset: () => {
    set({ ...initialState });
  },
}));
