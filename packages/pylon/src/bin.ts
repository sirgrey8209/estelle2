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

import { Pylon, type PylonConfig, type PylonDependencies } from './pylon.js';
import { WorkspaceStore } from './stores/workspace-store.js';
import { MessageStore } from './stores/message-store.js';
import { createRelayClient } from './network/relay-client.js';
import { ClaudeManager } from './claude/claude-manager.js';
import { ClaudeSDKAdapter } from './claude/claude-sdk-adapter.js';
import { BlobHandler, type FileSystemAdapter } from './handlers/blob-handler.js';
import { TaskManager, type FileSystem } from './managers/task-manager.js';
import { WorkerManager } from './managers/worker-manager.js';
import { FolderManager, type FolderFileSystem } from './managers/folder-manager.js';
import { FileSystemPersistence, type FileSystemInterface } from './persistence/file-system-persistence.js';

// ============================================================================
// 설정
// ============================================================================

const config: PylonConfig = {
  deviceId: parseInt(process.env['DEVICE_ID'] || '1', 10),
  relayUrl: process.env['RELAY_URL'] || 'ws://localhost:8080',
  uploadsDir: process.env['UPLOADS_DIR'] || './uploads',
};

/** 데이터 저장 디렉토리 */
const dataDir = process.env['DATA_DIR'] || './data';

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
  const configPaths = [
    path.join(workingDir, '.estelle', 'mcp-config.json'),
    path.join(workingDir, '.mcp.json'),
  ];

  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content);
        logger.log(`[MCP] Loaded config from ${configPath}`);
        return config;
      }
    } catch (err) {
      logger.error(`[MCP] Failed to load config from ${configPath}: ${err}`);
    }
  }

  return null;
}

function createDependencies(): PylonDependencies {
  // Persistence 생성
  const persistence = new FileSystemPersistence(dataDir, persistenceFileSystem);

  // WorkspaceStore 로드 또는 새로 생성
  const workspaceData = persistence.loadWorkspaceStore();
  const workspaceStore = workspaceData
    ? WorkspaceStore.fromJSON(workspaceData)
    : new WorkspaceStore();

  if (workspaceData) {
    logger.log(`[Persistence] Loaded ${workspaceData.workspaces?.length || 0} workspaces from ${dataDir}`);
  }

  const messageStore = new MessageStore();

  // RelayClient
  const relayClient = createRelayClient({
    url: config.relayUrl,
    deviceId: config.deviceId,
    reconnectInterval: 5000,
  });

  // ClaudeSDKAdapter
  const claudeAdapter = new ClaudeSDKAdapter();

  // ClaudeManager - 지연 바인딩으로 pylon 연결
  const claudeManager = new ClaudeManager({
    adapter: claudeAdapter,
    getPermissionMode: (sessionId: string) => {
      // sessionId = conversationId
      const workspaceId = workspaceStore.findWorkspaceByConversation(sessionId);
      if (!workspaceId) return 'default';
      const conversation = workspaceStore.getConversation(workspaceId, sessionId);
      return conversation?.permissionMode ?? 'default';
    },
    loadMcpConfig,
    onEvent: (sessionId, event) => {
      // 지연 바인딩: pylon이 생성된 후에 호출됨
      if (pylonInstance) {
        pylonInstance.sendClaudeEvent(sessionId, event);
      } else {
        logger.warn(`[Claude] Event received but pylon not ready: ${event.type}`);
      }
    },
  });

  // BlobHandler
  const blobHandler = new BlobHandler({
    uploadsDir: config.uploadsDir,
    fs: blobFileSystem,
    sendFn: () => {},
  });

  // TaskManager
  const taskManager = new TaskManager(taskFileSystem);

  // WorkerManager
  const workerManager = new WorkerManager(taskManager);

  // FolderManager
  const folderManager = new FolderManager(folderFileSystem);

  // 어댑터 인터페이스와 실제 구현체 시그니처 차이로 인한 타입 캐스팅
  // TODO: pylon.ts의 어댑터 인터페이스를 실제 구현체에 맞게 정리 필요
  return {
    workspaceStore,
    messageStore,
    relayClient,
    claudeManager,
    blobHandler: blobHandler as unknown as PylonDependencies['blobHandler'],
    taskManager,
    workerManager: workerManager as unknown as PylonDependencies['workerManager'],
    folderManager,
    logger,
    packetLogger,
    persistence,
    bugReportWriter,
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

  // 업로드 디렉토리 생성
  if (!fs.existsSync(config.uploadsDir)) {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
  }

  const deps = createDependencies();
  const pylon = new Pylon(config, deps);

  // 지연 바인딩: ClaudeManager.onEvent가 pylon을 참조할 수 있도록 설정
  pylonInstance = pylon;

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.log('Shutting down...');
    await pylon.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.log('Shutting down...');
    await pylon.stop();
    process.exit(0);
  });

  await pylon.start();
  logger.log(`[Estelle Pylon v2] Started`);
}

main().catch((error) => {
  logger.error(`Failed to start: ${error}`);
  process.exit(1);
});
