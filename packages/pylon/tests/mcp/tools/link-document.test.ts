/**
 * @file link-document.test.ts
 * @description link-document MCP 도구 함수 테스트
 *
 * BeaconClient로 entityId를 얻고, PylonClient로 link/unlink/list 요청을 수행하는
 * MCP 도구의 핵심 로직을 테스트합니다.
 *
 * 테스트 케이스:
 * - executeLinkDoc: 성공, path 없음, lookup 실패
 * - executeUnlinkDoc: 성공, 문서 없음
 * - executeListDocs: 성공, 빈 목록
 * - 도구 정의 함수: 올바른 스키마 반환
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

// ============================================================================
// 모킹 설정
// ============================================================================

// BeaconClient 모킹
vi.mock('../../../src/mcp/beacon-client.js', () => ({
  BeaconClient: {
    getInstance: vi.fn(),
  },
}));

// PylonClient 모킹 (아직 구현되지 않은 모듈)
vi.mock('../../../src/mcp/pylon-client.js', () => ({
  PylonClient: {
    getInstance: vi.fn(),
  },
}));

// 모킹된 모듈 import
import { BeaconClient } from '../../../src/mcp/beacon-client.js';
import { PylonClient } from '../../../src/mcp/pylon-client.js';

// 테스트 대상 import (아직 구현되지 않은 모듈 - 테스트 실패 예상)
import {
  executeLinkDoc,
  executeUnlinkDoc,
  executeListDocs,
  getLinkDocToolDefinition,
  getUnlinkDocToolDefinition,
  getListDocsToolDefinition,
} from '../../../src/mcp/tools/link-document.js';

// ============================================================================
// 타입 정의
// ============================================================================

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

interface ToolMeta {
  toolUseId: string;
}

interface LinkedDocument {
  path: string;
  addedAt: number;
}

// ============================================================================
// 테스트 헬퍼
// ============================================================================

/**
 * MCP 표준 응답에서 텍스트 추출
 */
function extractText(result: ToolResult): string {
  return result.content[0]?.text ?? '';
}

/**
 * MCP 성공 응답에서 파싱된 JSON 추출
 */
function extractJson(result: ToolResult): Record<string, unknown> {
  return JSON.parse(extractText(result));
}

/**
 * 목업 BeaconClient lookup 결과 생성 (성공)
 */
function createSuccessLookup(entityId: number) {
  return {
    success: true,
    pylonAddress: '127.0.0.1:9878',
    entityId,
    raw: { type: 'tool_use', id: 'toolu_test', name: 'link_doc', input: {} },
  };
}

/**
 * 목업 BeaconClient lookup 결과 생성 (실패)
 */
function createFailureLookup(error: string) {
  return {
    success: false,
    error,
  };
}

// ============================================================================
// 테스트
// ============================================================================

describe('link-document MCP tools', () => {
  let mockBeaconClient: {
    lookup: Mock;
  };
  let mockPylonClient: {
    link: Mock;
    unlink: Mock;
    list: Mock;
  };

  beforeEach(() => {
    // Mock BeaconClient 인스턴스 설정
    mockBeaconClient = {
      lookup: vi.fn(),
    };
    (BeaconClient.getInstance as Mock).mockReturnValue(mockBeaconClient);

    // Mock PylonClient 인스턴스 설정
    mockPylonClient = {
      link: vi.fn(),
      unlink: vi.fn(),
      list: vi.fn(),
    };
    (PylonClient.getInstance as Mock).mockReturnValue(mockPylonClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // executeLinkDoc 테스트
  // ==========================================================================
  describe('executeLinkDoc', () => {
    const meta: ToolMeta = { toolUseId: 'toolu_link_123' };

    describe('정상 케이스', () => {
      it('should_link_document_successfully_when_path_provided', async () => {
        // Arrange
        const mockDocs: LinkedDocument[] = [
          { path: 'docs/spec.md', addedAt: 1707580800000 },
        ];
        mockBeaconClient.lookup.mockResolvedValue(createSuccessLookup(2049));
        mockPylonClient.link.mockResolvedValue({
          success: true,
          docs: mockDocs,
        });

        // Act
        const result = await executeLinkDoc({ path: 'docs/spec.md' }, meta);

        // Assert
        expect(result.isError).toBeUndefined();
        const json = extractJson(result);
        expect(json.success).toBe(true);
        expect(json.path).toBe('docs/spec.md');
        expect(json.docs).toEqual(mockDocs);
      });

      it('should_call_beacon_lookup_with_correct_toolUseId', async () => {
        // Arrange
        mockBeaconClient.lookup.mockResolvedValue(createSuccessLookup(1001));
        mockPylonClient.link.mockResolvedValue({ success: true, docs: [] });

        // Act
        await executeLinkDoc({ path: 'test.md' }, { toolUseId: 'toolu_abc' });

        // Assert
        expect(mockBeaconClient.lookup).toHaveBeenCalledWith('toolu_abc');
      });

      it('should_call_pylon_link_with_entityId_and_path', async () => {
        // Arrange
        mockBeaconClient.lookup.mockResolvedValue(createSuccessLookup(3001));
        mockPylonClient.link.mockResolvedValue({ success: true, docs: [] });

        // Act
        await executeLinkDoc({ path: 'readme.md' }, meta);

        // Assert
        expect(mockPylonClient.link).toHaveBeenCalledWith(3001, 'readme.md');
      });
    });

    describe('에러 케이스', () => {
      it('should_return_error_when_path_is_missing', async () => {
        // Arrange
        const args = {} as { path?: string };

        // Act
        const result = await executeLinkDoc(args, meta);

        // Assert
        expect(result.isError).toBe(true);
        const text = extractText(result);
        expect(text).toMatch(/path/i);
      });

      it('should_return_error_when_path_is_empty_string', async () => {
        // Arrange
        const args = { path: '' };

        // Act
        const result = await executeLinkDoc(args, meta);

        // Assert
        expect(result.isError).toBe(true);
      });

      it('should_return_error_when_beacon_lookup_fails', async () => {
        // Arrange
        mockBeaconClient.lookup.mockResolvedValue(
          createFailureLookup('Tool use ID not found'),
        );

        // Act
        const result = await executeLinkDoc({ path: 'docs/spec.md' }, meta);

        // Assert
        expect(result.isError).toBe(true);
        const text = extractText(result);
        expect(text).toMatch(/lookup|entityId|not found/i);
      });

      it('should_return_error_when_beacon_lookup_throws', async () => {
        // Arrange
        mockBeaconClient.lookup.mockRejectedValue(new Error('Connection refused'));

        // Act
        const result = await executeLinkDoc({ path: 'docs/spec.md' }, meta);

        // Assert
        expect(result.isError).toBe(true);
        const text = extractText(result);
        expect(text).toMatch(/connection|error/i);
      });

      it('should_return_error_when_pylon_link_fails', async () => {
        // Arrange
        mockBeaconClient.lookup.mockResolvedValue(createSuccessLookup(2049));
        mockPylonClient.link.mockResolvedValue({
          success: false,
          error: 'File not found',
        });

        // Act
        const result = await executeLinkDoc({ path: 'nonexistent.md' }, meta);

        // Assert
        expect(result.isError).toBe(true);
        const text = extractText(result);
        expect(text).toMatch(/file|not found/i);
      });
    });
  });

  // ==========================================================================
  // executeUnlinkDoc 테스트
  // ==========================================================================
  describe('executeUnlinkDoc', () => {
    const meta: ToolMeta = { toolUseId: 'toolu_unlink_456' };

    describe('정상 케이스', () => {
      it('should_unlink_document_successfully', async () => {
        // Arrange
        mockBeaconClient.lookup.mockResolvedValue(createSuccessLookup(2049));
        mockPylonClient.unlink.mockResolvedValue({
          success: true,
          docs: [],
        });

        // Act
        const result = await executeUnlinkDoc({ path: 'docs/spec.md' }, meta);

        // Assert
        expect(result.isError).toBeUndefined();
        const json = extractJson(result);
        expect(json.success).toBe(true);
        expect(json.path).toBe('docs/spec.md');
      });

      it('should_call_pylon_unlink_with_entityId_and_path', async () => {
        // Arrange
        mockBeaconClient.lookup.mockResolvedValue(createSuccessLookup(4001));
        mockPylonClient.unlink.mockResolvedValue({ success: true, docs: [] });

        // Act
        await executeUnlinkDoc({ path: 'test.md' }, meta);

        // Assert
        expect(mockPylonClient.unlink).toHaveBeenCalledWith(4001, 'test.md');
      });
    });

    describe('에러 케이스', () => {
      it('should_return_error_when_document_not_linked', async () => {
        // Arrange
        mockBeaconClient.lookup.mockResolvedValue(createSuccessLookup(2049));
        mockPylonClient.unlink.mockResolvedValue({
          success: false,
          error: 'Document not linked',
        });

        // Act
        const result = await executeUnlinkDoc({ path: 'not-linked.md' }, meta);

        // Assert
        expect(result.isError).toBe(true);
        const text = extractText(result);
        expect(text).toMatch(/not linked|not found/i);
      });

      it('should_return_error_when_path_is_missing', async () => {
        // Arrange
        const args = {} as { path?: string };

        // Act
        const result = await executeUnlinkDoc(args, meta);

        // Assert
        expect(result.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // executeListDocs 테스트
  // ==========================================================================
  describe('executeListDocs', () => {
    const meta: ToolMeta = { toolUseId: 'toolu_list_789' };

    describe('정상 케이스', () => {
      it('should_list_linked_documents_successfully', async () => {
        // Arrange
        const mockDocs: LinkedDocument[] = [
          { path: 'docs/spec.md', addedAt: 1707580800000 },
          { path: 'docs/design.md', addedAt: 1707584400000 },
        ];
        mockBeaconClient.lookup.mockResolvedValue(createSuccessLookup(2049));
        mockPylonClient.list.mockResolvedValue({
          success: true,
          docs: mockDocs,
        });

        // Act
        const result = await executeListDocs({}, meta);

        // Assert
        expect(result.isError).toBeUndefined();
        const json = extractJson(result);
        expect(json.success).toBe(true);
        expect(json.docs).toHaveLength(2);
      });

      it('should_return_empty_array_when_no_documents_linked', async () => {
        // Arrange
        mockBeaconClient.lookup.mockResolvedValue(createSuccessLookup(2049));
        mockPylonClient.list.mockResolvedValue({
          success: true,
          docs: [],
        });

        // Act
        const result = await executeListDocs({}, meta);

        // Assert
        expect(result.isError).toBeUndefined();
        const json = extractJson(result);
        expect(json.success).toBe(true);
        expect(json.docs).toEqual([]);
      });

      it('should_include_document_metadata_in_response', async () => {
        // Arrange
        const addedAt = 1707580800000;
        mockBeaconClient.lookup.mockResolvedValue(createSuccessLookup(2049));
        mockPylonClient.list.mockResolvedValue({
          success: true,
          docs: [{ path: 'spec.md', addedAt }],
        });

        // Act
        const result = await executeListDocs({}, meta);

        // Assert
        const json = extractJson(result);
        const docs = json.docs as LinkedDocument[];
        expect(docs[0].path).toBe('spec.md');
        expect(docs[0].addedAt).toBe(addedAt);
      });
    });

    describe('에러 케이스', () => {
      it('should_return_error_when_beacon_lookup_fails', async () => {
        // Arrange
        mockBeaconClient.lookup.mockResolvedValue(
          createFailureLookup('Tool use ID not found'),
        );

        // Act
        const result = await executeListDocs({}, meta);

        // Assert
        expect(result.isError).toBe(true);
      });
    });
  });

  // ==========================================================================
  // MCP 응답 포맷 테스트
  // ==========================================================================
  describe('MCP 응답 포맷', () => {
    const meta: ToolMeta = { toolUseId: 'toolu_format_test' };

    beforeEach(() => {
      mockBeaconClient.lookup.mockResolvedValue(createSuccessLookup(2049));
    });

    it('should_return_content_array_with_text_type_on_success', async () => {
      // Arrange
      mockPylonClient.link.mockResolvedValue({ success: true, docs: [] });

      // Act
      const result = await executeLinkDoc({ path: 'test.md' }, meta);

      // Assert
      expect(result.content).toBeInstanceOf(Array);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(typeof result.content[0].text).toBe('string');
    });

    it('should_return_content_array_with_text_type_on_error', async () => {
      // Act
      const result = await executeLinkDoc({}, meta);

      // Assert
      expect(result.isError).toBe(true);
      expect(result.content).toBeInstanceOf(Array);
      expect(result.content[0].type).toBe('text');
    });

    it('should_return_parseable_json_in_success_response', async () => {
      // Arrange
      mockPylonClient.list.mockResolvedValue({ success: true, docs: [] });

      // Act
      const result = await executeListDocs({}, meta);

      // Assert
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });
  });

  // ==========================================================================
  // 도구 정의 테스트
  // ==========================================================================
  describe('Tool Definitions', () => {
    describe('getLinkDocToolDefinition', () => {
      it('should_return_correct_tool_name', () => {
        // Act
        const definition = getLinkDocToolDefinition();

        // Assert
        expect(definition.name).toBe('link_doc');
      });

      it('should_return_description', () => {
        // Act
        const definition = getLinkDocToolDefinition();

        // Assert
        expect(definition.description).toBeDefined();
        expect(typeof definition.description).toBe('string');
        expect(definition.description.length).toBeGreaterThan(0);
      });

      it('should_have_path_as_required_parameter', () => {
        // Act
        const definition = getLinkDocToolDefinition();

        // Assert
        expect(definition.inputSchema.properties).toHaveProperty('path');
        expect(definition.inputSchema.required).toContain('path');
      });

      it('should_have_valid_json_schema', () => {
        // Act
        const definition = getLinkDocToolDefinition();

        // Assert
        expect(definition.inputSchema.type).toBe('object');
        expect(definition.inputSchema.properties.path.type).toBe('string');
      });
    });

    describe('getUnlinkDocToolDefinition', () => {
      it('should_return_correct_tool_name', () => {
        // Act
        const definition = getUnlinkDocToolDefinition();

        // Assert
        expect(definition.name).toBe('unlink_doc');
      });

      it('should_have_path_as_required_parameter', () => {
        // Act
        const definition = getUnlinkDocToolDefinition();

        // Assert
        expect(definition.inputSchema.properties).toHaveProperty('path');
        expect(definition.inputSchema.required).toContain('path');
      });

      it('should_return_description', () => {
        // Act
        const definition = getUnlinkDocToolDefinition();

        // Assert
        expect(definition.description).toBeDefined();
        expect(typeof definition.description).toBe('string');
      });
    });

    describe('getListDocsToolDefinition', () => {
      it('should_return_correct_tool_name', () => {
        // Act
        const definition = getListDocsToolDefinition();

        // Assert
        expect(definition.name).toBe('list_docs');
      });

      it('should_not_require_any_parameters', () => {
        // Act
        const definition = getListDocsToolDefinition();

        // Assert
        expect(definition.inputSchema.required ?? []).toHaveLength(0);
      });

      it('should_return_description', () => {
        // Act
        const definition = getListDocsToolDefinition();

        // Assert
        expect(definition.description).toBeDefined();
        expect(typeof definition.description).toBe('string');
      });

      it('should_have_valid_json_schema', () => {
        // Act
        const definition = getListDocsToolDefinition();

        // Assert
        expect(definition.inputSchema.type).toBe('object');
      });
    });
  });
});
