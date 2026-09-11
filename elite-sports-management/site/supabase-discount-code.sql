-- ============================================================================
-- ESM — Discount code on player profile creation  (migration: add_player_discount_code)
-- ============================================================================
-- Adds an OPTIONAL free-text "Discount Code (if you have one)" captured on the player
-- profile-creation flow (/register/ step 2) and shown to Sam in the Admin panel when he
-- reviews/approves the athlete.
--
-- Deliberately NOT validated against a code list. Pricing is hidden site-wide right now
-- (see the 2026-09 pricing-hide work), so there is nothing to discount yet — this only
-- CAPTURES whatever the athlete types so Sam can honour it manually. Known ambassador
-- codes for context, not for logic: MALAVE20, CEDENO30. If real validation is wanted
-- later, that belongs in a new table + an RPC, not in a client-side list.
--
-- Nullable, no default: blank input is stored as NULL rather than an empty string, so
-- "no code" and "typed nothing" are the same thing in the admin view.
--
-- PRIVACY — the important bit. `anon` lost its table-level SELECT on players in
-- supabase-harden-players-columns.sql and now reads only an explicit column list, so a
-- NEW column is private by default. We deliberately do NOT grant SELECT(discount_code)
-- to anon: which ambassador referred an athlete, and what they were promised, is ESM's
-- business and must not be readable from the public roster.
--
-- No other grants are needed:
--   * `authenticated` holds TABLE-LEVEL select/insert/update, so the athlete's own
--     INSERT at /register/ and Sam's admin read + edit already cover the new column.
--   * `anon` holds TABLE-LEVEL insert, so if the field is ever added to the public
--     #join application form it will work with no further migration.
-- Row access is unchanged: RLS still limits INSERT to status='pending' and UPDATE to
-- admins (private.is_esm_admin()).
--
-- 64 chars is generous for a promo code and stops the column being used as free-form
-- storage; it matches the length-capping convention used by the other intake columns.
-- ============================================================================

alter table public.players
  add column if not exists discount_code text
  constraint players_discount_code_check
  check (discount_code is null or char_length(discount_code) <= 64);

-- Verify after applying:
--   anon  GET /rest/v1/players?select=discount_code   -> 42501 permission denied
--   admin GET /rest/v1/players?select=discount_code   -> 200

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   alter table public.players drop column if exists discount_code;
-- ----------------------------------------------------------------------------
