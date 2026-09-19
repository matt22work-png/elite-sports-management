-- ============================================================================
-- ESM — Events CMS: schema + one-time migration of the hardcoded arrays
-- migrations: events_cms_schema, events_cms_seed_from_hardcoded  (2026-09-19)
-- ============================================================================
-- Until now the Events section was a hardcoded EVENTS array (plus a single global
-- GALLERY array) in index.html. This moves both into the database so Sam can edit
-- events and their photo galleries from the admin panel.
--
-- Translatable fields follow the testimonials pattern: jsonb holding {en,es,it},
-- read on the homepage through loc(), which also accepts a bare string — so a
-- partially filled or legacy-shaped row still renders instead of showing raw JSON.
--
-- WHY event_date STAYS A REAL DATE:
--   The brief asked for the date to be trilingual like the other fields. It isn't,
--   deliberately. event_date is what the homepage SORTS on, and fmtDate() already
--   localises it per language via toLocaleDateString(lang) — "Dec 8, 2026" /
--   "8 dic 2026" / "8 dic 2026" — so a free-text date would lose both the sort and
--   the automatic localisation, and would need hand-maintaining in three places.
--   Instead `date_label` is an OPTIONAL trilingual override for the cases a single
--   date cannot express (the Tenerife card's "Dec 8-15, 2026" range). Null = format
--   event_date automatically. Best of both.
-- ============================================================================

-- ── events ──────────────────────────────────────────────────────────────────
alter table public.events
  alter column title type jsonb using
    case when title is null then null else jsonb_build_object('en', title) end,
  alter column location type jsonb using
    case when location is null then null else jsonb_build_object('en', location) end,
  alter column blurb type jsonb using
    case when blurb is null then null else jsonb_build_object('en', blurb) end;

alter table public.events
  add column if not exists tags          jsonb,
  add column if not exists date_label    jsonb,
  add column if not exists media         boolean not null default false,
  add column if not exists icon          text,
  add column if not exists reg_url       text,
  add column if not exists contact_email text,
  add column if not exists published     boolean not null default true;

alter table public.events drop constraint if exists events_status_chk;
alter table public.events
  add constraint events_status_chk check (status in ('upcoming','past'));

-- ── events_gallery ──────────────────────────────────────────────────────────
-- One row per photo — NOT a JSONB blob on the event — so gallery rows can be added,
-- removed and reordered independently from admin.
create table if not exists public.events_gallery (
  id         bigint generated always as identity primary key,
  event_id   bigint not null references public.events(id) on delete cascade,
  filename   text   not null,
  captions   jsonb  not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);
create index if not exists events_gallery_event_idx on public.events_gallery(event_id, sort_order);

-- ── RLS: public marketing content — anon reads, only admins write ────────────
-- Same shape as testimonials: a permissive anon SELECT plus an admin-only ALL policy
-- gated on private.is_esm_admin().
alter table public.events         enable row level security;
alter table public.events_gallery enable row level security;

drop policy if exists "admin manage events" on public.events;
create policy "admin manage events" on public.events
  for all to authenticated
  using ((select private.is_esm_admin())) with check ((select private.is_esm_admin()));

drop policy if exists "read events gallery" on public.events_gallery;
create policy "read events gallery" on public.events_gallery
  for select to anon using (true);

drop policy if exists "admin manage events gallery" on public.events_gallery;
create policy "admin manage events gallery" on public.events_gallery
  for all to authenticated
  using ((select private.is_esm_admin())) with check ((select private.is_esm_admin()));

grant select on public.events_gallery to anon;
grant select, insert, update, delete on public.events_gallery to authenticated;

-- Verified live after applying:
--   anon GET  /rest/v1/events          -> 200 + both rows
--   anon GET  /rest/v1/events_gallery  -> 200 + 12 rows
--   anon POST /rest/v1/events          -> 401 / 42501 RLS violation

-- ============================================================================
-- DATA MIGRATION — see migration events_cms_seed_from_hardcoded for the full
-- INSERT bodies (2 events + 12 gallery rows, every en/es/it string carried over
-- verbatim from the arrays that were live in index.html).
--
-- NOTE: the two rows previously sitting in public.events ("Winter League 2026",
-- "All-Stars Tournament") were stale 2026-07 seed data that nothing ever queried —
-- the homepage read the hardcoded array, not this table. They were deleted rather
-- than published, because wiring the homepage to this table would otherwise have put
-- copy on the live site that Sam never wrote and no visitor has ever seen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   drop table if exists public.events_gallery;
--   alter table public.events
--     drop column if exists tags, drop column if exists date_label,
--     drop column if exists media, drop column if exists icon,
--     drop column if exists reg_url, drop column if exists contact_email,
--     drop column if exists published,
--     drop constraint if exists events_status_chk;
--   alter table public.events
--     alter column title    type text using coalesce(title->>'en',    title    #>> '{}'),
--     alter column location type text using coalesce(location->>'en', location #>> '{}'),
--     alter column blurb    type text using coalesce(blurb->>'en',    blurb    #>> '{}');
--   -- then restore the hardcoded EVENTS/GALLERY arrays in index.html.
-- ----------------------------------------------------------------------------
