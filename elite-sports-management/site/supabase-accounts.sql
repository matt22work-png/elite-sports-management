-- ============================================================================
-- ESM — Account registration + manual approval workflow
-- ============================================================================
-- Two account types (player, scout) sign up with email+password. Each account
-- gets ONE public.profiles row (identity + role + approval + payment). Role
-- data lives in players (athletes, linked by owner_id) and scouts. Approval is
-- admin-only and DB-enforced; nobody can self-approve.
--
-- APPLIED to prod (sbexwyvsgqayxrsrlrpm) as migration accounts_profiles_and_scouts.
--
-- Validated with simulated JWTs (rolled back): a pending player can't self-
-- approve and sees only their own row; can't insert an approved roster row;
-- admin approval auto-syncs the roster row (trigger); an approved scout sees the
-- full roster incl. contact info via scout_roster(); anon cannot read profiles
-- or scouts.
--
-- DASHBOARD / MANUAL: for signUp to return a usable session immediately (so the
-- profile can be created right after registration), Supabase Auth "Confirm
-- email" should be OFF — approval + payment is the real gate. The register page
-- also finalizes the profile on first authenticated load if it is missing, so a
-- confirm-on setup degrades gracefully.
-- ============================================================================

-- ---------- profiles: one row per auth user ----------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  role           text not null check (role in ('player','scout')),
  first_name     text,
  last_name      text,
  email          text,
  account_status text not null default 'pending'  check (account_status in ('pending','approved','rejected','archived')),
  payment_status text not null default 'unpaid'   check (payment_status in ('unpaid','submitted','verified')),
  created_at     timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select to authenticated
  using ( id = (select auth.uid()) );

-- Users may create only their OWN profile, pending/unpaid — never self-approve.
drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles for insert to authenticated
  with check (
    id = (select auth.uid())
    and account_status = 'pending'
    and payment_status = 'unpaid'
    and role in ('player','scout')
  );

drop policy if exists "admin read profiles" on public.profiles;
create policy "admin read profiles" on public.profiles for select to authenticated
  using ( (select private.is_esm_admin()) );
drop policy if exists "admin update profiles" on public.profiles;
create policy "admin update profiles" on public.profiles for update to authenticated
  using ( (select private.is_esm_admin()) ) with check ( (select private.is_esm_admin()) );
drop policy if exists "admin delete profiles" on public.profiles;
create policy "admin delete profiles" on public.profiles for delete to authenticated
  using ( (select private.is_esm_admin()) );

-- ---------- scouts: role-specific data ----------
create table if not exists public.scouts (
  id           uuid primary key references auth.users(id) on delete cascade,
  organization text,
  title        text,
  school_team  text,
  phone        text,
  country      text,
  notes        text,
  created_at   timestamptz not null default now()
);
alter table public.scouts enable row level security;
revoke all on public.scouts from anon;

drop policy if exists "own scout read" on public.scouts;
create policy "own scout read" on public.scouts for select to authenticated
  using ( id = (select auth.uid()) );
drop policy if exists "own scout insert" on public.scouts;
create policy "own scout insert" on public.scouts for insert to authenticated
  with check ( id = (select auth.uid()) );
drop policy if exists "own scout update" on public.scouts;
create policy "own scout update" on public.scouts for update to authenticated
  using ( id = (select auth.uid()) ) with check ( id = (select auth.uid()) );
drop policy if exists "admin read scouts" on public.scouts;
create policy "admin read scouts" on public.scouts for select to authenticated
  using ( (select private.is_esm_admin()) );
drop policy if exists "admin manage scouts" on public.scouts;
create policy "admin manage scouts" on public.scouts for all to authenticated
  using ( (select private.is_esm_admin()) ) with check ( (select private.is_esm_admin()) );

-- ---------- helper predicates (private schema, not API-exposed) ----------
create or replace function private.is_approved_scout() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'scout' and p.account_status = 'approved'
  );
$$;
grant execute on function private.is_approved_scout() to authenticated;

create or replace function private.is_registered_player() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'player'
  );
$$;
grant execute on function private.is_registered_player() to authenticated;

-- ---------- players: link registered athletes, add scout access ----------
create unique index if not exists players_owner_id_uidx on public.players(owner_id) where owner_id is not null;

drop policy if exists "athlete reads own row" on public.players;
create policy "athlete reads own row" on public.players for select to authenticated
  using (
    owner_id = (select auth.uid())
    or lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );

drop policy if exists "player creates own row" on public.players;
create policy "player creates own row" on public.players for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and status = 'pending'
    and (select private.is_registered_player())
  );

-- Elevated roster for approved scouts (full rows incl. contact info). Column
-- privileges are per-role and can't separate scout from player, so this is a
-- SECURITY DEFINER function, not a grant. Returns empty for non-scouts.
create or replace function public.scout_roster() returns setof public.players
  language sql stable security definer set search_path = '' as $$
  select * from public.players
  where status = 'approved' and (select private.is_approved_scout())
  order by sort_order, name;
$$;
-- Supabase auto-grants EXECUTE to anon+authenticated on new public functions;
-- revoke from public AND anon so only signed-in users can call it (lint 0028).
revoke all on function public.scout_roster() from public;
revoke all on function public.scout_roster() from anon;   -- migration scout_roster_revoke_anon
grant execute on function public.scout_roster() to authenticated;

-- ---------- sync roster row with account approval ----------
create or replace function private.sync_player_status() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if NEW.role = 'player' and NEW.account_status is distinct from OLD.account_status then
    update public.players
      set status = case NEW.account_status
                     when 'approved' then 'approved'
                     when 'rejected' then 'rejected'
                     when 'archived' then 'archived'
                     else 'pending' end
      where owner_id = NEW.id;
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_sync_player_status on public.profiles;
create trigger trg_sync_player_status after update on public.profiles
  for each row execute function private.sync_player_status();

-- ROLLBACK:
--   drop trigger if exists trg_sync_player_status on public.profiles;
--   drop function if exists private.sync_player_status();
--   drop function if exists public.scout_roster();
--   drop function if exists private.is_registered_player();
--   drop function if exists private.is_approved_scout();
--   drop policy if exists "player creates own row" on public.players;
--   drop index if exists public.players_owner_id_uidx;
--   drop table if exists public.scouts;
--   drop table if exists public.profiles;
--   (and restore the email-only "athlete reads own row" policy)
