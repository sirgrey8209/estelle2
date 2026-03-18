# Voice Input Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Chrome 모바일에서 push-to-talk 방식 음성 입력 기능 추가

**Architecture:** `useSpeechRecognition` 커스텀 훅이 Web Speech API를 래핑. `InputBar.tsx`의 `+` 메뉴에 토글 추가, 토글 ON 시 왼쪽에 마이크 버튼 표시. 길게 누르면 녹음, 손 떼면 텍스트 변환 후 입력창에 이어붙임.

**Tech Stack:** Web Speech API (`webkitSpeechRecognition`), React hooks, localStorage, Tailwind CSS

**Design doc:** `docs/plans/2026-03-18-voice-input-design.md`

---

### Task 1: useSpeechRecognition 훅 — 테스트 작성

**Files:**
- Create: `packages/client/src/hooks/useSpeechRecognition.test.ts`

**Step 1: Write the test file**

```typescript
/**
 * @file useSpeechRecognition.test.ts
 * @description Web Speech API 래핑 훅 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechRecognition } from './useSpeechRecognition';

// Mock SpeechRecognition
class MockSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;

  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;

  start = vi.fn(() => {
    Promise.resolve().then(() => this.onstart?.());
  });

  stop = vi.fn(() => {
    Promise.resolve().then(() => this.onend?.());
  });

  abort = vi.fn();

  // Test helpers
  simulateResult(transcript: string, isFinal = true) {
    this.onresult?.({
      resultIndex: 0,
      results: {
        length: 1,
        0: { isFinal, 0: { transcript } },
      },
    });
  }

  simulateError(error: string) {
    this.onerror?.({ error });
  }
}

let lastMockInstance: MockSpeechRecognition | null = null;

beforeEach(() => {
  lastMockInstance = null;
  (window as any).webkitSpeechRecognition = vi.fn(() => {
    lastMockInstance = new MockSpeechRecognition();
    return lastMockInstance;
  });
});

afterEach(() => {
  delete (window as any).webkitSpeechRecognition;
  lastMockInstance = null;
});

describe('useSpeechRecognition', () => {
  describe('isSupported', () => {
    it('webkitSpeechRecognition이 있으면 true', () => {
      const { result } = renderHook(() => useSpeechRecognition());
      expect(result.current.isSupported).toBe(true);
    });

    it('SpeechRecognition이 없으면 false', () => {
      delete (window as any).webkitSpeechRecognition;
      const { result } = renderHook(() => useSpeechRecognition());
      expect(result.current.isSupported).toBe(false);
    });
  });

  describe('start/stop', () => {
    it('start 호출 시 isListening이 true', async () => {
      const { result } = renderHook(() => useSpeechRecognition());

      await act(async () => {
        result.current.start();
        await Promise.resolve();
      });

      expect(result.current.isListening).toBe(true);
    });

    it('stop 호출 시 isListening이 false', async () => {
      const { result } = renderHook(() => useSpeechRecognition());

      await act(async () => {
        result.current.start();
        await Promise.resolve();
      });
      expect(result.current.isListening).toBe(true);

      await act(async () => {
        result.current.stop();
        await Promise.resolve();
      });
      expect(result.current.isListening).toBe(false);
    });

    it('기본 lang은 ko-KR', async () => {
      const { result } = renderHook(() => useSpeechRecognition());

      await act(async () => {
        result.current.start();
        await Promise.resolve();
      });

      expect(lastMockInstance?.lang).toBe('ko-KR');
    });

    it('lang 옵션 적용', async () => {
      const { result } = renderHook(() =>
        useSpeechRecognition({ lang: 'en-US' })
      );

      await act(async () => {
        result.current.start();
        await Promise.resolve();
      });

      expect(lastMockInstance?.lang).toBe('en-US');
    });
  });

  describe('onResult', () => {
    it('최종 결과가 오면 onResult 호출', async () => {
      const onResult = vi.fn();
      const { result } = renderHook(() =>
        useSpeechRecognition({ onResult })
      );

      await act(async () => {
        result.current.start();
        await Promise.resolve();
      });

      act(() => {
        lastMockInstance?.simulateResult('안녕하세요');
      });

      expect(onResult).toHaveBeenCalledWith('안녕하세요');
    });

    it('비최종 결과는 onResult 호출 안 함', async () => {
      const onResult = vi.fn();
      const { result } = renderHook(() =>
        useSpeechRecognition({ onResult })
      );

      await act(async () => {
        result.current.start();
        await Promise.resolve();
      });

      act(() => {
        lastMockInstance?.simulateResult('안녕', false);
      });

      expect(onResult).not.toHaveBeenCalled();
    });
  });

  describe('onError', () => {
    it('인식 에러 시 onError 호출', async () => {
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useSpeechRecognition({ onError })
      );

      await act(async () => {
        result.current.start();
        await Promise.resolve();
      });

      act(() => {
        lastMockInstance?.simulateError('not-allowed');
      });

      expect(onError).toHaveBeenCalledWith('not-allowed');
    });

    it('no-speech는 에러로 취급하지 않음', async () => {
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useSpeechRecognition({ onError })
      );

      await act(async () => {
        result.current.start();
        await Promise.resolve();
      });

      act(() => {
        lastMockInstance?.simulateError('no-speech');
      });

      expect(onError).not.toHaveBeenCalled();
    });

    it('미지원 환경에서 start 호출 시 onError', () => {
      delete (window as any).webkitSpeechRecognition;
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useSpeechRecognition({ onError })
      );

      act(() => {
        result.current.start();
      });

      expect(onError).toHaveBeenCalledWith('Speech recognition is not supported');
    });
  });

  describe('cleanup', () => {
    it('언마운트 시 recognition abort', async () => {
      const { result, unmount } = renderHook(() => useSpeechRecognition());

      await act(async () => {
        result.current.start();
        await Promise.resolve();
      });

      const instance = lastMockInstance;
      unmount();

      expect(instance?.abort).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/client && npx vitest run src/hooks/useSpeechRecognition.test.ts`
Expected: FAIL — `useSpeechRecognition` 모듈을 찾을 수 없음

---

### Task 2: useSpeechRecognition 훅 — 구현

**Files:**
- Create: `packages/client/src/hooks/useSpeechRecognition.ts`

**Step 1: Write the hook implementation**

```typescript
/**
 * @file useSpeechRecognition.ts
 * @description Web Speech API (Chrome) push-to-talk 훅
 *
 * Chrome 모바일 전용. webkitSpeechRecognition을 래핑하여
 * start/stop 인터페이스와 결과 콜백을 제공합니다.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// Web Speech API types (Chrome)
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

interface UseSpeechRecognitionOptions {
  /** 인식 언어 (기본: 'ko-KR') */
  lang?: string;
  /** 최종 결과 콜백 */
  onResult?: (transcript: string) => void;
  /** 에러 콜백 */
  onError?: (error: string) => void;
}

interface UseSpeechRecognitionReturn {
  /** 현재 녹음 중인지 */
  isListening: boolean;
  /** 브라우저 지원 여부 */
  isSupported: boolean;
  /** 녹음 시작 */
  start: () => void;
  /** 녹음 중지 */
  stop: () => void;
}

/**
 * Web Speech API push-to-talk 훅
 *
 * @example
 * const { isListening, start, stop } = useSpeechRecognition({
 *   onResult: (text) => appendToInput(text),
 * });
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { lang = 'ko-KR', onResult, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isSupported = typeof window !== 'undefined' && getSpeechRecognitionCtor() !== null;

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onError?.('Speech recognition is not supported');
      return;
    }

    // 이전 인스턴스 정리
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) {
        onResult?.(transcript);
      }
    };

    recognition.onerror = (event: { error: string }) => {
      // no-speech, aborted는 실질적 에러가 아님
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        onError?.(event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      onError?.('Failed to start speech recognition');
      setIsListening(false);
    }
  }, [lang, onResult, onError]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  return { isListening, isSupported, start, stop };
}
```

**Step 2: Run test to verify it passes**

Run: `cd packages/client && npx vitest run src/hooks/useSpeechRecognition.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add packages/client/src/hooks/useSpeechRecognition.ts packages/client/src/hooks/useSpeechRecognition.test.ts
git commit -m "feat: add useSpeechRecognition hook for push-to-talk voice input"
```

---

### Task 3: InputBar에 음성 입력 토글 + 마이크 버튼 추가

**Files:**
- Modify: `packages/client/src/components/chat/InputBar.tsx`

**Context:**
- 현재 InputBar 구조: `[ + ] [ 입력창 ] [ 전송 ]`
- 목표 구조: `[ 🎤 ] [ + ] [ 입력창 ] [ 전송 ]` (토글 ON 시)
- `+` 메뉴는 `Dialog` 컴포넌트로 구현됨 (라인 389-426)
- 기존 메뉴 항목: 갤러리, 카메라, 파일 (라인 394-418)
- `cn` 유틸: `../../lib/utils`에서 import 가능

**Step 1: Import 추가**

`InputBar.tsx` 라인 2에서 `Mic` 아이콘 추가:

```typescript
// before
import { Plus, Send, Square, Loader2, X, Image as ImageIcon, Camera, File as FileIcon } from 'lucide-react';

// after
import { Plus, Send, Square, Loader2, X, Image as ImageIcon, Camera, File as FileIcon, Mic } from 'lucide-react';
```

`useSpeechRecognition` import 추가 (라인 14 근처):

```typescript
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
```

`cn` import 추가:

```typescript
import { cn } from '../../lib/utils';
```

**Step 2: 컴포넌트 안에 음성 입력 상태 + 훅 추가**

`InputBar` 함수 내부, `const { isDesktop, isTablet } = useResponsive();` (라인 55) 바로 아래에 추가:

```typescript
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

  const { isListening, isSupported, start: startListening, stop: stopListening } = useSpeechRecognition({
    onResult: handleVoiceResult,
    onError: (error) => console.warn('[VoiceInput]', error),
  });
```

**Step 3: 마이크 버튼 추가 (입력 영역)**

`{/* 입력 영역 */}` div 안에서, `{/* 첨부 버튼 */}` (라인 331) **바로 앞에** 마이크 버튼 추가:

```tsx
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
            disabled={isWorking}
            className={cn(
              'h-10 w-10 shrink-0',
              isListening && 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
            )}
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
```

**Step 4: `+` 메뉴에 음성 입력 토글 추가**

`{/* 첨부 메뉴 다이얼로그 */}` 안의 `<div className="space-y-2">` 블록 끝에 (파일 선택 버튼 다음, `</div>` 전에) 토글 항목 추가:

```tsx
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
```

**Step 5: 빌드 확인**

Run: `cd packages/client && npx tsc --noEmit`
Expected: 에러 없음

**Step 6: 전체 테스트 확인**

Run: `cd packages/client && npx vitest run`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add packages/client/src/components/chat/InputBar.tsx
git commit -m "feat: add voice input toggle and mic button to InputBar"
```

---

### Task 4: 전체 검증

**Step 1: 빌드 확인**

Run: `cd packages/client && npx vite build`
Expected: 빌드 성공

**Step 2: 전체 테스트 확인**

Run: `cd packages/client && npx vitest run`
Expected: ALL PASS
