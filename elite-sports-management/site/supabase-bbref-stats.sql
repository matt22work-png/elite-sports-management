-- ============================================================================
-- ESM — Baseball-Reference-style "Register" stats (batting / pitching / fielding)
-- ============================================================================
-- Three tables, one row per season/team/level stint for a player. A player can
-- have MULTIPLE rows per year (e.g. a "2 Teams" aggregate row + one row per team).
--
-- Raw countable stats are entered by admins. The derived columns (BA/OBP/SLG/OPS,
-- ERA/WHIP/…, Fld%/RF9/…) are DENORMALIZED: recomputed from the raw values by a
-- BEFORE INSERT/UPDATE trigger on every write, so they can never drift and are
-- fast to read. The admin UI also computes them live for preview; the trigger is
-- the source of truth.
--
-- IP / INN are stored in baseball notation (0.1 = 1 out, 0.2 = 2 outs). All rate
-- math converts to real innings first: outs = floor*3 + frac_digit, real = outs/3.
--
-- RLS: admins (private.is_esm_admin) get full CRUD; a logged-in player can read
-- only their OWN rows; anon + any authenticated user can read rows for APPROVED
-- players (for the public profile display). Nobody but admins can write.
--
-- APPLIED to prod (sbexwyvsgqayxrsrlrpm) as migration bbref_register_stats.
-- ============================================================================

-- ---------- IP baseball-notation → real innings (0.2 → 0.6667) ----------
create or replace function private.ip_to_real(ip numeric)
  returns numeric language sql immutable set search_path = '' as $$
  select case
    when ip is null then null
    else floor(ip) + round((ip - floor(ip)) * 10) / 3.0
  end;
$$;

-- ============================ BATTING ======================================
create table if not exists public.player_batting_stats (
  id          bigint generated always as identity primary key,
  player_id   bigint not null references public.players(id) on delete cascade,
  sort_order  int not null default 0,
  year        int,
  age         int,
  age_dif     text,                 -- manual entry (nullable)
  tm          text,                 -- team ("2 Teams" for the aggregate row)
  lg          text,
  lev         text,
  aff         text,
  g int, pa int, ab int, r int, h int,
  doubles int, triples int, hr int, rbi int,
  sb int, cs int, bb int, so int, hbp int, sh int, sf int, ibb int, gdp int,
  -- denormalized calculated (trigger-maintained, never entered):
  tb  int,
  ba  numeric(5,3), obp numeric(5,3), slg numeric(5,3), ops numeric(5,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_batting_player on public.player_batting_stats(player_id);

create or replace function private.calc_batting() returns trigger
  language plpgsql set search_path = '' as $$
declare v_ab numeric; v_h numeric; v_bb numeric; v_hbp numeric; v_sf numeric; v_tb numeric; v_den numeric;
        v_obp numeric; v_slg numeric;
begin
  v_ab:=coalesce(NEW.ab,0); v_h:=coalesce(NEW.h,0); v_bb:=coalesce(NEW.bb,0);
  v_hbp:=coalesce(NEW.hbp,0); v_sf:=coalesce(NEW.sf,0);
  v_tb := v_h + coalesce(NEW.doubles,0) + 2*coalesce(NEW.triples,0) + 3*coalesce(NEW.hr,0);
  NEW.tb := v_tb;
  NEW.ba  := case when v_ab>0 then round(v_h/v_ab,3) else null end;
  v_den := v_ab+v_bb+v_hbp+v_sf;
  v_obp := case when v_den>0 then (v_h+v_bb+v_hbp)/v_den else null end;
  v_slg := case when v_ab>0 then v_tb/v_ab else null end;
  NEW.obp := round(v_obp,3);
  NEW.slg := round(v_slg,3);
  -- OPS from FULL-precision OBP+SLG (matches Baseball-Reference), not the rounded pair.
  NEW.ops := case when v_obp is not null or v_slg is not null
                  then round(coalesce(v_obp,0)+coalesce(v_slg,0),3) else null end;
  NEW.updated_at := now();
  return NEW;
end $$;
drop trigger if exists trg_calc_batting on public.player_batting_stats;
create trigger trg_calc_batting before insert or update on public.player_batting_stats
  for each row execute function private.calc_batting();

-- ============================ PITCHING =====================================
create table if not exists public.player_pitching_stats (
  id          bigint generated always as identity primary key,
  player_id   bigint not null references public.players(id) on delete cascade,
  sort_order  int not null default 0,
  year        int,
  age         int,
  age_dif     text,
  tm text, lg text, lev text, aff text,
  w int, l int, g int, gs int, gf int, cg int, sho int, sv int,
  ip numeric(5,1),                  -- baseball notation (0.2 = 2 outs)
  h int, r int, er int, hr int, bb int, ibb int, so int, hbp int, bk int, wp int, bf int,
  -- denormalized calculated:
  w_l_pct numeric(5,3),
  era numeric(6,2), ra9 numeric(6,2), whip numeric(5,3),
  h9 numeric(5,1), hr9 numeric(5,1), bb9 numeric(5,1), so9 numeric(5,1),
  so_w numeric(6,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pitching_player on public.player_pitching_stats(player_id);

create or replace function private.calc_pitching() returns trigger
  language plpgsql set search_path = '' as $$
declare ipr numeric; v_w numeric; v_l numeric;
begin
  ipr := private.ip_to_real(NEW.ip);
  v_w:=coalesce(NEW.w,0); v_l:=coalesce(NEW.l,0);
  NEW.w_l_pct := case when (v_w+v_l)>0 then round(v_w/(v_w+v_l),3) else null end;
  if ipr is not null and ipr>0 then
    NEW.era  := round(coalesce(NEW.er,0)*9/ipr,2);
    NEW.ra9  := round(coalesce(NEW.r,0)*9/ipr,2);
    NEW.whip := round((coalesce(NEW.bb,0)+coalesce(NEW.h,0))/ipr,3);
    NEW.h9   := round(coalesce(NEW.h,0)*9/ipr,1);
    NEW.hr9  := round(coalesce(NEW.hr,0)*9/ipr,1);
    NEW.bb9  := round(coalesce(NEW.bb,0)*9/ipr,1);
    NEW.so9  := round(coalesce(NEW.so,0)*9/ipr,1);
  else
    NEW.era:=null; NEW.ra9:=null; NEW.whip:=null; NEW.h9:=null; NEW.hr9:=null; NEW.bb9:=null; NEW.so9:=null;
  end if;
  NEW.so_w := case when coalesce(NEW.bb,0)>0 then round(coalesce(NEW.so,0)::numeric/NEW.bb,2) else null end;
  NEW.updated_at := now();
  return NEW;
end $$;
drop trigger if exists trg_calc_pitching on public.player_pitching_stats;
create trigger trg_calc_pitching before insert or update on public.player_pitching_stats
  for each row execute function private.calc_pitching();

-- ============================ FIELDING =====================================
create table if not exists public.player_fielding_stats (
  id          bigint generated always as identity primary key,
  player_id   bigint not null references public.players(id) on delete cascade,
  sort_order  int not null default 0,
  year        int,
  age         int,
  tm text, lg text, lev text, aff text,
  position text,
  g int, gs int, cg int,
  inn numeric(6,1),                 -- baseball notation
  ch int, po int, a int, e int, dp int, pb int, wp int, sb int, cs int,
  lg_cs_pct text,                   -- manual entry (league avg CS%, nullable)
  -- denormalized calculated:
  fld_pct numeric(5,3), rf9 numeric(6,2), rf_g numeric(6,2), cs_pct numeric(5,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_fielding_player on public.player_fielding_stats(player_id);

create or replace function private.calc_fielding() returns trigger
  language plpgsql set search_path = '' as $$
declare innr numeric; po numeric; a numeric; e numeric; sb numeric; cs numeric; den numeric;
begin
  po:=coalesce(NEW.po,0); a:=coalesce(NEW.a,0); e:=coalesce(NEW.e,0);
  sb:=coalesce(NEW.sb,0); cs:=coalesce(NEW.cs,0);
  den := po+a+e;
  NEW.fld_pct := case when den>0 then round((po+a)/den,3) else null end;
  innr := private.ip_to_real(NEW.inn);
  NEW.rf9  := case when innr is not null and innr>0 then round((po+a)*9/innr,2) else null end;
  NEW.rf_g := case when coalesce(NEW.g,0)>0 then round((po+a)/NEW.g,2) else null end;
  NEW.cs_pct := case when (cs+sb)>0 then round(cs/(cs+sb),3) else null end;
  NEW.updated_at := now();
  return NEW;
end $$;
drop trigger if exists trg_calc_fielding on public.player_fielding_stats;
create trigger trg_calc_fielding before insert or update on public.player_fielding_stats
  for each row execute function private.calc_fielding();

-- ============================ RLS ==========================================
-- Shared predicate: is this stats row's player publicly approved?
create or replace function private.stats_player_approved(pid bigint) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.players p where p.id = pid and p.status = 'approved');
$$;
-- Shared predicate: does the caller own this stats row's player? (owner_id or email)
create or replace function private.owns_stats_player(pid bigint) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.players p
    where p.id = pid
      and ( p.owner_id = auth.uid()
            or lower(p.email) = lower(coalesce(auth.jwt() ->> 'email','')) )
  );
$$;
grant execute on function private.stats_player_approved(bigint) to anon, authenticated;
grant execute on function private.owns_stats_player(bigint) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['player_batting_stats','player_pitching_stats','player_fielding_stats'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);

    execute format($p$drop policy if exists "public reads approved stats" on public.%I$p$, t);
    execute format($p$create policy "public reads approved stats" on public.%I
      for select to anon using ( private.stats_player_approved(player_id) )$p$, t);

    execute format($p$drop policy if exists "read own or approved stats" on public.%I$p$, t);
    execute format($p$create policy "read own or approved stats" on public.%I
      for select to authenticated using (
        (select private.is_esm_admin())
        or private.stats_player_approved(player_id)
        or private.owns_stats_player(player_id)
      )$p$, t);

    execute format($p$drop policy if exists "admin writes stats" on public.%I$p$, t);
    execute format($p$create policy "admin writes stats" on public.%I
      for all to authenticated
      using ( (select private.is_esm_admin()) )
      with check ( (select private.is_esm_admin()) )$p$, t);
  end loop;
end $$;

-- Base table privileges the RLS policies sit on top of. RLS gates WHICH rows are
-- visible/writable; the role still needs the table-level privilege. anon is read-only
-- (rows restricted to approved players); authenticated has full DML gated by RLS
-- (read own/approved, write admin-only).
grant select on public.player_batting_stats  to anon;
grant select on public.player_pitching_stats to anon;
grant select on public.player_fielding_stats to anon;
grant select, insert, update, delete on public.player_batting_stats  to authenticated;
grant select, insert, update, delete on public.player_pitching_stats to authenticated;
grant select, insert, update, delete on public.player_fielding_stats to authenticated;

-- ROLLBACK:
--   drop table if exists public.player_batting_stats, public.player_pitching_stats, public.player_fielding_stats cascade;
--   drop function if exists private.calc_batting(), private.calc_pitching(), private.calc_fielding(),
--     private.ip_to_real(numeric), private.stats_player_approved(bigint), private.owns_stats_player(bigint);
