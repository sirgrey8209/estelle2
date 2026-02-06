import { useState, useContext } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useWorkspaceStore, useDeviceConfigStore } from '../../stores';
import { useResponsive } from '../../hooks/useResponsive';
import { SessionMenuButton } from '../common/SessionMenuButton';
import { BugReportDialog } from '../common/BugReportDialog';
import { MobileLayoutContext } from '../../layouts/MobileLayout';
import { getDeviceIcon } from '../../utils/device-icons';
import { setPermissionMode } from '../../services';

interface ChatHeaderProps {
  showSessionMenu?: boolean;
}

/**
 * 채팅 헤더
 *
 * - 워크스페이스/대화명
 * - StatusDot (상태 표시)
 * - SessionMenuButton (데스크탑에서)
 */
export function ChatHeader({ showSessionMenu = true }: ChatHeaderProps) {
  const [showBugReport, setShowBugReport] = useState(false);
  const { selectedConversation, updatePermissionMode } = useWorkspaceStore();
  const { getIcon } = useDeviceConfigStore();
  const { isDesktop } = useResponsive();
  const { openSidebar } = useContext(MobileLayoutContext);

  if (!selectedConversation) {
    return (
      <div className="px-3 py-1 bg-secondary/30 flex items-center">
        {/* 뒤로 가기 버튼 (모바일) */}
        {!isDesktop && (
          <button
            onClick={openSidebar}
            className="p-1.5 hover:bg-secondary/50 rounded transition-colors mr-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <span className="text-sm text-muted-foreground">
          워크스페이스를 선택하세요
        </span>
      </div>
    );
  }

  const pylonIconName = getIcon(selectedConversation.pylonId);
  const IconComponent = getDeviceIcon(pylonIconName);

  return (
    <>
      <div className="px-3 py-1 bg-secondary/30 flex items-center">
        {/* 뒤로 가기 버튼 (모바일) */}
        {!isDesktop && (
          <button
            onClick={openSidebar}
            className="p-1.5 hover:bg-secondary/50 rounded transition-colors mr-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        {/* 대화명 + 워크스페이스 */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="font-semibold truncate">
            {selectedConversation.conversationName}
          </span>

          {/* 워크스페이스 아이콘 + 이름 (작게) */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <IconComponent className="h-3 w-3 opacity-60" />
            <span className="text-xs truncate opacity-60">
              {selectedConversation.workspaceName}
            </span>
          </div>
        </div>

        {/* 세션 메뉴 */}
        {showSessionMenu && (
          <SessionMenuButton
            permissionMode={selectedConversation.permissionMode}
            onPermissionModeChange={(mode) => {
              setPermissionMode(selectedConversation.conversationId, mode);
              updatePermissionMode(selectedConversation.conversationId, mode);
            }}
            onBugReport={() => setShowBugReport(true)}
          />
        )}
      </div>

      {/* 버그 리포트 다이얼로그 */}
      <BugReportDialog
        open={showBugReport}
        onClose={() => setShowBugReport(false)}
      />
    </>
  );
}
