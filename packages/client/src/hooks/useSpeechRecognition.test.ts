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

  describe('interimTranscript', () => {
    it('비최종 결과가 오면 interimTranscript 업데이트', async () => {
      const { result } = renderHook(() => useSpeechRecognition());

      await act(async () => {
        result.current.start();
        await Promise.resolve();
      });

      act(() => {
        lastMockInstance?.simulateResult('안녕하', false);
      });

      expect(result.current.interimTranscript).toBe('안녕하');
    });

    it('최종 결과가 오면 interimTranscript 비워짐', async () => {
      const onResult = vi.fn();
      const { result } = renderHook(() =>
        useSpeechRecognition({ onResult })
      );

      await act(async () => {
        result.current.start();
        await Promise.resolve();
      });

      // 먼저 중간 결과
      act(() => {
        lastMockInstance?.simulateResult('안녕하', false);
      });
      expect(result.current.interimTranscript).toBe('안녕하');

      // 최종 결과
      act(() => {
        lastMockInstance?.simulateResult('안녕하세요');
      });
      expect(result.current.interimTranscript).toBe('');
      expect(onResult).toHaveBeenCalledWith('안녕하세요');
    });

    it('stop 후 interimTranscript 비워짐', async () => {
      const { result } = renderHook(() => useSpeechRecognition());

      await act(async () => {
        result.current.start();
        await Promise.resolve();
      });

      act(() => {
        lastMockInstance?.simulateResult('테스트', false);
      });
      expect(result.current.interimTranscript).toBe('테스트');

      await act(async () => {
        result.current.stop();
        await Promise.resolve();
      });
      expect(result.current.interimTranscript).toBe('');
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
