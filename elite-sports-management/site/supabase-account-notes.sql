-- ============================================================================
-- ESM — Admin internal notes on accounts (account_notes)
-- ============================================================================
-- Private admin notes on a registered account (player OR scout). Separate table
-- for the same reason as player_notes: a notes column on profiles would leak to
-- the account owner via their "own profile read" policy.
--
-- APPLIED to prod (sbexwyvsgqayxrsrlrpm) as migration account_internal_notes.
-- ============================================================================

create table if not exists public.account_notes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  notes      text,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.account_notes enable row level security;
revoke all on public.account_notes from anon;

drop policy if exists "admin manage account_notes" on public.account_notes;
create policy "admin manage account_notes" on public.account_notes for all to authenticated
  using ( (select private.is_esm_admin()) ) with check ( (select private.is_esm_admin()) );

-- ROLLBACK:  drop table if exists public.account_notes;
