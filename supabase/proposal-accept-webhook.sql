-- ============================================================================
--  Proposal-accepted alert webhook (per customer-facing Supabase project)
--  When a public proposal flips to status='accepted', POST the row to the
--  `notify-acceptance` edge function, which emails the owning studio's
--  notify_email. This is the SQL equivalent of a Dashboard → Database Webhook
--  (used because that page 404'd) — pg_net trigger, same payload shape.
--
--  Run in the SQL editor of each customer-facing project. ⚠️ Change the URL's
--  project ref to the project you're running it on (below = CUSTOMERS
--  ietkgxvmxzeqjhxmdddx). The `notify-acceptance` edge function must already
--  be deployed there (verify_jwt OFF) with RESEND_API_KEY + FROM_EMAIL secrets.
--  Safe to re-run.
-- ============================================================================

-- Enable pg_net (lets Postgres make HTTP calls), if not already on.
create extension if not exists pg_net;

create or replace function public.notify_proposal_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform net.http_post(
      url     := 'https://ietkgxvmxzeqjhxmdddx.supabase.co/functions/v1/notify-acceptance',
      headers := jsonb_build_object('Content-Type','application/json'),
      body    := jsonb_build_object(
                   'type','UPDATE','schema','public','table','public_proposals',
                   'record', to_jsonb(new), 'old_record', to_jsonb(old))
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_proposal_accepted on public.public_proposals;
create trigger trg_notify_proposal_accepted
  after update on public.public_proposals
  for each row
  execute function public.notify_proposal_accepted();
