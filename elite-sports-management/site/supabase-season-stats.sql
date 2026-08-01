-- ============================================================================
-- ESM — Phase 1: structured per-season stats for self-created player profiles
-- ============================================================================
-- Adds public.players.season_stats: a jsonb array of per-season stat rows that a
-- player self-enters at registration (simplified core-stats v1, baseball). Kept
-- SEPARATE from the legacy `stats` column (a jsonb array of {label,value}
-- highlights used by the 17 seed players + the public modal + admin editor), so
-- nothing existing changes shape.
--
-- Row shape (derived stats are computed on render, never stored, so they can't
-- drift from the raw inputs):
--   [{"kind":"batting","season":"2024","team":"Hastings College","level":"NAIA",
--     "G":45,"AB":150,"R":28,"H":48,"2B":10,"3B":2,"HR":6,"RBI":30,"BB":20,"SO":25,"SB":8},
--    {"kind":"pitching","season":"2024","team":"...","level":"...",
--     "W":5,"L":2,"G":12,"GS":8,"IP":60.1,"H":45,"R":22,"ER":18,"BB":15,"SO":70},
--    {"kind":"fielding","season":"2024","team":"...","level":"...",
--     "G":45,"PO":80,"A":120,"E":6}]
--
-- APPLIED to prod (sbexwyvsgqayxrsrlrpm) as migration players_season_stats_column.
--
-- Security / RLS (verified live via simulated JWTs, rolled back):
--  * No new policy needed — season_stats is just another column on players, so
--    the EXISTING row policies govern it: owner INSERTs it on their own pending
--    row ("player creates own row"); owner/email SELECT reads their own
--    ("athlete reads own row"); admins read/write all; approved scouts get it via
--    scout_roster() (select *).
--  * Anon reads the public roster through a column-scoped SELECT grant (row
--    filter status='approved' still enforced by RLS). season_stats is added to
--    that grant so an approved athlete's stats render on the public modal; PII
--    (age/phone/email/instagram/message/owner_id/source) stays ungranted.
--  * Verified: anon reads season_stats on approved rows only (1/1) and still
--    cannot read phone (42501); an owner sees only their own row, never another
--    account's.
-- ============================================================================

alter table public.players
  add column if not exists season_stats jsonb not null default '[]'::jsonb;

grant select (season_stats) on public.players to anon;

-- ROLLBACK:
--   revoke select (season_stats) on public.players from anon;
--   alter table public.players drop column if exists season_stats;
