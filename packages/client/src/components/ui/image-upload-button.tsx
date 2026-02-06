import * as React from 'react';
import { ImagePlus } from 'lucide-react';
import { Button } from './button';
import type { SelectedImage } from '@/platform/useImagePicker';

export interface ImageUploadButtonProps {
  /** 이미지 선택 시 콜백 */
  onSelect: (image: SelectedImage) => void;
  /** 여러 이미지 선택 허용 */
  multiple?: boolean;
  /** 비활성화 */
  disabled?: boolean;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 이미지 업로드 버튼
 */
export function ImageUploadButton({
  onSelect,
  multiple = false,
  disabled = false,
  className,
}: ImageUploadButtonProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 첫 번째 파일만 처리 (multiple인 경우에도 일단 단일 처리)
    const file = files[0];
    const image: SelectedImage = {
      uri: URL.createObjectURL(file),
      fileName: file.name,
      mimeType: file.type,
      file,
    };

    onSelect(image);

    // 입력 초기화 (같은 파일 재선택 허용)
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={disabled}
        className={className}
        aria-label="이미지 첨부"
      >
        <ImagePlus className="h-5 w-5" />
      </Button>
    </>
  );
}
