/**
 * @file static.ts
 * @description 정적 파일 서빙 모듈
 *
 * 웹 클라이언트 배포를 위한 정적 파일 서버입니다.
 * SPA(Single Page Application) 라우팅을 지원합니다.
 * Dev Hub 대시보드도 제공합니다.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';
import { log } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// ============================================================================
// Hub Dashboard
// ============================================================================

/**
 * Hub 라우트 설정 인터페이스
 */
interface HubProject {
  name: string;
  path: string;
  port: number;
  url?: string;
  description?: string;
}

interface HubRoutes {
  projects: HubProject[];
}

/**
 * hub-routes.json 설정 파일 경로
 */
function getHubRoutesPath(): string {
  // packages/relay/src -> packages/relay -> packages -> estelle2 -> config
  return path.resolve(__dirname, '..', '..', '..', 'config', 'hub-routes.json');
}

/**
 * hub-routes.json에서 프로젝트 목록을 로드합니다.
 * 매 요청마다 파일을 다시 읽어 변경사항을 즉시 반영합니다.
 */
function loadHubRoutes(): HubRoutes {
  const configPath = getHubRoutesPath();
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as HubRoutes;
  } catch (err) {
    log(`Hub routes config not found or invalid: ${configPath}`);
    return { projects: [] };
  }
}

/**
 * Hub 대시보드 HTML을 생성합니다.
 */
function generateHubDashboard(projects: HubProject[], host: string): string {
  const projectCards = projects.map(p => {
    const projectUrl = p.url || `http://${host.split(':')[0]}:${p.port}`;
    const portDisplay = p.url ? new URL(p.url).pathname : `:${p.port}`;
    return `
    <a href="${projectUrl}" class="project-card" target="_blank">
      <div class="project-name">${p.name}</div>
      <div class="project-desc">${p.description || ''}</div>
      <div class="project-port">${portDisplay}</div>
    </a>
  `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dev Hub</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
      padding: 2rem;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      text-align: center;
      margin-bottom: 0.5rem;
      font-size: 2.5rem;
      background: linear-gradient(90deg, #00d2ff, #3a7bd5);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      text-align: center;
      color: #888;
      margin-bottom: 2rem;
    }
    .projects {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }
    .project-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 1.5rem;
      text-decoration: none;
      color: #fff;
      transition: all 0.3s ease;
      display: block;
    }
    .project-card:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: #3a7bd5;
      transform: translateY(-4px);
    }
    .project-name {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .project-desc {
      color: #aaa;
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }
    .project-port {
      font-family: monospace;
      color: #3a7bd5;
      font-size: 0.85rem;
    }
    .empty {
      text-align: center;
      color: #666;
      padding: 3rem;
    }
    .refresh-note {
      text-align: center;
      color: #555;
      font-size: 0.8rem;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Dev Hub</h1>
    <p class="subtitle">Development Projects Dashboard</p>
    <div class="projects">
      ${projectCards || '<div class="empty">No projects configured.<br>Edit config/hub-routes.json to add projects.</div>'}
    </div>
    <p class="refresh-note">Refresh to reload project list</p>
  </div>
</body>
</html>`;
}

/**
 * Hub 대시보드를 서빙합니다.
 */
function serveHubDashboard(req: IncomingMessage, res: ServerResponse): void {
  const routes = loadHubRoutes();
  const host = req.headers.host || 'localhost';
  const html = generateHubDashboard(routes.projects, host);

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(html);
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

    // Hub 대시보드
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/hub' || url.pathname === '/hub/') {
      return serveHubDashboard(req, res);
    }

    // 정적 파일 서빙 시도
    const served = serveStatic(req, res, options);
    if (!served) {
      send404(res);
    }
  };
}
