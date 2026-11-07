// SQLite adapter - re-exported from db-sqlite.js
import { db, sqlite, formatSql, formatDbDate, parseDbDate } from "./db-sqlite.js";

// Export pool-like object for compatibility with legacy pg code
export const pool = {
  async query(text, params = []) {
    return db.query(text, params);
  },
  end() {
    db.close();
  }
};

export { db, sqlite, formatSql, formatDbDate, parseDbDate };
export default db;
