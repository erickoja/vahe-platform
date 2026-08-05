-- ============================================================================
--  Team invites — let a studio owner/admin add teammates to an EXISTING studio.
--  studio_members already supports many users per studio; this adds a
--  shareable-link invite flow:
--    • create_studio_invite()  → mints a random token (owner/admin only)
--    • the invitee opens  app.prongstudio.app/?invite=<token>,  signs up
--    • accept_studio_invite(token) joins them to the studio on first sign-in
--  All members get full access (studio_state RLS is by membership); only
--  owner/admin can invite, remove members, or change studio settings.
--
--  Run on each customer-facing Supabase project (the CUSTOMERS one:
--  ietkgxvmxzeqjhxmdddx — and optionally the owner's own ipbillmpehwgnlayyziz
--  if you want teammates in your own studio too). Safe to re-run.
-- ============================================================================
begin;

create table if not exists public.studio_invites (
  token       text primary key,
  studio_id   uuid not null references public.studios(id) on delete cascade,
  role        text not null default 'staff',
  email       text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);
create index if not exists studio_invites_studio_idx on public.studio_invites(studio_id);

alter table public.studio_invites enable row level security;
-- Members can see their own studio's invites (to list / copy / revoke pending ones).
-- No direct insert/update/delete for users — all mutations go through the RPCs below.
drop policy if exists si_select on public.studio_invites;
create policy si_select on public.studio_invites for select using (studio_id in (select auth_studio_ids()));

-- Mint a shareable invite for the caller's studio (owner/admin only). Returns the token.
create or replace function public.create_studio_invite(p_role text default 'staff', p_email text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_studio uuid; v_token text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select studio_id into v_studio from public.studio_members
    where user_id = auth.uid() and role in ('owner','admin') limit 1;
  if v_studio is null then raise exception 'only an owner or admin can invite teammates'; end if;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.studio_invites(token, studio_id, role, email, created_by)
    values (v_token, v_studio, coalesce(nullif(trim(p_role), ''), 'staff'), nullif(trim(p_email), ''), auth.uid());
  return v_token;
end $$;

-- Accept an invite: join the caller to the invite's studio. Idempotent.
create or replace function public.accept_studio_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv public.studio_invites;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_inv from public.studio_invites where token = p_token;
  if v_inv.studio_id is null then raise exception 'invite not found'; end if;
  if exists (select 1 from public.studio_members where studio_id = v_inv.studio_id and user_id = auth.uid()) then
    return v_inv.studio_id;                        -- already a member → idempotent
  end if;
  if exists (select 1 from public.studio_members where user_id = auth.uid()) then
    raise exception 'you already belong to a studio';
  end if;
  insert into public.studio_members(studio_id, user_id, role)
    values (v_inv.studio_id, auth.uid(), coalesce(v_inv.role, 'staff'));
  update public.studio_invites set accepted_at = now(), accepted_by = auth.uid()
    where token = p_token and accepted_at is null;
  return v_inv.studio_id;
end $$;

-- List the caller's studio members with email + role (auth.users isn't user-readable directly).
create or replace function public.list_studio_members()
returns table(user_id uuid, email text, role text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.studio_members m
  join auth.users u on u.id = m.user_id
  where m.studio_id in (select studio_id from public.studio_members where user_id = auth.uid())
  order by (m.role = 'owner') desc, m.created_at
$$;

-- Remove a teammate (owner/admin only; can't remove yourself, and never an owner).
create or replace function public.remove_studio_member(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_studio uuid;
begin
  select studio_id into v_studio from public.studio_members
    where user_id = auth.uid() and role in ('owner','admin') limit 1;
  if v_studio is null then raise exception 'only an owner or admin can remove members'; end if;
  if p_user = auth.uid() then raise exception 'you cannot remove yourself'; end if;
  delete from public.studio_members
    where studio_id = v_studio and user_id = p_user and role <> 'owner';
end $$;

-- Revoke a pending invite (owner/admin of that invite's studio).
create or replace function public.revoke_studio_invite(p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare v_studio uuid;
begin
  select studio_id into v_studio from public.studio_members
    where user_id = auth.uid() and role in ('owner','admin') limit 1;
  if v_studio is null then raise exception 'only an owner or admin can revoke invites'; end if;
  delete from public.studio_invites where token = p_token and studio_id = v_studio and accepted_at is null;
end $$;

revoke all on function public.create_studio_invite(text, text) from public;
revoke all on function public.accept_studio_invite(text)       from public;
revoke all on function public.list_studio_members()            from public;
revoke all on function public.remove_studio_member(uuid)       from public;
revoke all on function public.revoke_studio_invite(text)       from public;
grant execute on function public.create_studio_invite(text, text) to authenticated;
grant execute on function public.accept_studio_invite(text)       to authenticated;
grant execute on function public.list_studio_members()            to authenticated;
grant execute on function public.remove_studio_member(uuid)       to authenticated;
grant execute on function public.revoke_studio_invite(text)       to authenticated;

commit;
