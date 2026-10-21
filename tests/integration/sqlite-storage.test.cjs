const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { SQLiteStorage } = require('../../sqlite-storage.cjs');

test('SQLite storage persists values, updates keys, and removes keys', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'gym-town-sqlite-'));
  const databasePath = path.join(directory, 'test.sqlite');

  try {
    let storage = new SQLiteStorage(databasePath);
    assert.equal(storage.get('missing'), null);
    storage.set('app-state', '{"members":[]}');
    storage.set('theme', 'light');
    storage.set('app-state', '{"members":[{"id":"member-1"}]}');
    storage.close();

    storage = new SQLiteStorage(databasePath);
    assert.equal(storage.get('app-state'), '{"members":[{"id":"member-1"}]}');
    assert.equal(storage.get('theme'), 'light');
    storage.remove('theme');
    assert.equal(storage.get('theme'), null);
    storage.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
