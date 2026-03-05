/**
 * @file widget-asset-handler.ts
 * @description 위젯 에셋 파일 서빙
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

// MIME 타입 매핑
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.js': 'application/javascript',
  '.json': 'application/json',
};

// 세션별 에셋 경로 저장
const sessionAssets = new Map<string, Map<string, string>>();

/**
 * 세션에 에셋 등록
 */
export function registerAssets(
  sessionId: string,
  assets: Record<string, string>,
  cwd: string
): void {
  const assetMap = new Map<string, string>();
  for (const [key, filePath] of Object.entries(assets)) {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(cwd, filePath);
    assetMap.set(key, absolutePath);
  }
  sessionAssets.set(sessionId, assetMap);
}

/**
 * 세션 에셋 정리
 */
export function cleanupAssets(sessionId: string): void {
  sessionAssets.delete(sessionId);
}

/**
 * 에셋 URL 생성
 */
export function getAssetUrls(
  sessionId: string,
  assets: Record<string, string>,
  baseUrl: string
): Record<string, string> {
  const urls: Record<string, string> = {};
  for (const key of Object.keys(assets)) {
    urls[key] = `${baseUrl}/widget-assets/${sessionId}/${encodeURIComponent(key)}`;
  }
  return urls;
}

/**
 * 에셋 요청 핸들러
 */
export async function handleAssetRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessionId: string,
  assetKey: string
): Promise<void> {
  const assetMap = sessionAssets.get(sessionId);
  if (!assetMap) {
    res.writeHead(404);
    res.end('Session not found');
    return;
  }

  const filePath = assetMap.get(decodeURIComponent(assetKey));
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404);
    res.end('Asset not found');
    return;
  }

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'max-age=3600',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500);
    res.end('Failed to read asset');
  }
}
