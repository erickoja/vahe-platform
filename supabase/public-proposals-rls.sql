-- ============================================================================
--  Studio-scope the public_proposals staff RLS (close the cross-studio gap).
--  Before: "staff full access" let ANY authenticated user read/write EVERY
--  studio's proposals. After: a studio's members can only touch their own.
--
--  SAFE TO RUN NOW because:
--   - the deployed app stamps studio_id on every published proposal, and
--     existing rows were backfilled (multitenant-email.sql), so no NULLs remain;
--   - the logged-out client page uses the get_proposal / accept_proposal
--     SECURITY DEFINER RPCs, which bypass RLS — unaffected;
--   - auth_studio_ids() returns the caller's studios by MEMBERSHIP (any role),
--     so all staff of a studio keep access.
--
--  Run in Supabase → SQL Editor. Prod (ipbillmpehwgnlayyziz) is the one that
--  matters; also run on dev (khpykxoshyljqkauvdfn) + tester (ietkgxvmxzeqjhxmdddx)
--  to keep them consistent. Idempotent.
-- ============================================================================

-- Belt-and-suspenders: sweep up any proposal that somehow still has no studio_id
-- (single-studio projects: assigns to that studio).
update public.public_proposals p
   set studio_id = s.id
  from (select id from public.studios order by created_at limit 1) s
 where p.studio_id is null;

-- Replace the permissive policy with per-studio ones.
drop policy if exists "staff full access" on public.public_proposals;
drop policy if exists "staff read own"    on public.public_proposals;
drop policy if exists "staff write own"   on public.public_proposals;
drop policy if exists "staff update own"  on public.public_proposals;
drop policy if exists "staff delete own"  on public.public_proposals;

create policy "staff read own"   on public.public_proposals for select to authenticated
  using (studio_id in (select auth_studio_ids()));
create policy "staff write own"  on public.public_proposals for insert to authenticated
  with check (studio_id in (select auth_studio_ids()));
create policy "staff update own" on public.public_proposals for update to authenticated
  using (studio_id in (select auth_studio_ids()))
  with check (studio_id in (select auth_studio_ids()));
create policy "staff delete own" on public.public_proposals for delete to authenticated
  using (studio_id in (select auth_studio_ids()));
