/**
 * ccusage 유틸리티 테스트
 *
 * 테스트 항목:
 * - ccusage CLI 실행 및 JSON 파싱
 * - 사용량 요약 계산 (오늘/주간/월간)
 * - 캐시 효율 계산
 * - 에러 핸들링 (ccusage 미설치 등)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchCcusage,
  calculateUsageSummary,
  getCacheEfficiency,
} from '../../src/utils/ccusage.js';
import type { CcusageOutput, DailyUsage } from '@estelle/core';

// 테스트용 mock 데이터
const mockDailyUsage: DailyUsage = {
  date: '2026-02-06',
  inputTokens: 1000,
  outputTokens: 500,
  cacheCreationTokens: 10000,
  cacheReadTokens: 50000,
  totalTokens: 61500,
  totalCost: 5.5,
  modelsUsed: ['claude-opus-4-5-20251101'],
  modelBreakdowns: [
    {
      modelName: 'claude-opus-4-5-20251101',
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationTokens: 10000,
      cacheReadTokens: 50000,
      cost: 5.5,
    },
  ],
};

const mockCcusageOutput: CcusageOutput = {
  daily: [
    { ...mockDailyUsage, date: '2026-02-01', totalCost: 10.0, totalTokens: 100000 },
    { ...mockDailyUsage, date: '2026-02-02', totalCost: 15.0, totalTokens: 150000 },
    { ...mockDailyUsage, date: '2026-02-03', totalCost: 8.0, totalTokens: 80000 },
    { ...mockDailyUsage, date: '2026-02-04', totalCost: 12.0, totalTokens: 120000 },
    { ...mockDailyUsage, date: '2026-02-05', totalCost: 20.0, totalTokens: 200000 },
    { ...mockDailyUsage, date: '2026-02-06', totalCost: 5.5, totalTokens: 61500 },
  ],
};

describe('ccusage utility', () => {
  describe('getCacheEfficiency', () => {
    it('should calculate cache efficiency correctly', () => {
      const usage: DailyUsage = {
        ...mockDailyUsage,
        inputTokens: 1000,
        cacheReadTokens: 9000, // 90% cache hit
      };

      const efficiency = getCacheEfficiency(usage);
      expect(efficiency).toBe(90);
    });

    it('should return 0 when no input tokens', () => {
      const usage: DailyUsage = {
        ...mockDailyUsage,
        inputTokens: 0,
        cacheReadTokens: 0,
      };

      const efficiency = getCacheEfficiency(usage);
      expect(efficiency).toBe(0);
    });

    it('should handle edge case with only cache reads', () => {
      const usage: DailyUsage = {
        ...mockDailyUsage,
        inputTokens: 100,
        cacheReadTokens: 9900, // 99% cache hit
      };

      const efficiency = getCacheEfficiency(usage);
      expect(efficiency).toBe(99);
    });
  });

  describe('calculateUsageSummary', () => {
    it('should calculate today usage correctly', () => {
      const today = '2026-02-06';
      const summary = calculateUsageSummary(mockCcusageOutput, today);

      expect(summary.todayCost).toBe(5.5);
      expect(summary.todayTokens).toBe(61500);
    });

    it('should calculate weekly usage (last 7 days)', () => {
      const today = '2026-02-06';
      const summary = calculateUsageSummary(mockCcusageOutput, today);

      // 2026-02-01 ~ 2026-02-06 (6일치 데이터)
      const expectedWeekCost = 10.0 + 15.0 + 8.0 + 12.0 + 20.0 + 5.5;
      expect(summary.weekCost).toBe(expectedWeekCost);
    });

    it('should handle empty data', () => {
      const emptyOutput: CcusageOutput = { daily: [] };
      const summary = calculateUsageSummary(emptyOutput, '2026-02-06');

      expect(summary.todayCost).toBe(0);
      expect(summary.todayTokens).toBe(0);
      expect(summary.weekCost).toBe(0);
      expect(summary.monthCost).toBe(0);
    });

    it('should include lastUpdated timestamp', () => {
      const summary = calculateUsageSummary(mockCcusageOutput, '2026-02-06');
      expect(summary.lastUpdated).toBeDefined();
      expect(typeof summary.lastUpdated).toBe('string');
    });

    it('should include recent daily details', () => {
      const summary = calculateUsageSummary(mockCcusageOutput, '2026-02-06');
      expect(summary.dailyDetails).toBeDefined();
      expect(summary.dailyDetails!.length).toBeLessThanOrEqual(7);
    });
  });

  describe('fetchCcusage', () => {
    it('should return null when ccusage is not available', async () => {
      // ccusage가 없는 환경에서 실행 시 null 반환
      const result = await fetchCcusage({ command: 'nonexistent-ccusage-command' });
      expect(result).toBeNull();
    });

    // 실제 ccusage가 설치된 환경에서만 실행되는 테스트 (수동 테스트용)
    // it('should fetch and parse ccusage output', async () => {
    //   const result = await fetchCcusage();
    //   if (result) {
    //     expect(result.daily).toBeDefined();
    //     expect(Array.isArray(result.daily)).toBe(true);
    //   }
    // });
  });
});
