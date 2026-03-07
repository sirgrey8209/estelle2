import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Check, X, MoreHorizontal, CheckSquare, Square, Clock, Plug, Play, Loader2 } from 'lucide-react';
import { parseToolInput, parseMcpToolName } from '../../utils/toolInputParser';
import { removeSystemReminder, diffLines } from '../../utils/textUtils';
import { Collapsible } from '../common/Collapsible';
import { WidgetRenderer } from '../widget';
import { cn } from '../../lib/utils';
import type { ViewNode } from '@estelle/core';
import { FilePathLink } from './FilePathLink';

/**
 * 파일 경로에서 파일명만 추출
 */
function extractFileName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || filePath;
}

/**
 * 하위 툴 정보 타입
 */
export interface ChildToolInfo {
  id: string;
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  isComplete: boolean;
  success?: boolean;
  timestamp: number;
}

interface ToolCardProps {
  toolName: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  isComplete: boolean;
  success?: boolean;
  elapsedSeconds?: number;
  /** Task 툴의 하위 툴들 */
  childTools?: ChildToolInfo[];
  /** MCP 파일 클릭 핸들러 */
  onMcpFileClick?: (fileInfo: McpFileInfo) => void;
  /** MCP 도구 호출 ID (Widget 렌더링에 사용) */
  toolUseId?: string;
  /** Widget 세션 (run_widget일 때 사용) */
  widgetSession?: {
    toolUseId: string;
    sessionId: string;
    view: ViewNode | null;
    status: 'pending' | 'claiming' | 'running' | 'completed';
  } | null;
  /** Widget v2 이벤트 핸들러 (ScriptViewNode용) */
  onWidgetEvent?: (data: unknown) => void;
  /** Widget v2 취소 핸들러 (ScriptViewNode용) */
  onWidgetCancel?: () => void;
  /** Widget claim 핸들러 (pending 상태에서 시작 버튼 클릭) */
  onWidgetClaim?: () => void;
  /** Widget v2 에셋 URL 맵 (ScriptViewNode용) */
  widgetAssets?: Record<string, string>;
  /** 파일 경로 클릭 핸들러 */
  onFilePathClick?: (path: string) => void;
}

// McpFileInfo를 export
export type { McpFileInfo };

interface McpRenderContext {
  isComplete: boolean;
  success?: boolean;
  statusIcon: React.ReactNode;
  statusColor: string;
  borderColor: string;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  onFileClick?: (fileInfo: McpFileInfo) => void;
}

interface McpFileInfo {
  filename: string;
  mimeType?: string;
  size: number;
  path: string;
  description?: string | null;
}

/**
 * MCP 도구 전용 렌더링
 * - 상단: 🔌 + serverName (아주 작게)
 * - 본문: 도구명 + desc (Read와 동일한 형태)
 * - 확장: output JSON raw
 */
function renderMcpTool(
  serverName: string,
  mcpToolName: string,
  toolInput: Record<string, unknown> | undefined,
  cleanedOutput: unknown,
  ctx: McpRenderContext
): React.ReactNode {
  const { isComplete, success, statusIcon, statusColor, borderColor, isExpanded, setIsExpanded, onFileClick } = ctx;

  // 도구명과 설명
  const displayToolName = mcpToolName.replace(/_/g, ' ');
  const firstVal = toolInput
    ? Object.values(toolInput).find((v) => typeof v === 'string') as string | undefined
    : undefined;

  // send_file 전용: 파일 정보 파싱
  let fileInfo: McpFileInfo | null = null;
  if (mcpToolName === 'send_file' && typeof cleanedOutput === 'string') {
    try {
      const parsed = JSON.parse(cleanedOutput);
      if (parsed?.success && parsed?.file) {
        fileInfo = parsed.file as McpFileInfo;
      }
    } catch {
      // 파싱 실패
    }
  }

  const getFileTypeIcon = (mimeType?: string, filename?: string) => {
    if (mimeType?.startsWith('image/')) return '🖼️';
    if (mimeType === 'text/markdown' || filename?.endsWith('.md')) return '📝';
    return '📄';
  };

  const formatSize = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={cn(
        'my-0.5 ml-2 rounded border border-l-2 bg-card overflow-hidden max-w-[400px]',
        borderColor
      )}
      style={{ borderLeftColor: isComplete ? (success ? '#22c55e' : '#ef4444') : '#eab308' }}
    >
      {/* 상단: 상태 아이콘 + 🔌서버명 + 도구명 (다른 툴과 동일한 포맷) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center px-2 py-1 hover:bg-muted/50 transition-colors"
      >
        <span className={statusColor}>{statusIcon}</span>
        <Plug className="ml-1.5 h-3.5 w-3.5" />
        <span className="ml-0.5 text-sm font-medium">{serverName}</span>
        <span className="flex-1 ml-1.5 text-xs text-muted-foreground truncate text-left">
          {displayToolName}
        </span>
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {/* send_file 성공 시: 파일 카드 (한 줄) */}
      {mcpToolName === 'send_file' && fileInfo && (
        <div className="px-2 py-1 border-t border-border/50">
          <FilePathLink
            path={fileInfo.path}
            description={fileInfo.description ?? undefined}
            size={fileInfo.size}
            onClick={() => onFileClick?.(fileInfo!)}
          />
        </div>
      )}

      {/* 확장 시: output JSON raw */}
      <Collapsible expanded={isExpanded}>
        <div className="border-t border-border px-2 py-1">
          {toolInput && (
            <div className="mb-1">
              <p className="text-[10px] text-muted-foreground/50 mb-0.5">Input:</p>
              <p className="text-xs text-muted-foreground select-text whitespace-pre-wrap break-all">
                {JSON.stringify(toolInput, null, 2)}
              </p>
            </div>
          )}
          {isComplete && cleanedOutput !== undefined && (
            <div className="bg-muted p-1.5 rounded">
              <p className="text-[10px] text-muted-foreground/50 mb-0.5">Output:</p>
              <p className="text-xs opacity-80 select-text whitespace-pre-wrap break-all">
                {typeof cleanedOutput === 'string'
                  ? cleanedOutput
                  : JSON.stringify(cleanedOutput, null, 2)}
              </p>
            </div>
          )}
        </div>
      </Collapsible>
    </div>
  );
}

/**
 * 도구 호출 카드 (컴팩트)
 */
export function ToolCard({
  toolName,
  toolInput,
  toolOutput,
  isComplete,
  success,
  elapsedSeconds,
  childTools,
  onMcpFileClick,
  toolUseId,
  widgetSession,
  onWidgetEvent,
  onWidgetCancel,
  onWidgetClaim,
  widgetAssets,
  onFilePathClick,
}: ToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedChildId, setExpandedChildId] = useState<string | null>(null);
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
  const prevChildCountRef = useRef<number>(0);

  // 새 하위 툴 추가 시 애니메이션 트리거 (Task 전용)
  useEffect(() => {
    if (toolName !== 'Task' || !childTools) return;

    const currentCount = childTools.length;
    const prevCount = prevChildCountRef.current;

    // 새 툴이 추가된 경우
    if (currentCount > prevCount && prevCount > 0) {
      // 가장 최신 툴에만 애니메이션 적용
      const newestTool = childTools.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
      setAnimatingIds(new Set([newestTool.id]));

      const timer = setTimeout(() => {
        setAnimatingIds(new Set());
      }, 300);

      prevChildCountRef.current = currentCount;
      return () => clearTimeout(timer);
    }

    prevChildCountRef.current = currentCount;
  }, [toolName, childTools]);

  const getStatus = () => {
    if (!isComplete) {
      return {
        icon: <MoreHorizontal className="h-3.5 w-3.5" />,
        color: 'text-yellow-500',
        borderColor: 'border-yellow-500/30',
      };
    }
    return success
      ? {
          icon: <Check className="h-3.5 w-3.5" />,
          color: 'text-green-500',
          borderColor: 'border-green-500/30',
        }
      : {
          icon: <X className="h-3.5 w-3.5" />,
          color: 'text-red-500',
          borderColor: 'border-red-500/30',
        };
  };

  const { icon: statusIcon, color: statusColor, borderColor } = getStatus();
  const { desc, cmd } = parseToolInput(toolName, toolInput);

  // toolOutput에서 system-reminder 제거
  const cleanedOutput = typeof toolOutput === 'string'
    ? removeSystemReminder(toolOutput)
    : toolOutput;

  // AskUserQuestion 툴 전용 렌더링
  if (toolName === 'AskUserQuestion') {
    const rawQuestions = toolInput?.questions;
    // questions가 배열 또는 객체({"0": ..., "1": ...}) 형태일 수 있음
    const questions: Array<{
      question?: string;
      header?: string;
      options?: Array<{ label?: string; description?: string }>;
      multiSelect?: boolean;
    }> = Array.isArray(rawQuestions)
      ? rawQuestions
      : rawQuestions && typeof rawQuestions === 'object'
        ? Object.values(rawQuestions)
        : [];

    const questionCount = questions.length;

    // 답변 파싱: "질문1"="답변1", "질문2"="답변2" 형태
    const rawAnswer = typeof cleanedOutput === 'string'
      ? cleanedOutput.replace(/^User has answered your questions: /, '').replace(/\. You can now continue.*$/, '')
      : '';

    // 답변을 질문별로 매핑
    const answerMap: Record<string, string> = {};
    const answerMatches = rawAnswer.matchAll(/"([^"]+)"="([^"]+)"/g);
    for (const match of answerMatches) {
      answerMap[match[1]] = match[2];
    }

    // 질문 1개: 간단히 표시
    if (questionCount <= 1) {
      const q = questions[0];
      const questionText = q?.question || 'Question';
      const answerKey = q?.header || q?.question || 'Question';
      const answer = answerMap[answerKey] || (isComplete ? rawAnswer : '');

      return (
        <div
          className={cn(
            'my-0.5 ml-2 rounded border border-l-2 bg-card overflow-hidden max-w-[400px]',
            borderColor
          )}
          style={{ borderLeftColor: isComplete ? (success ? '#22c55e' : '#ef4444') : '#eab308' }}
        >
          <div className="px-2 py-1">
            <div className="flex items-start gap-1.5">
              <span className={cn(statusColor, 'mt-0.5 shrink-0')}>{statusIcon}</span>
              <p className="text-sm">
                <span className="text-muted-foreground">{questionText}</span>
                {answer && <span className="ml-1 text-foreground">→ {answer}</span>}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // 질문 여러개: 목록으로 표시
    return (
      <div
        className={cn(
          'my-0.5 ml-2 rounded border border-l-2 bg-card overflow-hidden max-w-[400px]',
          borderColor
        )}
        style={{ borderLeftColor: isComplete ? (success ? '#22c55e' : '#ef4444') : '#eab308' }}
      >
        <div className="px-2 py-1 space-y-0.5">
          {questions.map((q, i) => {
            const questionText = q.question || `Q${i + 1}`;
            const answerKey = q.header || q.question || `Q${i + 1}`;
            const answer = answerMap[answerKey];
            return (
              <div key={i} className="flex items-start gap-1.5">
                {i === 0 && <span className={cn(statusColor, 'mt-0.5 shrink-0')}>{statusIcon}</span>}
                {i !== 0 && <span className="w-3.5 shrink-0" />}
                <p className="text-sm">
                  <span className="text-muted-foreground">{questionText}</span>
                  {answer && <span className="ml-1">→ {answer}</span>}
                </p>
              </div>
            );
            })}
        </div>
      </div>
    );
  }

  // TodoWrite 툴 전용 렌더링
  if (toolName === 'TodoWrite') {
    const rawTodos = toolInput?.todos;
    const todos: Array<{ content?: string; subject?: string; status?: string; activeForm?: string }> = Array.isArray(rawTodos)
      ? rawTodos
      : rawTodos && typeof rawTodos === 'object'
        ? Object.values(rawTodos as Record<string, unknown>)
        : [];
    const count = todos.length;

    const getStatusIcon = (status?: string) => {
      switch (status) {
        case 'completed': return <CheckSquare className="h-3.5 w-3.5 text-green-500" />;
        case 'in_progress': return <Clock className="h-3.5 w-3.5 text-yellow-500" />;
        default: return <Square className="h-3.5 w-3.5 text-muted-foreground" />;
      }
    };

    return (
      <div
        className={cn(
          'my-0.5 ml-2 rounded border border-l-2 bg-card overflow-hidden max-w-[400px]',
          borderColor
        )}
        style={{ borderLeftColor: isComplete ? (success ? '#22c55e' : '#ef4444') : '#eab308' }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center px-2 py-1 hover:bg-muted/50 transition-colors"
        >
          <span className={statusColor}>{statusIcon}</span>
          <span className="ml-1.5 text-sm font-medium">TodoWrite</span>
          <span className="flex-1 ml-1.5 text-xs text-muted-foreground truncate text-left">
            {count} items
          </span>
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        <Collapsible expanded={isExpanded}>
          <div className="bg-muted p-2 rounded-b">
            {todos.length > 0 ? (
              todos.map((todo, index) => (
                <div
                  key={index}
                  className="flex items-start mb-1 last:mb-0"
                >
                  <div className="mx-1">
                    {getStatusIcon(todo.status)}
                  </div>
                  <span
                    className={cn(
                      'flex-1 ml-1 text-xs',
                      todo.status === 'in_progress' ? 'opacity-90' : 'opacity-50',
                      todo.status === 'completed' && 'line-through'
                    )}
                  >
                    {todo.status === 'in_progress' && todo.activeForm
                      ? todo.activeForm
                      : todo.content || todo.subject || JSON.stringify(todo)}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">
                {JSON.stringify(toolInput, null, 2)}
              </span>
            )}
          </div>
        </Collapsible>
      </div>
    );
  }

  // MCP 도구 전용 렌더링
  const mcpInfo = parseMcpToolName(toolName);

  // run_widget / run_widget_inline MCP 도구: Widget 렌더링
  if (mcpInfo.isMcp && (mcpInfo.toolName === 'run_widget' || mcpInfo.toolName === 'run_widget_inline')) {
    // widgetSession이 있고 toolUseId가 매칭되는 경우에만 Widget 렌더링
    const matchedWidget = widgetSession && toolUseId && widgetSession.toolUseId === toolUseId
      ? widgetSession
      : null;

    // 결과 텍스트 변환
    const outputText = cleanedOutput
      ? (typeof cleanedOutput === 'string' ? cleanedOutput : JSON.stringify(cleanedOutput, null, 2))
      : null;

    return (
      <div
        className={cn(
          'my-0.5 ml-2 rounded border border-l-2 bg-card overflow-hidden max-w-[400px]',
          borderColor
        )}
        style={{ borderLeftColor: isComplete ? (success ? '#22c55e' : '#ef4444') : '#eab308' }}
      >
        {/* 헤더 */}
        <div className="flex items-center px-2 py-1">
          <Plug className="h-3 w-3 text-muted-foreground/60" />
          <span className="ml-1 text-[10px] text-muted-foreground/60">
            {mcpInfo.serverName}
          </span>
          <span className="ml-1.5 text-xs text-muted-foreground">Widget</span>
          {/* 진행 중일 때만 X 버튼 표시 */}
          {!isComplete && matchedWidget && onWidgetCancel && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWidgetCancel();
              }}
              className="ml-auto p-0.5 rounded hover:bg-muted/80"
              aria-label="Cancel widget"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          )}
          {/* 완료 시 상태 아이콘 */}
          {isComplete && <span className={cn('ml-auto', statusColor)}>{statusIcon}</span>}
        </div>

        {/* Widget 렌더링: pending → 시작 버튼, claiming → 스피너, running → WidgetRenderer */}
        {matchedWidget && matchedWidget.status === 'pending' && onWidgetClaim && (
          <div className="border-t border-border p-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWidgetClaim();
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:bg-primary/90"
            >
              <Play className="h-3.5 w-3.5" />
              시작
            </button>
          </div>
        )}
        {matchedWidget && matchedWidget.status === 'claiming' && (
          <div className="border-t border-border p-3 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">실행 중...</span>
          </div>
        )}
        {matchedWidget && matchedWidget.status === 'running' && matchedWidget.view && onWidgetEvent && onWidgetCancel && (
          <div className="border-t border-border">
            <WidgetRenderer
              sessionId={matchedWidget.sessionId}
              view={matchedWidget.view}
              onEvent={onWidgetEvent}
              onCancel={onWidgetCancel}
              assets={widgetAssets}
            />
          </div>
        )}
        {/* completed 상태: 종료 페이지 (모든 클라이언트에 브로드캐스트) */}
        {matchedWidget && matchedWidget.status === 'completed' && matchedWidget.view && (
          <div className="border-t border-border">
            <WidgetRenderer
              sessionId={matchedWidget.sessionId}
              view={matchedWidget.view}
              onEvent={() => {}} // completed 상태에서는 이벤트 무시
              onCancel={() => {}} // completed 상태에서는 취소 무시
              assets={widgetAssets}
            />
          </div>
        )}

        {/* 결과 표시 (완료 후) */}
        {isComplete && outputText && (
          <div className="border-t border-border px-2 py-1">
            <p className="text-xs text-muted-foreground">{outputText}</p>
          </div>
        )}
      </div>
    );
  }

  if (mcpInfo.isMcp) {
    return renderMcpTool(mcpInfo.serverName, mcpInfo.toolName, toolInput, cleanedOutput, {
      isComplete,
      success,
      statusIcon,
      statusColor,
      borderColor,
      isExpanded,
      setIsExpanded,
      onFileClick: onMcpFileClick,
    });
  }

  // Bash, Grep, Glob, Task, Edit, Write, Read 툴들의 렌더링
  const renderSpecialTool = (
    name: string,
    summary: string,
    details?: string,
    showOutput: boolean = true
  ) => (
    <div
      className={cn(
        'my-0.5 ml-2 rounded border border-l-2 bg-card overflow-hidden max-w-[400px]',
        borderColor
      )}
      style={{ borderLeftColor: isComplete ? (success ? '#22c55e' : '#ef4444') : '#eab308' }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center px-2 py-1 hover:bg-muted/50 transition-colors"
      >
        <span className={statusColor}>{statusIcon}</span>
        <span className="ml-1.5 text-sm font-medium">{name}</span>
        <span className="flex-1 ml-1.5 text-xs text-muted-foreground truncate text-left">
          {summary}
        </span>
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      <Collapsible expanded={isExpanded}>
        <div className="border-t border-border">
          {details && (
            <p className="px-2 py-1 text-xs text-muted-foreground select-text">
              {details}
            </p>
          )}
          {showOutput && isComplete && cleanedOutput !== undefined && (
            <div className="bg-muted p-2 rounded-b">
              <p className="text-xs opacity-80 select-text whitespace-pre-wrap break-all">
                {typeof cleanedOutput === 'string'
                  ? cleanedOutput.length > 500
                    ? cleanedOutput.substring(0, 500) + '...'
                    : cleanedOutput
                  : JSON.stringify(cleanedOutput, null, 2)}
              </p>
            </div>
          )}
        </div>
      </Collapsible>
    </div>
  );

  if (toolName === 'Bash') {
    const description = (toolInput?.description as string) || '';
    const command = (toolInput?.command as string) || '';
    return renderSpecialTool('Bash', description || command.split('\n')[0], command);
  }

  if (toolName === 'Grep') {
    const pattern = (toolInput?.pattern as string) || '';
    const searchPath = (toolInput?.path as string) || '';
    return renderSpecialTool('Grep', pattern, searchPath);
  }

  if (toolName === 'Glob') {
    const pattern = (toolInput?.pattern as string) || '';
    const searchPath = (toolInput?.path as string) || '';
    return renderSpecialTool('Glob', pattern, searchPath);
  }

  if (toolName === 'Task') {
    const description = (toolInput?.description as string) || '';
    const prompt = (toolInput?.prompt as string) || '';
    const subagentType = (toolInput?.subagent_type as string) || '';
    const truncatedPrompt = prompt.length > 300 ? prompt.substring(0, 300) + '...' : prompt;

    // 하위 툴들 정렬 (timestamp 기준 최신순)
    const sortedChildren = childTools
      ? [...childTools].sort((a, b) => b.timestamp - a.timestamp)
      : [];

    // 닫힌 상태에서 보여줄 최신 3개
    const previewChildren = sortedChildren.slice(0, 3);
    // 열린 상태에서 보여줄 전체 (오래된 순)
    const allChildrenOldFirst = [...sortedChildren].reverse();

    // 하위 툴 컴팩트 렌더링
    const renderChildTool = (child: ChildToolInfo, isPreview: boolean = false) => {
      const childStatus = !child.isComplete
        ? { icon: <MoreHorizontal className="h-3 w-3" />, color: 'text-yellow-500' }
        : child.success
          ? { icon: <Check className="h-3 w-3" />, color: 'text-green-500' }
          : { icon: <X className="h-3 w-3" />, color: 'text-red-500' };

      const childParsed = parseToolInput(child.toolName, child.toolInput);
      const isChildExpanded = expandedChildId === child.id;
      const isAnimating = animatingIds.has(child.id);

      // 하위 툴 output 정리
      const childCleanedOutput = typeof child.toolOutput === 'string'
        ? removeSystemReminder(child.toolOutput)
        : child.toolOutput;

      return (
        <div
          key={child.id}
          className={cn(
            'border-l-2 bg-muted/30 rounded-r overflow-hidden transition-all duration-300',
            isAnimating && 'animate-in slide-in-from-left-2 fade-in',
            child.isComplete
              ? child.success
                ? 'border-green-500/50'
                : 'border-red-500/50'
              : 'border-yellow-500/50'
          )}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedChildId(isChildExpanded ? null : child.id);
            }}
            className="w-full flex items-center gap-1 px-1.5 py-0.5 hover:bg-muted/50 transition-colors"
          >
            <span className={childStatus.color}>{childStatus.icon}</span>
            <span className="text-xs font-medium">{child.toolName}</span>
            <span className="flex-1 text-xs text-muted-foreground truncate text-left ml-1">
              {childParsed.desc}
            </span>
            {isChildExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
          </button>

          <Collapsible expanded={isChildExpanded}>
            <div className="px-1.5 py-1 bg-muted/50 text-xs">
              {childParsed.cmd && (
                <p className="text-muted-foreground/70 mb-1 break-all">{childParsed.cmd}</p>
              )}
              {child.isComplete && childCleanedOutput !== undefined && (
                <p className="opacity-70 select-text whitespace-pre-wrap break-all">
                  {typeof childCleanedOutput === 'string'
                    ? childCleanedOutput.length > 300
                      ? childCleanedOutput.substring(0, 300) + '...'
                      : childCleanedOutput
                    : JSON.stringify(childCleanedOutput, null, 2)}
                </p>
              )}
            </div>
          </Collapsible>
        </div>
      );
    };

    return (
      <div
        className={cn(
          'my-0.5 ml-2 rounded border border-l-2 bg-card overflow-hidden max-w-[400px]',
          borderColor
        )}
        style={{ borderLeftColor: isComplete ? (success ? '#22c55e' : '#ef4444') : '#eab308' }}
      >
        {/* Task 헤더 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center px-2 py-1 hover:bg-muted/50 transition-colors"
        >
          <span className={statusColor}>{statusIcon}</span>
          <span className="ml-1.5 text-sm font-medium">Task</span>
          <span className="flex-1 ml-1.5 text-xs text-muted-foreground truncate text-left">
            {description}
          </span>
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {/* 닫힌 상태: 진행 중일 때만 최신 3개 하위 툴 미리보기 (오래된 순, +more가 위에) */}
        {!isExpanded && !isComplete && previewChildren.length > 0 && (
          <div className="px-2 pb-1.5 space-y-0.5">
            {sortedChildren.length > 3 && (
              <p className="text-xs text-muted-foreground/50 pl-1">
                +{sortedChildren.length - 3} more...
              </p>
            )}
            {[...previewChildren].reverse().map(child => renderChildTool(child, true))}
          </div>
        )}

        {/* 열린 상태: 프롬프트 → 하위 툴들 → 완료 요약 */}
        <Collapsible expanded={isExpanded}>
          <div className="border-t border-border">
            {/* 프롬프트 섹션 */}
            <div className="px-2 py-1">
              {subagentType && (
                <p className="text-xs text-muted-foreground/70 mb-0.5">[{subagentType}]</p>
              )}
              <p className="text-xs text-muted-foreground select-text whitespace-pre-wrap">
                {truncatedPrompt}
              </p>
            </div>

            {/* 하위 툴들 (열린 상태에서만, 오래된 순) */}
            {allChildrenOldFirst.length > 0 && (
              <div className="px-2 py-1 space-y-0.5 border-t border-border/50">
                <p className="text-xs text-muted-foreground/50 mb-0.5">
                  실행된 도구 ({allChildrenOldFirst.length})
                </p>
                {allChildrenOldFirst.map(child => renderChildTool(child))}
              </div>
            )}

            {/* 완료 요약 */}
            {isComplete && cleanedOutput !== undefined && (
              <div className="bg-muted p-2 rounded-b">
                <p className="text-xs opacity-80 select-text whitespace-pre-wrap break-all">
                  {typeof cleanedOutput === 'string'
                    ? cleanedOutput.length > 500
                      ? cleanedOutput.substring(0, 500) + '...'
                      : cleanedOutput
                    : JSON.stringify(cleanedOutput, null, 2)}
                </p>
              </div>
            )}
          </div>
        </Collapsible>
      </div>
    );
  }

  if (toolName === 'Read') {
    const filePath = (toolInput?.file_path as string) || '';
    const fileName = extractFileName(filePath);

    return (
      <div
        className={cn(
          'my-0.5 ml-2 rounded border border-l-2 bg-card overflow-hidden max-w-[400px]',
          borderColor
        )}
        style={{ borderLeftColor: isComplete ? (success ? '#22c55e' : '#ef4444') : '#eab308' }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center px-2 py-1 hover:bg-muted/50 transition-colors"
        >
          <span className={statusColor}>{statusIcon}</span>
          <span className="ml-1.5 text-sm font-medium">Read</span>
          <span className="flex-1 ml-1.5 text-xs text-muted-foreground truncate text-left">
            {fileName}
          </span>
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        <Collapsible expanded={isExpanded}>
          <div className="border-t border-border">
            <div className="px-2 py-1">
              <FilePathLink
                path={filePath}
                onClick={() => onFilePathClick?.(filePath)}
              />
            </div>
            {isComplete && cleanedOutput !== undefined && (
              <div className="bg-muted p-2 rounded-b">
                <p className="text-xs opacity-80 select-text whitespace-pre-wrap break-all">
                  {typeof cleanedOutput === 'string'
                    ? cleanedOutput.length > 500
                      ? cleanedOutput.substring(0, 500) + '...'
                      : cleanedOutput
                    : JSON.stringify(cleanedOutput, null, 2)}
                </p>
              </div>
            )}
          </div>
        </Collapsible>
      </div>
    );
  }

  if (toolName === 'Write') {
    const filePath = (toolInput?.file_path as string) || '';
    const content = (toolInput?.content as string) || '';
    const fileName = extractFileName(filePath);

    return (
      <div
        className={cn(
          'my-0.5 ml-2 rounded border border-l-2 bg-card overflow-hidden max-w-[400px]',
          borderColor
        )}
        style={{ borderLeftColor: isComplete ? (success ? '#22c55e' : '#ef4444') : '#eab308' }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center px-2 py-1 hover:bg-muted/50 transition-colors"
        >
          <span className={statusColor}>{statusIcon}</span>
          <span className="ml-1.5 text-sm font-medium">Write</span>
          <span className="flex-1 ml-1.5 text-xs text-muted-foreground truncate text-left">
            {fileName}
          </span>
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        <Collapsible expanded={isExpanded}>
          <div className="border-t border-border">
            <div className="px-2 py-1">
              <FilePathLink
                path={filePath}
                onClick={() => onFilePathClick?.(filePath)}
              />
            </div>
            {content && (
              <div className="bg-muted p-2 rounded-b">
                <p className="text-xs opacity-80 select-text whitespace-pre-wrap">
                  {content.length > 500 ? content.substring(0, 500) + '...' : content}
                </p>
              </div>
            )}
          </div>
        </Collapsible>
      </div>
    );
  }

  if (toolName === 'Edit') {
    const filePath = (toolInput?.file_path as string) || '';
    const oldString = (toolInput?.old_string as string) || '';
    const newString = (toolInput?.new_string as string) || '';
    const fileName = extractFileName(filePath);

    return (
      <div
        className={cn(
          'my-0.5 ml-2 rounded border border-l-2 bg-card overflow-hidden max-w-[400px]',
          borderColor
        )}
        style={{ borderLeftColor: isComplete ? (success ? '#22c55e' : '#ef4444') : '#eab308' }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center px-2 py-1 hover:bg-muted/50 transition-colors"
        >
          <span className={statusColor}>{statusIcon}</span>
          <span className="ml-1.5 text-sm font-medium">Edit</span>
          <span className="flex-1 ml-1.5 text-xs text-muted-foreground truncate text-left">
            {fileName}
          </span>
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        <Collapsible expanded={isExpanded}>
          <div className="border-t border-border">
            <div className="px-2 py-1">
              <FilePathLink
                path={filePath}
                onClick={() => onFilePathClick?.(filePath)}
              />
            </div>
            <div className="bg-muted p-2 rounded-b">
              {(() => {
                const diff = diffLines(oldString, newString);
                const maxLines = 20;
                const displayDiff = diff.slice(0, maxLines);
                const hasMore = diff.length > maxLines;

                return (
                  <>
                    {displayDiff.map((line, i) => {
                      const isRemove = line.type === 'remove';
                      const isAdd = line.type === 'add';
                      const prefix = isRemove ? '-' : isAdd ? '+' : ' ';

                      return (
                        <div key={i} className="flex py-px">
                          <span
                            className={cn(
                              'w-4 text-center text-xs',
                              isRemove ? 'text-red-500' : isAdd ? 'text-green-500' : 'opacity-30'
                            )}
                          >
                            {prefix}
                          </span>
                          <span
                            className={cn(
                              'flex-1 text-xs select-text',
                              isRemove ? 'text-red-500' : isAdd ? 'text-green-500' : 'opacity-50'
                            )}
                          >
                            {line.text}
                          </span>
                        </div>
                      );
                    })}
                    {hasMore && (
                      <span className="text-xs opacity-40 pl-4">
                        {`... (+${diff.length - maxLines} lines)`}
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </Collapsible>
      </div>
    );
  }

  // 기본 렌더링
  return (
    <div
      className={cn(
        'my-0.5 ml-2 rounded border border-l-2 bg-card overflow-hidden max-w-[400px]',
        borderColor
      )}
      style={{ borderLeftColor: isComplete ? (success ? '#22c55e' : '#ef4444') : '#eab308' }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center px-2 py-1 hover:bg-muted/50 transition-colors"
      >
        <span className={statusColor}>{statusIcon}</span>
        <span className="ml-1.5 text-sm font-medium">{toolName}</span>
        <span className="flex-1 ml-2 text-xs text-muted-foreground truncate text-left">
          {desc}
        </span>
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {cmd && !isExpanded && (
        <div className="px-2 pb-1">
          <p className="text-xs text-muted-foreground/50 truncate">
            {cmd}
          </p>
        </div>
      )}

      <Collapsible expanded={isExpanded}>
        <div className="px-2 pb-2 border-t border-border mt-1 pt-1">
          {cmd && (
            <p className="text-xs mb-2 select-text">
              {cmd}
            </p>
          )}

          {toolInput && (
            <div className="mb-2">
              <p className="text-xs text-muted-foreground/50 mb-0.5">Input:</p>
              <p className="text-xs text-muted-foreground/70 select-text whitespace-pre-wrap">
                {JSON.stringify(toolInput, null, 2)}
              </p>
            </div>
          )}

          {isComplete && cleanedOutput !== undefined && (
            <div>
              <p className="text-xs text-muted-foreground/50 mb-0.5">Output:</p>
              <p className="text-xs text-muted-foreground/70 select-text whitespace-pre-wrap">
                {typeof cleanedOutput === 'string'
                  ? cleanedOutput.length > 500
                    ? cleanedOutput.substring(0, 500) + '...'
                    : cleanedOutput
                  : JSON.stringify(cleanedOutput, null, 2)}
              </p>
            </div>
          )}
        </div>
      </Collapsible>
    </div>
  );
}
