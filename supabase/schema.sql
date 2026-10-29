-- Lights Job Estimator: database setup for Supabase.
-- Paste this whole file into Supabase → SQL Editor → New query, and press Run.
-- Safe to run again: it only creates what is missing and replaces the functions and rules.
--
-- Each company's jobs and settings are visible only to people who belong to that company.
-- Row Level Security enforces this in the database, so it holds even if someone edits the web page.

-- ---------- Tables ----------
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 120),
  settings   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index if not exists memberships_user_idx on public.memberships (user_id);

create table if not exists public.jobs (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_company_idx on public.jobs (company_id, updated_at desc);

-- The server sets updated_at, so a wrong clock on someone's phone can't reorder jobs.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before insert or update on public.jobs
  for each row execute function public.touch_updated_at();

-- ---------- Membership checks ----------
-- security definer so the checks can read memberships without tripping its own rules.
create or replace function public.is_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where company_id = c and user_id = auth.uid());
$$;

create or replace function public.is_owner(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where company_id = c and user_id = auth.uid() and role = 'owner');
$$;

-- A new user creates their company here; they become its owner.
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
  insert into memberships (company_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;

-- ---------- Row Level Security ----------
alter table public.companies   enable row level security;
alter table public.memberships enable row level security;
alter table public.jobs        enable row level security;

drop policy if exists "members read their company" on public.companies;
create policy "members read their company" on public.companies
  for select to authenticated using (public.is_member(id));

drop policy if exists "owners update their company" on public.companies;
create policy "owners update their company" on public.companies
  for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));

drop policy if exists "members read memberships" on public.memberships;
create policy "members read memberships" on public.memberships
  for select to authenticated using (user_id = auth.uid() or public.is_member(company_id));

drop policy if exists "members read jobs" on public.jobs;
create policy "members read jobs" on public.jobs
  for select to authenticated using (public.is_member(company_id));

drop policy if exists "members add jobs" on public.jobs;
create policy "members add jobs" on public.jobs
  for insert to authenticated with check (public.is_member(company_id));

drop policy if exists "members change jobs" on public.jobs;
create policy "members change jobs" on public.jobs
  for update to authenticated using (public.is_member(company_id)) with check (public.is_member(company_id));

drop policy if exists "members delete jobs" on public.jobs;
create policy "members delete jobs" on public.jobs
  for delete to authenticated using (public.is_member(company_id));

-- ---------- Who may call what ----------
-- Signed-out visitors get nothing. Companies and memberships change only through create_company.
revoke all on public.companies, public.memberships, public.jobs from anon;
revoke insert, update, delete on public.companies, public.memberships from authenticated;
grant select on public.companies, public.memberships to authenticated;
grant update (name, settings) on public.companies to authenticated;
grant select, insert, update, delete on public.jobs to authenticated;

revoke execute on function public.create_company(text) from public, anon;
grant execute on function public.create_company(text) to authenticated;
revoke execute on function public.is_member(uuid), public.is_owner(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.is_owner(uuid) to authenticated;
