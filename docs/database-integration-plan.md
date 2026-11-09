# Database integration plan — The Gym Town

_How to move the front desk from browser `localStorage` to a real, shared database without rewriting the app._

---

## 1. Where the data lives today

| Layer | File | Behaviour |
| --- | --- | --- |
| Storage engine | `src/db/storage.ts` | Single `DatabaseState` object, persisted to `localStorage` (`tgt_*` keys), in-memory cache + `subscribe()` listeners |
| Small prefs | `src/db/appStorage.ts` | Theme, misc UI prefs |
| Types | `src/types/index.ts` | `DatabaseState` and every table type |
| Backup / restore | `src/db/storage.ts` (`exportBackupJson`, `restoreBackupJson`) | Full JSON dump of every table, schema v3 |

Consequences of the current design:

- Data belongs to **one browser on one machine**. A second desk (or a phone) sees an empty app.
- "Clear site data", a new laptop, or a reinstall wipes everything unless a backup JSON was taken.
- No logins, no audit trail that a second device can trust, no reporting outside the browser.

The good news: **all reads/writes already go through the `db` facade** (`db.getMembers()`, `db.addMember()`, …). Every screen talks to `db`, never to `localStorage` directly. That is exactly the seam we need — the screens do not change at all.

---

## 2. Recommendation: Supabase (Postgres) first

For a single gym with 1–3 desks, **Supabase** is the best first step:

- Real PostgreSQL (relations, joins, SUM/aggregate reports) — a gym's fee ledger is relational data.
- Built-in auth (email/password or magic link), row-level security, and realtime subscriptions.
- Hosted, no server to run; the React app on Vercel talks to it directly with the public anon key.
- Free tier is plenty (500 MB DB, unlimited API requests) — years of gym data is a few MB.
- SQL is portable: if you outgrow it, the same schema moves to any Postgres host.

Alternatives, briefly:

| Option | Good for | Trade-off |
| --- | --- | --- |
| **Supabase** (Postgres) | Multi-desk, real reports, auth, RLS | Relational thinking required |
| Firebase Firestore | Fastest realtime, minimal schema work | Weak relational reporting (fee ledger, month-wise balances), vendor lock-in, pricing per read |
| Own Node/Express + Postgres on Railway/Render | Full control, custom APIs | You now run and patch a server, backups, uptime |
| Turso / SQLite + sync | Cheap, SQL, offline-first | Sync conflicts are your problem |

For this app the ranking is: **Supabase > own Node+Postgres > Turso > Firebase**.

---

## 3. Target architecture

```
React screens
     │  (unchanged API)
     ▼
src/db/storage.ts  ── the `db` facade (getters, mutators, subscribe)
     │
     ├── local cache: in-memory + localStorage (offline fallback)
     ▼
src/db/cloud/  (new)
     ├── supabaseClient.ts   createClient(url, anonKey)
     ├── syncEngine.ts       pull snapshot → apply mutations → push queue
     ├── mapper.ts           DatabaseState ⟷ rows (snake_case tables)
     └── queue.ts            IndexedDB write-queue for offline desks
```

**Golden rule:** the facade never blocks the UI. Mutations update the in-memory state, fire the existing `subscribe()` listeners instantly, then push to the cloud in the background. If the push fails (no internet), it is queued and retried; the UI stays responsive and the receipt still prints.

A feature flag makes the cutover safe:

```bash
# .env
VITE_DATA_MODE=local        # today
VITE_DATA_MODE=cloud        # after go-live
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

`storage.ts` picks the driver at boot, so you can run `local` and `cloud` side by side until the owner is confident.

---

## 4. Schema sketch (Postgres)

Mirrors the existing tables one-to-one so the JSON backup maps directly.

```sql
create table gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz default now()
);

create table profiles (            -- front desk staff, linked to auth.users
  id uuid primary key references auth.users on delete cascade,
  gym_id uuid references gyms not null,
  full_name text not null,
  role text not null check (role in ('owner','manager','receptionist')),
  shift text
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms not null,
  name text not null,
  duration_months int not null,
  fee numeric(10,2) not null,
  active boolean default true
);

create table members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms not null,
  roll_number text not null,               -- 'the-gym-town-01'
  full_name text not null,
  mobile_number text not null,
  cnic text,
  gender text,
  blood_group text,
  address text,
  join_date date not null,
  plan_id uuid references plans,
  plan_name text not null,
  total_fee numeric(10,2) not null default 0,
  paid_amount numeric(10,2) not null default 0,
  balance_due numeric(10,2) not null default 0,
  expiry_date date,
  status text not null default 'ACTIVE',
  removed_at timestamptz,
  version int not null default 1,          -- optimistic concurrency
  updated_at timestamptz default now(),
  unique (gym_id, roll_number)
);

create table member_fee_ledger (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms not null,
  member_id uuid references members on delete cascade,
  entry_date date not null,
  billing_month text,                      -- 'YYYY-MM'
  description text,
  charge numeric(10,2) not null default 0,
  payment numeric(10,2) not null default 0,
  remaining_balance numeric(10,2) not null default 0,
  receipt_no text,
  created_at timestamptz default now()
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms not null,
  member_id uuid references members on delete cascade,
  check_in_at timestamptz not null,
  method text default 'MANUAL'
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms not null,
  member_id uuid references members on delete cascade,
  amount numeric(10,2) not null,
  method text,
  reference text,
  receipt_no text,
  paid_at timestamptz default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms not null,
  code text, name text not null, category text,
  purchase_price numeric(10,2) default 0,
  sale_price numeric(10,2) default 0,
  stock_quantity int default 0,
  low_stock_threshold int default 5
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms not null,
  member_id uuid references members,
  total_amount numeric(10,2) not null,
  total_cost numeric(10,2) not null default 0,
  sold_at timestamptz default now(),
  sold_by uuid references profiles
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales on delete cascade,
  product_id uuid references products,
  product_name text not null,
  quantity int not null,
  unit_price numeric(10,2) not null,
  unit_cost numeric(10,2) not null default 0
);

create table stock_purchases (       -- supplier restocks
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms not null,
  supplier_id uuid references suppliers,
  product_id uuid references products,
  quantity int not null,
  unit_cost numeric(10,2) not null,
  purchased_at timestamptz default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms not null,
  title text not null, category text,
  amount numeric(10,2) not null,
  spent_at timestamptz default now()
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references gyms not null,
  name text not null, phone text, address text
);

create table settings (
  gym_id uuid primary key references gyms,
  data jsonb not null default '{}'::jsonb,   -- receipt header, terms, theme, address…
  updated_at timestamptz default now()
);

create table audit_logs (
  id bigserial primary key,
  gym_id uuid references gyms not null,
  actor uuid references profiles,
  action text not null,
  detail text,
  created_at timestamptz default now()
);
```

Indexes that matter in daily use:

```sql
create index members_gym_status_idx on members (gym_id, status);
create index members_name_trgm      on members using gin (full_name gin_trgm_ops);
create index ledger_member_month    on member_fee_ledger (member_id, billing_month);
create index attendance_gym_day     on attendance (gym_id, check_in_at desc);
create index payments_gym_day       on payments (gym_id, paid_at desc);
create index sales_gym_day          on sales (gym_id, sold_at desc);
```

`settings` stays a `jsonb` blob on purpose: receipt terms, address, theme, and counter toggles change often and are never queried relationally.

---

## 5. Security (row-level security)

The anon key ships to the browser, so **every table must be protected by RLS**. Never put the `service_role` key in the frontend.

```sql
alter table members enable row level security;

create policy "staff read own gym"
  on members for select
  using (gym_id = (select gym_id from profiles where id = auth.uid()));

create policy "staff write own gym"
  on members for insert
  using (gym_id = (select gym_id from profiles where id = auth.uid()));

create policy "staff update own gym"
  on members for update
  using (gym_id = (select gym_id from profiles where id = auth.uid()));

-- destructive operations reserved for the owner
create policy "owner delete members"
  on members for delete
  using (
    (select role from profiles where id = auth.uid()) = 'owner'
    and gym_id = (select gym_id from profiles where id = auth.uid())
  );
```

Deleting a member should normally be the existing **soft delete** (`status='REMOVED'`, `removed_at`), not a SQL `DELETE` — it keeps the ledger and receipts historically correct.

---

## 6. Migration checklist (safe, reversible)

1. **Create the Supabase project**; copy URL + anon key into Vercel env vars.
2. **Run the schema** (SQL editor or `supabase db push` with `supabase/migrations/*.sql` in the repo).
3. **Write the mapper** `src/db/cloud/mapper.ts`: `DatabaseState → rows` and back. This is pure functions, easy to unit test — add round-trip tests next to `tests/integration/member-fee-ledger.test.ts`.
4. **Write the sync engine**: on login → `select` all tables for the gym → build `DatabaseState`; on mutation → upsert the changed rows; subscribe to `postgres_changes` for other desks.
5. **Import the current backup**: take a full backup from _Settings → Export Full Backup_, then run a one-off script (`scripts/import-backup.ts`, run locally with the service key) that inserts the JSON into Postgres. Verify counts against the backup's `counts` object.
6. **Dual-run for a week**: keep exporting backups. Only flip `VITE_DATA_MODE=cloud` once counts match and the owner has used it for a few days.
7. **Enable Supabase daily backups** (Pro plan: 7-day PITR) and keep the manual JSON backup button as the second line of defence.

Rollback is trivial at any point: set `VITE_DATA_MODE=local` again — the browser copy is still there until it is cleared.

---

## 7. Offline behaviour (important for a gym counter)

The counter must work while the internet is down:

- Keep the in-memory state as the source of truth for the current session; persist a copy to `localStorage` (already done).
- Queue mutations in **IndexedDB** (`queue.ts`) when the network call fails; flush in order when `navigator.onLine` flips back or the app regains focus.
- Every queued mutation carries a client-generated UUID so a retry is idempotent (`insert ... on conflict (id) do update`).
- Conflicts on `members` are resolved with the `version` column: `update members set version = version + 1 ... where id = $1 and version = $2`; if zero rows come back, re-read and re-apply the field-level diff.
- Show a small "Offline — N changes queued" pill in the header so the receptionist knows the state.

---

## 8. What this costs and buys

| | Today (localStorage) | Supabase |
| --- | --- | --- |
| Second desk / phone | ✗ | ✓ realtime |
| Data loss on cache clear | ✓ loses all | ✗ safe |
| Month-wise / profit reporting | in-browser only | SQL, any client |
| Logins & audit | ✗ | ✓ auth + `audit_logs` |
| Monthly cost | Rs. 0 | Rs. 0 (free tier) → ~$25 when it grows |
| Work | — | ~3–5 focused days of engineering |

---

## 9. Suggested order of work

1. `docs/` schema + RLS SQL committed (this file).
2. `supabaseClient.ts` + `mapper.ts` with round-trip tests.
3. `syncEngine.ts` read path (snapshot pull) behind `VITE_DATA_MODE`.
4. Write path + IndexedDB queue + offline pill.
5. Backup-JSON importer script + count verification.
6. Login screen (`profiles` + role), then flip the flag.
