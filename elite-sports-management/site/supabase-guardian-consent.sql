-- ============================================================================
-- ESM — Date of birth + parent/guardian consent capture on players
-- migration: players_dob_and_guardian_consent   (applied 2026-09-18)
-- ============================================================================
-- Adds the fields the Giocatore (player) account-creation step now collects, so
-- Sam can see an athlete's age bracket and, for minors, who signed for them.
--
-- The thresholds are the ones the Baseball/Softball Representation document sets
-- for itself (terms-baseball-softball.html, sections 23 / 24 / 25):
--
--   18+        section 23 — the athlete consents on their own, no guardian block
--   14 to 17   section 24 — one parent OR legal guardian signs alongside the athlete
--   under 14   section 25 — BOTH parents exercising parental responsibility
--
-- guardian2_* therefore only fills in for the under-14 case. guardian_relation
-- records whether guardian 1 signed as a parent or as a legal guardian (the
-- "Qualifica: Genitore / Tutore legale" line in section 24).
--
-- Additive and reversible: every column is nullable, so existing rows and every
-- existing INSERT path keep working untouched.
-- ============================================================================

alter table public.players
  add column if not exists date_of_birth        date,
  add column if not exists guardian_relation    text,
  add column if not exists guardian1_first_name text,
  add column if not exists guardian1_last_name  text,
  add column if not exists guardian1_email      text,
  add column if not exists guardian1_phone      text,
  add column if not exists guardian2_first_name text,
  add column if not exists guardian2_last_name  text,
  add column if not exists guardian2_email      text,
  add column if not exists guardian2_phone      text,
  add column if not exists guardian_notes       text,
  add column if not exists consent_doc_url      text,
  add column if not exists consent_signed_at    timestamptz;

alter table public.players
  drop constraint if exists players_guardian_relation_chk;
alter table public.players
  add constraint players_guardian_relation_chk
  check (guardian_relation is null or guardian_relation in ('parent','guardian'));

-- Sanity guard: a DOB in the future, or implying an age over 120, is a typo.
alter table public.players
  drop constraint if exists players_dob_sane_chk;
alter table public.players
  add constraint players_dob_sane_chk
  check (date_of_birth is null
         or (date_of_birth <= current_date and date_of_birth > current_date - interval '120 years'));

comment on column public.players.date_of_birth is
  'Athlete DOB. Drives the parent/guardian requirement (18+ / 14-17 / under 14) per the Baseball-Softball terms document.';
comment on column public.players.guardian_notes is
  'Optional free-text notes from the registrant. Admin-visible, never required, never public.';
comment on column public.players.consent_doc_url is
  'Storage path of the auto-filled, generated consent PDF for this athlete.';

-- ----------------------------------------------------------------------------
-- EXPOSURE — deliberately no GRANT here.
--
-- anon holds a COLUMN-level SELECT grant on players (see
-- supabase-harden-players-columns.sql), which means columns added after that
-- grant are automatically NOT readable by anon. Verified live after applying:
--   GET /rest/v1/players?select=date_of_birth,guardian1_email  -> 42501
--   GET /rest/v1/players?select=slug,name&status=eq.approved   -> 200 + rows
--
-- These columns must NEVER be added to that grant list. DOB and guardian contact
-- details are intake PII, not roster display fields. The portal and admin read as
-- `authenticated`, which has full-table SELECT, so Sam sees them normally.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   alter table public.players
--     drop constraint if exists players_guardian_relation_chk,
--     drop constraint if exists players_dob_sane_chk,
--     drop column if exists date_of_birth,
--     drop column if exists guardian_relation,
--     drop column if exists guardian1_first_name, drop column if exists guardian1_last_name,
--     drop column if exists guardian1_email,      drop column if exists guardian1_phone,
--     drop column if exists guardian2_first_name, drop column if exists guardian2_last_name,
--     drop column if exists guardian2_email,      drop column if exists guardian2_phone,
--     drop column if exists guardian_notes,
--     drop column if exists consent_doc_url,      drop column if exists consent_signed_at;
-- ----------------------------------------------------------------------------
