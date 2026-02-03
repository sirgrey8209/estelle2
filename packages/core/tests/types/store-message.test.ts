/**
 * @file store-message.test.ts
 * @description Core 패키지의 통합 StoreMessage 타입 테스트
 *
 * Pylon과 Client가 공유하는 메시지 타입을 정의합니다.
 * 이 테스트는 구현 전에 작성되어 FAILING 상태여야 합니다.
 */

import { describe, it, expect } from 'vitest';

// 존재하지 않는 타입/함수를 import (FAILING 테스트용)
import type {
  // 메시지 타입 리터럴
  StoreMessageType,

  // 기본 인터페이스
  BaseStoreMessage,

  // 첨부 관련 타입
  Attachment,
  FileInfo,
  ResultInfo,

  // 개별 메시지 타입들
  UserTextMessage,
  AssistantTextMessage,
  ToolStartMessage,
  ToolCompleteMessage,
  ErrorMessage,
  ResultMessage,
  AbortedMessage,
  FileAttachmentMessage,
  UserResponseMessage,

  // Union 타입
  StoreMessage,
} from '../../src/types/store-message.js';

import {
  // 타입 가드 함수들
  isUserTextMessage,
  isAssistantTextMessage,
  isToolStartMessage,
  isToolCompleteMessage,
  isStoreErrorMessage,
  isResultMessage,
  isAbortedMessage,
  isFileAttachmentMessage,
  isUserResponseMessage,
  isStoreMessage,
} from '../../src/types/store-message.js';

// ============================================================================
// StoreMessageType 테스트
// ============================================================================

describe('StoreMessageType', () => {
  it('should_have_all_required_message_types', () => {
    // Arrange & Act
    const expectedTypes: StoreMessageType[] = [
      'text',
      'tool_start',
      'tool_complete',
      'error',
      'result',
      'aborted',
      'file_attachment',
      'user_response',
    ];

    // Assert
    expect(expectedTypes).toHaveLength(8);
    expectedTypes.forEach((type) => {
      expect(typeof type).toBe('string');
    });
  });
});

// ============================================================================
// BaseStoreMessage 테스트
// ============================================================================

describe('BaseStoreMessage', () => {
  it('should_have_required_fields', () => {
    // Arrange
    const base: BaseStoreMessage = {
      id: 'msg-001',
      role: 'user',
      type: 'text',
      timestamp: Date.now(),
    };

    // Assert
    expect(base.id).toBe('msg-001');
    expect(base.role).toBe('user');
    expect(base.type).toBe('text');
    expect(typeof base.timestamp).toBe('number');
  });

  it('should_accept_all_role_values', () => {
    // Arrange
    const roles: Array<'user' | 'assistant' | 'system'> = ['user', 'assistant', 'system'];

    // Act & Assert
    roles.forEach((role) => {
      const msg: BaseStoreMessage = {
        id: `msg-${role}`,
        role,
        type: 'text',
        timestamp: Date.now(),
      };
      expect(msg.role).toBe(role);
    });
  });
});

// ============================================================================
// Attachment 타입 테스트
// ============================================================================

describe('Attachment', () => {
  it('should_have_required_fields', () => {
    // Arrange
    const attachment: Attachment = {
      filename: 'image.png',
      path: '/uploads/image.png',
    };

    // Assert
    expect(attachment.filename).toBe('image.png');
    expect(attachment.path).toBe('/uploads/image.png');
  });

  it('should_support_optional_thumbnail', () => {
    // Arrange
    const attachment: Attachment = {
      filename: 'photo.jpg',
      path: '/uploads/photo.jpg',
      thumbnail: 'data:image/jpeg;base64,/9j/4AAQSkZ...',
    };

    // Assert
    expect(attachment.thumbnail).toBeDefined();
  });
});

// ============================================================================
// FileInfo 타입 테스트
// ============================================================================

describe('FileInfo', () => {
  it('should_have_all_required_fields', () => {
    // Arrange
    const fileInfo: FileInfo = {
      path: '/tmp/output.md',
      filename: 'output.md',
      mimeType: 'text/markdown',
      fileType: 'markdown',
      size: 1024,
    };

    // Assert
    expect(fileInfo.path).toBe('/tmp/output.md');
    expect(fileInfo.filename).toBe('output.md');
    expect(fileInfo.mimeType).toBe('text/markdown');
    expect(fileInfo.fileType).toBe('markdown');
    expect(fileInfo.size).toBe(1024);
  });

  it('should_support_optional_description', () => {
    // Arrange
    const fileInfo: FileInfo = {
      path: '/tmp/result.png',
      filename: 'result.png',
      mimeType: 'image/png',
      fileType: 'image',
      size: 2048,
      description: 'Generated chart image',
    };

    // Assert
    expect(fileInfo.description).toBe('Generated chart image');
  });
});

// ============================================================================
// ResultInfo 타입 테스트
// ============================================================================

describe('ResultInfo', () => {
  it('should_have_all_token_and_duration_fields', () => {
    // Arrange
    const resultInfo: ResultInfo = {
      durationMs: 1500,
      inputTokens: 100,
      outputTokens: 200,
      cacheReadTokens: 50,
    };

    // Assert
    expect(resultInfo.durationMs).toBe(1500);
    expect(resultInfo.inputTokens).toBe(100);
    expect(resultInfo.outputTokens).toBe(200);
    expect(resultInfo.cacheReadTokens).toBe(50);
  });
});

// ============================================================================
// UserTextMessage 테스트
// ============================================================================

describe('UserTextMessage', () => {
  it('should_have_user_role_and_text_type', () => {
    // Arrange
    const msg: UserTextMessage = {
      id: 'user-msg-001',
      role: 'user',
      type: 'text',
      timestamp: Date.now(),
      content: 'Hello, Claude!',
    };

    // Assert
    expect(msg.role).toBe('user');
    expect(msg.type).toBe('text');
    expect(msg.content).toBe('Hello, Claude!');
  });

  it('should_support_attachments', () => {
    // Arrange
    const msg: UserTextMessage = {
      id: 'user-msg-002',
      role: 'user',
      type: 'text',
      timestamp: Date.now(),
      content: 'Check this image',
      attachments: [
        { filename: 'screenshot.png', path: '/uploads/screenshot.png' },
      ],
    };

    // Assert
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments![0].filename).toBe('screenshot.png');
  });

  it('should_handle_empty_content', () => {
    // Arrange
    const msg: UserTextMessage = {
      id: 'user-msg-003',
      role: 'user',
      type: 'text',
      timestamp: Date.now(),
      content: '',
    };

    // Assert
    expect(msg.content).toBe('');
  });

  it('should_handle_unicode_content', () => {
    // Arrange
    const msg: UserTextMessage = {
      id: 'user-msg-004',
      role: 'user',
      type: 'text',
      timestamp: Date.now(),
      content: '안녕하세요! 한글 메시지입니다.',
    };

    // Assert
    expect(msg.content).toBe('안녕하세요! 한글 메시지입니다.');
  });
});

// ============================================================================
// AssistantTextMessage 테스트
// ============================================================================

describe('AssistantTextMessage', () => {
  it('should_have_assistant_role_and_text_type', () => {
    // Arrange
    const msg: AssistantTextMessage = {
      id: 'asst-msg-001',
      role: 'assistant',
      type: 'text',
      timestamp: Date.now(),
      content: 'Hello! How can I help you?',
    };

    // Assert
    expect(msg.role).toBe('assistant');
    expect(msg.type).toBe('text');
    expect(msg.content).toBe('Hello! How can I help you?');
  });

  it('should_support_multiline_content', () => {
    // Arrange
    const multilineContent = `Line 1
Line 2
Line 3`;
    const msg: AssistantTextMessage = {
      id: 'asst-msg-002',
      role: 'assistant',
      type: 'text',
      timestamp: Date.now(),
      content: multilineContent,
    };

    // Assert
    expect(msg.content).toContain('\n');
    expect(msg.content.split('\n')).toHaveLength(3);
  });
});

// ============================================================================
// ToolStartMessage 테스트
// ============================================================================

describe('ToolStartMessage', () => {
  it('should_have_assistant_role_and_tool_start_type', () => {
    // Arrange
    const msg: ToolStartMessage = {
      id: 'tool-msg-001',
      role: 'assistant',
      type: 'tool_start',
      timestamp: Date.now(),
      toolName: 'Read',
      toolInput: { file_path: '/src/main.ts' },
    };

    // Assert
    expect(msg.role).toBe('assistant');
    expect(msg.type).toBe('tool_start');
    expect(msg.toolName).toBe('Read');
    expect(msg.toolInput).toEqual({ file_path: '/src/main.ts' });
  });

  it('should_handle_empty_tool_input', () => {
    // Arrange
    const msg: ToolStartMessage = {
      id: 'tool-msg-002',
      role: 'assistant',
      type: 'tool_start',
      timestamp: Date.now(),
      toolName: 'TaskList',
      toolInput: {},
    };

    // Assert
    expect(msg.toolInput).toEqual({});
  });

  it('should_handle_complex_tool_input', () => {
    // Arrange
    const msg: ToolStartMessage = {
      id: 'tool-msg-003',
      role: 'assistant',
      type: 'tool_start',
      timestamp: Date.now(),
      toolName: 'Grep',
      toolInput: {
        pattern: 'TODO',
        path: '/src',
        glob: '**/*.ts',
      },
    };

    // Assert
    expect(msg.toolInput.pattern).toBe('TODO');
    expect(msg.toolInput.path).toBe('/src');
  });
});

// ============================================================================
// ToolCompleteMessage 테스트
// ============================================================================

describe('ToolCompleteMessage', () => {
  it('should_have_success_status_and_output', () => {
    // Arrange
    const msg: ToolCompleteMessage = {
      id: 'tool-msg-004',
      role: 'assistant',
      type: 'tool_complete',
      timestamp: Date.now(),
      toolName: 'Read',
      toolInput: { file_path: '/src/main.ts' },
      success: true,
      output: 'export const main = () => {};',
    };

    // Assert
    expect(msg.type).toBe('tool_complete');
    expect(msg.success).toBe(true);
    expect(msg.output).toBeDefined();
    expect(msg.error).toBeUndefined();
  });

  it('should_have_error_when_failed', () => {
    // Arrange
    const msg: ToolCompleteMessage = {
      id: 'tool-msg-005',
      role: 'assistant',
      type: 'tool_complete',
      timestamp: Date.now(),
      toolName: 'Read',
      toolInput: { file_path: '/nonexistent.ts' },
      success: false,
      error: 'File not found',
    };

    // Assert
    expect(msg.success).toBe(false);
    expect(msg.error).toBe('File not found');
    expect(msg.output).toBeUndefined();
  });

  it('should_handle_both_output_and_error_undefined', () => {
    // Arrange - 도구가 출력 없이 완료된 경우
    const msg: ToolCompleteMessage = {
      id: 'tool-msg-006',
      role: 'assistant',
      type: 'tool_complete',
      timestamp: Date.now(),
      toolName: 'Write',
      toolInput: { file_path: '/tmp/test.txt' },
      success: true,
    };

    // Assert
    expect(msg.success).toBe(true);
    expect(msg.output).toBeUndefined();
    expect(msg.error).toBeUndefined();
  });
});

// ============================================================================
// ErrorMessage 테스트
// ============================================================================

describe('ErrorMessage', () => {
  it('should_have_system_role_and_error_type', () => {
    // Arrange
    const msg: ErrorMessage = {
      id: 'err-msg-001',
      role: 'system',
      type: 'error',
      timestamp: Date.now(),
      content: 'An unexpected error occurred',
    };

    // Assert
    expect(msg.role).toBe('system');
    expect(msg.type).toBe('error');
    expect(msg.content).toBe('An unexpected error occurred');
  });

  it('should_handle_detailed_error_messages', () => {
    // Arrange
    const msg: ErrorMessage = {
      id: 'err-msg-002',
      role: 'system',
      type: 'error',
      timestamp: Date.now(),
      content: 'Connection timeout: Failed to connect to server after 30 seconds',
    };

    // Assert
    expect(msg.content).toContain('timeout');
  });
});

// ============================================================================
// ResultMessage 테스트
// ============================================================================

describe('ResultMessage', () => {
  it('should_have_system_role_and_result_type', () => {
    // Arrange
    const msg: ResultMessage = {
      id: 'result-msg-001',
      role: 'system',
      type: 'result',
      timestamp: Date.now(),
      resultInfo: {
        durationMs: 2500,
        inputTokens: 150,
        outputTokens: 300,
        cacheReadTokens: 0,
      },
    };

    // Assert
    expect(msg.role).toBe('system');
    expect(msg.type).toBe('result');
    expect(msg.resultInfo).toBeDefined();
    expect(msg.resultInfo.durationMs).toBe(2500);
  });

  it('should_handle_zero_tokens', () => {
    // Arrange
    const msg: ResultMessage = {
      id: 'result-msg-002',
      role: 'system',
      type: 'result',
      timestamp: Date.now(),
      resultInfo: {
        durationMs: 100,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
      },
    };

    // Assert
    expect(msg.resultInfo.inputTokens).toBe(0);
    expect(msg.resultInfo.outputTokens).toBe(0);
  });
});

// ============================================================================
// AbortedMessage 테스트
// ============================================================================

describe('AbortedMessage', () => {
  it('should_have_system_role_and_aborted_type', () => {
    // Arrange
    const msg: AbortedMessage = {
      id: 'abort-msg-001',
      role: 'system',
      type: 'aborted',
      timestamp: Date.now(),
      reason: 'user',
    };

    // Assert
    expect(msg.role).toBe('system');
    expect(msg.type).toBe('aborted');
    expect(msg.reason).toBe('user');
  });

  it('should_support_session_ended_reason', () => {
    // Arrange
    const msg: AbortedMessage = {
      id: 'abort-msg-002',
      role: 'system',
      type: 'aborted',
      timestamp: Date.now(),
      reason: 'session_ended',
    };

    // Assert
    expect(msg.reason).toBe('session_ended');
  });
});

// ============================================================================
// FileAttachmentMessage 테스트
// ============================================================================

describe('FileAttachmentMessage', () => {
  it('should_have_assistant_role_and_file_attachment_type', () => {
    // Arrange
    const msg: FileAttachmentMessage = {
      id: 'file-msg-001',
      role: 'assistant',
      type: 'file_attachment',
      timestamp: Date.now(),
      file: {
        path: '/tmp/chart.png',
        filename: 'chart.png',
        mimeType: 'image/png',
        fileType: 'image',
        size: 4096,
      },
    };

    // Assert
    expect(msg.role).toBe('assistant');
    expect(msg.type).toBe('file_attachment');
    expect(msg.file.filename).toBe('chart.png');
  });

  it('should_support_file_description', () => {
    // Arrange
    const msg: FileAttachmentMessage = {
      id: 'file-msg-002',
      role: 'assistant',
      type: 'file_attachment',
      timestamp: Date.now(),
      file: {
        path: '/tmp/report.md',
        filename: 'report.md',
        mimeType: 'text/markdown',
        fileType: 'markdown',
        size: 2048,
        description: 'Generated analysis report',
      },
    };

    // Assert
    expect(msg.file.description).toBe('Generated analysis report');
  });
});

// ============================================================================
// UserResponseMessage 테스트
// ============================================================================

describe('UserResponseMessage', () => {
  it('should_have_user_role_and_user_response_type', () => {
    // Arrange
    const msg: UserResponseMessage = {
      id: 'resp-msg-001',
      role: 'user',
      type: 'user_response',
      timestamp: Date.now(),
      responseType: 'permission',
      toolUseId: 'toolu_12345',
      response: 'yes',
    };

    // Assert
    expect(msg.role).toBe('user');
    expect(msg.type).toBe('user_response');
    expect(msg.responseType).toBe('permission');
    expect(msg.toolUseId).toBe('toolu_12345');
    expect(msg.response).toBe('yes');
  });

  it('should_support_question_response_type', () => {
    // Arrange
    const msg: UserResponseMessage = {
      id: 'resp-msg-002',
      role: 'user',
      type: 'user_response',
      timestamp: Date.now(),
      responseType: 'question',
      toolUseId: 'toolu_67890',
      response: 'Option A',
    };

    // Assert
    expect(msg.responseType).toBe('question');
    expect(msg.response).toBe('Option A');
  });
});

// ============================================================================
// StoreMessage Union Type 테스트
// ============================================================================

describe('StoreMessage Union Type', () => {
  it('should_accept_all_message_types', () => {
    // Arrange
    const messages: StoreMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        type: 'text',
        timestamp: Date.now(),
        content: 'Hello',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        type: 'text',
        timestamp: Date.now(),
        content: 'Hi',
      },
      {
        id: 'msg-3',
        role: 'assistant',
        type: 'tool_start',
        timestamp: Date.now(),
        toolName: 'Read',
        toolInput: {},
      },
      {
        id: 'msg-4',
        role: 'assistant',
        type: 'tool_complete',
        timestamp: Date.now(),
        toolName: 'Read',
        toolInput: {},
        success: true,
      },
      {
        id: 'msg-5',
        role: 'system',
        type: 'error',
        timestamp: Date.now(),
        content: 'Error!',
      },
      {
        id: 'msg-6',
        role: 'system',
        type: 'result',
        timestamp: Date.now(),
        resultInfo: { durationMs: 1000, inputTokens: 10, outputTokens: 20, cacheReadTokens: 0 },
      },
      {
        id: 'msg-7',
        role: 'system',
        type: 'aborted',
        timestamp: Date.now(),
        reason: 'user',
      },
      {
        id: 'msg-8',
        role: 'assistant',
        type: 'file_attachment',
        timestamp: Date.now(),
        file: { path: '/tmp/f.txt', filename: 'f.txt', mimeType: 'text/plain', fileType: 'text', size: 100 },
      },
      {
        id: 'msg-9',
        role: 'user',
        type: 'user_response',
        timestamp: Date.now(),
        responseType: 'permission',
        toolUseId: 'id1',
        response: 'yes',
      },
    ];

    // Assert
    expect(messages).toHaveLength(9);
  });

  it('should_support_type_narrowing_with_switch', () => {
    // Arrange
    const processMessage = (msg: StoreMessage): string => {
      switch (msg.type) {
        case 'text':
          return msg.role === 'user' ? `User: ${msg.content}` : `Assistant: ${msg.content}`;
        case 'tool_start':
          return `Tool Start: ${msg.toolName}`;
        case 'tool_complete':
          return `Tool Complete: ${msg.toolName} (${msg.success ? 'success' : 'failed'})`;
        case 'error':
          return `Error: ${msg.content}`;
        case 'result':
          return `Result: ${msg.resultInfo.durationMs}ms`;
        case 'aborted':
          return `Aborted: ${msg.reason}`;
        case 'file_attachment':
          return `File: ${msg.file.filename}`;
        case 'user_response':
          return `Response: ${msg.response}`;
      }
    };

    // Act & Assert
    const userMsg: StoreMessage = {
      id: '1',
      role: 'user',
      type: 'text',
      timestamp: Date.now(),
      content: 'Hello',
    };
    expect(processMessage(userMsg)).toBe('User: Hello');

    const toolMsg: StoreMessage = {
      id: '2',
      role: 'assistant',
      type: 'tool_start',
      timestamp: Date.now(),
      toolName: 'Bash',
      toolInput: {},
    };
    expect(processMessage(toolMsg)).toBe('Tool Start: Bash');
  });
});

// ============================================================================
// Type Guards 테스트
// ============================================================================

describe('Type Guards', () => {
  describe('isUserTextMessage', () => {
    it('should_return_true_for_user_text_messages', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'user',
        type: 'text',
        timestamp: Date.now(),
        content: 'Hello',
      };

      // Act & Assert
      expect(isUserTextMessage(msg)).toBe(true);
    });

    it('should_return_false_for_assistant_text_messages', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'assistant',
        type: 'text',
        timestamp: Date.now(),
        content: 'Hi',
      };

      // Act & Assert
      expect(isUserTextMessage(msg)).toBe(false);
    });

    it('should_return_false_for_invalid_values', () => {
      expect(isUserTextMessage(null)).toBe(false);
      expect(isUserTextMessage(undefined)).toBe(false);
      expect(isUserTextMessage({})).toBe(false);
      expect(isUserTextMessage({ type: 'text' })).toBe(false);
    });
  });

  describe('isAssistantTextMessage', () => {
    it('should_return_true_for_assistant_text_messages', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'assistant',
        type: 'text',
        timestamp: Date.now(),
        content: 'Hello',
      };

      // Act & Assert
      expect(isAssistantTextMessage(msg)).toBe(true);
    });

    it('should_return_false_for_user_text_messages', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'user',
        type: 'text',
        timestamp: Date.now(),
        content: 'Hello',
      };

      // Act & Assert
      expect(isAssistantTextMessage(msg)).toBe(false);
    });
  });

  describe('isToolStartMessage', () => {
    it('should_return_true_for_tool_start_messages', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'assistant',
        type: 'tool_start',
        timestamp: Date.now(),
        toolName: 'Read',
        toolInput: {},
      };

      // Act & Assert
      expect(isToolStartMessage(msg)).toBe(true);
    });

    it('should_return_false_for_tool_complete_messages', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'assistant',
        type: 'tool_complete',
        timestamp: Date.now(),
        toolName: 'Read',
        toolInput: {},
        success: true,
      };

      // Act & Assert
      expect(isToolStartMessage(msg)).toBe(false);
    });

    it('should_return_false_when_missing_toolInput', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'assistant',
        type: 'tool_start',
        timestamp: Date.now(),
        toolName: 'Read',
      };

      // Act & Assert
      expect(isToolStartMessage(msg)).toBe(false);
    });
  });

  describe('isToolCompleteMessage', () => {
    it('should_return_true_for_tool_complete_messages', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'assistant',
        type: 'tool_complete',
        timestamp: Date.now(),
        toolName: 'Read',
        toolInput: {},
        success: true,
      };

      // Act & Assert
      expect(isToolCompleteMessage(msg)).toBe(true);
    });

    it('should_return_false_when_missing_success_field', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'assistant',
        type: 'tool_complete',
        timestamp: Date.now(),
        toolName: 'Read',
        toolInput: {},
      };

      // Act & Assert
      expect(isToolCompleteMessage(msg)).toBe(false);
    });
  });

  describe('isStoreErrorMessage', () => {
    it('should_return_true_for_error_messages', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'system',
        type: 'error',
        timestamp: Date.now(),
        content: 'Error occurred',
      };

      // Act & Assert
      expect(isStoreErrorMessage(msg)).toBe(true);
    });

    it('should_return_false_for_non_system_error_types', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'assistant',
        type: 'error',
        timestamp: Date.now(),
        content: 'Error',
      };

      // Act & Assert
      expect(isStoreErrorMessage(msg)).toBe(false);
    });
  });

  describe('isResultMessage', () => {
    it('should_return_true_for_result_messages', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'system',
        type: 'result',
        timestamp: Date.now(),
        resultInfo: {
          durationMs: 1000,
          inputTokens: 10,
          outputTokens: 20,
          cacheReadTokens: 0,
        },
      };

      // Act & Assert
      expect(isResultMessage(msg)).toBe(true);
    });

    it('should_return_false_when_missing_resultInfo', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'system',
        type: 'result',
        timestamp: Date.now(),
      };

      // Act & Assert
      expect(isResultMessage(msg)).toBe(false);
    });
  });

  describe('isAbortedMessage', () => {
    it('should_return_true_for_aborted_messages', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'system',
        type: 'aborted',
        timestamp: Date.now(),
        reason: 'user',
      };

      // Act & Assert
      expect(isAbortedMessage(msg)).toBe(true);
    });

    it('should_return_false_when_missing_reason', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'system',
        type: 'aborted',
        timestamp: Date.now(),
      };

      // Act & Assert
      expect(isAbortedMessage(msg)).toBe(false);
    });
  });

  describe('isFileAttachmentMessage', () => {
    it('should_return_true_for_file_attachment_messages', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'assistant',
        type: 'file_attachment',
        timestamp: Date.now(),
        file: {
          path: '/tmp/f.txt',
          filename: 'f.txt',
          mimeType: 'text/plain',
          fileType: 'text',
          size: 100,
        },
      };

      // Act & Assert
      expect(isFileAttachmentMessage(msg)).toBe(true);
    });

    it('should_return_false_when_missing_file', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'assistant',
        type: 'file_attachment',
        timestamp: Date.now(),
      };

      // Act & Assert
      expect(isFileAttachmentMessage(msg)).toBe(false);
    });
  });

  describe('isUserResponseMessage', () => {
    it('should_return_true_for_user_response_messages', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'user',
        type: 'user_response',
        timestamp: Date.now(),
        responseType: 'permission',
        toolUseId: 'id1',
        response: 'yes',
      };

      // Act & Assert
      expect(isUserResponseMessage(msg)).toBe(true);
    });

    it('should_return_false_when_missing_required_fields', () => {
      // Arrange
      const msg = {
        id: '1',
        role: 'user',
        type: 'user_response',
        timestamp: Date.now(),
        // missing responseType, toolUseId, response
      };

      // Act & Assert
      expect(isUserResponseMessage(msg)).toBe(false);
    });
  });

  describe('isStoreMessage', () => {
    it('should_return_true_for_all_valid_message_types', () => {
      const validMessages = [
        { id: '1', role: 'user', type: 'text', timestamp: 0, content: 'hi' },
        { id: '2', role: 'assistant', type: 'text', timestamp: 0, content: 'hi' },
        { id: '3', role: 'assistant', type: 'tool_start', timestamp: 0, toolName: 't', toolInput: {} },
        { id: '4', role: 'assistant', type: 'tool_complete', timestamp: 0, toolName: 't', toolInput: {}, success: true },
        { id: '5', role: 'system', type: 'error', timestamp: 0, content: 'err' },
        { id: '6', role: 'system', type: 'result', timestamp: 0, resultInfo: { durationMs: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 } },
        { id: '7', role: 'system', type: 'aborted', timestamp: 0, reason: 'user' },
        { id: '8', role: 'assistant', type: 'file_attachment', timestamp: 0, file: { path: 'p', filename: 'f', mimeType: 'm', fileType: 't', size: 0 } },
        { id: '9', role: 'user', type: 'user_response', timestamp: 0, responseType: 'permission', toolUseId: 'id', response: 'yes' },
      ];

      validMessages.forEach((msg) => {
        expect(isStoreMessage(msg)).toBe(true);
      });
    });

    it('should_return_false_for_invalid_values', () => {
      expect(isStoreMessage(null)).toBe(false);
      expect(isStoreMessage(undefined)).toBe(false);
      expect(isStoreMessage({})).toBe(false);
      expect(isStoreMessage('string')).toBe(false);
      expect(isStoreMessage(123)).toBe(false);
      expect(isStoreMessage({ type: 'unknown' })).toBe(false);
    });
  });
});

// ============================================================================
// Edge Cases 테스트
// ============================================================================

describe('Edge Cases', () => {
  it('should_handle_very_long_content', () => {
    // Arrange
    const longContent = 'x'.repeat(10000);
    const msg: UserTextMessage = {
      id: 'long-msg',
      role: 'user',
      type: 'text',
      timestamp: Date.now(),
      content: longContent,
    };

    // Assert
    expect(msg.content.length).toBe(10000);
  });

  it('should_handle_special_characters_in_content', () => {
    // Arrange
    const specialContent = '🎉 <script>alert("xss")</script> & " \' \n \t \r';
    const msg: AssistantTextMessage = {
      id: 'special-msg',
      role: 'assistant',
      type: 'text',
      timestamp: Date.now(),
      content: specialContent,
    };

    // Assert
    expect(msg.content).toBe(specialContent);
  });

  it('should_handle_zero_timestamp', () => {
    // Arrange
    const msg: UserTextMessage = {
      id: 'zero-ts',
      role: 'user',
      type: 'text',
      timestamp: 0,
      content: 'test',
    };

    // Assert
    expect(msg.timestamp).toBe(0);
  });

  it('should_handle_future_timestamp', () => {
    // Arrange
    const futureTimestamp = Date.now() + 1000 * 60 * 60 * 24 * 365; // 1 year from now
    const msg: UserTextMessage = {
      id: 'future-ts',
      role: 'user',
      type: 'text',
      timestamp: futureTimestamp,
      content: 'test',
    };

    // Assert
    expect(msg.timestamp).toBe(futureTimestamp);
  });

  it('should_handle_empty_tool_name', () => {
    // Arrange
    const msg: ToolStartMessage = {
      id: 'empty-tool',
      role: 'assistant',
      type: 'tool_start',
      timestamp: Date.now(),
      toolName: '',
      toolInput: {},
    };

    // Assert
    expect(msg.toolName).toBe('');
  });

  it('should_handle_nested_objects_in_tool_input', () => {
    // Arrange
    const msg: ToolStartMessage = {
      id: 'nested-input',
      role: 'assistant',
      type: 'tool_start',
      timestamp: Date.now(),
      toolName: 'Complex',
      toolInput: {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
        array: [1, 2, { nested: true }],
      },
    };

    // Assert
    expect((msg.toolInput.level1 as any).level2.level3.value).toBe('deep');
  });

  it('should_handle_multiple_attachments', () => {
    // Arrange
    const attachments: Attachment[] = Array.from({ length: 10 }, (_, i) => ({
      filename: `file${i}.png`,
      path: `/uploads/file${i}.png`,
    }));

    const msg: UserTextMessage = {
      id: 'multi-attach',
      role: 'user',
      type: 'text',
      timestamp: Date.now(),
      content: 'Multiple files',
      attachments,
    };

    // Assert
    expect(msg.attachments).toHaveLength(10);
  });
});
