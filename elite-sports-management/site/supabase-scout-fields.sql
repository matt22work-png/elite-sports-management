-- ============================================================================
-- ESM — Expanded scout / team self-registration fields
-- ============================================================================
-- The scout self-registration (role='scout' at /register/, €49.99 roster access)
-- was expanded (2026-08, per Sam) to collect a fuller team/scout profile alongside
-- the existing email+password account creation.
--
-- New form field set: photo, "Full Name / Team Name", nationality, email (the
-- account email — already on profiles), phone+country code, country, role within
-- the team/organization, and the job positions/players they're looking for.
--
-- Column mapping on public.scouts:
--   • photo_url    (NEW)   — headshot/logo, in the public `application-photos` bucket
--   • name_or_team (NEW)   — person OR team/org name (single free-text field)
--   • nationality  (NEW)
--   • looking_for  (NEW)   — positions to fill / players sought (textarea)
--   • title        (REUSE) — now the "Role within the team/organization" field
--   • phone,country(REUSE) — unchanged
-- The older `organization` / `school_team` / `notes` columns are LEFT IN PLACE
-- (not dropped) so existing scout rows keep their data; the new form simply no
-- longer writes to them.
--
-- APPLY: run in the Supabase SQL Editor, or applied to prod (sbexwyvsgqayxrsrlrpm)
-- as migration `scout_fields_and_notify`. Idempotent — safe to re-run.
-- ============================================================================

-- ---------- 1. New scout columns ----------
alter table public.scouts add column if not exists photo_url    text;
alter table public.scouts add column if not exists name_or_team text;
alter table public.scouts add column if not exists nationality  text;
alter table public.scouts add column if not exists looking_for  text;

-- ---------- 2. Storage: let a signed-in scout upload their photo ----------
-- Scouts fill their details AFTER account creation, so they upload while
-- authenticated. The application-photos bucket (built for the public application
-- form) previously allowed anon INSERT only; add an authenticated INSERT policy so
-- the same intake-photo bucket serves scout uploads too. Public read + bucket-level
-- mime/size limits (image/jpeg,image/png ≤10MB) are unchanged.
drop policy if exists "authed can upload application photos" on storage.objects;
create policy "authed can upload application photos" on storage.objects for insert to authenticated
  with check ( bucket_id = 'application-photos' );

-- ---------- 3. Notify Sam when a scout completes their details ----------
-- The profiles INSERT already emails Sam at account creation (minimal info). The
-- useful, complete team/scout details land a moment later as the scouts INSERT, so
-- notify on that too. Reuse the existing generic notifier; add a `scouts` branch and
-- an AFTER INSERT trigger (upsert-on-conflict fires INSERT once, on first save).
create or replace function private.notify_submission() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_url    text;
  v_secret text;
  v_should boolean := false;
begin
  select url, secret into v_url, v_secret from private.notify_config where id = 1;
  if v_url is null or v_url = '' then
    return NEW;                                    -- not configured → no-op
  end if;
  if TG_TABLE_NAME = 'players' then
    v_should := (NEW.source = 'application');       -- public #join applications only
  elsif TG_TABLE_NAME = 'profiles' then
    v_should := true;                               -- player/scout registrations
  elsif TG_TABLE_NAME = 'scouts' then
    v_should := true;                               -- scout details completed
  elsif TG_TABLE_NAME = 'tenerife_registrations' then
    v_should := true;                               -- Tenerife Winter League registrations
  end if;
  if not v_should then
    return NEW;
  end if;
  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('table', TG_TABLE_NAME, 'record', to_jsonb(NEW)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(v_secret, ''))
  );
  return NEW;
exception when others then
  return NEW;                                       -- a notification failure must NEVER block the insert
end $$;

drop trigger if exists trg_notify_scout on public.scouts;
create trigger trg_notify_scout after insert on public.scouts
  for each row execute function private.notify_submission();

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   drop trigger if exists trg_notify_scout on public.scouts;
--   drop policy if exists "authed can upload application photos" on storage.objects;
--   alter table public.scouts
--     drop column if exists photo_url, drop column if exists name_or_team,
--     drop column if exists nationality, drop column if exists looking_for;
--   -- (restore the previous private.notify_submission() from supabase-gmail-notify.sql)
-- ----------------------------------------------------------------------------
