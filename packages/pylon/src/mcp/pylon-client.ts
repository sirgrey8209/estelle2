/**
 * @file pylon-client.ts
 * @description PylonClient - MCP 도구에서 PylonMcpServer로 요청을 보내는 TCP 클라이언트
 *
 * MCP 도구에서 link/unlink/list 요청을 처리한다.
 * 환경변수 ESTELLE_MCP_PORT로 포트를 주입받아 직접 연결한다.
 *
 * 프로토콜:
 * - 요청: { "action": "link", "conversationId": 2049, "path": "docs/spec.md" }
 * - 요청: { "action": "unlink", "conversationId": 2049, "path": "docs/spec.md" }
 * - 요청: { "action": "list", "conversationId": 2049 }
 * - 요청: { "action": "lookup_and_link", "toolUseId": "toolu_xxx", "path": "docs/spec.md" }
 * - 응답: { "success": true, "docs": [...] }
 * - 응답: { "success": false, "error": "..." }
 */

import net from 'net';
import type { LinkedDocument } from '@estelle/core';

// ============================================================================
// 상수
// ============================================================================

/** 기본 타임아웃 (5초) */
const DEFAULT_TIMEOUT = 5000;

/** 환경변수에서 타임아웃 읽기 (MCP_TIMEOUT, 밀리초) */
const getTimeout = (): number => {
  const envTimeout = process.env.MCP_TIMEOUT;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_TIMEOUT;
};

// ============================================================================
// 타입 정의
// ============================================================================

/** PylonClient 옵션 */
export interface PylonClientOptions {
  /** MCP 서버 호스트 */
  host: string;
  /** MCP 서버 포트 */
  port: number;
  /** 타임아웃 (밀리초) */
  timeout?: number;
}

/** Link 결과 타입 */
export interface LinkResult {
  success: boolean;
  docs?: LinkedDocument[];
  error?: string;
}

/** 파일 정보 타입 */
interface FileInfo {
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  description: string | null;
}

/** SendFile 결과 타입 */
export interface SendFileResult {
  success: boolean;
  file?: FileInfo;
  error?: string;
}

/** Deploy 결과 타입 */
export interface DeployResult {
  success: boolean;
  target?: string;
  output?: string;
  error?: string;
}

/** 워크스페이스 정보 타입 */
interface WorkspaceInfo {
  id: number;
  name: string;
}

/** 상태 정보 타입 */
interface StatusInfo {
  environment: 'dev' | 'stage' | 'release' | 'test';
  version: string;
  workspace: WorkspaceInfo | null;
  conversationId: number;
  linkedDocuments: Array<{ path: string; addedAt: number }>;
}

/** GetStatus 결과 타입 */
export interface GetStatusResult {
  success: boolean;
  status?: StatusInfo;
  error?: string;
}

/** 대화 정보 타입 */
interface ConversationInfo {
  conversationId: number;
  name: string;
  linkedDocuments?: Array<{ path: string; addedAt: number }>;
}

/** 대화 관리 결과 타입 */
export interface ConversationResult {
  success: boolean;
  conversation?: ConversationInfo;
  error?: string;
}

/** SetSystemPrompt 결과 타입 */
export interface SetSystemPromptResult {
  success: boolean;
  message?: string;
  newSession?: boolean;
  error?: string;
}

/** 요청 타입 */
interface PylonRequest {
  action: 'link' | 'unlink' | 'list' | 'send_file' | 'deploy' | 'get_status' | 'lookup_and_link' | 'lookup_and_unlink' | 'lookup_and_list' | 'lookup_and_send_file' | 'lookup_and_deploy' | 'lookup_and_get_status' | 'lookup_and_create_conversation' | 'lookup_and_delete_conversation' | 'lookup_and_rename_conversation' | 'lookup_and_set_system_prompt';
  conversationId?: number;
  toolUseId?: string;
  path?: string;
  description?: string;
  target?: string;
  name?: string;
  files?: string[];
  newName?: string;
  content?: string;
}

// ============================================================================
// PylonClient 클래스
// ============================================================================

/**
 * PylonClient - MCP 서버에서 PylonMcpServer TCP 서버로 요청을 보내는 클라이언트
 *
 * 환경변수 ESTELLE_MCP_PORT에서 포트를 주입받아 직접 연결한다.
 */
export class PylonClient {
  // ============================================================================
  // Private 필드
  // ============================================================================

  private _host: string;
  private _port: number;
  private _timeout: number;

  // ============================================================================
  // 생성자
  // ============================================================================

  constructor(options: PylonClientOptions) {
    this._host = options.host;
    this._port = options.port;
    this._timeout = options.timeout ?? getTimeout();
  }

  // ============================================================================
  // 공개 속성
  // ============================================================================

  /** 호스트 */
  get host(): string {
    return this._host;
  }

  /** 포트 번호 */
  get port(): number {
    return this._port;
  }

  /** 타임아웃 (밀리초) */
  get timeout(): number {
    return this._timeout;
  }

  // ============================================================================
  // 공개 메서드 - toolUseId 기반
  // ============================================================================

  /**
   * toolUseId 기반 문서 연결
   * PylonMcpServer가 내부적으로 toolUseId → conversationId 변환 수행
   */
  async linkByToolUseId(toolUseId: string, path: string): Promise<LinkResult> {
    return this._sendRequest<LinkResult>({
      action: 'lookup_and_link',
      toolUseId,
      path,
    });
  }

  /**
   * toolUseId 기반 문서 연결 해제
   */
  async unlinkByToolUseId(toolUseId: string, path: string): Promise<LinkResult> {
    return this._sendRequest<LinkResult>({
      action: 'lookup_and_unlink',
      toolUseId,
      path,
    });
  }

  /**
   * toolUseId 기반 연결된 문서 목록 조회
   */
  async listByToolUseId(toolUseId: string): Promise<LinkResult> {
    return this._sendRequest<LinkResult>({
      action: 'lookup_and_list',
      toolUseId,
    });
  }

  /**
   * toolUseId 기반 파일 전송
   */
  async sendFileByToolUseId(
    toolUseId: string,
    path: string,
    description?: string,
  ): Promise<SendFileResult> {
    return this._sendRequest<SendFileResult>({
      action: 'lookup_and_send_file',
      toolUseId,
      path,
      description,
    });
  }

  /**
   * toolUseId 기반 배포
   */
  async deployByToolUseId(
    toolUseId: string,
    target: string,
  ): Promise<DeployResult> {
    return this._sendRequest<DeployResult>({
      action: 'lookup_and_deploy',
      toolUseId,
      target,
    });
  }

  /**
   * toolUseId 기반 상태 조회
   */
  async getStatusByToolUseId(
    toolUseId: string,
  ): Promise<GetStatusResult> {
    // toolUseId 검증
    if (!toolUseId || toolUseId === '') {
      return {
        success: false,
        error: 'toolUseId is required',
      };
    }

    return this._sendRequest<GetStatusResult>({
      action: 'lookup_and_get_status',
      toolUseId,
    });
  }

  /**
   * toolUseId 기반 대화 생성
   * 현재 대화와 같은 워크스페이스에 새 대화를 생성합니다.
   */
  async createConversationByToolUseId(
    toolUseId: string,
    name?: string,
    files?: string[],
  ): Promise<ConversationResult> {
    if (!toolUseId || toolUseId === '') {
      return {
        success: false,
        error: 'toolUseId is required',
      };
    }

    return this._sendRequest<ConversationResult>({
      action: 'lookup_and_create_conversation',
      toolUseId,
      name,
      files,
    });
  }

  /**
   * toolUseId 기반 대화 삭제
   * target은 대화 이름 또는 ID입니다.
   */
  async deleteConversationByToolUseId(
    toolUseId: string,
    target: string,
  ): Promise<ConversationResult> {
    if (!toolUseId || toolUseId === '') {
      return {
        success: false,
        error: 'toolUseId is required',
      };
    }

    if (!target || target === '') {
      return {
        success: false,
        error: 'target is required',
      };
    }

    return this._sendRequest<ConversationResult>({
      action: 'lookup_and_delete_conversation',
      toolUseId,
      target,
    });
  }

  /**
   * toolUseId 기반 대화명 변경
   * target이 없으면 현재 대화의 이름을 변경합니다.
   */
  async renameConversationByToolUseId(
    toolUseId: string,
    newName: string,
    target?: string,
  ): Promise<ConversationResult> {
    if (!toolUseId || toolUseId === '') {
      return {
        success: false,
        error: 'toolUseId is required',
      };
    }

    if (!newName || newName === '') {
      return {
        success: false,
        error: 'newName is required',
      };
    }

    return this._sendRequest<ConversationResult>({
      action: 'lookup_and_rename_conversation',
      toolUseId,
      newName,
      target,
    });
  }

  /**
   * toolUseId 기반 시스템 프롬프트 설정
   * 파일 내용을 받아 현재 대화의 customSystemPrompt로 설정하고 새 세션을 시작합니다.
   */
  async setSystemPromptByToolUseId(
    toolUseId: string,
    content: string,
  ): Promise<SetSystemPromptResult> {
    if (!toolUseId || toolUseId === '') {
      return {
        success: false,
        error: 'toolUseId is required',
      };
    }

    return this._sendRequest<SetSystemPromptResult>({
      action: 'lookup_and_set_system_prompt',
      toolUseId,
      content,
    });
  }

  // ============================================================================
  // 공개 메서드 - conversationId 기반 (레거시 호환)
  // ============================================================================

  /**
   * 문서 연결
   */
  async link(conversationId: number, path: string): Promise<LinkResult> {
    return this._sendRequest<LinkResult>({
      action: 'link',
      conversationId,
      path,
    });
  }

  /**
   * 문서 연결 해제
   */
  async unlink(conversationId: number, path: string): Promise<LinkResult> {
    return this._sendRequest<LinkResult>({
      action: 'unlink',
      conversationId,
      path,
    });
  }

  /**
   * 연결된 문서 목록 조회
   */
  async list(conversationId: number): Promise<LinkResult> {
    return this._sendRequest<LinkResult>({
      action: 'list',
      conversationId,
    });
  }

  /**
   * 파일 전송
   */
  async sendFile(
    conversationId: number,
    path: string,
    description?: string,
  ): Promise<SendFileResult> {
    return this._sendRequest<SendFileResult>({
      action: 'send_file',
      conversationId,
      path,
      description,
    });
  }

  /**
   * 배포 (레거시 conversationId 기반)
   */
  async deploy(
    conversationId: number,
    target?: string,
  ): Promise<DeployResult> {
    return this._sendRequest<DeployResult>({
      action: 'deploy',
      conversationId,
      target,
    });
  }

  /**
   * 상태 조회 (레거시 conversationId 기반)
   */
  async getStatus(
    conversationId: number,
  ): Promise<GetStatusResult> {
    // conversationId 검증
    if (conversationId === undefined || conversationId === null) {
      return {
        success: false,
        error: 'conversationId is required',
      };
    }

    return this._sendRequest<GetStatusResult>({
      action: 'get_status',
      conversationId,
    });
  }

  // ============================================================================
  // Private 메서드
  // ============================================================================

  /**
   * TCP 요청 전송
   */
  private _sendRequest<T>(request: PylonRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ port: this._port, host: this._host });
      let buffer = '';
      let timeoutId: NodeJS.Timeout | null = null;

      // 정리 함수
      const cleanup = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        socket.removeAllListeners();
        socket.destroy();
      };

      // 타임아웃 설정
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Request timeout'));
      }, this._timeout);

      // 연결 성공
      socket.on('connect', () => {
        socket.write(JSON.stringify(request));
      });

      // 데이터 수신
      socket.on('data', (data) => {
        buffer += data.toString();

        try {
          const response = JSON.parse(buffer) as T;
          cleanup();
          resolve(response);
        } catch {
          // 아직 완전한 JSON이 아님 - 더 기다림
        }
      });

      // 연결 에러
      socket.on('error', (err) => {
        cleanup();
        reject(err);
      });

      // 연결 종료 (응답 없이)
      socket.on('close', () => {
        // 이미 처리된 경우 무시
        if (timeoutId) {
          cleanup();
          reject(new Error('Connection closed without response'));
        }
      });
    });
  }
}
