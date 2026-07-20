-- ============================================================================
-- VAHE — TESTER project setup (one-shot)
-- ============================================================================
-- Run this ONCE, top to bottom, in the SQL Editor of a BRAND-NEW Supabase
-- project that will host external testers. It stands the whole backend up from
-- scratch: the key/value store, image bucket, public proposals, then full
-- multi-tenancy (per-studio isolation + RLS) and the self-serve signup RPC.
--
-- This is for a FRESH project only. Do NOT run it on the production business
-- project (ipbillmpehwgnlayyziz) or the dev project — they already have this
-- schema and their own data.
-- ============================================================================

begin;

-- ── 1. Key/value store + realtime ───────────────────────────────────────────
create table if not exists public.studio_state (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz default now()
);
alter table public.studio_state enable row level security;
-- (The permissive policies from the single-tenant setup are intentionally NOT
--  created here — section 5 installs per-studio RLS instead.)
alter publication supabase_realtime add table public.studio_state;

-- ── 2. Private image bucket + policies ───────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('job-images', 'job-images', false)
on conflict (id) do nothing;
drop policy if exists "job-images read"   on storage.objects;
drop policy if exists "job-images insert" on storage.objects;
drop policy if exists "job-images delete" on storage.objects;
create policy "job-images read"   on storage.objects for select to authenticated using (bucket_id = 'job-images');
create policy "job-images insert" on storage.objects for insert to authenticated with check (bucket_id = 'job-images');
create policy "job-images delete" on storage.objects for delete to authenticated using (bucket_id = 'job-images');

-- ── 3. Public-facing proposals (client-facing share links) ───────────────────
create table if not exists public.public_proposals (
  token           text primary key,
  data            jsonb       not null,
  status          text        not null default 'sent',
  accepted_option text,
  accepted_name   text,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now()
);
alter table public.public_proposals enable row level security;
drop policy if exists "staff full access" on public.public_proposals;
create policy "staff full access" on public.public_proposals
  for all to authenticated using (true) with check (true);
-- NOTE: this staff policy is not yet studio-scoped — a follow-up item. Fine for
-- a small trusted tester group (test data only).
create or replace function public.get_proposal(p_token text)
returns public.public_proposals language sql security definer set search_path = public
as $$ select * from public.public_proposals where token = p_token; $$;
create or replace function public.accept_proposal(p_token text, p_option text, p_name text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  update public.public_proposals
     set status='accepted', accepted_option=p_option, accepted_name=p_name, accepted_at=now()
   where token = p_token and status = 'sent';
  get diagnostics n = row_count;
  return n > 0;
end; $$;
grant execute on function public.get_proposal(text)               to anon, authenticated;
grant execute on function public.accept_proposal(text, text, text) to anon, authenticated;

-- ── 4. Tenant tables + membership helper ─────────────────────────────────────
create table if not exists public.studios (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  created_at             timestamptz not null default now(),
  plan                   text not null default 'trial',
  status                 text not null default 'active',
  trial_ends_at          timestamptz,
  stripe_customer_id     text,
  stripe_subscription_id text
);
create table if not exists public.studio_members (
  studio_id  uuid not null references public.studios(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (studio_id, user_id)
);
create or replace function public.auth_studio_ids()
returns setof uuid language sql stable security definer set search_path = public
as $$ select studio_id from public.studio_members where user_id = auth.uid() $$;

-- ── 5. Scope studio_state to a studio + per-studio RLS ───────────────────────
-- Fresh table is empty, so no data backfill is needed; go straight to NOT NULL.
alter table public.studio_state add column if not exists studio_id uuid references public.studios(id);
alter table public.studio_state alter column studio_id set not null;
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'studio_state_pkey') then
    alter table public.studio_state drop constraint studio_state_pkey;
  end if;
end $$;
alter table public.studio_state add primary key (studio_id, key);
create index if not exists studio_state_studio_idx on public.studio_state(studio_id);

alter table public.studios        enable row level security;
alter table public.studio_members enable row level security;

drop policy if exists ss_select on public.studio_state;
drop policy if exists ss_insert on public.studio_state;
drop policy if exists ss_update on public.studio_state;
drop policy if exists ss_delete on public.studio_state;
create policy ss_select on public.studio_state for select using      (studio_id in (select auth_studio_ids()));
create policy ss_insert on public.studio_state for insert with check (studio_id in (select auth_studio_ids()));
create policy ss_update on public.studio_state for update using      (studio_id in (select auth_studio_ids())) with check (studio_id in (select auth_studio_ids()));
create policy ss_delete on public.studio_state for delete using      (studio_id in (select auth_studio_ids()));

drop policy if exists st_select on public.studios;
drop policy if exists st_update on public.studios;
create policy st_select on public.studios for select using (id in (select auth_studio_ids()));
create policy st_update on public.studios for update
  using      (id in (select studio_id from public.studio_members where user_id = auth.uid() and role in ('owner','admin')))
  with check (id in (select studio_id from public.studio_members where user_id = auth.uid() and role in ('owner','admin')));

drop policy if exists sm_select on public.studio_members;
create policy sm_select on public.studio_members for select using (studio_id in (select auth_studio_ids()));

commit;

-- ── 6. Self-serve signup: bootstrap a studio for the current user ────────────
create or replace function public.create_studio_for_current_user(studio_name text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_studio uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.studio_members where user_id = auth.uid()) then
    raise exception 'user already belongs to a studio';
  end if;
  insert into public.studios(name, plan, status, trial_ends_at)
    values (coalesce(nullif(trim(studio_name), ''), 'My Studio'), 'trial', 'active', now() + interval '14 days')
    returning id into v_studio;
  insert into public.studio_members(studio_id, user_id, role) values (v_studio, auth.uid(), 'owner');
  return v_studio;
end $$;
revoke all on function public.create_studio_for_current_user(text) from public;
grant execute on function public.create_studio_for_current_user(text) to authenticated;
