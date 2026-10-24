-- One encrypted-by-transport JSON snapshot per authenticated gym owner.
-- Run this in Supabase SQL Editor before enabling cloud sync.
create table if not exists public.gym_app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.gym_app_state enable row level security;

revoke all on table public.gym_app_state from anon, authenticated;
grant select, insert, update on table public.gym_app_state to authenticated;

drop policy if exists "Owners can read their gym snapshot" on public.gym_app_state;
create policy "Owners can read their gym snapshot"
  on public.gym_app_state for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Owners can insert their gym snapshot" on public.gym_app_state;
create policy "Owners can insert their gym snapshot"
  on public.gym_app_state for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Owners can update their gym snapshot" on public.gym_app_state;
create policy "Owners can update their gym snapshot"
  on public.gym_app_state for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.write_gym_app_state(
  p_snapshot jsonb,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'Snapshot must be a JSON object';
  end if;

  if p_expected_revision = 0 then
    insert into public.gym_app_state (user_id, snapshot, revision, updated_at)
    values (auth.uid(), p_snapshot, 1, now())
    on conflict (user_id) do nothing
    returning revision into next_revision;
    if next_revision is null then
      raise exception 'CLOUD_REVISION_CONFLICT';
    end if;
    return next_revision;
  end if;

  update public.gym_app_state
    set snapshot = p_snapshot,
        revision = revision + 1,
        updated_at = now()
    where user_id = auth.uid()
      and revision = p_expected_revision
    returning revision into next_revision;

  if next_revision is null then
    raise exception 'CLOUD_REVISION_CONFLICT';
  end if;
  return next_revision;
end;
$$;

revoke all on function public.write_gym_app_state(jsonb, bigint) from public, anon;
grant execute on function public.write_gym_app_state(jsonb, bigint) to authenticated;
