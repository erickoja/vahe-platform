-- ============================================================================
--  Multi-tenant proposal-acceptance email — schema + backfill.
--  Run ONCE per backend, in Supabase → SQL Editor → New query → Run:
--    • dev   (khpykxoshyljqkauvdfn)  — so localhost keeps working
--    • prod  (ipbillmpehwgnlayyziz)  — the live business app
--    • tester(ietkgxvmxzeqjhxmdddx)  — the tester deploy
--  Safe to run before OR after deploying the app (the column is nullable and
--  there is no RLS change here). Idempotent — safe to re-run.
--
--  NOTE: studio-scoping the public_proposals RLS policy (the cross-studio read
--  gap) is deliberately NOT here — it must ship back-to-back with the app to
--  avoid breaking publishing. Do that as its own step later.
-- ============================================================================

-- 1. Each studio carries the email where it wants acceptance alerts sent.
alter table public.studios          add column if not exists notify_email text;

-- 2. Every published proposal remembers which studio it belongs to.
alter table public.public_proposals add column if not exists studio_id uuid references public.studios(id);

-- 3. Backfill existing proposals to the (single) existing studio on this project.
--    Correct on prod where there is exactly one studio. On a multi-studio
--    project this lumps old rows under the oldest studio — fine for throwaway
--    tester data; adjust by hand if you ever need historical accuracy.
update public.public_proposals p
   set studio_id = s.id
  from (select id from public.studios order by created_at limit 1) s
 where p.studio_id is null;

-- 4. Seed each studio's notify_email from its saved business email so existing
--    studios get alerts without re-saving settings. K.biz storage key = 'jlr4_biz'.
update public.studios st
   set notify_email = coalesce(
         st.notify_email,
         nullif(ss.value->>'notifyEmail',''),
         nullif(ss.value->>'email','')
       )
  from public.studio_state ss
 where ss.studio_id = st.id
   and ss.key = 'jlr4_biz'
   and st.notify_email is null;
