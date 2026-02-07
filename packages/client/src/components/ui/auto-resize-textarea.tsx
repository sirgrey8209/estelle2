import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AutoResizeTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  /** 최대 행 수 */
  maxRows?: number;
  /** 최소 행 수 */
  minRows?: number;
  /** 값 변경 핸들러 (문자열) */
  onChange?: (value: string) => void;
  /** 이벤트 핸들러 (네이티브) */
  onChangeEvent?: React.ChangeEventHandler<HTMLTextAreaElement>;
}

/**
 * 자동 높이 조절 textarea
 */
const AutoResizeTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoResizeTextareaProps
>(({ className, maxRows = 6, minRows = 1, onChange, onChangeEvent, value, ...props }, ref) => {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const lineHeight = 24; // 대략적인 line-height (px)

  const setRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref]
  );

  const adjustHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // 높이 초기화 후 scrollHeight로 재계산
    textarea.style.height = 'auto';

    const minHeight = minRows * lineHeight;
    const maxHeight = maxRows * lineHeight;
    const scrollHeight = textarea.scrollHeight;

    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;

    // 내용이 maxHeight를 넘을 때만 스크롤바 표시
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [maxRows, minRows]);

  // 값 변경 시 높이 조절
  React.useLayoutEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e.target.value);
      onChangeEvent?.(e);
      adjustHeight();
    },
    [onChange, onChangeEvent, adjustHeight]
  );

  return (
    <textarea
      ref={setRef}
      className={cn(
        'flex w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className
      )}
      value={value}
      onChange={handleChange}
      rows={minRows}
      style={{
        minHeight: `${minRows * lineHeight}px`,
        maxHeight: `${maxRows * lineHeight}px`,
        overflowY: 'hidden', // adjustHeight에서 동적으로 변경
      }}
      {...props}
    />
  );
});

AutoResizeTextarea.displayName = 'AutoResizeTextarea';

export { AutoResizeTextarea };
