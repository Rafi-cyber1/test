const { DatabaseSync } = require('node:sqlite');

class SQLiteStorage {
  constructor(databasePath) {
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS app_storage (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) STRICT;
    `);
    this.getStatement = this.database.prepare('SELECT value FROM app_storage WHERE key = ?');
    this.setStatement = this.database.prepare(`
      INSERT INTO app_storage (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);
    this.deleteStatement = this.database.prepare('DELETE FROM app_storage WHERE key = ?');
  }

  get(key) {
    return this.getStatement.get(key)?.value ?? null;
  }

  set(key, value) {
    this.setStatement.run(key, value);
  }

  remove(key) {
    this.deleteStatement.run(key);
  }

  close() {
    this.database.close();
  }
}

module.exports = { SQLiteStorage };
