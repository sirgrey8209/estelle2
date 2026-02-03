#!/usr/bin/env node
/**
 * @file bin.ts
 * @description CLI 실행 진입점
 */

import { runCli } from './cli.js';

runCli().catch((error) => {
  console.error('Failed to start relay server:', error);
  process.exit(1);
});
