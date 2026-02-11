#!/usr/bin/env node
/**
 * @file bin.ts
 * @description ClaudeBeacon CLI 진입점
 *
 * 단일 Claude SDK 인스턴스로 여러 Pylon(dev/stage/release)을 서비스합니다.
 * PM2로 관리되며, TCP 포트 9875에서 Pylon 연결을 수신합니다.
 */

import {
  query,
  type McpServerConfig,
  type SettingSource,
  type CanUseTool,
} from '@anthropic-ai/claude-agent-sdk';
import { ClaudeBeacon } from './beacon.js';

// ============================================================================
// 상수
// ============================================================================

const DEFAULT_PORT = 9875;

// ============================================================================
// SDK 어댑터
// ============================================================================

/**
 * Claude SDK 어댑터 (실제 SDK 호출)
 */
const sdkAdapter = {
  async *query(options: Record<string, unknown>) {
    const sdkOptions = {
      cwd: options.cwd as string | undefined,
      abortController: options.abortController as AbortController | undefined,
      includePartialMessages: (options.includePartialMessages ?? true) as boolean,
      settingSources: (options.settingSources ?? ['user', 'project', 'local']) as SettingSource[],
      resume: options.resume as string | undefined,
      mcpServers: options.mcpServers as Record<string, McpServerConfig> | undefined,
      canUseTool: options.canUseTool as CanUseTool | undefined,
      env: options.env as Record<string, string> | undefined,
    };

    const sdkQuery = query({
      prompt: options.prompt as string,
      options: sdkOptions,
    });

    for await (const msg of sdkQuery) {
      yield msg as { type: string; [key: string]: unknown };
    }
  },
};

// ============================================================================
// 메인
// ============================================================================

async function main(): Promise<void> {
  const port = parseInt(process.env.BEACON_PORT || String(DEFAULT_PORT), 10);
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR || '(default: ~/.claude)';

  console.log(`[ClaudeBeacon] Starting...`);
  console.log(`[ClaudeBeacon]   Port: ${port}`);
  console.log(`[ClaudeBeacon]   CLAUDE_CONFIG_DIR: ${claudeConfigDir}`);

  const beacon = new ClaudeBeacon({
    adapter: sdkAdapter,
    port,
  });

  await beacon.start();

  console.log(`[ClaudeBeacon] Listening on 127.0.0.1:${port}`);
  console.log('[ClaudeBeacon] Waiting for Pylon connections...');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[ClaudeBeacon] Shutting down...');
    await beacon.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('[ClaudeBeacon] Received SIGTERM, shutting down...');
    await beacon.stop();
    process.exit(0);
  });

  // 상태 출력 (10초마다)
  setInterval(() => {
    const pylons = beacon.getPylons();
    if (pylons.length > 0) {
      console.log(
        `[ClaudeBeacon] Connected Pylons: ${pylons.map((p) => `${p.env}(${p.pylonAddress})`).join(', ')}`
      );
    }
  }, 10000);
}

main().catch((err) => {
  console.error('[ClaudeBeacon] Fatal error:', err);
  process.exit(1);
});
