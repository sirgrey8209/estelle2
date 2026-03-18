import { useState, useCallback, useRef, useEffect, ChangeEvent, useMemo } from 'react';
import { Plus, Send, Square, Loader2, X, Image as ImageIcon, Camera, File as FileIcon, Mic } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useWorkspaceStore, useCurrentConversationState } from '../../stores';
import { useConversationStore, EMPTY_SLASH_COMMANDS } from '../../stores/conversationStore';
import { useImageUploadStore, AttachedImage } from '../../stores/imageUploadStore';
import { AutoResizeTextInput } from '../common/AutoResizeTextInput';
import { useResponsive } from '../../hooks/useResponsive';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { cn } from '../../lib/utils';
import { processFiles } from '../../utils/fileUtils';
import {
  parseSlashCommand,
  filterSlashCommandsByPrefix,
  useSlashAutocomplete,
  SlashAutocompletePopup,
} from './SlashAutocomplete';
import { requestSlashCommands } from '../../services/relaySender';

// 대화별 입력 텍스트 저장소 (conversationId → draft text)
const draftTexts = new Map<number, string>();

/**
 * 특정 대화의 draft 텍스트 삭제 (새 대화 생성 시 호출)
 */
export function clearDraftText(conversationId: number): void {
  draftTexts.delete(conversationId);
}

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
  const { attachedImages, addAttachedImage, removeAttachedImage, clearAttachedImages, hasActiveUpload } = useImageUploadStore();
  const { isDesktop, isTablet } = useResponsive();

  // 음성 입력
  const [voiceMode, setVoiceMode] = useState(() => {
    return localStorage.getItem('estelle:voiceInputEnabled') === 'true';
  });

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode((prev) => {
      const next = !prev;
      localStorage.setItem('estelle:voiceInputEnabled', String(next));
      return next;
    });
    setShowAttachMenu(false);
  }, []);

  const handleVoiceResult = useCallback((transcript: string) => {
    setText((prev) => {
      if (prev && !prev.endsWith(' ')) {
        return prev + ' ' + transcript;
      }
      return prev + transcript;
    });
  }, []);

  const handleVoiceError = useCallback((error: string) => {
    console.warn('[VoiceInput]', error);
  }, []);

  const { isListening, isSupported, start: startListening, stop: stopListening } = useSpeechRecognition({
    onResult: handleVoiceResult,
    onError: handleVoiceError,
  });

  const conversationId = selectedConversation?.conversationId || null;

  // 슬래시 자동완성
  const slashCommands = useConversationStore((state) =>
    conversationId ? state.getSlashCommands(conversationId) : EMPTY_SLASH_COMMANDS
  );
  const slashCommand = useMemo(() => parseSlashCommand(text), [text]);
  const filteredCommands = useMemo(
    () => (slashCommand.isSlashCommand ? filterSlashCommandsByPrefix(slashCommands, slashCommand.prefix) : []),
    [slashCommands, slashCommand]
  );

  // 슬래시 명령어 입력 시 Pylon에 목록 요청
  // - `/` 입력 시 한 번만 요청 (slashCommands가 비어있을 때)
  // - 대화가 바뀌면 다시 요청
  const slashCommandsRequestedRef = useRef<number | null>(null);

  useEffect(() => {
    if (slashCommand.isSlashCommand && conversationId) {
      // 현재 대화에서 아직 요청하지 않았고, slashCommands가 비어있으면 요청
      if (slashCommandsRequestedRef.current !== conversationId && slashCommands.length === 0) {
        console.log('[InputBar] Requesting slash commands for conversation:', conversationId);
        requestSlashCommands(conversationId);
        slashCommandsRequestedRef.current = conversationId;
      }
    }
  }, [slashCommand.isSlashCommand, conversationId, slashCommands.length]);

  // 대화 변경 시 요청 상태 리셋
  useEffect(() => {
    if (conversationId !== slashCommandsRequestedRef.current) {
      slashCommandsRequestedRef.current = null;
    }
  }, [conversationId]);

  // DEBUG: 슬래시 명령어 디버깅
  useEffect(() => {
    if (slashCommand.isSlashCommand) {
      console.log('[InputBar] slash command:', { text, slashCommand, slashCommands: slashCommands.length, filteredCommands });
    }
  }, [text, slashCommand, slashCommands, filteredCommands]);
  const {
    selectedIndex,
    moveUp,
    moveDown,
    reset: resetAutocomplete,
  } = useSlashAutocomplete(filteredCommands.length);

  const showAutocomplete = slashCommand.isSlashCommand && filteredCommands.length > 0;

  // 슬래시 명령어 선택 시 입력창에 삽입
  // 기존 텍스트에서 슬래시 명령어 부분만 교체
  const handleSelectCommand = useCallback((command: string) => {
    // text에서 slashCommand.prefix 위치를 찾아서 교체
    const prefixIndex = text.lastIndexOf(slashCommand.prefix);
    if (prefixIndex !== -1) {
      const before = text.slice(0, prefixIndex);
      setText(`${before}${command} `);
    } else {
      setText(`${command} `);
    }
    resetAutocomplete();
  }, [text, slashCommand.prefix, resetAutocomplete]);

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
  const canSend = (text.trim() || attachedImages.length > 0) && !disabled && !isWorking;

  const handleSend = useCallback(() => {
    if (!canSend || !selectedConversation) return;

    if (hasActiveUpload) {
      return;
    }

    const attachments = attachedImages.length > 0 ? attachedImages : undefined;
    onSend?.(text.trim(), attachments);
    setText('');
    clearAttachedImages();
    // 전송 후 draft 삭제
    if (conversationId) {
      draftTexts.delete(conversationId);
    }
  }, [canSend, selectedConversation, hasActiveUpload, attachedImages, text, onSend, clearAttachedImages, conversationId]);

  const handleStop = () => {
    onStop?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 자동완성 팝업이 열려있을 때 키보드 처리
    if (showAutocomplete) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          moveDown();
          return;
        case 'ArrowUp':
          e.preventDefault();
          moveUp();
          return;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            handleSelectCommand(filteredCommands[selectedIndex]);
          }
          return;
        case 'Escape':
          e.preventDefault();
          setText(''); // 슬래시 명령어 취소
          return;
        case 'Tab':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            handleSelectCommand(filteredCommands[selectedIndex]);
          }
          return;
      }
    }

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

  // 붙여넣기: 클립보드 파일, 이미지, 대용량 텍스트 → 파일 첨부
  const PASTE_TEXT_THRESHOLD = 1024; // 1KB 이상이면 파일 첨부로 전환

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // 1. 클립보드에서 파일 수집 (이미지 포함)
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          // 클립보드 이미지는 파일명이 'image.png' 등으로 고정되므로 타임스탬프 추가
          if (item.type.startsWith('image/') && file.name === 'image.png') {
            const ext = file.type.split('/')[1] || 'png';
            const newFile = new File([file], `clipboard-${Date.now()}.${ext}`, { type: file.type });
            files.push(newFile);
          } else {
            files.push(file);
          }
        }
      }
    }

    // 파일이 있으면 첨부
    if (files.length > 0) {
      e.preventDefault();
      const attachedFiles = processFiles(files);
      for (const attached of attachedFiles) {
        addAttachedImage(attached);
      }
      return;
    }

    // 2. 대용량 텍스트 확인
    const pastedText = e.clipboardData.getData('text/plain');
    if (pastedText && new Blob([pastedText]).size >= PASTE_TEXT_THRESHOLD) {
      e.preventDefault();
      const blob = new Blob([pastedText], { type: 'text/plain' });
      const file = new File([blob], `pasted-${Date.now()}.txt`, { type: 'text/plain' });
      const attachedFiles = processFiles([file]);
      for (const attached of attachedFiles) {
        addAttachedImage(attached);
      }
    }
  }, [addAttachedImage]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const attachedFiles = processFiles(files);
      for (const attached of attachedFiles) {
        addAttachedImage(attached);
      }
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

  const removeAttachment = (id: string) => {
    const attachment = attachedImages.find((a) => a.id === id);
    if (attachment?.uri) {
      URL.revokeObjectURL(attachment.uri);
    }
    removeAttachedImage(id);
  };

  return (
    <div className="bg-secondary/30">
      {/* 첨부 파일 미리보기 (멀티 파일 지원) */}
      {attachedImages.length > 0 && (
        <div className="flex flex-wrap gap-2 px-2 pt-2 bg-muted/50">
          {attachedImages.map((attachment) => (
            <div key={attachment.id} className="relative group">
              {attachment.mimeType?.startsWith('image/') ? (
                <img
                  src={attachment.uri}
                  alt={attachment.fileName}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-muted flex flex-col items-center justify-center border border-border">
                  <span className="text-2xl">📄</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-14 px-1">
                    {attachment.fileName.split('.').pop()?.toUpperCase() || 'FILE'}
                  </span>
                </div>
              )}
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-80 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
              {/* 파일명 툴팁 */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] truncate px-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                {attachment.fileName}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 입력 영역 */}
      <div className="relative flex items-end px-2 py-1.5 gap-1">
        {/* 슬래시 자동완성 팝업 */}
        <SlashAutocompletePopup
          commands={filteredCommands}
          selectedIndex={selectedIndex}
          onSelect={handleSelectCommand}
          visible={showAutocomplete}
        />
        {/* 음성 입력 버튼 (토글 ON 시) */}
        {voiceMode && isSupported && (
          <Button
            variant={isListening ? 'default' : 'ghost'}
            size="icon"
            onTouchStart={(e) => {
              e.preventDefault();
              startListening();
            }}
            onTouchEnd={() => stopListening()}
            onMouseDown={() => startListening()}
            onMouseUp={() => stopListening()}
            onMouseLeave={() => { if (isListening) stopListening(); }}
            disabled={isWorking}
            className={cn(
              'h-10 w-10 shrink-0',
              isListening && 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
            )}
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
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
            {/* 음성 입력 토글 */}
            {isSupported && (
              <>
                <div className="border-t my-1" />
                <button
                  onClick={toggleVoiceMode}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <Mic className="h-5 w-5" />
                  <span>음성 입력</span>
                  <span className={cn(
                    'ml-auto text-xs px-2 py-0.5 rounded-full',
                    voiceMode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {voiceMode ? 'ON' : 'OFF'}
                  </span>
                </button>
              </>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="ghost" onClick={() => setShowAttachMenu(false)}>
              취소
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 숨겨진 파일 입력 (이미지, 멀티 선택) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* 숨겨진 파일 입력 (모든 파일, 멀티 선택) */}
      <input
        ref={generalFileInputRef}
        type="file"
        accept="*/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
