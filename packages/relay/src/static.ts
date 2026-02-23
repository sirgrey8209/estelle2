/**
 * @file static.ts
 * @description 정적 파일 서빙 모듈
 *
 * 웹 클라이언트 배포를 위한 정적 파일 서버입니다.
 * SPA(Single Page Application) 라우팅을 지원합니다.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { log } from './utils.js';

/**
 * MIME 타입 매핑
 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * 정적 파일 서버 옵션
 */
export interface StaticServerOptions {
  /** 정적 파일 디렉토리 경로 */
  staticDir: string;

  /** index.html 파일 경로 (SPA fallback용) */
  indexFile?: string;

  /** 캐시 컨트롤 헤더 (기본: 1일) */
  cacheControl?: string;

  /** 에셋 경로 패턴 (더 긴 캐시 적용) */
  assetPathPattern?: RegExp;

  /** 에셋 캐시 컨트롤 헤더 (기본: 1년) */
  assetCacheControl?: string;
}

const DEFAULT_OPTIONS: Required<Omit<StaticServerOptions, 'staticDir'>> = {
  indexFile: 'index.html',
  cacheControl: 'public, max-age=86400', // 1일
  assetPathPattern: /^\/assets\//,
  assetCacheControl: 'public, max-age=31536000, immutable', // 1년 (해시가 포함된 파일)
};

/**
 * 정적 파일을 서빙합니다.
 *
 * @param req - HTTP 요청
 * @param res - HTTP 응답
 * @param options - 서버 옵션
 * @returns 파일이 서빙되었으면 true, 아니면 false
 */
export function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  options: StaticServerOptions
): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { staticDir, indexFile, cacheControl, assetPathPattern, assetCacheControl } = opts;

  // URL 파싱
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname = url.pathname;

  // 보안: 디렉토리 트래버설 방지
  pathname = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');

  // 파일 경로 결정
  let filePath = path.join(staticDir, pathname);

  // 디렉토리인 경우 index.html 추가
  if (pathname.endsWith('/')) {
    filePath = path.join(filePath, indexFile);
  }

  // 파일 존재 확인
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback: 파일이 없으면 index.html 반환
    const indexPath = path.join(staticDir, indexFile);
    if (fs.existsSync(indexPath)) {
      filePath = indexPath;
    } else {
      return false; // 파일 없음
    }
  }

  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // 캐시 컨트롤 결정
    const isVersionJson = pathname === '/version.json';
    const isAsset = assetPathPattern.test(pathname);
    const cache = isVersionJson
      ? 'no-cache, no-store, must-revalidate'
      : isAsset ? assetCacheControl : cacheControl;

    // 응답 전송
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(content);

    return true;
  } catch (err) {
    log(`Static file error: ${(err as Error).message}`);
    return false;
  }
}

/**
 * 404 응답을 전송합니다.
 */
export function send404(res: ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

/**
 * 정적 파일 서버 미들웨어를 생성합니다.
 *
 * @param options - 서버 옵션
 * @returns HTTP 요청 핸들러
 */
export function createStaticHandler(
  options: StaticServerOptions
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req: IncomingMessage, res: ServerResponse) => {
    // WebSocket 업그레이드 요청은 무시
    if (req.headers.upgrade === 'websocket') {
      return;
    }

    // 정적 파일 서빙 시도
    const served = serveStatic(req, res, options);
    if (!served) {
      send404(res);
    }
  };
}
