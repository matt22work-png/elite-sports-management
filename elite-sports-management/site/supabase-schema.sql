-- Elite Sports Management — Supabase schema
-- Run in the Supabase SQL Editor (Dashboard → SQL → New query).

-- ---------- PLAYERS / APPLICANTS ----------
create table if not exists players (
  id          bigint generated always as identity primary key,
  slug        text unique not null,
  name        text not null,
  "group"     text not null,             -- Pitcher | Catcher | Infielder | Two-Way
  position    text,
  country     text,
  flag        text,
  heritage    text,
  born        text,
  birthplace  text,
  tier        text,                      -- Pro | College | International | New
  bats        text,
  bio         text,
  teams       jsonb default '[]'::jsonb,
  stats       jsonb default '[]'::jsonb, -- [{label,value}]  ← baseball stats live here
  image_url   text,
  -- intake fields captured from the form:
  age         text,
  phone       text,
  email       text,
  instagram   text,
  applying_for text,                     -- Representation | Coaching | Both
  message     text,
  status      text default 'pending',    -- moderation ON: applicants start as 'pending' until an admin approves
  owner_id    uuid,                      -- reserved for future athlete logins (Supabase Auth)
  sort_order  int default 0,
  created_at  timestamptz default now()
);

alter table players enable row level security;

-- Public can read only published profiles.
create policy "read approved players" on players for select to anon
  using (status = 'approved');

-- The website form can submit applications, but ONLY as 'pending' (moderation).
create policy "public can apply" on players for insert to anon
  with check (status = 'pending');

-- ---------- EVENTS ----------
create table if not exists events (
  id         bigint generated always as identity primary key,
  title      text not null,
  event_date date,
  location   text,
  status     text default 'upcoming',    -- upcoming | past
  blurb      text,
  image_url  text,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table events enable row level security;
create policy "read events" on events for select to anon using (true);

-- ---------- TESTIMONIALS ----------
create table if not exists testimonials (
  id         bigint generated always as identity primary key,
  quote      text not null,
  name       text,
  role       text,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table testimonials enable row level security;
create policy "read testimonials" on testimonials for select to anon using (true);

-- ---------- ADMIN AUTHORIZATION ----------
-- Admins are defined by data (an allow-list), not by hardcoding an email in every
-- policy. The list + helper live in a `private` schema that PostgREST does NOT
-- expose, so the helper is usable inside RLS but is not callable via the public API.
create schema if not exists private;

create table if not exists private.esm_admins (
  email    text primary key,
  added_at timestamptz not null default now()
);
alter table private.esm_admins enable row level security;  -- locked down: no policies, only reachable via the helper / service role

-- Seed admin emails here (add/remove rows to manage who can moderate).
insert into private.esm_admins (email) values
  ('mattswagj@gmail.com'),
  ('matt22work-png@gmail.com')
on conflict (email) do nothing;

-- True when the current JWT's email is in the allow-list. SECURITY DEFINER so it
-- can read the locked-down table; empty search_path + qualified names for safety.
create or replace function private.is_esm_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.esm_admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant usage   on schema   private               to authenticated;
grant execute on function private.is_esm_admin() to authenticated;

-- Admins can read every player (including pending) and update them.
create policy "admin read all players" on players for select to authenticated
  using ( private.is_esm_admin() );
create policy "admin update players" on players for update to authenticated
  using ( private.is_esm_admin() ) with check ( private.is_esm_admin() );

-- ---------- STORAGE (player-photos bucket) ----------
-- Public bucket `player-photos` holds athlete + founder photos. Anyone can read
-- (public bucket); only admins can upload / replace.
create policy "admin upload player photos" on storage.objects for insert to authenticated
  with check ( bucket_id = 'player-photos' and private.is_esm_admin() );
create policy "admin list player photos" on storage.objects for select to authenticated
  using ( bucket_id = 'player-photos' and private.is_esm_admin() );
create policy "admin replace player photos" on storage.objects for update to authenticated
  using ( bucket_id = 'player-photos' and private.is_esm_admin() )
  with check ( bucket_id = 'player-photos' and private.is_esm_admin() );
