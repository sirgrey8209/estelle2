import { useState, useCallback, useRef, useEffect, ChangeEvent } from 'react';
import { Plus, Send, Square, Loader2, X, Image as ImageIcon, Camera, File as FileIcon } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useWorkspaceStore, useCurrentConversationState } from '../../stores';
import { useImageUploadStore, AttachedImage } from '../../stores/imageUploadStore';
import { AutoResizeTextInput } from '../common/AutoResizeTextInput';
import { useResponsive } from '../../hooks/useResponsive';

// 대화별 입력 텍스트 저장소 (conversationId → draft text)
const draftTexts = new Map<number, string>();

interface InputBarProps {
  disabled?: boolean;
  onSend?: (text: string, attachments?: AttachedImage[]) => void;
  onStop?: () => void;
}

/**
 * 입력 바
 */
export function InputBar({ disabled = false, onSend, onStop }: InputBarProps) {
  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generalFileInputRef = useRef<HTMLInputElement>(null);
  const prevConversationIdRef = useRef<number | null>(null);

  const { selectedConversation } = useWorkspaceStore();
  // conversationStore에서 현재 대화의 status 가져오기
  const currentState = useCurrentConversationState();
  const status = currentState?.status ?? 'idle';
  const { attachedImage, setAttachedImage, hasActiveUpload } = useImageUploadStore();
  const { isDesktop, isTablet } = useResponsive();

  const conversationId = selectedConversation?.conversationId || null;

  // 대화 변경 시 텍스트 저장/복원
  useEffect(() => {
    const prevId = prevConversationIdRef.current;

    // 이전 대화의 텍스트 저장
    if (prevId && prevId !== conversationId) {
      if (text.trim()) {
        draftTexts.set(prevId, text);
      } else {
        draftTexts.delete(prevId);
      }
    }

    // 새 대화의 텍스트 복원
    if (conversationId) {
      const savedText = draftTexts.get(conversationId) || '';
      setText(savedText);
    } else {
      setText('');
    }

    prevConversationIdRef.current = conversationId;
  }, [conversationId]); // text는 의존성에서 제외 (무한 루프 방지)

  const isWorking = status === 'working';
  const canSend = (text.trim() || attachedImage) && !disabled && !isWorking;

  const handleSend = useCallback(() => {
    if (!canSend || !selectedConversation) return;

    if (hasActiveUpload) {
      return;
    }

    const attachments = attachedImage ? [attachedImage] : undefined;
    onSend?.(text.trim(), attachments);
    setText('');
    setAttachedImage(null);
    // 전송 후 draft 삭제
    if (conversationId) {
      draftTexts.delete(conversationId);
    }
  }, [canSend, selectedConversation, hasActiveUpload, attachedImage, text, onSend, setAttachedImage, conversationId]);

  const handleStop = () => {
    onStop?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (isDesktop || isTablet) {
        // 데스크탑/태블릿: Enter = 전송, Shift+Enter / Ctrl+Enter = 줄바꿈
        if (!e.shiftKey && !e.ctrlKey) {
          e.preventDefault();
          handleSend();
        }
      }
      // 모바일: Enter = 줄바꿈 (기본 동작), 전송은 Send 버튼으로
    }
  };

  // 붙여넣기: 클립보드 이미지 또는 대용량 텍스트 → 파일 첨부
  const PASTE_TEXT_THRESHOLD = 1024; // 1KB 이상이면 파일 첨부로 전환

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // 1. 클립보드 이미지 확인
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;

        const ext = file.type.split('/')[1] || 'png';
        const filename = `clipboard-${Date.now()}.${ext}`;
        const uri = URL.createObjectURL(file);
        setAttachedImage({
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          uri,
          fileName: filename,
          file,
          mimeType: file.type,
        });
        return;
      }
    }

    // 2. 대용량 텍스트 확인
    const pastedText = e.clipboardData.getData('text/plain');
    if (pastedText && new Blob([pastedText]).size >= PASTE_TEXT_THRESHOLD) {
      e.preventDefault();
      const blob = new Blob([pastedText], { type: 'text/plain' });
      const file = new File([blob], `pasted-${Date.now()}.txt`, { type: 'text/plain' });
      const uri = URL.createObjectURL(file);
      setAttachedImage({
        id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        uri,
        fileName: file.name,
        file,
        mimeType: 'text/plain',
      });
    }
  }, [setAttachedImage]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const uri = URL.createObjectURL(file);
      setAttachedImage({
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        uri,
        fileName: file.name,
        file,
        mimeType: file.type || 'application/octet-stream',
      });
    }
    setShowAttachMenu(false);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (generalFileInputRef.current) {
      generalFileInputRef.current.value = '';
    }
  };

  const removeAttachment = () => {
    if (attachedImage?.uri) {
      URL.revokeObjectURL(attachedImage.uri);
    }
    setAttachedImage(null);
  };

  return (
    <div className="bg-secondary/30">
      {/* 첨부 파일 미리보기 */}
      {attachedImage && (
        <div className="flex items-center px-2 pt-2 bg-muted/50">
          <div className="relative">
            {attachedImage.mimeType?.startsWith('image/') ? (
              <img
                src={attachedImage.uri}
                alt={attachedImage.fileName}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex flex-col items-center justify-center border border-border">
                <span className="text-2xl">📄</span>
              </div>
            )}
            <button
              onClick={removeAttachment}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <span className="ml-2 flex-1 text-xs text-muted-foreground truncate">
            {attachedImage.fileName}
          </span>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="flex items-end px-2 py-1.5 gap-1">
        {/* 첨부 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowAttachMenu(true)}
          disabled={isWorking}
          className="h-8 w-8 shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>

        {/* 텍스트 입력 */}
        <AutoResizeTextInput
          placeholder={disabled ? '대기 중...' : '메시지를 입력하세요...'}
          value={text}
          onChange={setText}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled || isWorking}
          minRows={1}
          maxRows={6}
          className="flex-1 bg-background rounded-lg px-3 py-2 text-sm resize-none"
        />

        {/* 버튼 영역 */}
        {isWorking ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleStop}
            className="h-8"
          >
            <Square className="h-3 w-3 mr-1" />
            Stop
          </Button>
        ) : hasActiveUpload ? (
          <Button
            variant="ghost"
            size="icon"
            disabled
            className="h-8 w-8"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="icon"
            onClick={handleSend}
            disabled={!canSend}
            className="h-8 w-8"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 첨부 메뉴 다이얼로그 */}
      <Dialog open={showAttachMenu} onOpenChange={setShowAttachMenu}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>파일 첨부</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <ImageIcon className="h-5 w-5" />
              <span>갤러리에서 선택</span>
            </button>
            <button
              onClick={() => {
                // Web에서 카메라 접근은 제한적
                fileInputRef.current?.click();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <Camera className="h-5 w-5" />
              <span>카메라 촬영</span>
            </button>
            <button
              onClick={() => generalFileInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
            >
              <FileIcon className="h-5 w-5" />
              <span>파일 선택</span>
            </button>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="ghost" onClick={() => setShowAttachMenu(false)}>
              취소
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 숨겨진 파일 입력 (이미지) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* 숨겨진 파일 입력 (모든 파일) */}
      <input
        ref={generalFileInputRef}
        type="file"
        accept="*/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
