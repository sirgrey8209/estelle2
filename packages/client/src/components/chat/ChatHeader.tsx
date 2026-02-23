import { useState, useRef, useEffect, useContext, useCallback } from 'react';
import { ArrowLeft, Check, X, FileText } from 'lucide-react';
import { MessageType } from '@estelle/core';
import { useWorkspaceStore, useDeviceConfigStore, useConversationStore } from '../../stores';
import { useResponsive } from '../../hooks/useResponsive';
import { SessionMenuButton } from '../common/SessionMenuButton';
import { BugReportDialog } from '../common/BugReportDialog';
import { ShareDialog } from '../share/ShareDialog';
import { MobileLayoutContext } from '../../layouts/MobileLayout';
import { getDeviceIcon } from '../../utils/device-icons';
import { setPermissionMode, renameConversation, deleteConversation, sendBugReport, sendClaudeControl, blobService, createShare, getWebSocket } from '../../services';
import { clearDraftText } from './InputBar';
import { Button } from '../ui/button';
import { FileViewer } from '../viewers/FileViewer';

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
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [viewingDocument, setViewingDocument] = useState<{ path: string; content: string | null } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { selectedConversation, updatePermissionMode } = useWorkspaceStore();
  const { getIcon } = useDeviceConfigStore();
  const { isDesktop } = useResponsive();
  const { openSidebar } = useContext(MobileLayoutContext);

  // 문서 클릭 핸들러
  const handleDocumentClick = useCallback((docPath: string) => {
    if (!selectedConversation) return;

    // 뷰어 열기 (로딩 상태)
    setViewingDocument({ path: docPath, content: null });

    // 파일 요청
    const unsubscribe = blobService.onDownloadComplete((event) => {
      if (event.filename === docPath || event.filename.endsWith(docPath.replace(/\\/g, '/'))) {
        const decoder = new TextDecoder('utf-8');
        const content = decoder.decode(event.bytes);
        setViewingDocument({ path: docPath, content });
        unsubscribe();
      }
    });

    // 절대경로 여부 확인 (Windows: C:\..., Unix: /...)
    const isAbsolute = /^[A-Za-z]:[\\/]/.test(docPath) || docPath.startsWith('/');
    const filePath = isAbsolute ? docPath : `${selectedConversation.workingDir}\\${docPath}`;

    blobService.requestFile({
      targetDeviceId: selectedConversation.pylonId,
      conversationId: selectedConversation.conversationId,
      filename: docPath,
      filePath,
    });
  }, [selectedConversation]);

  // 파일명 추출 헬퍼
  const getFilename = (path: string) => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
  };

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  // 대화가 바뀌면 편집 모드 해제
  useEffect(() => {
    setIsRenaming(false);
  }, [selectedConversation?.conversationId]);

  const startRename = useCallback(() => {
    if (!selectedConversation) return;
    setRenameValue(selectedConversation.conversationName);
    setIsRenaming(true);
  }, [selectedConversation]);

  const confirmRename = useCallback(() => {
    if (!selectedConversation) return;
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== selectedConversation.conversationName) {
      renameConversation(
        selectedConversation.conversationId,
        trimmed
      );
    }
    setIsRenaming(false);
  }, [selectedConversation, renameValue]);

  const cancelRename = useCallback(() => {
    setIsRenaming(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      confirmRename();
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  }, [confirmRename, cancelRename]);

  const handleDelete = useCallback(() => {
    if (!selectedConversation) return;
    deleteConversation(selectedConversation.conversationId);
    // 선택 해제
    useWorkspaceStore.getState().clearSelection();
    // conversationStore에서 대화 상태 삭제
    useConversationStore.getState().deleteConversation(selectedConversation.conversationId);
  }, [selectedConversation]);

  // 공유 핸들러
  const handleShare = useCallback(() => {
    if (!selectedConversation) return;

    setShowShareDialog(true);
    setShareLoading(true);
    setShareError(null);
    setShareUrl(null);

    // WebSocket 메시지 리스너
    const ws = getWebSocket();
    if (!ws) {
      setShareLoading(false);
      setShareError('서버에 연결되어 있지 않습니다.');
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === MessageType.SHARE_CREATE_RESULT) {
          ws.removeEventListener('message', handleMessage);
          setShareLoading(false);

          if (message.payload.success) {
            const shareId = message.payload.shareId;
            const url = `${window.location.origin}/share/${shareId}`;
            setShareUrl(url);
          } else {
            setShareError(message.payload.error || '공유 링크 생성에 실패했습니다.');
          }
        }
      } catch {
        // JSON 파싱 에러 무시
      }
    };

    ws.addEventListener('message', handleMessage);

    // 공유 요청 전송
    createShare(selectedConversation.conversationId);

    // 타임아웃 처리
    setTimeout(() => {
      ws.removeEventListener('message', handleMessage);
      if (shareLoading) {
        setShareLoading(false);
        setShareError('요청 시간이 초과되었습니다.');
      }
    }, 10000);
  }, [selectedConversation, shareLoading]);

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
          {isRenaming ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <input
                ref={inputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 min-w-0 px-2 py-0.5 text-sm font-semibold bg-background border border-primary/50 rounded outline-none"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-primary"
                onClick={confirmRename}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground"
                onClick={cancelRename}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* 세션 메뉴 */}
        {showSessionMenu && !isRenaming && (
          <SessionMenuButton
            permissionMode={selectedConversation.permissionMode}
            onPermissionModeChange={(mode) => {
              setPermissionMode(selectedConversation.conversationId, mode);
              updatePermissionMode(selectedConversation.conversationId, mode);
            }}
            onNewSession={() => {
              // 로컬 메시지 및 입력 draft 정리 (새 세션이므로 이전 히스토리 불필요)
              useConversationStore.getState().clearMessages(selectedConversation.conversationId);
              clearDraftText(selectedConversation.conversationId);
              sendClaudeControl(selectedConversation.conversationId, 'new_session');
            }}
            onShare={handleShare}
            onBugReport={() => setShowBugReport(true)}
            onRename={startRename}
            onDelete={handleDelete}
            conversationName={selectedConversation.conversationName}
          />
        )}
      </div>

      {/* 연결된 문서 칩 */}
      {selectedConversation.linkedDocuments.length > 0 && (
        <div className="px-3 py-1 bg-secondary/20 border-t border-border/30 flex items-center gap-1.5 overflow-x-auto">
          {selectedConversation.linkedDocuments.map((doc) => (
            <button
              key={doc.path}
              onClick={() => handleDocumentClick(doc.path)}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary/50 hover:bg-secondary/80 rounded text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title={doc.path}
            >
              <FileText className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{getFilename(doc.path)}</span>
            </button>
          ))}
        </div>
      )}

      {/* 버그 리포트 다이얼로그 */}
      <BugReportDialog
        open={showBugReport}
        onClose={() => setShowBugReport(false)}
        onSubmit={async (message) => {
          const sent = sendBugReport(
            message,
            selectedConversation?.conversationId,
            selectedConversation?.workspaceId ? Number(selectedConversation.workspaceId) : undefined
          );
          if (!sent) throw new Error('WebSocket 연결 안 됨');
        }}
      />

      {/* 공유 다이얼로그 */}
      <ShareDialog
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        shareUrl={shareUrl}
        isLoading={shareLoading}
        error={shareError}
      />

      {/* 문서 뷰어 */}
      {viewingDocument && (
        <FileViewer
          open={true}
          onClose={() => setViewingDocument(null)}
          file={{
            filename: getFilename(viewingDocument.path),
            size: viewingDocument.content?.length ?? 0,
            description: viewingDocument.path,
          }}
          content={viewingDocument.content}
        />
      )}
    </>
  );
}
