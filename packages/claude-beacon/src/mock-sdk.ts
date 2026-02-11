/**
 * @file mock-sdk.ts
 * @description MockSDK - ClaudeBeacon 테스트를 위한 Mock SDK
 *
 * 실제 Claude SDK의 이벤트 시퀀스를 재생하여 테스트할 수 있게 한다.
 *
 * 주요 이벤트:
 * - content_block_start (type: tool_use) - 도구 호출 시작
 * - content_block_delta - 도구 입력 스트리밍
 * - content_block_stop - 도구 호출 완료
 */

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * Tool Use 블록 시작 정보
 */
export interface ToolUseBlockStart {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Input JSON Delta
 */
export interface InputJsonDelta {
  type: 'input_json_delta';
  partial_json: string;
}

/**
 * Content Block Start 이벤트
 */
export interface ContentBlockStartEvent {
  type: 'content_block_start';
  index: number;
  content_block: ToolUseBlockStart;
}

/**
 * Content Block Delta 이벤트
 */
export interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  index: number;
  delta: InputJsonDelta;
}

/**
 * Content Block Stop 이벤트
 */
export interface ContentBlockStopEvent {
  type: 'content_block_stop';
  index: number;
}

/**
 * SDK 이벤트 유니온 타입
 */
export type SDKEvent = ContentBlockStartEvent | ContentBlockDeltaEvent | ContentBlockStopEvent;

/**
 * Tool Use Start 옵션
 */
export interface ToolUseStartOptions {
  id?: string;
  name: string;
  index?: number;
}

/**
 * Tool Use Delta 옵션
 */
export interface ToolUseDeltaOptions {
  index: number;
  partialJson: string;
}

/**
 * Tool Use Stop 옵션
 */
export interface ToolUseStopOptions {
  index: number;
}

/**
 * Tool Use Sequence 옵션
 */
export interface ToolUseSequenceOptions {
  id?: string;
  name: string;
  input: Record<string, unknown>;
  index?: number;
  chunkSize?: number;
}

/**
 * Replay 옵션
 */
export interface ReplayOptions {
  delayMs?: number;
}

/**
 * 로그 엔트리 타입
 */
export interface LogEntry {
  type: string;
  index?: number;
  content_block?: {
    type: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  };
  delta?: {
    type: string;
    partial_json?: string;
  };
}

// ============================================================================
// MockSDK 클래스
// ============================================================================

/**
 * MockSDK - Claude SDK 이벤트를 모킹하는 클래스
 *
 * 테스트를 위해 SDK 이벤트 시퀀스를 생성하고 재생할 수 있다.
 */
export class MockSDK {
  // ============================================================================
  // Private 필드
  // ============================================================================

  private _idCounter: number;

  // ============================================================================
  // 생성자
  // ============================================================================

  constructor() {
    this._idCounter = 0;
  }

  // ============================================================================
  // 이벤트 생성 메서드
  // ============================================================================

  /**
   * Tool Use Start 이벤트 생성
   */
  createToolUseStartEvent(options: ToolUseStartOptions): ContentBlockStartEvent {
    const id = options.id ?? this._generateToolUseId();
    const index = options.index ?? 0;

    return {
      type: 'content_block_start',
      index,
      content_block: {
        type: 'tool_use',
        id,
        name: options.name,
        input: {},
      },
    };
  }

  /**
   * Tool Use Delta 이벤트 생성
   */
  createToolUseDeltaEvent(options: ToolUseDeltaOptions): ContentBlockDeltaEvent {
    return {
      type: 'content_block_delta',
      index: options.index,
      delta: {
        type: 'input_json_delta',
        partial_json: options.partialJson,
      },
    };
  }

  /**
   * Tool Use Stop 이벤트 생성
   */
  createToolUseStopEvent(options: ToolUseStopOptions): ContentBlockStopEvent {
    return {
      type: 'content_block_stop',
      index: options.index,
    };
  }

  // ============================================================================
  // 시퀀스 생성 메서드
  // ============================================================================

  /**
   * 완전한 Tool Use 시퀀스 생성
   */
  createToolUseSequence(options: ToolUseSequenceOptions): SDKEvent[] {
    const id = options.id ?? this._generateToolUseId();
    const index = options.index ?? 0;
    const inputJson = JSON.stringify(options.input);
    const chunkSize = options.chunkSize ?? inputJson.length;

    const events: SDKEvent[] = [];

    // Start 이벤트 (기존 메서드 재사용)
    events.push(this.createToolUseStartEvent({ id, name: options.name, index }));

    // Delta 이벤트들 (입력을 청크로 분할)
    if (inputJson !== '{}') {
      for (let i = 0; i < inputJson.length; i += chunkSize) {
        const chunk = inputJson.slice(i, i + chunkSize);
        events.push({
          type: 'content_block_delta',
          index,
          delta: {
            type: 'input_json_delta',
            partial_json: chunk,
          },
        });
      }
    } else {
      // 빈 입력의 경우에도 delta 이벤트 추가 (일부 테스트는 최소 2개 기대)
      events.push({
        type: 'content_block_delta',
        index,
        delta: {
          type: 'input_json_delta',
          partial_json: '{}',
        },
      });
    }

    // Stop 이벤트
    events.push({
      type: 'content_block_stop',
      index,
    });

    return events;
  }

  /**
   * 여러 도구 호출의 시퀀스 생성
   */
  createMultiToolSequence(tools: Array<{ id?: string; name: string; input: Record<string, unknown> }>): SDKEvent[] {
    const events: SDKEvent[] = [];

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      const sequence = this.createToolUseSequence({
        id: tool.id,
        name: tool.name,
        input: tool.input,
        index: i,
      });
      events.push(...sequence);
    }

    return events;
  }

  // ============================================================================
  // 재생 메서드
  // ============================================================================

  /**
   * 이벤트 시퀀스 재생
   */
  async replay(
    events: SDKEvent[],
    callback: (event: SDKEvent) => void,
    options?: ReplayOptions
  ): Promise<void> {
    const delayMs = options?.delayMs ?? 0;

    for (let i = 0; i < events.length; i++) {
      callback(events[i]);

      if (delayMs > 0 && i < events.length - 1) {
        await this._delay(delayMs);
      }
    }
  }

  // ============================================================================
  // 로그 파싱 메서드
  // ============================================================================

  /**
   * 로그 엔트리에서 이벤트 생성
   */
  fromLogEntry(entry: LogEntry): SDKEvent {
    if (entry.type === 'content_block_start' && entry.content_block) {
      return {
        type: 'content_block_start',
        index: entry.index ?? 0,
        content_block: {
          type: 'tool_use',
          id: entry.content_block.id ?? '',
          name: entry.content_block.name ?? '',
          input: entry.content_block.input ?? {},
        },
      };
    }

    if (entry.type === 'content_block_delta' && entry.delta) {
      return {
        type: 'content_block_delta',
        index: entry.index ?? 0,
        delta: {
          type: 'input_json_delta',
          partial_json: entry.delta.partial_json ?? '',
        },
      };
    }

    // content_block_stop
    return {
      type: 'content_block_stop',
      index: entry.index ?? 0,
    };
  }

  /**
   * 여러 로그 엔트리에서 시퀀스 생성
   */
  fromLogEntries(entries: LogEntry[]): SDKEvent[] {
    return entries.map((entry) => this.fromLogEntry(entry));
  }

  // ============================================================================
  // Private 메서드
  // ============================================================================

  /**
   * Tool Use ID 생성
   */
  private _generateToolUseId(): string {
    this._idCounter++;
    const random = Math.random().toString(36).substring(2, 15);
    return `toolu_${random}${this._idCounter}`;
  }

  /**
   * 지연
   */
  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
