-- ============================================================================
-- ESM — Phase 6: email notification on every submission
-- ============================================================================
-- A DB trigger POSTs each new submission to the `notify` Edge Function
-- (site/supabase/functions/notify/index.ts), which emails Sam via
-- Resend. pg_net does the POST asynchronously, so it NEVER blocks the insert.
--
-- APPLIED to prod (sbexwyvsgqayxrsrlrpm) as migration notify_submission_triggers.
-- The Edge Function `notify` is deployed (verify_jwt=false; it does its own
-- shared-secret auth via the x-notify-secret header).
--
-- Routing (in the Edge Function):
--   • players INSERT source='application'  → public #join application:
--         Softball / College / Baseball / everything else → Sam
--         (kind is labeled in the subject line for triage; recipient is unified)
--   • profiles INSERT (player or scout registration) → Sam
--   • players source='registration'/'admin' → skipped (the profiles row covers
--     registrations; admin-added rows don't need an email)
--   • Tenerife (Phase 2) will funnel through the profiles path → Sam
--
-- Provider-agnostic: the trigger + function react to the submission ROW, not to
-- how payment was taken, so this keeps working across Wise / Stripe / etc.
--
-- SAFE TO SHIP DISABLED: the trigger is INERT until app.notify_url is set (see
-- "ACTIVATION" below). Verified: with it unset, inserts succeed untouched.
-- ============================================================================

create extension if not exists pg_net with schema extensions;   -- API stays in the `net` schema

create or replace function private.notify_submission() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_url    text := current_setting('app.notify_url', true);
  v_secret text := current_setting('app.notify_secret', true);
  v_should boolean := false;
begin
  if v_url is null or v_url = '' then
    return NEW;                                   -- not configured → no-op
  end if;
  if TG_TABLE_NAME = 'players' then
    v_should := (NEW.source = 'application');      -- public #join applications only
  elsif TG_TABLE_NAME = 'profiles' then
    v_should := true;                              -- account registrations (player/scout)
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
  return NEW;                                      -- a notification failure must never block the insert
end $$;

drop trigger if exists trg_notify_player on public.players;
create trigger trg_notify_player after insert on public.players
  for each row execute function private.notify_submission();

drop trigger if exists trg_notify_profile on public.profiles;
create trigger trg_notify_profile after insert on public.profiles
  for each row execute function private.notify_submission();

-- ============================================================================
-- ACTIVATION (manual — external accounts + secrets; do these to turn it ON)
-- ============================================================================
-- 1. Resend (https://resend.com): create an account, verify a sending domain (or
--    a single verified sender), and create an API key. Deliverability to Gmail
--    needs a verified domain — the default onboarding@resend.dev only reaches the
--    Resend account owner's own address.
--
-- 2. Set the Edge Function secrets (Dashboard → Edge Functions → notify → Secrets,
--    or `supabase secrets set KEY=VALUE`). Pick a random NOTIFY_SECRET, e.g.
--    `openssl rand -hex 24`:
--        RESEND_API_KEY = re_xxx
--        NOTIFY_SECRET  = <random>
--        NOTIFY_FROM    = Elite Sports Management <noreply@your-verified-domain>
--        (optional) NOTIFY_SAM to override the recipient
--
-- 3. Point the DB at the function + share the SAME secret (persists for new
--    connections; the trigger reads these at runtime):
--        alter database postgres set app.notify_url    = 'https://sbexwyvsgqayxrsrlrpm.supabase.co/functions/v1/notify';
--        alter database postgres set app.notify_secret = '<same NOTIFY_SECRET as step 2>';
--
-- 4. Test: submit the public application form (or insert a players row with
--    source='application') and confirm the email arrives. Function logs:
--    Dashboard → Edge Functions → notify → Logs.
--
-- To DISABLE without dropping anything: reset app.notify_url
--     alter database postgres reset app.notify_url;
-- ============================================================================

-- ROLLBACK:
--   drop trigger if exists trg_notify_player on public.players;
--   drop trigger if exists trg_notify_profile on public.profiles;
--   drop function if exists private.notify_submission();
--   -- (Edge Function `notify` is deployed separately; delete it in the dashboard.)
