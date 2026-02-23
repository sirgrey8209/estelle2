/**
 * @file DebugLogSection.tsx
 * @description 디버그 로그 섹션
 *
 * Settings에서 최근 로그를 확인할 수 있는 컴포넌트입니다.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useDebugStore, LogLevel } from '../../stores/debugStore';
import { cn } from '../../lib/utils';

/** 로그 레벨별 색상 */
const levelColors: Record<LogLevel, string> = {
  info: 'text-blue-500',
  warn: 'text-yellow-500',
  error: 'text-red-500',
  debug: 'text-gray-500',
};

/** 시간 포맷 (HH:MM:SS.mmm) */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export function DebugLogSection() {
  const [expanded, setExpanded] = useState(false);
  const { logs, clear } = useDebugStore();

  return (
    <div className="border rounded-lg">
      {/* 헤더 (토글 버튼) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">Debug Logs</span>
          <span className="text-xs text-muted-foreground">
            ({logs.length})
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {/* 로그 패널 */}
      {expanded && (
        <div className="border-t">
          {/* 툴바 */}
          <div className="flex justify-end p-2 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              className="h-7 text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>

          {/* 로그 목록 */}
          <div className="max-h-64 overflow-y-auto p-2 font-mono text-xs bg-muted/30">
            {logs.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                No logs yet
              </div>
            ) : (
              <div className="space-y-0.5">
                {logs.map((entry) => (
                  <div key={entry.id} className="flex gap-2">
                    <span className="text-muted-foreground shrink-0">
                      {formatTime(entry.timestamp)}
                    </span>
                    <span className={cn('shrink-0', levelColors[entry.level])}>
                      [{entry.tag}]
                    </span>
                    <span className="break-all">{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
