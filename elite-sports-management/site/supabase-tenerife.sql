-- ============================================================================
-- ESM — Phase 2: Tenerife Winter League registrations (€599.99)
-- ============================================================================
-- A one-time event signup — no login account (unlike player/scout). The public
-- /tenerife/ form inserts a pending/unpaid row (session-less anon client, like the
-- #join application); only admins read/manage them. Sam is emailed on each new
-- registration via the Phase 6 notify function (trg_notify_tenerife).
--
-- APPLIED to prod (sbexwyvsgqayxrsrlrpm) as migration tenerife_registrations.
--
-- RLS (verified live via simulated roles, rolled back):
--   • anon/authenticated INSERT only a pending+unpaid row (no read-back needed —
--     the form uses return=minimal). Verified: anon insert OK (1); anon insert of
--     an 'approved' row blocked; anon SELECT denied.
--   • admin read/manage all. Verified: admin SELECT sees the row.
-- ============================================================================

create table if not exists public.tenerife_registrations (
  id             bigint generated always as identity primary key,
  name           text not null check (char_length(name) <= 120),
  email          text check (email is null or char_length(email) <= 254),
  phone          text check (phone is null or char_length(phone) <= 40),
  country        text,
  position       text,
  sport          text default 'Baseball' check (sport in ('Baseball','Softball')),
  notes          text check (notes is null or char_length(notes) <= 5000),
  status         text not null default 'pending'  check (status in ('pending','approved','rejected','archived')),
  payment_status text not null default 'unpaid'   check (payment_status in ('unpaid','submitted','verified')),
  created_at     timestamptz not null default now()
);
alter table public.tenerife_registrations enable row level security;
revoke all on public.tenerife_registrations from anon;
grant insert on public.tenerife_registrations to anon, authenticated;

-- Register policy is anon-only: the /tenerife/ form always inserts as anon
-- (persistSession:false), so this avoids a second permissive policy on
-- authenticated INSERT (admin manages via "admin all tenerife").
drop policy if exists "register tenerife" on public.tenerife_registrations;
create policy "register tenerife" on public.tenerife_registrations for insert to anon
  with check (status = 'pending' and payment_status = 'unpaid');

drop policy if exists "admin all tenerife" on public.tenerife_registrations;
create policy "admin all tenerife" on public.tenerife_registrations for all to authenticated
  using ((select private.is_esm_admin())) with check ((select private.is_esm_admin()));

-- Phase 6 notifier extended to also fire for Tenerife registrations → Sam.
-- (Full function body lives in supabase-notify.sql; this migration re-created it
--  adding the tenerife_registrations branch, and added the trigger below.)
drop trigger if exists trg_notify_tenerife on public.tenerife_registrations;
create trigger trg_notify_tenerife after insert on public.tenerife_registrations
  for each row execute function private.notify_submission();

-- ROLLBACK:
--   drop trigger if exists trg_notify_tenerife on public.tenerife_registrations;
--   drop table if exists public.tenerife_registrations;
--   -- (remove the tenerife_registrations branch from private.notify_submission)
