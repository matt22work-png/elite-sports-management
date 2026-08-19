-- ============================================================================
-- ESM — Expanded public application form: category-specific fields + file uploads
-- ============================================================================
-- The bottom-of-page #join application form was expanded (2026-08) from 3 fields
-- to a category-driven form. Depending on "I'm applying for":
--   • Baseball / Softball Representation → photo, name, nationality, email,
--     phone, country, position, resume/CV (PDF), age, goals
--   • College Placement → all of the above + English certificate (PDF),
--     education level, diploma (PDF), and "what they'd like to study + goals"
--   • Coaching → unchanged minimal fields (goals + anything else)
--
-- Applications still land in `public.players` as source='application', status
-- 'pending' (same row/RLS model as before — see supabase-schema.sql). This file:
--   1. Adds the new columns the form now captures.
--   2. Length-caps them (server-side backstop, matching supabase-players-constraints.sql).
--   3. Creates two Storage buckets for the uploads and their RLS policies.
--
-- Reused existing columns (NOT re-added here): name, email, phone, country, age,
-- position, image_url (headshot), bio (baseball/softball "goals"), applying_for,
-- message, sport.
--
-- APPLY: run in the Supabase SQL Editor, or it is applied to prod
-- (sbexwyvsgqayxrsrlrpm) as migration `application_fields_and_buckets`.
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------- 1. New intake columns on players ----------
alter table public.players add column if not exists nationality     text;
alter table public.players add column if not exists resume_url       text;  -- object PATH in `application-docs` bucket
alter table public.players add column if not exists english_cert_url text;  -- object PATH in `application-docs` bucket
alter table public.players add column if not exists diploma_url       text;  -- object PATH in `application-docs` bucket
alter table public.players add column if not exists education_level   text;
alter table public.players add column if not exists study_goals       text;  -- College: "what they'd like to study" + goals

-- NOTE on privacy: these columns are intentionally NOT added to the anon column
-- SELECT grant (see supabase-harden-players-columns.sql). anon can INSERT them
-- (table-level INSERT grant is unchanged) but can never read them back — only the
-- `authenticated` admin role can, via the "admin read all players" RLS policy.

-- ---------- 2. Length caps (abuse/flood backstop; never reject a real human) ----------
alter table public.players drop constraint if exists players_nationality_len;
alter table public.players add  constraint players_nationality_len   check (nationality     is null or char_length(nationality)     <= 80);
alter table public.players drop constraint if exists players_resume_url_len;
alter table public.players add  constraint players_resume_url_len    check (resume_url       is null or char_length(resume_url)       <= 400);
alter table public.players drop constraint if exists players_english_url_len;
alter table public.players add  constraint players_english_url_len   check (english_cert_url is null or char_length(english_cert_url) <= 400);
alter table public.players drop constraint if exists players_diploma_url_len;
alter table public.players add  constraint players_diploma_url_len   check (diploma_url       is null or char_length(diploma_url)       <= 400);
alter table public.players drop constraint if exists players_education_len;
alter table public.players add  constraint players_education_len     check (education_level   is null or char_length(education_level)   <= 120);
alter table public.players drop constraint if exists players_study_len;
alter table public.players add  constraint players_study_len         check (study_goals       is null or char_length(study_goals)       <= 5000);

-- ---------- 3. Storage buckets for the uploads ----------
-- Two buckets, split by sensitivity:
--   • application-photos (PUBLIC)  — headshots (jpg/png). Public so the admin
--     avatar (<img>/background-image on image_url) and any future public profile
--     render with zero extra code, exactly like the curated player-photos bucket.
--   • application-docs   (PRIVATE) — resume/CV, English certificate, diploma PDFs.
--     Sensitive: never public. Admin downloads them via short-lived signed URLs.
-- Bucket-level file_size_limit + allowed_mime_types are the SERVER-SIDE backstop
-- to the client validation (10 MB cap; images vs PDF only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('application-photos', 'application-photos', true,  10485760, array['image/jpeg','image/png']),
  ('application-docs',   'application-docs',   false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- 3a. Storage RLS policies ----------
-- The public application form is anonymous, so anon must be able to UPLOAD (insert)
-- into both buckets. Reads: application-photos is a public bucket (served without
-- RLS); application-docs is private and only admins may read (for signed URLs).
drop policy if exists "public can upload application photos" on storage.objects;
create policy "public can upload application photos" on storage.objects for insert to anon
  with check ( bucket_id = 'application-photos' );

drop policy if exists "public can upload application docs" on storage.objects;
create policy "public can upload application docs" on storage.objects for insert to anon
  with check ( bucket_id = 'application-docs' );

drop policy if exists "admin read application docs" on storage.objects;
create policy "admin read application docs" on storage.objects for select to authenticated
  using ( bucket_id = 'application-docs' and private.is_esm_admin() );

-- (Optional) let admins also read/list application-photos objects while signed in.
drop policy if exists "admin read application photos" on storage.objects;
create policy "admin read application photos" on storage.objects for select to authenticated
  using ( bucket_id = 'application-photos' and private.is_esm_admin() );

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   drop policy if exists "public can upload application photos" on storage.objects;
--   drop policy if exists "public can upload application docs"   on storage.objects;
--   drop policy if exists "admin read application docs"          on storage.objects;
--   drop policy if exists "admin read application photos"        on storage.objects;
--   delete from storage.buckets where id in ('application-photos','application-docs');
--   alter table public.players
--     drop column if exists nationality, drop column if exists resume_url,
--     drop column if exists english_cert_url, drop column if exists diploma_url,
--     drop column if exists education_level, drop column if exists study_goals;
-- ----------------------------------------------------------------------------
