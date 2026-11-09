/**
 * One-off importer: JSON backup  ->  Supabase (PostgreSQL)
 *
 * Usage
 *   SUPABASE_URL="https://xxxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="service-role-key" \
 *   npx tsx scripts/import-backup-to-supabase.ts ./the-gym-town-backup.json
 *
 * Notes
 * - Uses the SERVICE ROLE key on purpose: it bypasses RLS so the import works
 *   before any staff account exists. Never put this key in the browser bundle.
 * - Safe to re-run: rows are upserted on their primary key (id / gym_id).
 * - The backup file is the one from Settings -> Export Full Backup.
 */

import { readFileSync } from 'node:fs';

type AnyRecord = Record<string, unknown>;

const tablesModule = await import('../src/db/cloud/mapper');
const { stateToTables, CLOUD_TABLE_ORDER, GYM_ID } = tablesModule;

const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const filePath = process.argv[2];

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.');
  process.exit(1);
}
if (!filePath) {
  console.error('Usage: npx tsx scripts/import-backup-to-supabase.ts <backup.json>');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(filePath, 'utf8')) as AnyRecord;
const database = (raw && typeof raw === 'object' && 'database' in raw ? raw.database : raw) as AnyRecord;

if (!database || !Array.isArray(database.members)) {
  console.error('This file does not look like a Gym Town backup (no members table).');
  process.exit(1);
}

// The mapper only needs the table arrays + settings, so fill the gaps.
const state = {
  members: [],
  plans: [],
  membershipHistory: [],
  memberFeeLedger: [],
  attendance: [],
  payments: [],
  expenses: [],
  doorLogs: [],
  notifications: [],
  users: [],
  auditLogs: [],
  products: [],
  sales: [],
  stockPurchases: [],
  inventoryTransactions: [],
  suppliers: [],
  ...database,
  settings: database.settings ?? {},
  currentUser: database.currentUser ?? { id: 'import', username: 'import', fullName: 'Import', role: 'GYM_OWNER', email: '', isActive: true },
} as Parameters<typeof stateToTables>[0];

const tables = stateToTables(state);

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

const chunk = <T,>(items: T[], size: number): T[][] =>
  items.length === 0 ? [] : Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  );

async function upsert(table: string, rows: AnyRecord[], conflictColumn: string) {
  if (rows.length === 0) {
    console.log(`  ${table.padEnd(24)} 0 rows (skipped)`);
    return 0;
  }

  let written = 0;
  for (const batch of chunk(rows, 400)) {
    const response = await fetch(
      `${url}/rest/v1/${table}?on_conflict=${conflictColumn}`,
      {
        method: 'POST',
        headers: {
          ...headers,
          // merge-duplicates = UPDATE on conflict; missing-to-null keeps old columns
          Prefer: 'resolution=merge-duplicates, missing=default, return=minimal',
        },
        body: JSON.stringify(batch),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${table} import failed (${response.status}): ${text.slice(0, 400)}`);
    }
    written += batch.length;
  }

  console.log(`  ${table.padEnd(24)} ${written} rows`);
  return written;
}

console.log(`Importing into ${url} (gym_id = ${GYM_ID})\n`);

let total = 0;
for (const table of CLOUD_TABLE_ORDER) {
  const conflictColumn = table === 'settings' ? 'gym_id' : 'id';
  total += await upsert(table, tables[table] as AnyRecord[], conflictColumn);
}

console.log(`\nDone — ${total} rows written.`);

// Verification hints
const verify = await fetch(
  `${url}/rest/v1/members?select=id,roll_number,full_name,balance_due&order=roll_number.asc&limit=5`,
  { headers }
);
if (verify.ok) {
  const sample = (await verify.json()) as AnyRecord[];
  console.log('\nSample members now in Postgres:');
  console.table(sample);
} else {
  console.warn('Could not read back a sample of members:', verify.status);
}

console.log(
  '\nNext: create your staff login (Authentication -> Users -> Add user) and put {"gym_id":"gym_main"} in the user metadata.'
);
