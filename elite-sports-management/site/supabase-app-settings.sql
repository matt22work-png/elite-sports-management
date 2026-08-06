-- ============================================================================
-- app_settings + roster master access code  (migration: roster_master_code_settings)
-- ============================================================================
-- Admin-managed key/value settings. Currently holds the single "master" roster-access
-- code that the homepage roster gate accepts, so Sam can change it from the Admin panel
-- (Admin → "Roster access code") without a code deploy. Replaces the old hardcoded
-- MASTER_ACCESS_CODE = "ESM13" constant in index.html.
--
-- Security model:
--   * app_settings is admin-only for read/write (RLS via private.is_esm_admin()). anon has
--     NO direct table access.
--   * verify_roster_code(entered) — SECURITY DEFINER, compares server-side (case-insensitive),
--     returns only true/false. Used for the live gate check.
--   * get_roster_code() — SECURITY DEFINER, returns the current code TEXT (or NULL if retired),
--     granted to anon. The homepage caches this in localStorage for a synchronous, network-free
--     gate check (replacing the old hardcoded "ESM13" string). The master code is a soft
--     convenience gate, NOT a secret (it was shipped in page source as ESM13 for most of its
--     life), so exposing the current value to anon is consistent with its threat model.
--   * Per-user SHA-256 personal codes (ROSTER_CODE_HASHES in index.html) are unaffected.
--   * See add_get_roster_code_rpc migration / bottom of this file for get_roster_code().

create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.app_settings enable row level security;

drop policy if exists "admin manage settings" on public.app_settings;
create policy "admin manage settings" on public.app_settings
  for all to authenticated
  using ((select private.is_esm_admin()))
  with check ((select private.is_esm_admin()));

revoke all on public.app_settings from anon;
grant select, insert, update on public.app_settings to authenticated;   -- RLS gates to admins

-- Seed with the current code so rollout is behaviour-identical (ESM13 keeps working until
-- Sam changes it).
insert into public.app_settings (key, value) values ('roster_master_code', 'ESM13')
  on conflict (key) do nothing;

-- Public verification RPC: entered code in, true/false out. Case-insensitive, trims blanks.
create or replace function public.verify_roster_code(p_code text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.app_settings
    where key = 'roster_master_code'
      and btrim(value) <> ''
      and upper(btrim(value)) = upper(btrim(coalesce(p_code, '')))
  );
$$;
revoke all on function public.verify_roster_code(text) from public;
grant execute on function public.verify_roster_code(text) to anon, authenticated;

-- Public code READ RPC (migration add_get_roster_code_rpc): returns the current master code
-- text so the homepage can cache it in localStorage for a synchronous, network-free gate check.
-- Returns NULL when the code is empty/retired (browser then clears its stale cache).
create or replace function public.get_roster_code()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select nullif(btrim(value), '')
  from public.app_settings
  where key = 'roster_master_code';
$$;
revoke all on function public.get_roster_code() from public;
grant execute on function public.get_roster_code() to anon, authenticated;

-- ROLLBACK:
--   drop function if exists public.get_roster_code();
--   drop function if exists public.verify_roster_code(text);
--   drop table if exists public.app_settings;
