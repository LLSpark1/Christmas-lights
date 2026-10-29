-- Lights Job Estimator: crew invites.
-- Run this after schema.sql: Supabase → SQL Editor → New query, paste this whole file, press Run.
-- Safe to run again.
--
-- An owner creates an invite link and sends it to a worker. The worker signs in, opens the link,
-- and joins the company as a member: members share the company's jobs but can't change its
-- prices or suppliers. Links work once and expire after 14 days. Owners can remove members.

-- Remember each member's email so the owner can see who is on the team.
alter table public.memberships add column if not exists email text;
update public.memberships m set email = u.email
  from auth.users u where u.id = m.user_id and m.email is null;

create table if not exists public.invites (
  token      text primary key default replace(gen_random_uuid()::text, '-', ''),
  company_id uuid not null references public.companies (id) on delete cascade,
  label      text check (length(label) <= 200),
  role       text not null default 'member' check (role = 'member'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by    uuid references auth.users (id) on delete set null,
  used_at    timestamptz
);
create index if not exists invites_company_idx on public.invites (company_id);

alter table public.invites enable row level security;
drop policy if exists "owners read invites" on public.invites;
create policy "owners read invites" on public.invites
  for select to authenticated using (public.is_owner(company_id));

-- Now also records the owner's email.
create or replace function public.create_company(company_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if exists (select 1 from memberships where user_id = auth.uid()) then
    raise exception 'This account already belongs to a company';
  end if;
  insert into companies (name, settings)
    values (trim(company_name), jsonb_build_object('bizName', trim(company_name)))
    returning id into new_id;
  insert into memberships (company_id, user_id, role, email)
    values (new_id, auth.uid(), 'owner', (select email from auth.users where id = auth.uid()));
  return new_id;
end $$;

create or replace function public.create_invite(c uuid, invite_label text) returns text
language plpgsql security definer set search_path = public as $$
declare
  new_token text;
begin
  if not public.is_owner(c) then
    raise exception 'Only the company owner can invite people';
  end if;
  if (select count(*) from invites where company_id = c and used_at is null and expires_at > now()) >= 50 then
    raise exception 'Too many open invites. Cancel some first.';
  end if;
  insert into invites (company_id, label) values (c, nullif(trim(invite_label), ''))
    returning token into new_token;
  return new_token;
end $$;

create or replace function public.accept_invite(invite_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if exists (select 1 from memberships where user_id = auth.uid()) then
    raise exception 'This account already belongs to a company';
  end if;
  select * into inv from invites where token = trim(invite_token) for update;
  if not found or inv.used_at is not null or inv.expires_at < now() then
    raise exception 'This invite is no longer valid. Ask for a new one.';
  end if;
  insert into memberships (company_id, user_id, role, email)
    values (inv.company_id, auth.uid(), inv.role, (select email from auth.users where id = auth.uid()));
  update invites set used_by = auth.uid(), used_at = now() where token = inv.token;
  return inv.company_id;
end $$;

create or replace function public.cancel_invite(invite_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from invites where token = invite_token and public.is_owner(company_id);
end $$;

create or replace function public.remove_member(c uuid, member uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(c) then
    raise exception 'Only the company owner can remove people';
  end if;
  delete from memberships where company_id = c and user_id = member and role <> 'owner';
end $$;

-- ---------- Who may call what ----------
revoke all on public.invites from anon, authenticated;
grant select on public.invites to authenticated;

revoke execute on function public.create_invite(uuid, text), public.accept_invite(text),
  public.cancel_invite(text), public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.create_invite(uuid, text), public.accept_invite(text),
  public.cancel_invite(text), public.remove_member(uuid, uuid) to authenticated;
revoke execute on function public.create_company(text) from public, anon;
grant execute on function public.create_company(text) to authenticated;
