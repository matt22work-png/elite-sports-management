-- ============================================================================
-- ESM — Harden public column exposure on players
-- ============================================================================
-- Problem (verified live, 2026-07): the anon RLS SELECT policy on `players`
-- returns the ENTIRE approved row, including intake PII (age, phone, email,
-- instagram, message). A direct PostgREST request with the public anon key can
-- read those columns:
--     GET /rest/v1/players?select=email,phone   ->  200 OK
-- Today the curated roster rows have null contact fields so nothing leaks yet,
-- but the moment a real applicant is approved their contact details become
-- publicly readable.
--
-- RLS is row-level and cannot restrict columns. The correct fix is a
-- column-level SELECT grant: PostgREST honors column privileges, so anon can
-- only read the public display columns. Row filtering (status = 'approved') is
-- still enforced by the existing RLS policy.
--
-- Safe because:
--  * The public site already selects only these columns (index.html boot()),
--    so NO client change is required.
--  * INSERT privilege is untouched -> the public application form still works
--    (it inserts without reading back: `return=minimal`).
--  * The portal/admin read as the `authenticated` role, which is unaffected.
--  * `status` and `sort_order` are granted so the client's
--    `.eq("status","approved").order("sort_order")` still works (WHERE/ORDER
--    on a column requires SELECT privilege on it).
--
-- Apply during a normal deploy; effect is immediate. Rollback at the bottom.
-- ============================================================================

revoke select on public.players from anon;

grant select (
  slug, name, "group", position, country, flag, heritage, born, birthplace,
  tier, bats, bio, teams, stats, image_url, sport, status, sort_order
) on public.players to anon;

-- Verify after applying (should return 200 with rows for the first, and a
-- permission error for the second):
--   GET /rest/v1/players?select=slug,name,group&status=eq.approved
--   GET /rest/v1/players?select=email,phone            -> 42501 permission denied

-- ----------------------------------------------------------------------------
-- ROLLBACK (restores full-row anon read):
--   revoke select on public.players from anon;
--   grant  select on public.players to anon;
-- ----------------------------------------------------------------------------
