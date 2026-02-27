// SQLite DB 확인 스크립트
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'stage-data', 'data', 'messages.db');

console.log('DB Path:', dbPath);

const db = new Database(dbPath, { readonly: true });

// 테이블 확인
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('\n=== Tables ===');
console.log(tables);

// 메시지 개수
const count = db.prepare('SELECT COUNT(*) as count FROM messages').get();
console.log('\n=== Total Messages ===');
console.log(count);

// 세션별 메시지 개수
const sessions = db.prepare('SELECT session_id, COUNT(*) as count FROM messages GROUP BY session_id').all();
console.log('\n=== Messages per Session ===');
console.log(sessions);

// 최근 10개 메시지
const recent = db.prepare(`
  SELECT id, session_id, role, type,
         SUBSTR(content, 1, 50) as content_preview,
         timestamp
  FROM messages
  ORDER BY timestamp DESC
  LIMIT 10
`).all();
console.log('\n=== Recent 10 Messages ===');
console.log(recent);

// 마이그레이션 상태
const migration = db.prepare("SELECT * FROM migration_status").all();
console.log('\n=== Migration Status ===');
console.log(migration);

db.close();
