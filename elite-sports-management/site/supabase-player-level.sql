-- ============================================================================
-- ESM — Player "Level" classification field  (migration: add_player_level_field)
-- ============================================================================
-- Adds an admin-editable classification to each player: College / International / Pro.
-- Managed live from the Admin panel (player edit → "Level" dropdown), shown publicly on
-- the roster card + detail modal as a small badge (like position/sport). No deploy needed
-- to change a player's level — it's a normal players-table UPDATE through the admin UI.
--
-- Values: 'college' | 'international' | 'pro'. Nullable (most existing players have none
-- set yet); no default, so a player with no level simply shows no badge. CHECK constrains
-- the value set at the DB layer.
--
-- Grants: anon reads `players` via COLUMN-LEVEL SELECT grants (table-level SELECT was
-- revoked in supabase-harden-players-columns.sql), so a new column is NOT auto-readable by
-- the public site — we grant SELECT(level) to anon explicitly. `level` is public
-- classification info, safe to expose. `authenticated` has TABLE-LEVEL select/update/insert,
-- so admin edits (as authenticated) already cover the new column with no extra grant.
-- ============================================================================

alter table public.players
  add column if not exists level text
  constraint players_level_check check (level is null or level in ('college','international','pro'));

grant select (level) on public.players to anon;

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   alter table public.players drop column if exists level;   -- (grant drops with the column)
-- ----------------------------------------------------------------------------
