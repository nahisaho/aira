/**
 * Test helper — creates an in-memory CompatDatabase using sql.js.
 *
 * Replaces the previous better-sqlite3 dependency which was never installed.
 * All test files should use this helper instead of importing better-sqlite3.
 */
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import type { BindParams } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Re-export CompatDatabase type for test files
export interface CompatDatabase {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown | undefined;
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  };
  exec(sql: string): void;
  pragma(statement: string): unknown;
  transaction<T extends (...args: unknown[]) => unknown>(fn: T): T;
  close(): void;
}

function normalizeParams(params: unknown[]): BindParams | undefined {
  if (params.length === 0) return undefined;
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0] as BindParams;
  }
  return params as BindParams;
}

function createWrapper(db: SqlJsDatabase): CompatDatabase {
  return {
    prepare(sql: string) {
      return {
        all(...params: unknown[]): unknown[] {
          const stmt = db.prepare(sql);
          const bound = normalizeParams(params);
          if (bound) stmt.bind(bound);
          const results: unknown[] = [];
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
          return results;
        },
        get(...params: unknown[]): unknown | undefined {
          const stmt = db.prepare(sql);
          const bound = normalizeParams(params);
          if (bound) stmt.bind(bound);
          let result: unknown | undefined;
          if (stmt.step()) {
            result = stmt.getAsObject();
          }
          stmt.free();
          return result;
        },
        run(...params: unknown[]): { changes: number; lastInsertRowid: number } {
          const bound = normalizeParams(params);
          if (bound) {
            db.run(sql, bound);
          } else {
            db.run(sql);
          }
          const changes = db.getRowsModified();
          let lastInsertRowid = 0;
          try {
            const r = db.exec("SELECT last_insert_rowid() as id");
            if (r.length > 0 && r[0].values.length > 0) {
              lastInsertRowid = r[0].values[0][0] as number;
            }
          } catch { /* ignore */ }
          return { changes, lastInsertRowid };
        },
      };
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    pragma(statement: string): unknown {
      const setMatch = statement.match(/^(\w+)\s*=\s*(.+)$/);
      if (setMatch) {
        try { db.run(`PRAGMA ${statement}`); } catch { /* ignore */ }
        return undefined;
      }
      try {
        const result = db.exec(`PRAGMA ${statement}`);
        if (result.length === 0) return [];
        const cols = result[0].columns;
        return result[0].values.map(row => {
          const obj: Record<string, unknown> = {};
          cols.forEach((col, i) => { obj[col] = row[i]; });
          return obj;
        });
      } catch {
        return [];
      }
    },
    transaction<T extends (...args: unknown[]) => unknown>(fn: T): T {
      const wrapped = ((...args: unknown[]) => {
        db.run("BEGIN TRANSACTION");
        try {
          const result = fn(...args);
          db.run("COMMIT");
          return result;
        } catch (err) {
          db.run("ROLLBACK");
          throw err;
        }
      }) as T;
      return wrapped;
    },
    close(): void {
      db.close();
    },
  };
}

let sqlPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null;

function getSql(): Promise<Awaited<ReturnType<typeof initSqlJs>>> {
  if (!sqlPromise) {
    // Locate WASM binary
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(thisDir, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      path.resolve(thisDir, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      path.resolve(thisDir, '..', '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    ];
    let wasmBinary: ArrayBuffer | undefined;
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        const buf = fs.readFileSync(c);
        wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        break;
      }
    }
    sqlPromise = initSqlJs(wasmBinary ? { wasmBinary } : undefined);
  }
  return sqlPromise;
}

/**
 * Create an in-memory CompatDatabase for testing.
 * Must be called with `await` since sql.js init is async.
 */
export async function createTestDatabase(): Promise<CompatDatabase> {
  const SQL = await getSql();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  return createWrapper(db);
}
