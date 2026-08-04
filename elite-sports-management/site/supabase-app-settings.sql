-- ============================================================================
-- app_settings + roster master access code  (migration: roster_master_code_settings)
-- ============================================================================
-- Admin-managed key/value settings. Currently holds the single "master" roster-access
-- code that the homepage roster gate accepts, so Sam can change it from the Admin panel
-- (Admin → "Roster access code") without a code deploy. Replaces the old hardcoded
-- MASTER_ACCESS_CODE = "ESM13" constant in index.html.
--
-- Security model:
--   * app_settings is admin-only (RLS via private.is_esm_admin()). anon has NO access.
--   * The public gate never reads the code value. It calls verify_roster_code(entered),
--     a SECURITY DEFINER function that compares server-side (case-insensitive) and returns
--     only true/false — so the current code is never shipped to the browser (unlike ESM13,
--     which was readable in page source).
--   * Per-user SHA-256 personal codes (ROSTER_CODE_HASHES in index.html) are unaffected.

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

-- ROLLBACK:
--   drop function if exists public.verify_roster_code(text);
--   drop table if exists public.app_settings;
--   (and restore the hardcoded MASTER_ACCESS_CODE = "ESM13" gate check in index.html)
