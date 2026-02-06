import { Button } from '../ui/button';
import { parseToolInput } from '../../utils/toolInputParser';
import type { PermissionRequest as PermissionRequestType } from '../../stores/claudeStore';

interface PermissionRequestProps {
  request: PermissionRequestType;
  onAllow?: () => void;
  onDeny?: () => void;
}

/**
 * 권한 요청 뷰
 */
export function PermissionRequest({
  request,
  onAllow,
  onDeny,
}: PermissionRequestProps) {
  const { desc, cmd } = parseToolInput(request.toolName, request.toolInput);

  return (
    <div className="py-2 bg-yellow-500/10">
      {/* ToolCard와 동일한 박스 스타일 */}
      <div className="my-0.5 ml-5 rounded border border-l-2 border-yellow-500 bg-card overflow-hidden max-w-[400px]">
        {/* 헤더: 권한 요청 툴네임 설명 */}
        <div className="flex items-center gap-1.5 px-2 py-1">
          <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
            권한 요청
          </span>
          <span className="font-medium">{request.toolName}</span>
          <span className="flex-1 text-xs text-muted-foreground truncate text-left">
            {desc}
          </span>
        </div>

        {/* 명령어 */}
        {cmd && (
          <p className="px-2 pb-2 text-xs text-muted-foreground select-text break-all">
            {cmd}
          </p>
        )}

        {/* 버튼: 허용 / 거부 */}
        <div className="flex gap-2 px-2 py-2">
          <Button
            onClick={onAllow}
            size="sm"
            tabIndex={-1}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white"
          >
            허용
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDeny}
            tabIndex={-1}
            className="flex-1 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            거부
          </Button>
        </div>
      </div>
    </div>
  );
}
