-- ============================================================================
-- ESM — "Teams and Scouts" application category fields
-- ============================================================================
-- The public #join application "I'm applying for" dropdown replaced "Coaching"
-- with "Teams and Scouts" (2026-08, per Sam). That category collects a team/scout
-- lead: photo, name-or-team, nationality, email, phone+code, country, role within
-- the team/organization, and the positions/players they're looking for.
--
-- Reuses existing players columns (name, nationality, email, phone, country,
-- image_url). Adds two columns for the team/scout-specific text so admin + email
-- can show them with correct labels — mirrors the same-named columns on scouts.
--
-- APPLY: Supabase SQL Editor, or applied to prod as migration
-- `application_teams_fields`. Idempotent.
-- ============================================================================

alter table public.players add column if not exists role        text;  -- role within the team/organization
alter table public.players add column if not exists looking_for text;  -- positions to fill / players sought

alter table public.players drop constraint if exists players_role_len;
alter table public.players add  constraint players_role_len    check (role        is null or char_length(role)        <= 120);
alter table public.players drop constraint if exists players_looking_len;
alter table public.players add  constraint players_looking_len check (looking_for is null or char_length(looking_for) <= 5000);

-- Not added to the anon column SELECT grant (see supabase-harden-players-columns.sql):
-- these are intake fields, readable only by the authenticated admin role.

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   alter table public.players
--     drop constraint if exists players_role_len, drop constraint if exists players_looking_len,
--     drop column if exists role, drop column if exists looking_for;
-- ----------------------------------------------------------------------------
