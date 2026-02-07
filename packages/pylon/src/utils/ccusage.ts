/**
 * ccusage 유틸리티
 *
 * ccusage CLI 도구를 실행하여 Claude Code 사용량 데이터를 가져옵니다.
 * https://github.com/ryoppippi/ccusage
 *
 * @module utils/ccusage
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  CcusageOutput,
  DailyUsage,
  UsageSummary,
} from '@estelle/core';

const execAsync = promisify(exec);

/**
 * ccusage 실행 옵션
 */
export interface FetchCcusageOptions {
  /** ccusage 명령어 (기본값: 'npx ccusage') */
  command?: string;
  /** 시작 날짜 (YYYYMMDD) */
  since?: string;
  /** 종료 날짜 (YYYYMMDD) */
  until?: string;
  /** 타임아웃 (ms, 기본값: 30000) */
  timeout?: number;
}

/**
 * 캐시 효율 계산
 *
 * @param usage - 일별 사용량 데이터
 * @returns 캐시 효율 (0-100)
 */
export function getCacheEfficiency(usage: DailyUsage): number {
  const totalInput = usage.inputTokens + usage.cacheReadTokens;
  if (totalInput === 0) return 0;

  return Math.round((usage.cacheReadTokens / totalInput) * 100);
}

/**
 * 사용량 요약 계산
 *
 * @param output - ccusage 출력 데이터
 * @param today - 오늘 날짜 (YYYY-MM-DD)
 * @returns 사용량 요약
 */
export function calculateUsageSummary(
  output: CcusageOutput,
  today: string
): UsageSummary {
  const { daily } = output;

  // 오늘 데이터
  const todayData = daily.find((d) => d.date === today);
  const todayCost = todayData?.totalCost ?? 0;
  const todayTokens = todayData?.totalTokens ?? 0;
  const todayCacheEfficiency = todayData ? getCacheEfficiency(todayData) : 0;

  // 날짜 계산 헬퍼
  const parseDate = (dateStr: string) => new Date(dateStr);
  const todayDate = parseDate(today);

  // 7일 전 날짜
  const weekAgo = new Date(todayDate);
  weekAgo.setDate(weekAgo.getDate() - 6); // 오늘 포함 7일

  // 30일 전 날짜
  const monthAgo = new Date(todayDate);
  monthAgo.setDate(monthAgo.getDate() - 29); // 오늘 포함 30일

  // 주간 합산
  let weekCost = 0;
  let weekTokens = 0;
  for (const d of daily) {
    const date = parseDate(d.date);
    if (date >= weekAgo && date <= todayDate) {
      weekCost += d.totalCost;
      weekTokens += d.totalTokens;
    }
  }

  // 월간 합산
  let monthCost = 0;
  let monthTokens = 0;
  for (const d of daily) {
    const date = parseDate(d.date);
    if (date >= monthAgo && date <= todayDate) {
      monthCost += d.totalCost;
      monthTokens += d.totalTokens;
    }
  }

  // 최근 7일 상세 데이터
  const dailyDetails = daily
    .filter((d) => {
      const date = parseDate(d.date);
      return date >= weekAgo && date <= todayDate;
    })
    .sort((a, b) => b.date.localeCompare(a.date)); // 최신순

  return {
    todayCost,
    todayTokens,
    todayCacheEfficiency,
    weekCost,
    weekTokens,
    monthCost,
    monthTokens,
    lastUpdated: new Date().toISOString(),
    dailyDetails,
  };
}

/**
 * ccusage CLI 실행하여 사용량 데이터 가져오기
 *
 * @param options - 실행 옵션
 * @returns ccusage 출력 데이터 또는 null (실패 시)
 */
export async function fetchCcusage(
  options: FetchCcusageOptions = {}
): Promise<CcusageOutput | null> {
  const {
    command = 'npx ccusage',
    since,
    until,
    timeout = 30000,
  } = options;

  // 명령어 구성
  let cmd = `${command} --json`;
  if (since) cmd += ` --since ${since}`;
  if (until) cmd += ` --until ${until}`;

  try {
    const { stdout } = await execAsync(cmd, { timeout });
    const output = JSON.parse(stdout) as CcusageOutput;
    return output;
  } catch (error) {
    // ccusage가 설치되지 않았거나 실행 실패
    console.error('[ccusage] Failed to fetch usage data:', error);
    return null;
  }
}

/**
 * 사용량 데이터 가져오기 및 요약 계산
 *
 * @param options - 실행 옵션
 * @returns 사용량 요약 또는 null (실패 시)
 */
export async function getUsageSummary(
  options: FetchCcusageOptions = {}
): Promise<UsageSummary | null> {
  const output = await fetchCcusage(options);
  if (!output) return null;

  const today = new Date().toISOString().split('T')[0];
  return calculateUsageSummary(output, today);
}
