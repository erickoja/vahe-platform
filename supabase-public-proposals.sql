-- ============================================================================
--  VAHE — Online proposals (multi-option + client acceptance)
--  Run this ONCE in the Supabase dashboard → SQL Editor → New query → Run.
--  It creates a separate, public-facing table that holds only the immutable
--  proposal snapshots you publish. Your studio data (clients, jobs, costs,
--  margins) is NEVER exposed — clients can read just one proposal by its token
--  and write back only their acceptance, both via the two functions below.
-- ============================================================================

create table if not exists public.public_proposals (
  token           text primary key,
  data            jsonb       not null,          -- frozen client-facing snapshot
  status          text        not null default 'sent',   -- 'sent' | 'accepted'
  accepted_option text,                          -- chosen option (quote id)
  accepted_name   text,                          -- client's typed sign-off
  accepted_at     timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.public_proposals enable row level security;

-- Staff (any logged-in studio user) can do everything.
drop policy if exists "staff full access" on public.public_proposals;
create policy "staff full access" on public.public_proposals
  for all to authenticated using (true) with check (true);

-- Logged-out visitors (anon) get NO direct table access — RLS denies by default.
-- They can only reach a single proposal through the two SECURITY DEFINER
-- functions below, which prevents anyone from listing/dumping all proposals.

-- Read one proposal by its (unguessable) token.
create or replace function public.get_proposal(p_token text)
returns public.public_proposals
language sql
security definer
set search_path = public
as $$
  select * from public.public_proposals where token = p_token;
$$;

-- Record an acceptance — only succeeds if the proposal hasn't been accepted yet.
create or replace function public.accept_proposal(p_token text, p_option text, p_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update public.public_proposals
     set status = 'accepted',
         accepted_option = p_option,
         accepted_name   = p_name,
         accepted_at     = now()
   where token = p_token and status = 'sent';
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Allow logged-out clients to call ONLY these two functions.
grant execute on function public.get_proposal(text)               to anon, authenticated;
grant execute on function public.accept_proposal(text, text, text) to anon, authenticated;
