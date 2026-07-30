-- ============================================================================
--  Prong Studio — SaaS subscription billing (Stripe) schema
--  Adds subscription fields to the studios table. Run once per Supabase project.
--  Safe to re-run (IF NOT EXISTS / idempotent grandfather update).
--
--  Model: monthly + annual plans, 14-day trial, read-only when lapsed.
--  The app reads these fields to know a studio's access level; the Stripe
--  webhook edge function writes them (via the service role).
-- ============================================================================

alter table public.studios
  add column if not exists sub_status            text default 'trialing',   -- trialing | active | past_due | canceled
  add column if not exists plan                  text,                       -- monthly | annual | null
  add column if not exists trial_ends_at         timestamptz default (now() + interval '14 days'),
  add column if not exists current_period_end    timestamptz,
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text;

-- Grandfather every EXISTING studio (incl. the owner's own dogfooding studio) as a comped
-- active account, so turning billing on can never lock out a studio that predates it.
-- New studios created after this run get the column defaults (trialing + 14-day trial).
update public.studios
   set sub_status = 'active', trial_ends_at = null
 where stripe_customer_id is null
   and (sub_status is null or sub_status = 'trialing');

-- Members must be able to READ their studio's billing fields (the app selects them at login).
-- Only add this if a member-select policy doesn't already exist for studios.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='studios' and policyname='studios_member_select'
  ) then
    create policy studios_member_select on public.studios
      for select to authenticated
      using (id in (select studio_id from public.studio_members where user_id = auth.uid()));
  end if;
end $$;

-- NOTE: the webhook edge function updates these columns using the SERVICE ROLE key,
-- which bypasses RLS — so no member UPDATE policy on billing columns is needed (and we
-- deliberately don't grant one, so a studio can't self-promote to 'active').
