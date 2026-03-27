/**
 * @file command-store.ts
 * @description CommandStore - 커맨드 툴바용 커맨드 저장소 (SQLite 기반)
 *
 * 워크스페이스별 커맨드 버튼 데이터를 관리하는 SQLite 기반 저장소입니다.
 *
 * @example
 * ```typescript
 * const store = new CommandStore('data/commands.db');
 * const id = store.createCommand('Review', 'search', '#ff0000', 'Review this code');
 * store.assignCommand(id, null); // 글로벌
 * const commands = store.getCommands(workspaceId);
 * store.close();
 * ```
 */

import Database from 'better-sqlite3';

export interface CommandListItem {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  content: string;
}

export class CommandStore {
  private db: Database.Database;
  private stmtInsertCommand!: Database.Statement;
  private stmtDeleteCommand!: Database.Statement;
  private stmtGetContent!: Database.Statement;
  private stmtGetCommands!: Database.Statement;
  private stmtAssign!: Database.Statement;
  private stmtUnassign!: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._initSchema();
    this._prepareStatements();
  }

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        content TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS command_assignments (
        command_id INTEGER NOT NULL REFERENCES commands(id) ON DELETE CASCADE,
        workspace_id INTEGER NOT NULL DEFAULT 0,
        UNIQUE(command_id, workspace_id)
      );

      UPDATE command_assignments SET workspace_id = 0 WHERE workspace_id IS NULL;
    `);
  }

  private _prepareStatements(): void {
    this.stmtInsertCommand = this.db.prepare(
      'INSERT INTO commands (name, icon, color, content) VALUES (?, ?, ?, ?)'
    );
    this.stmtDeleteCommand = this.db.prepare('DELETE FROM commands WHERE id = ?');
    this.stmtGetContent = this.db.prepare('SELECT content FROM commands WHERE id = ?');
    this.stmtGetCommands = this.db.prepare(
      'SELECT DISTINCT c.id, c.name, c.icon, c.color, c.content FROM commands c INNER JOIN command_assignments ca ON c.id = ca.command_id WHERE ca.workspace_id = 0 OR ca.workspace_id = ?'
    );
    this.stmtAssign = this.db.prepare(
      'INSERT OR IGNORE INTO command_assignments (command_id, workspace_id) VALUES (?, ?)'
    );
    this.stmtUnassign = this.db.prepare(
      'DELETE FROM command_assignments WHERE command_id = ? AND workspace_id = ?'
    );
  }

  createCommand(name: string, icon: string | null, color: string | null, content: string): number {
    const result = this.stmtInsertCommand.run(name, icon, color, content);
    return Number(result.lastInsertRowid);
  }

  updateCommand(id: number, fields: { name?: string; icon?: string; color?: string; content?: string }): boolean {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (fields.name !== undefined) { setClauses.push('name = ?'); values.push(fields.name); }
    if (fields.icon !== undefined) { setClauses.push('icon = ?'); values.push(fields.icon); }
    if (fields.color !== undefined) { setClauses.push('color = ?'); values.push(fields.color); }
    if (fields.content !== undefined) { setClauses.push('content = ?'); values.push(fields.content); }

    if (setClauses.length === 0) return false;

    values.push(id);
    const stmt = this.db.prepare(`UPDATE commands SET ${setClauses.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  deleteCommand(id: number): boolean {
    const result = this.stmtDeleteCommand.run(id);
    return result.changes > 0;
  }

  getContent(id: number): string | null {
    const row = this.stmtGetContent.get(id) as { content: string } | undefined;
    return row?.content ?? null;
  }

  getCommands(workspaceId: number): CommandListItem[] {
    return this.stmtGetCommands.all(workspaceId) as CommandListItem[];
  }

  assignCommand(commandId: number, workspaceId: number | null): void {
    this.stmtAssign.run(commandId, workspaceId ?? 0);
  }

  unassignCommand(commandId: number, workspaceId: number | null): void {
    this.stmtUnassign.run(commandId, workspaceId ?? 0);
  }

  getCommandsByWorkspaces(workspaceIds: number[]): Map<number, CommandListItem[]> {
    const result = new Map<number, CommandListItem[]>();
    for (const wsId of workspaceIds) {
      result.set(wsId, this.getCommands(wsId));
    }
    return result;
  }

  getAssignedWorkspaceIds(commandId: number): (number | null)[] {
    const stmt = this.db.prepare(
      'SELECT workspace_id FROM command_assignments WHERE command_id = ?'
    );
    const rows = stmt.all(commandId) as { workspace_id: number }[];
    return rows.map(r => r.workspace_id === 0 ? null : r.workspace_id);
  }

  getCommandById(id: number): CommandListItem | null {
    const stmt = this.db.prepare('SELECT id, name, icon, color, content FROM commands WHERE id = ?');
    const row = stmt.get(id) as CommandListItem | undefined;
    return row ?? null;
  }

  close(): void {
    this.db.close();
  }
}
