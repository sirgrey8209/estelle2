/**
 * @file SlashAutocomplete.tsx
 * @description 슬래시 명령어 자동완성 유틸리티 함수
 *
 * 슬래시 명령어 파싱 및 필터링 로직을 제공합니다.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '../../lib/utils';

// ============================================================================
// Types
// ============================================================================

/**
 * 슬래시 명령어 파싱 결과
 */
export interface SlashCommandResult {
  /** 슬래시 명령어 여부 */
  isSlashCommand: boolean;
  /** "/" 포함 전체 입력 (슬래시 명령어가 아니면 빈 문자열) */
  prefix: string;
  /** 슬래시 뒤의 명령어 부분 (슬래시 명령어가 아니면 빈 문자열) */
  command: string;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * 입력에서 슬래시 명령어 파싱
 *
 * 슬래시 명령어 조건:
 * 1. 텍스트 끝에서 공백 없이 "/" 로 시작하는 단어가 있어야 함
 * 2. "/" 뒤에 공백이 없어야 함 (명령어 뒤 공백 = 자동완성 종료)
 *
 * @param text - 입력 텍스트
 * @returns 슬래시 명령어 파싱 결과
 */
export function parseSlashCommand(text: string): SlashCommandResult {
  if (!text) {
    return {
      isSlashCommand: false,
      prefix: '',
      command: '',
    };
  }

  // 텍스트 끝에서 앞으로 탐색하여 "/" 또는 공백 찾기
  let slashIndex = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    const char = text[i];
    if (char === ' ' || char === '\n') {
      // 공백을 만나면 중단 (슬래시 명령어 없음)
      break;
    }
    if (char === '/') {
      slashIndex = i;
      break;
    }
  }

  // "/" 를 찾지 못함
  if (slashIndex === -1) {
    return {
      isSlashCommand: false,
      prefix: '',
      command: '',
    };
  }

  // "/" 부터 끝까지 추출
  const prefix = text.slice(slashIndex);

  // 슬래시 명령어
  return {
    isSlashCommand: true,
    prefix,
    command: prefix.slice(1), // "/" 제거
  };
}

/**
 * 슬래시 명령어 목록에서 prefix로 필터링
 *
 * @param commands - 슬래시 명령어 목록 (예: ["/compact", "/clear", "/tdd-flow"])
 * @param prefix - 사용자 입력 (예: "/", "/tdd")
 * @returns 필터링된 명령어 목록
 */
export function filterSlashCommandsByPrefix(commands: string[], prefix: string): string[] {
  // 슬래시로 시작하지 않으면 빈 배열
  if (!prefix.startsWith('/')) {
    return [];
  }

  // "/" 만 있으면 전체 목록 반환
  if (prefix === '/') {
    return commands;
  }

  // 공백이 포함되어 있으면 빈 배열 (정확히 일치하는 것도 없음)
  if (prefix.includes(' ')) {
    return [];
  }

  // 소문자로 변환하여 비교
  const searchTerm = prefix.toLowerCase();

  // 대소문자 무시하고 prefix로 필터링
  return commands.filter((cmd) =>
    cmd.toLowerCase().startsWith(searchTerm)
  );
}

// ============================================================================
// Hook Types
// ============================================================================

/**
 * useSlashAutocomplete 훅 반환 타입
 */
export interface UseSlashAutocompleteResult {
  /** 현재 선택된 인덱스 */
  selectedIndex: number;
  /** 선택 인덱스 위로 이동 (0에서 마지막으로 순환) */
  moveUp: () => void;
  /** 선택 인덱스 아래로 이동 (마지막에서 0으로 순환) */
  moveDown: () => void;
  /** 선택 인덱스 0으로 초기화 */
  reset: () => void;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * 슬래시 자동완성 선택 인덱스 관리 훅
 *
 * @param itemCount - 항목 개수
 * @returns 선택 인덱스 및 조작 함수
 */
export function useSlashAutocomplete(itemCount: number): UseSlashAutocompleteResult {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // itemCount가 변경되면 인덱스 조정
  useEffect(() => {
    if (itemCount === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= itemCount) {
      setSelectedIndex(itemCount - 1);
    }
  }, [itemCount, selectedIndex]);

  const moveDown = useCallback(() => {
    if (itemCount === 0) return;
    setSelectedIndex((prev) => (prev + 1) % itemCount);
  }, [itemCount]);

  const moveUp = useCallback(() => {
    if (itemCount === 0) return;
    setSelectedIndex((prev) => (prev - 1 + itemCount) % itemCount);
  }, [itemCount]);

  const reset = useCallback(() => {
    setSelectedIndex(0);
  }, []);

  return {
    selectedIndex,
    moveUp,
    moveDown,
    reset,
  };
}

// ============================================================================
// Components
// ============================================================================

/**
 * SlashAutocompletePopup Props
 */
export interface SlashAutocompletePopupProps {
  /** 표시할 슬래시 명령어 목록 */
  commands: string[];
  /** 현재 선택된 인덱스 */
  selectedIndex: number;
  /** 항목 선택 시 콜백 */
  onSelect: (command: string) => void;
  /** 팝업 표시 여부 */
  visible: boolean;
}

/**
 * 슬래시 자동완성 팝업 컴포넌트
 *
 * 입력창 위에 표시되는 명령어 목록 드롭다운
 */
export function SlashAutocompletePopup({
  commands,
  selectedIndex,
  onSelect,
  visible,
}: SlashAutocompletePopupProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // 선택 항목이 변경되면 스크롤 조정
  useEffect(() => {
    if (visible && selectedRef.current) {
      selectedRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex, visible]);

  if (!visible || commands.length === 0) {
    return null;
  }

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 mb-1 max-h-48 min-w-[140px] max-w-[200px] overflow-y-auto rounded-lg border border-border bg-popover shadow-lg z-50"
    >
      {commands.map((command, index) => (
        <button
          key={command}
          ref={index === selectedIndex ? selectedRef : undefined}
          type="button"
          className={cn(
            'w-full px-3 py-1.5 text-left text-sm transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            index === selectedIndex && 'bg-accent text-accent-foreground'
          )}
          onClick={() => onSelect(command)}
          onMouseDown={(e) => e.preventDefault()} // 포커스 유지
        >
          <span className="font-mono text-xs">{command}</span>
        </button>
      ))}
    </div>
  );
}
