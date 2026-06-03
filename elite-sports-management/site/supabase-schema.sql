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
  status      text default 'approved',   -- flip default to 'pending' to moderate before publishing
  owner_id    uuid,                      -- reserved for future athlete logins (Supabase Auth)
  sort_order  int default 0,
  created_at  timestamptz default now()
);

alter table players enable row level security;

-- Public can read only published profiles.
create policy "read approved players" on players for select to anon
  using (status = 'approved');

-- The website form can create profiles (anon insert). Tighten later if you add moderation.
create policy "public can apply" on players for insert to anon
  with check (true);

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
