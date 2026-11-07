import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.join(__dirname, "zihai.db");
const sqlite = new Database(dbPath, { timeout: 5000 });

// Enable WAL mode for performance
try {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
} catch (e) {
  // Ignore lock errors on pragmas during parallel test runs
}

/**
 * Translate Postgres-flavoured SQL into SQLite SQL, keeping `$N` placeholders
 * intact (they are resolved separately by `translate`).
 */
function convertDialect(text) {
  let sql = text;
  // `expr::date` -> `date(expr)` (must run before generic cast stripping).
  sql = sql.replace(/(\$\d+|\b[A-Za-z_][\w.]*)::date\b/gi, "date($1)");
  sql = sql.replace(/position\((.+?)\s+in\s+(.+?)\)/gi, "instr($2, $1)");
  sql = sql.replace(/::[a-zA-Z_]+/g, "");
  sql = sql.replace(/NOW\(\)\s*\+\s*INTERVAL\s*'(\d+)\s*hour'/gi, "datetime('now', '+$1 hour')");
  sql = sql.replace(/NOW\(\)\s*\+\s*INTERVAL\s*'(\d+)\s*day'/gi, "datetime('now', '+$1 day')");
  sql = sql.replace(/CURRENT_DATE\s*-\s*INTERVAL\s*'(\d+)\s*days?'/gi, "DATE('now', '-$1 days')");
  sql = sql.replace(/NOW\(\)/gi, "CURRENT_TIMESTAMP");
  sql = sql.replace(/SERIAL\s+PRIMARY\s+KEY/gi, "INTEGER PRIMARY KEY AUTOINCREMENT");
  sql = sql.replace(/\bLEAST\(/gi, "MIN(");
  sql = sql.replace(/\bGREATEST\(/gi, "MAX(");
  sql = sql.replace(/\s+RETURNING\s+[a-zA-Z0-9_,\s*]+/gi, "");
  return sql;
}

export function formatSql(text) {
  if (typeof text !== "string") return text;
  return convertDialect(text).replace(/\$(\d+)/g, "?");
}

/** SQLite-friendly timestamp (same format as CURRENT_TIMESTAMP, UTC). */
export function formatDbDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/** Parse a value read from the DB (UTC `YYYY-MM-DD HH:MM:SS`) into a Date. */
export function parseDbDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(value.replace(" ", "T") + "Z");
  }
  return new Date(value);
}

function toBindable(value) {
  if (value === undefined) return null;
  if (value instanceof Date) return formatDbDate(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

/**
 * Convert SQL + params to something better-sqlite3 accepts. `$N` placeholders
 * may be reused or appear out of order: each occurrence becomes a `?` and the
 * params array is rebuilt in occurrence order.
 */
function translate(text, params = []) {
  let sql = convertDialect(text);
  let bound = Array.isArray(params) ? params : [params];
  if (/\$\d+/.test(sql)) {
    const order = [];
    sql = sql.replace(/\$(\d+)/g, (_, n) => {
      order.push(Number(n) - 1);
      return "?";
    });
    bound = order.map((i) => bound[i]);
  }
  return { sql, params: bound.map(toBindable) };
}

// Drop-in replacement for pg-based db — same API
const db = {
  prepare(text) {
    const sql = formatSql(text);
    return sqlite.prepare(sql);
  },

  all(text, params = []) {
    const { sql, params: p } = translate(text, params);
    const stmt = sqlite.prepare(sql);
    if (!stmt.reader) {
      stmt.run(...p);
      return [];
    }
    return stmt.all(...p);
  },

  get(text, params = []) {
    const { sql, params: p } = translate(text, params);
    const stmt = sqlite.prepare(sql);
    if (!stmt.reader) {
      stmt.run(...p);
      return null;
    }
    return stmt.get(...p) || null;
  },

  run(text, params = []) {
    const { sql, params: p } = translate(text, params);
    const stmt = sqlite.prepare(sql);
    if (stmt.reader) {
      return stmt.all(...p);
    }
    const result = stmt.run(...p);
    return {
      changes: result?.changes || 0,
      rowCount: result?.changes || 0,
      lastInsertRowid: result?.lastInsertRowid || 0,
    };
  },


  async query(text, params = []) {
    const rows = this.all(text, params);
    return { rows };
  },

  async queryOne(text, params = []) {
    const row = this.get(text, params);
    return { rows: row ? [row] : [] };
  },

  async execute(text, params = []) {
    return this.run(text, params);
  },

  transaction(fn) {
    const txn = sqlite.transaction(fn);
    return txn();
  },

  close() {
    return sqlite.close();
  },

  _db: sqlite,
};

// ─── Startup self-healing migrations ────────────────────────────────────────
// Older databases (migrated from Postgres) can lack tables/constraints that the
// routes rely on. Everything here is idempotent and never throws.

function tableExists(name) {
  return !!sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?")
    .get(name);
}

function columnNames(table) {
  return sqlite.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function addColumnIfMissing(table, column, definition) {
  if (!tableExists(table)) return;
  if (!columnNames(table).includes(column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function ensureUniqueIndex(name, table, columns) {
  if (!tableExists(table)) return;
  const existing = columnNames(table);
  if (!columns.every((c) => existing.includes(c))) return;
  const cols = columns.join(", ");
  const create = `CREATE UNIQUE INDEX IF NOT EXISTS ${name} ON ${table}(${cols})`;
  try {
    sqlite.exec(create);
  } catch {
    // Duplicates exist: keep the oldest row of each group, then retry.
    sqlite.exec(
      `DELETE FROM ${table} WHERE rowid NOT IN (SELECT MIN(rowid) FROM ${table} GROUP BY ${cols})`,
    );
    sqlite.exec(create);
  }
}

function ensureSchema() {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS mock_test_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        hsk_level INTEGER NOT NULL,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL,
        time_taken INTEGER DEFAULT 0,
        answers TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    addColumnIfMissing("users", "xp", "INTEGER DEFAULT 0");
    addColumnIfMissing("users", "streak_days", "INTEGER DEFAULT 0");
    addColumnIfMissing("users", "last_login", "TEXT");
    addColumnIfMissing("users", "gems", "INTEGER DEFAULT 0");
    addColumnIfMissing("users", "streak_freezes", "INTEGER DEFAULT 0");
    addColumnIfMissing("users", "previous_streak", "INTEGER DEFAULT 0");
    addColumnIfMissing("users", "is_admin", "INTEGER DEFAULT 0");

    // `id SERIAL PRIMARY KEY` is not an auto-increment key in SQLite, so quest
    // rows were created with NULL ids. Rebuild the table preserving its rows.
    const quests = sqlite
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_quests'")
      .get();
    if (quests && /SERIAL/i.test(quests.sql)) {
      sqlite.transaction(() => {
        sqlite.exec(`
          CREATE TABLE user_quests_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            quest_type VARCHAR(50) NOT NULL,
            progress INTEGER DEFAULT 0,
            target INTEGER NOT NULL,
            gems_reward INTEGER NOT NULL,
            claimed INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO user_quests_new (user_id, quest_type, progress, target, gems_reward, claimed, updated_at)
            SELECT user_id, quest_type, progress, target, gems_reward, claimed, updated_at FROM user_quests;
          DROP TABLE user_quests;
          ALTER TABLE user_quests_new RENAME TO user_quests;
        `);
      })();
    }

    // Required by `ON CONFLICT (...)` clauses in the routes.
    ensureUniqueIndex("uq_flashcard_progress_user_word", "flashcard_progress", ["user_id", "word_id"]);
    ensureUniqueIndex("uq_favorites_user_word", "favorites", ["user_id", "word_id"]);
    ensureUniqueIndex("uq_search_history_user_query", "search_history", ["user_id", "query"]);
    ensureUniqueIndex("uq_custom_list_words", "custom_list_words", ["list_id", "word_id"]);
    ensureUniqueIndex("uq_user_achievements", "user_achievements", ["user_id", "achievement_id"]);
  } catch (err) {
    console.error("Schema self-heal failed (non-fatal):", err.message);
  }
}

ensureSchema();

export { db, sqlite };
