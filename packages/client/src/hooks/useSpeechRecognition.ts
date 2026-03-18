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
  /** 녹음 중 실시간 중간 결과 */
  interimTranscript: string;
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
  const [interimTranscript, setInterimTranscript] = useState('');
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
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimTranscript(interim);
      if (finalTranscript) {
        onResult?.(finalTranscript);
        setInterimTranscript('');
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
      setInterimTranscript('');
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

  return { isListening, isSupported, interimTranscript, start, stop };
}
