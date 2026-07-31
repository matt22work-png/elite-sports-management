-- ============================================================================
-- ESM — Internal admin notes (player_notes)
-- ============================================================================
-- Private notes an admin keeps on a player. They must NEVER be publicly visible
-- and must not even be visible to the athlete themselves.
--
-- Why a separate table (not a column on players): the "athlete reads own row"
-- RLS policy returns the athlete's WHOLE players row, so a notes column on
-- players would leak to that athlete. A distinct admin-only table cannot leak —
-- there is no anon or athlete policy on it, and anon base grants are revoked.
--
-- APPLIED to prod (sbexwyvsgqayxrsrlrpm) as migration player_internal_notes.
-- ============================================================================

create table if not exists public.player_notes (
  player_id  bigint primary key references public.players(id) on delete cascade,
  notes      text,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.player_notes enable row level security;

revoke all on public.player_notes from anon;

drop policy if exists "admin manage player_notes" on public.player_notes;
create policy "admin manage player_notes" on public.player_notes for all to authenticated
  using ( private.is_esm_admin() ) with check ( private.is_esm_admin() );

-- ROLLBACK:
--   drop table if exists public.player_notes;
