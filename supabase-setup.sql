create table if not exists public.staff_access (
  email text primary key check (email = lower(email)),
  display_name text not null,
  role text not null default 'trainer' check (role in ('owner', 'trainer'))
);

alter table public.staff_access
  add column if not exists display_name text not null default '';
create unique index if not exists staff_access_display_name_uidx
  on public.staff_access (display_name)
  where display_name <> '';

create table if not exists public.clients (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_settings (
  id text primary key check (id = 'main'),
  plans jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.staff_access enable row level security;
alter table public.clients enable row level security;
alter table public.gym_settings enable row level security;

revoke all on public.staff_access, public.clients, public.gym_settings from anon;
grant select on public.staff_access to authenticated;
grant select, insert, update, delete on public.clients, public.gym_settings to authenticated;

drop policy if exists "Staff can read own access" on public.staff_access;
create policy "Staff can read own access"
  on public.staff_access for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

drop policy if exists "Authorized staff can manage clients" on public.clients;
create policy "Authorized staff can manage clients"
  on public.clients for all to authenticated
  using (exists (
    select 1 from public.staff_access
    where email = lower(auth.jwt() ->> 'email')
  ))
  with check (exists (
    select 1 from public.staff_access
    where email = lower(auth.jwt() ->> 'email')
  ));

drop policy if exists "Authorized staff can manage gym settings" on public.gym_settings;
create policy "Authorized staff can manage gym settings"
  on public.gym_settings for all to authenticated
  using (exists (
    select 1 from public.staff_access
    where email = lower(auth.jwt() ->> 'email')
  ))
  with check (exists (
    select 1 from public.staff_access
    where email = lower(auth.jwt() ->> 'email')
  ));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'clients'
  ) then
    alter publication supabase_realtime add table public.clients;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gym_settings'
  ) then
    alter publication supabase_realtime add table public.gym_settings;
  end if;
end
$$;
