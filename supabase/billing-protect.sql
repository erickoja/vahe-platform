-- ============================================================================
--  Protect the billing columns on public.studios from client-side edits.
--
--  PROBLEM (found in the Oct 2026 audit): the st_update RLS policy lets a studio's
--  owner/admin UPDATE their own studios row. RLS is row-level, not column-level, so
--  an owner could call the REST API directly with their own login token and set
--  sub_status='active', trial_ends_at='2099-01-01', plan, stripe_* ... and use the
--  product free forever (or wipe their Stripe link). The app never does this, but
--  anyone can with the browser dev tools.
--
--  FIX: a BEFORE UPDATE trigger that rejects any change to the billing columns when
--  the caller is a normal logged-in user. The Stripe webhook / billing edge function
--  use the service role (auth.role() = 'service_role'), and the SQL editor runs as
--  postgres (auth.role() is null), so both still work. Renaming the studio, setting
--  notify_email etc. are unaffected.
--
--  Run once on the CUSTOMER project (ietkgxvmxzeqjhxmdddx). Safe to re-run.
-- ============================================================================
create or replace function public.studios_protect_billing()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if new.sub_status              is distinct from old.sub_status
    or new.plan                    is distinct from old.plan
    or new.trial_ends_at           is distinct from old.trial_ends_at
    or new.current_period_end      is distinct from old.current_period_end
    or new.stripe_customer_id      is distinct from old.stripe_customer_id
    or new.stripe_subscription_id  is distinct from old.stripe_subscription_id then
      raise exception 'billing fields can only be changed by the billing system';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_studios_protect_billing on public.studios;
create trigger trg_studios_protect_billing
  before update on public.studios
  for each row execute function public.studios_protect_billing();

-- ── How to verify (SQL editor, as a throwaway test studio's owner) ──────────
-- With a real user's JWT, this must now FAIL with "billing fields can only be changed...":
--   PATCH /rest/v1/studios?id=eq.<studio>  { "sub_status": "active" }
-- and renaming the studio ({ "name": "x" }) must still succeed.
