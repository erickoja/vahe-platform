-- ============================================================================
-- VAHE multi-tenancy migration  (Phase 1: isolation + RLS + data migration)
-- ============================================================================
-- Turns the single shared `studio_state` table into a per-studio store, adds
-- studios + membership, backfills ALL existing data into one "VAHE" studio,
-- and locks everything down with Row-Level Security.
--
-- RUN ORDER: run this whole file once, top to bottom, in the Supabase SQL editor.
-- Run it on STAGING first, verify isolation, then on PROD (see MULTI-TENANCY-PLAN.md).
-- It is written to be safe to re-run (idempotent guards) but you shouldn't need to.
-- ============================================================================

begin;

-- ── 1. Tenant tables ────────────────────────────────────────────────────────
create table if not exists studios (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  created_at             timestamptz not null default now(),
  plan                   text not null default 'trial',   -- trial | active | past_due | canceled
  status                 text not null default 'active',  -- active | suspended
  trial_ends_at          timestamptz,
  stripe_customer_id     text,
  stripe_subscription_id text
);

create table if not exists studio_members (
  studio_id  uuid not null references studios(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'staff',               -- owner | admin | staff
  created_at timestamptz not null default now(),
  primary key (studio_id, user_id)
);

-- ── 2. Membership helper (security definer avoids RLS recursion) ─────────────
-- Policies that need "which studios does this user belong to?" call this instead
-- of selecting studio_members directly, which would recurse under RLS.
create or replace function auth_studio_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select studio_id from studio_members where user_id = auth.uid()
$$;

-- ── 3. Add the tenant column to the existing state table (nullable for now) ──
alter table studio_state add column if not exists studio_id uuid references studios(id);

-- ── 4. Backfill: create the VAHE studio, link every current user, stamp data ─
-- Right now the only auth users are VAHE staff, so linking all of them to the
-- VAHE studio is correct. New signups (phase 2) get their own studio instead.
do $$
declare v_studio uuid;
begin
  -- reuse an existing VAHE studio if this migration is re-run
  select id into v_studio from studios where name = 'VAHE Jewellery' limit 1;
  if v_studio is null then
    insert into studios(name, plan, status) values ('VAHE Jewellery', 'active', 'active')
    returning id into v_studio;
  end if;

  insert into studio_members(studio_id, user_id, role)
    select v_studio, u.id, 'owner' from auth.users u
    on conflict (studio_id, user_id) do nothing;

  update studio_state set studio_id = v_studio where studio_id is null;
end $$;

-- ── 5. Enforce tenancy: not-null + composite primary key ────────────────────
alter table studio_state alter column studio_id set not null;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'studio_state_pkey') then
    alter table studio_state drop constraint studio_state_pkey;
  end if;
end $$;

alter table studio_state add primary key (studio_id, key);
create index if not exists studio_state_studio_idx on studio_state(studio_id);

-- ── 6. Row-Level Security ───────────────────────────────────────────────────
alter table studio_state   enable row level security;
alter table studios        enable row level security;
alter table studio_members enable row level security;

-- Remove the OLD permissive policies from the original single-tenant setup.
-- These grant every authenticated user access to EVERY row; leaving them in place
-- would OR with (and defeat) the per-studio policies below. Critical on prod.
drop policy if exists "authenticated read"   on studio_state;
drop policy if exists "authenticated write"  on studio_state;
drop policy if exists "authenticated update" on studio_state;

-- studio_state: members of a studio can do anything with THAT studio's rows only
drop policy if exists ss_select on studio_state;
drop policy if exists ss_insert on studio_state;
drop policy if exists ss_update on studio_state;
drop policy if exists ss_delete on studio_state;

create policy ss_select on studio_state for select
  using      (studio_id in (select auth_studio_ids()));
create policy ss_insert on studio_state for insert
  with check (studio_id in (select auth_studio_ids()));
create policy ss_update on studio_state for update
  using      (studio_id in (select auth_studio_ids()))
  with check (studio_id in (select auth_studio_ids()));
create policy ss_delete on studio_state for delete
  using      (studio_id in (select auth_studio_ids()));

-- studios: members can read their studio; only owners/admins can rename it.
-- Billing columns (plan/status/stripe_*) are changed only by the service role
-- (Stripe webhook), which bypasses RLS — so no client policy grants that.
drop policy if exists st_select on studios;
drop policy if exists st_update on studios;

create policy st_select on studios for select
  using (id in (select auth_studio_ids()));
create policy st_update on studios for update
  using      (id in (select studio_id from studio_members
                     where user_id = auth.uid() and role in ('owner','admin')))
  with check (id in (select studio_id from studio_members
                     where user_id = auth.uid() and role in ('owner','admin')));

-- studio_members: you can see co-members of studios you belong to
drop policy if exists sm_select on studio_members;
create policy sm_select on studio_members for select
  using (studio_id in (select auth_studio_ids()));

commit;

-- ============================================================================
-- PHASE 2 (self-serve signup) — safe to create now, used later.
-- A new user has no membership yet, so RLS would block them from creating their
-- own studio. This security-definer RPC lets a signed-in user bootstrap exactly
-- one studio for themselves.
-- ============================================================================
create or replace function create_studio_for_current_user(studio_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_studio uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  -- one studio per account for v1
  if exists (select 1 from studio_members where user_id = auth.uid()) then
    raise exception 'user already belongs to a studio';
  end if;
  insert into studios(name, plan, status, trial_ends_at)
    values (coalesce(nullif(trim(studio_name), ''), 'My Studio'),
            'trial', 'active', now() + interval '14 days')
    returning id into v_studio;
  insert into studio_members(studio_id, user_id, role)
    values (v_studio, auth.uid(), 'owner');
  return v_studio;
end $$;

revoke all on function create_studio_for_current_user(text) from public;
grant execute on function create_studio_for_current_user(text) to authenticated;
