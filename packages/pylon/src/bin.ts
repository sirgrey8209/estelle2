#!/usr/bin/env node
/**
 * @file bin.ts
 * @description Pylon CLI 실행 진입점
 *
 * 환경변수:
 * - RELAY_URL: Relay 서버 URL (기본: ws://localhost:8080)
 * - DEVICE_ID: 디바이스 ID (기본: 1)
 * - UPLOADS_DIR: 업로드 디렉토리 (기본: ./uploads)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { decodeConversationIdFull, type ConversationId, type EnvId } from '@estelle/core';
import { Pylon, type PylonConfig, type PylonDependencies } from './pylon.js';
import { WorkspaceStore } from './stores/workspace-store.js';
import { MessageStore } from './stores/message-store.js';
import { ShareStore } from './stores/share-store.js';
import { createRelayClient } from './network/relay-client.js';
import { ClaudeManager } from './claude/claude-manager.js';
import { ClaudeSDKAdapter } from './claude/claude-sdk-adapter.js';
import { BlobHandler, type FileSystemAdapter } from './handlers/blob-handler.js';
import { TaskManager, type FileSystem } from './managers/task-manager.js';
import { WorkerManager } from './managers/worker-manager.js';
import { FolderManager, type FolderFileSystem } from './managers/folder-manager.js';
import { FileSystemPersistence, type FileSystemInterface } from './persistence/file-system-persistence.js';
import { CredentialManager } from './auth/credential-manager.js';
import { PylonMcpServer } from './servers/pylon-mcp-server.js';
import os from 'os';

// ============================================================================
// 환경 설정 로드
// ============================================================================

/**
 * 환경 설정 인터페이스
 */
interface EnvConfig {
  envId?: number;
  pylon?: {
    pylonIndex?: string;
    relayUrl?: string;
    configDir?: string;
    credentialsBackupDir?: string;
    dataDir?: string;
    mcpPort?: number;
  };
}

/**
 * ESTELLE_ENV_CONFIG 환경변수에서 설정 로드
 * dev-server.js 또는 빌드 스크립트에서 주입됨
 */
function loadEnvConfig(): EnvConfig | null {
  const envConfigStr = process.env['ESTELLE_ENV_CONFIG'];
  if (!envConfigStr) return null;

  try {
    return JSON.parse(envConfigStr) as EnvConfig;
  } catch (err) {
    console.error('[Config] Failed to parse ESTELLE_ENV_CONFIG:', err);
    return null;
  }
}

const envConfig = loadEnvConfig();

// ============================================================================
// 설정 (ESTELLE_ENV_CONFIG 우선, 개별 환경변수 fallback)
// ============================================================================

/** envId (0=release, 1=stage, 2=dev) - config보다 먼저 선언 */
const envId = envConfig?.envId ?? parseInt(process.env['ENV_ID'] || '0', 10);

/** buildEnv 문자열 (envId → 문자열 변환) */
const envIdToBuildEnv: Record<number, string> = { 0: 'release', 1: 'stage', 2: 'dev', 3: 'test' };
const buildEnv = envIdToBuildEnv[envId] || 'release';

// pylonIndex (1~15) from config, default 1
const pylonIndex = parseInt(envConfig?.pylon?.pylonIndex || process.env['PYLON_INDEX'] || '1', 10);
// deviceId = envId * 32 + pylonIndex (encodePylonId 공식: envId << 5 | deviceIndex)
const computedDeviceId = envId * 32 + pylonIndex;

const config: PylonConfig = {
  deviceId: computedDeviceId,
  relayUrl: envConfig?.pylon?.relayUrl || process.env['RELAY_URL'] || 'ws://localhost:8080',
  uploadsDir: path.resolve(process.env['UPLOADS_DIR'] || './uploads'),
  buildEnv,
};

/** 데이터 저장 디렉토리 */
const dataDir = envConfig?.pylon?.dataDir || process.env['DATA_DIR'] || './data';

/** Claude config 디렉토리 (환경별 분리) */
const claudeConfigDir = envConfig?.pylon?.configDir || process.env['CLAUDE_CONFIG_DIR'] || path.join(os.homedir(), '.claude');

/** 인증 백업 디렉토리 */
const credentialsBackupDir = envConfig?.pylon?.credentialsBackupDir || process.env['CREDENTIALS_BACKUP_DIR'] || path.join(os.homedir(), '.claude-credentials');


// ============================================================================
// Logger 구현
// ============================================================================

const logger = {
  log: (message: string) => console.log(`[${new Date().toISOString()}] ${message}`),
  info: (message: string) => console.log(`[${new Date().toISOString()}] [INFO] ${message}`),
  warn: (message: string) => console.warn(`[${new Date().toISOString()}] [WARN] ${message}`),
  error: (message: string) => console.error(`[${new Date().toISOString()}] [ERROR] ${message}`),
};

const packetLogger = {
  logSend: (source: string, message: unknown) => {
    if (process.env['DEBUG_PACKETS'] === 'true') {
      console.log(`[SEND:${source}]`, JSON.stringify(message).slice(0, 200));
    }
  },
  logRecv: (source: string, message: unknown) => {
    if (process.env['DEBUG_PACKETS'] === 'true') {
      console.log(`[RECV:${source}]`, JSON.stringify(message).slice(0, 200));
    }
  },
};

// ============================================================================
// 파일시스템 어댑터
// ============================================================================

/**
 * BlobHandler용 파일시스템 어댑터
 */
const blobFileSystem: FileSystemAdapter = {
  exists: (filePath: string) => fs.existsSync(filePath),
  readFile: (filePath: string) => fs.readFileSync(filePath),
  writeFile: (filePath: string, data: Buffer) => fs.writeFileSync(filePath, data),
  mkdir: (dirPath: string) => fs.mkdirSync(dirPath, { recursive: true }),
  findFile: (dir: string, filename: string) => {
    if (!fs.existsSync(dir)) return undefined;
    const entries = fs.readdirSync(dir);
    const found = entries.find((e) => e.includes(filename));
    return found ? path.join(dir, found) : undefined;
  },
};

/**
 * TaskManager용 파일시스템 어댑터
 */
const taskFileSystem: FileSystem = {
  existsSync: (p: string) => fs.existsSync(p),
  mkdirSync: (p: string, options?: { recursive?: boolean }) =>
    fs.mkdirSync(p, options),
  readdirSync: (p: string) => fs.readdirSync(p) as string[],
  readFileSync: (p: string, _encoding?: string) => fs.readFileSync(p, 'utf-8'),
  writeFileSync: (p: string, content: string, _encoding?: string) =>
    fs.writeFileSync(p, content, 'utf-8'),
};

/**
 * FolderManager용 파일시스템 어댑터
 */
const folderFileSystem: FolderFileSystem = {
  existsSync: (p: string) => fs.existsSync(p),
  statSync: (p: string) => fs.statSync(p),
  readdirSync: (p: string, _options: { withFileTypes: true }) =>
    fs.readdirSync(p, { withFileTypes: true }),
  mkdirSync: (p: string) => fs.mkdirSync(p, { recursive: true }),
  renameSync: (oldPath: string, newPath: string) => fs.renameSync(oldPath, newPath),
};

/**
 * Persistence용 파일시스템 어댑터
 */
const persistenceFileSystem: FileSystemInterface = {
  existsSync: (p: string) => fs.existsSync(p),
  readFileSync: (p: string, encoding: string) => fs.readFileSync(p, encoding as BufferEncoding),
  writeFileSync: (p: string, data: string, encoding: string) =>
    fs.writeFileSync(p, data, encoding as BufferEncoding),
  mkdirSync: (p: string, options?: { recursive?: boolean }) =>
    fs.mkdirSync(p, options),
  readdirSync: (p: string) => fs.readdirSync(p) as string[],
  unlinkSync: (p: string) => fs.unlinkSync(p),
};

/**
 * 버그 리포트 파일 경로
 */
const bugReportPath = path.join(dataDir, 'bug-reports.txt');

/**
 * 버그 리포트 작성기
 */
const bugReportWriter = {
  append: (content: string) => {
    fs.appendFileSync(bugReportPath, content, 'utf-8');
  },
};

/**
 * SDK 로그 디렉토리
 */
const sdkLogDir = path.join(dataDir, 'sdk-logs');

/**
 * SDK raw 메시지 로거
 * 날짜별 JSONL 파일로 저장
 */
function logSdkRawMessage(sessionId: string, message: unknown): void {
  try {
    // 로그 디렉토리 생성
    if (!fs.existsSync(sdkLogDir)) {
      fs.mkdirSync(sdkLogDir, { recursive: true });
    }

    // 날짜별 파일명
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const logFile = path.join(sdkLogDir, `sdk-${date}.jsonl`);

    // JSONL 형식으로 저장
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId,
      message,
    };
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf-8');
  } catch (err) {
    logger.error(`[SDK Log] Failed to write log: ${err}`);
  }
}

// ============================================================================
// 의존성 생성
// ============================================================================

// Pylon 인스턴스 (지연 바인딩용)
let pylonInstance: Pylon | null = null;

/**
 * MCP 설정 로드
 * @param workingDir 작업 디렉토리
 * @returns MCP 서버 설정 또는 null
 */
function loadMcpConfig(workingDir: string): Record<string, unknown> | null {
  // estelle-mcp 서버 자동 주입 (pylon 패키지 내부)
  const mcpPort = envConfig?.pylon?.mcpPort || parseInt(process.env['ESTELLE_MCP_PORT'] || '9880', 10);
  let mcpServerPath: string;
  try {
    const binDir = path.dirname(fileURLToPath(import.meta.url));
    // pylon/dist/bin.js → pylon/dist/mcp/server.js
    mcpServerPath = path.resolve(binDir, 'mcp', 'server.js');
  } catch {
    logger.error('[MCP] Failed to resolve estelle-mcp server path');
    mcpServerPath = '';
  }

  const estelleMcp: Record<string, unknown> = {
    command: 'node',
    args: [mcpServerPath],
    env: {
      ESTELLE_WORKING_DIR: workingDir,
      ESTELLE_MCP_PORT: String(mcpPort),
      MCP_TIMEOUT: '180000', // 3분 타임아웃
    },
  };

  // 1. 전역 MCP 설정 로드 (claudeConfigDir/.claude.json의 mcpServers)
  let globalConfig: Record<string, unknown> = {};
  if (claudeConfigDir) {
    const globalConfigPath = path.join(claudeConfigDir, '.claude.json');
    try {
      if (fs.existsSync(globalConfigPath)) {
        const content = fs.readFileSync(globalConfigPath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
          globalConfig = parsed.mcpServers;
          logger.log(`[MCP] Loaded global config from ${globalConfigPath} (${Object.keys(globalConfig).length} servers)`);
        }
      }
    } catch (err) {
      logger.error(`[MCP] Failed to load global config from ${globalConfigPath}: ${err}`);
    }
  }

  // 2. 프로젝트별 MCP 설정 로드
  let projectConfig: Record<string, unknown> = {};
  const configPaths = [
    path.join(workingDir, '.estelle', 'mcp-config.json'),
    path.join(workingDir, '.mcp.json'),
  ];

  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(content);
        // .mcp.json은 { "mcpServers": {...} } 구조일 수 있으므로 내부 객체 추출
        projectConfig = parsed.mcpServers && typeof parsed.mcpServers === 'object'
          ? parsed.mcpServers
          : parsed;
        logger.log(`[MCP] Loaded project config from ${configPath} (${Object.keys(projectConfig).length} servers)`);
        break;
      }
    } catch (err) {
      logger.error(`[MCP] Failed to load config from ${configPath}: ${err}`);
    }
  }

  // 전역 + 프로젝트 + estelle-mcp (프로젝트가 전역을 오버라이드)
  return {
    ...globalConfig,
    ...projectConfig,
    'estelle-mcp': estelleMcp,
  };
}

function createDependencies(): PylonDependencies & {
  _bindPylonSend: (fn: (msg: unknown) => void) => void;
} {
  // Persistence 생성
  const persistence = new FileSystemPersistence(dataDir, persistenceFileSystem);

  // WorkspaceStore 로드 또는 새로 생성
  // Note: WorkspaceStore는 deviceIndex(1~15)를 받아 내부에서 pylonId를 생성
  const workspaceData = persistence.loadWorkspaceStore();
  const workspaceStore = workspaceData
    ? WorkspaceStore.fromJSON(pylonIndex, workspaceData, envId as EnvId)
    : new WorkspaceStore(pylonIndex, undefined, envId as EnvId);

  if (workspaceData) {
    logger.log(`[Persistence] Loaded ${workspaceData.workspaces?.length || 0} workspaces from ${dataDir}`);
  }

  const messageStore = new MessageStore();

  // ShareStore 로드 또는 새로 생성
  const shareData = persistence.loadShareStore();
  const shareStore = shareData
    ? ShareStore.fromJSON(shareData)
    : new ShareStore();

  if (shareData) {
    logger.log(`[Persistence] Loaded ${shareData.shares?.length || 0} shares from ${dataDir}`);
  }

  // RelayClient
  // Note: Relay는 deviceIndex(1~15)를 기대하고 envId와 조합해 pylonId를 계산함
  const relayClient = createRelayClient({
    url: config.relayUrl,
    deviceId: pylonIndex,  // pylonIndex를 전달 (Relay가 인코딩)
    reconnectInterval: 5000,
  });

  // ClaudeAdapter - SDK 직접 사용
  logger.log(`[Claude] Using ClaudeSDKAdapter (direct SDK, configDir=${claudeConfigDir})`);
  const claudeAdapter = new ClaudeSDKAdapter();

  // ClaudeManager - 지연 바인딩으로 pylon 연결
  const claudeManager = new ClaudeManager({
    adapter: claudeAdapter,
    getPermissionMode: (conversationId: number) => {
      const conversation = workspaceStore.getConversation(conversationId as ConversationId);
      return conversation?.permissionMode ?? 'default';
    },
    loadMcpConfig,
    onEvent: (conversationId, event) => {
      // 지연 바인딩: pylon이 생성된 후에 호출됨
      if (pylonInstance) {
        pylonInstance.sendClaudeEvent(conversationId, event);
      } else {
        logger.warn(`[Claude] Event received but pylon not ready: ${event.type}`);
      }
    },
    onRawMessage: (conversationId, message) => {
      // SDK raw 메시지 로깅
      logSdkRawMessage(String(conversationId), message);
    },
    claudeConfigDir,
  });

  // BlobHandler (sendFn은 pylon 생성 후 지연 바인딩)
  let pylonSendFn: (msg: unknown) => void = () => {};
  const blobHandler = new BlobHandler({
    uploadsDir: config.uploadsDir,
    fs: blobFileSystem,
    sendFn: (msg) => pylonSendFn(msg),
  });

  // BlobHandler 어댑터 래퍼 - 인터페이스에 맞춰 BlobHandler 호출
  const blobHandlerAdapter: PylonDependencies['blobHandler'] = {
    handleBlobStart: (payload: unknown, from: number) => {
      return blobHandler.handleBlobStart(payload as Parameters<typeof blobHandler.handleBlobStart>[0], from);
    },
    handleBlobChunk: (payload: unknown) => {
      return blobHandler.handleBlobChunk(payload as Parameters<typeof blobHandler.handleBlobChunk>[0]);
    },
    handleBlobEnd: (payload: unknown) => {
      return blobHandler.handleBlobEnd(payload as Parameters<typeof blobHandler.handleBlobEnd>[0]);
    },
    handleBlobRequest: (payload: unknown, from: number) => {
      return blobHandler.handleBlobRequest(payload as Parameters<typeof blobHandler.handleBlobRequest>[0], from);
    },
  };

  // TaskManager
  const taskManager = new TaskManager(taskFileSystem);

  // WorkerManager
  const workerManager = new WorkerManager(taskManager);

  // FolderManager
  const folderManager = new FolderManager(folderFileSystem);

  // CredentialManager
  const credentialManager = new CredentialManager({
    configDir: claudeConfigDir,
    backupDir: credentialsBackupDir,
  });
  logger.log(`[Credential] Config dir: ${claudeConfigDir}`);
  logger.log(`[Credential] Backup dir: ${credentialsBackupDir}`);

  return {
    workspaceStore,
    messageStore,
    relayClient,
    claudeManager,
    blobHandler: blobHandlerAdapter,
    // pylonSendFn 바인딩을 위한 setter 추가
    _bindPylonSend: (sendFn: (msg: unknown) => void) => {
      pylonSendFn = sendFn;
    },
    taskManager,
    workerManager: workerManager as unknown as PylonDependencies['workerManager'],
    folderManager,
    logger,
    packetLogger,
    persistence,
    bugReportWriter,
    credentialManager,
    shareStore,
  };
}

// ============================================================================
// 메인
// ============================================================================

async function main(): Promise<void> {
  logger.log(`[Estelle Pylon v2] Starting...`);
  logger.log(`  Device ID: ${config.deviceId}`);
  logger.log(`  Relay URL: ${config.relayUrl}`);
  logger.log(`  Uploads Dir: ${config.uploadsDir}`);
  logger.log(`  Data Dir: ${dataDir}`);
  logger.log(`  Claude Config Dir: ${claudeConfigDir}`);
  logger.log(`  Credentials Backup Dir: ${credentialsBackupDir}`);

  // 업로드 디렉토리 생성
  if (!fs.existsSync(config.uploadsDir)) {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
  }

  const deps = createDependencies();
  const pylon = new Pylon(config, deps);

  // 지연 바인딩: ClaudeManager.onEvent가 pylon을 참조할 수 있도록 설정
  pylonInstance = pylon;

  // 지연 바인딩: BlobHandler.sendFn이 relayClient.send를 사용하도록 설정
  deps._bindPylonSend((msg) => deps.relayClient.send(msg));

  // PylonMcpServer 생성 (MCP 도구가 WorkspaceStore에 접근 가능하도록)
  const pylonMcpPort = envConfig?.pylon?.mcpPort || parseInt(process.env['ESTELLE_MCP_PORT'] || '9880', 10);
  const pylonMcpServer = new PylonMcpServer(deps.workspaceStore, {
    port: pylonMcpPort,
    onChange: () => pylon.broadcastWorkspaceList(),
    getConversationIdByToolUseId: (toolUseId: string) => {
      return deps.claudeManager.getSessionIdByToolUseId(toolUseId);
    },
    onNewSession: (conversationId: number) => {
      pylon.triggerNewSession(conversationId);
    },
    onConversationCreate: (conversationId: number) => {
      pylon.triggerInitialContext(conversationId);
    },
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.log('Shutting down...');
    await pylonMcpServer.close();
    await pylon.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.log('Shutting down...');
    await pylonMcpServer.close();
    await pylon.stop();
    process.exit(0);
  });

  await pylon.start();

  // PylonMcpServer 시작
  try {
    await pylonMcpServer.listen();
    logger.log(`[PylonMcpServer] Listening on port ${pylonMcpPort}`);
  } catch (err) {
    logger.error(`[PylonMcpServer] Failed to start: ${err}`);
  }

  logger.log(`[Estelle Pylon v2] Started`);
}

main().catch((error) => {
  logger.error(`Failed to start: ${error}`);
  process.exit(1);
});
