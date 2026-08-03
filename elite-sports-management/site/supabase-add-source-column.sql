-- ============================================================================
-- ESM — Add players.source (submission origin)
-- ============================================================================
-- Additive, low-risk. Lets the admin pending queue distinguish paid €129.99
-- self-created profiles ('profile-gate') from regular representation applicants
-- ('application'), and admin-created players ('admin'). Existing rows and normal
-- applications default to 'application'. No effect on RLS, the public column-
-- scoped select, or existing queries.
--
-- Set by:
--   - public apply form (index.html): 'profile-gate' if the €129.99 gate is
--     unlocked, else 'application'
--   - admin "Add Player" (admin/index.html): 'admin'
--
-- APPLIED to prod (sbexwyvsgqayxrsrlrpm) as migration add_players_source_column.
-- ============================================================================

alter table public.players add column if not exists source text default 'application';

-- ROLLBACK:
--   alter table public.players drop column if exists source;
