-- ============================================================================
-- ESM — RLS init-plan optimization (Supabase performance lint 0003)
-- ============================================================================
-- Wraps auth.<fn>() / helper calls in RLS policies in a scalar subselect so
-- Postgres evaluates them ONCE per statement instead of once per row. Purely a
-- performance change — the boolean result is identical. Silences lint 0003.
--
-- APPLIED to prod (sbexwyvsgqayxrsrlrpm) as migration rls_initplan_optimization.
-- ============================================================================

drop policy if exists "athlete reads own row" on public.players;
create policy "athlete reads own row" on public.players for select to authenticated
  using ( lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', '')) );

drop policy if exists "admin read all players" on public.players;
create policy "admin read all players" on public.players for select to authenticated
  using ( (select private.is_esm_admin()) );

drop policy if exists "admin update players" on public.players;
create policy "admin update players" on public.players for update to authenticated
  using ( (select private.is_esm_admin()) ) with check ( (select private.is_esm_admin()) );

drop policy if exists "admin insert players" on public.players;
create policy "admin insert players" on public.players for insert to authenticated
  with check ( (select private.is_esm_admin()) );

drop policy if exists "admin delete players" on public.players;
create policy "admin delete players" on public.players for delete to authenticated
  using ( (select private.is_esm_admin()) );

drop policy if exists "admin manage player_notes" on public.player_notes;
create policy "admin manage player_notes" on public.player_notes for all to authenticated
  using ( (select private.is_esm_admin()) ) with check ( (select private.is_esm_admin()) );
