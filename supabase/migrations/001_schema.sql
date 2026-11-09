-- ===========================================================================
-- The Gym Town — Supabase / PostgreSQL schema (v1)
-- ===========================================================================
-- Paste this whole file into Supabase → SQL Editor → Run, or run it with the
-- Supabase CLI (`supabase db push`).
--
-- Design rules
--   1. Every table has: id (text, the same id the app already generates),
--      gym_id (text), and `data` (jsonb) holding the COMPLETE original object.
--      Nothing the app stores can be lost, even fields added in future.
--   2. Columns next to `data` exist only for what you want to query, sort,
--      join or aggregate (roll number, status, amounts, dates).
--   3. Row Level Security is ON for every table: a signed-in staff member can
--      only ever see rows of their own gym.
--   4. One gym per install is expected; `gym_id` keeps the door open for more.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pg_trgm;      -- fuzzy member search
create extension if not exists "uuid-ossp";  -- auth profile ids

-- ---------------------------------------------------------------------------
-- 1. Gyms and staff profiles
-- ---------------------------------------------------------------------------
create table if not exists public.gyms (
  id          text primary key,
  name        text not null,
  address     text,
  city        text,
  phone       text,
  created_at  timestamptz not null default now()
);

-- One row per member of staff, linked to Supabase Auth.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  gym_id      text not null references public.gyms (id) on delete cascade,
  full_name   text not null default 'Staff',
  role        text not null default 'receptionist'
              check (role in ('owner', 'manager', 'receptionist')),
  shift       text,
  created_at  timestamptz not null default now()
);

-- Helper used by every RLS policy. SECURITY DEFINER so it can read profiles
-- without triggering profiles' own policy (which would recurse).
create or replace function public.current_gym_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select gym_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 2. Membership plans
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id             text primary key,
  gym_id         text not null references public.gyms (id) on delete cascade,
  name           text not null,
  price          numeric(12,2) not null default 0,
  duration_days  integer,
  is_active      boolean default true,
  data           jsonb not null,
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Members
-- ---------------------------------------------------------------------------
create table if not exists public.members (
  id             text primary key,
  gym_id         text not null references public.gyms (id) on delete cascade,
  roll_number    text not null,
  full_name      text not null,
  mobile_number  text,
  cnic           text,
  blood_group    text,
  plan_id        text,
  plan_name      text,
  status         text,
  payment_status text,
  total_fee      numeric(12,2) default 0,
  paid_amount    numeric(12,2) default 0,
  balance_due    numeric(12,2) default 0,
  join_date      date,
  expiry_date    date,
  removed_at     timestamptz,
  archived       boolean default false,
  version        integer not null default 1,
  data           jsonb not null,
  updated_at     timestamptz not null default now(),
  unique (gym_id, roll_number)
);

create index if not exists members_gym_status_idx on public.members (gym_id, status);
create index if not exists members_gym_roll_idx   on public.members (gym_id, roll_number);
create index if not exists members_name_trgm      on public.members using gin (full_name gin_trgm_ops);
create index if not exists members_due_idx        on public.members (gym_id, balance_due) where balance_due > 0;

-- ---------------------------------------------------------------------------
-- 4. Membership history, fee ledger, receipts, attendance
-- ---------------------------------------------------------------------------
create table if not exists public.membership_history (
  id          text primary key,
  gym_id      text not null references public.gyms (id) on delete cascade,
  member_id   text not null,
  action_type text,
  created_at  timestamptz,
  data        jsonb not null
);
create index if not exists membership_history_member_idx on public.membership_history (gym_id, member_id);

create table if not exists public.member_fee_ledger (
  id            text primary key,
  gym_id        text not null references public.gyms (id) on delete cascade,
  member_id     text not null,
  entry_date    date,
  billing_month text,
  type          text,
  amount        numeric(12,2) default 0,
  receipt_no    text,
  data          jsonb not null,
  created_at    timestamptz not null default now()
);
create index if not exists ledger_member_month_idx on public.member_fee_ledger (gym_id, member_id, billing_month);
create index if not exists ledger_date_idx         on public.member_fee_ledger (gym_id, entry_date desc);

create table if not exists public.payments (
  id             text primary key,
  gym_id         text not null references public.gyms (id) on delete cascade,
  member_id      text not null,
  receipt_number text,
  amount         numeric(12,2) default 0,
  payment_type   text,
  paid_at        timestamptz,
  data           jsonb not null,
  created_at     timestamptz not null default now(),
  unique (gym_id, receipt_number)
);
create index if not exists payments_gym_date_idx on public.payments (gym_id, paid_at desc);

create table if not exists public.attendance (
  id           text primary key,
  gym_id       text not null references public.gyms (id) on delete cascade,
  member_id    text not null,
  method       text,
  access_status text,
  check_in_at  timestamptz,
  data         jsonb not null
);
create index if not exists attendance_gym_day_idx on public.attendance (gym_id, check_in_at desc);

-- ---------------------------------------------------------------------------
-- 5. Money out, door logs, WhatsApp notifications, audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id         text primary key,
  gym_id     text not null references public.gyms (id) on delete cascade,
  title      text,
  category   text,
  amount     numeric(12,2) default 0,
  spent_at   timestamptz,
  data       jsonb not null
);
create index if not exists expenses_gym_date_idx on public.expenses (gym_id, spent_at desc);

create table if not exists public.door_logs (
  id               text primary key,
  gym_id           text not null references public.gyms (id) on delete cascade,
  member_id        text,
  status           text,
  occurred_at      timestamptz,
  data             jsonb not null
);

create table if not exists public.notifications (
  id          text primary key,
  gym_id      text not null references public.gyms (id) on delete cascade,
  member_id   text,
  message_type text,
  status      text,
  created_at  timestamptz,
  data        jsonb not null
);

create table if not exists public.audit_logs (
  id          text primary key,
  gym_id      text not null references public.gyms (id) on delete cascade,
  occurred_at timestamptz,
  module      text,
  action      text,
  username    text,
  data        jsonb not null
);
create index if not exists audit_logs_gym_date_idx on public.audit_logs (gym_id, occurred_at desc);

-- App-level user list (kept for parity with the browser build; real login
-- happens through Supabase Auth + profiles).
create table if not exists public.users (
  id         text primary key,
  gym_id     text not null references public.gyms (id) on delete cascade,
  username   text,
  full_name  text,
  role       text,
  email      text,
  is_active  boolean default true,
  data       jsonb not null
);

-- ---------------------------------------------------------------------------
-- 6. Store, POS and suppliers
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id               text primary key,
  gym_id           text not null references public.gyms (id) on delete cascade,
  code             text,
  name             text not null,
  category         text,
  purchase_price   numeric(12,2) default 0,
  selling_price    numeric(12,2) default 0,
  stock_quantity   integer default 0,
  min_stock_level  integer default 5,
  is_active        boolean default true,
  data             jsonb not null,
  updated_at       timestamptz not null default now()
);
create index if not exists products_gym_stock_idx on public.products (gym_id, stock_quantity);

create table if not exists public.sales (
  id              text primary key,
  gym_id          text not null references public.gyms (id) on delete cascade,
  invoice_number  text,
  member_id       text,
  total_amount    numeric(12,2) default 0,
  total_cogs      numeric(12,2) default 0,
  sold_at         timestamptz,
  data            jsonb not null,
  created_at      timestamptz not null default now(),
  unique (gym_id, invoice_number)
);
create index if not exists sales_gym_date_idx on public.sales (gym_id, sold_at desc);

create table if not exists public.stock_purchases (
  id              text primary key,
  gym_id          text not null references public.gyms (id) on delete cascade,
  purchase_number text,
  total_cost      numeric(12,2) default 0,
  purchase_date   date,
  data            jsonb not null
);

create table if not exists public.inventory_transactions (
  id          text primary key,
  gym_id      text not null references public.gyms (id) on delete cascade,
  product_id  text,
  type        text,
  quantity_change integer,
  occurred_at timestamptz,
  data        jsonb not null
);

create table if not exists public.suppliers (
  id     text primary key,
  gym_id text not null references public.gyms (id) on delete cascade,
  name   text,
  phone  text,
  data   jsonb not null
);

-- ---------------------------------------------------------------------------
-- 7. Station settings (one row per gym)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  gym_id     text primary key references public.gyms (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists members_touch on public.members;
create trigger members_touch before update on public.members
  for each row execute function public.touch_updated_at();

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists plans_touch on public.plans;
create trigger plans_touch before update on public.plans
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 9. Auto-create a profile when a staff account signs up
--    (put gym_id in the user's metadata when inviting: { "gym_id": "gym_main" })
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, gym_id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'gym_id', 'gym_main'),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'receptionist')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 10. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.gyms                  enable row level security;
alter table public.profiles              enable row level security;
alter table public.plans                 enable row level security;
alter table public.members               enable row level security;
alter table public.membership_history    enable row level security;
alter table public.member_fee_ledger     enable row level security;
alter table public.payments              enable row level security;
alter table public.attendance            enable row level security;
alter table public.expenses              enable row level security;
alter table public.door_logs             enable row level security;
alter table public.notifications         enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.users                 enable row level security;
alter table public.products              enable row level security;
alter table public.sales                 enable row level security;
alter table public.stock_purchases       enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.suppliers             enable row level security;
alter table public.settings              enable row level security;

-- A staff member can read their own gym and their own profile.
drop policy if exists gyms_read on public.gyms;
create policy gyms_read on public.gyms
  for select using (id = public.current_gym_id());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (gym_id = public.current_gym_id());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid());

-- Every data table: full read/write for staff of the same gym.
do $$
declare
  t text;
  tables text[] := array[
    'plans', 'members', 'membership_history', 'member_fee_ledger', 'payments',
    'attendance', 'expenses', 'door_logs', 'notifications', 'audit_logs',
    'users', 'products', 'sales', 'stock_purchases', 'inventory_transactions',
    'suppliers', 'settings'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format(
      'create policy %I_read on public.%I for select using (gym_id = public.current_gym_id())',
      t, t
    );

    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format(
      'create policy %I_insert on public.%I for insert with check (gym_id = public.current_gym_id())',
      t, t
    );

    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format(
      'create policy %I_update on public.%I for update using (gym_id = public.current_gym_id()) with check (gym_id = public.current_gym_id())',
      t, t
    );

    -- Destructive deletes stay with the owner only.
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format(
      $f$create policy %I_delete on public.%I for delete using (gym_id = public.current_gym_id() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner'))$f$,
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Realtime (three desks / phone see each other's changes immediately)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array['members', 'member_fee_ledger', 'payments', 'attendance', 'products', 'sales', 'settings'];
begin
  foreach t in array tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. First-run data: the gym row every row points to
-- ---------------------------------------------------------------------------
insert into public.gyms (id, name, address, city, phone)
values ('gym_main', 'The Gym Town', 'Hyder Chowk, Near Opposite Sultan Fast Food', 'Hyderabad', '')
on conflict (id) do nothing;
