/**
 * @file usage.ts
 * @description Claude Code 사용량 관련 타입 정의
 *
 * ccusage CLI 도구의 JSON 출력을 기반으로 정의
 */

/**
 * 모델별 사용량 breakdown
 */
export interface ModelBreakdown {
  /** 모델명 (예: 'claude-opus-4-5-20251101') */
  modelName: string;
  /** 입력 토큰 수 */
  inputTokens: number;
  /** 출력 토큰 수 */
  outputTokens: number;
  /** 캐시 생성 토큰 수 */
  cacheCreationTokens: number;
  /** 캐시 읽기 토큰 수 */
  cacheReadTokens: number;
  /** 비용 (USD) */
  cost: number;
}

/**
 * 일별 사용량 데이터
 */
export interface DailyUsage {
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 입력 토큰 수 */
  inputTokens: number;
  /** 출력 토큰 수 */
  outputTokens: number;
  /** 캐시 생성 토큰 수 */
  cacheCreationTokens: number;
  /** 캐시 읽기 토큰 수 */
  cacheReadTokens: number;
  /** 총 토큰 수 */
  totalTokens: number;
  /** 총 비용 (USD) */
  totalCost: number;
  /** 사용된 모델 목록 */
  modelsUsed: string[];
  /** 모델별 상세 breakdown */
  modelBreakdowns: ModelBreakdown[];
}

/**
 * ccusage JSON 출력 형식
 */
export interface CcusageOutput {
  /** 일별 사용량 배열 */
  daily: DailyUsage[];
}

/**
 * Claude 사용량 요약 (클라이언트 표시용)
 */
export interface UsageSummary {
  /** 오늘 비용 (USD) */
  todayCost: number;
  /** 오늘 총 토큰 */
  todayTokens: number;
  /** 오늘 캐시 효율 (%) */
  todayCacheEfficiency: number;
  /** 최근 7일 비용 (USD) */
  weekCost: number;
  /** 최근 7일 총 토큰 */
  weekTokens: number;
  /** 최근 30일 비용 (USD) */
  monthCost: number;
  /** 최근 30일 총 토큰 */
  monthTokens: number;
  /** 마지막 업데이트 시각 */
  lastUpdated: string;
  /** 일별 상세 데이터 (최근 7일) */
  dailyDetails?: DailyUsage[];
}

/**
 * Usage 요청 페이로드
 */
export interface UsageRequestPayload {
  /** 요청 타입 */
  requestType: 'summary' | 'daily' | 'monthly';
  /** 시작 날짜 (YYYYMMDD) */
  since?: string;
  /** 종료 날짜 (YYYYMMDD) */
  until?: string;
}

/**
 * Usage 응답 페이로드
 */
export interface UsageResponsePayload {
  /** 성공 여부 */
  success: boolean;
  /** 사용량 요약 (성공 시) */
  summary?: UsageSummary;
  /** 에러 메시지 (실패 시) */
  error?: string;
}
