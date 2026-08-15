-- ============================================================================
-- ESM — Gmail SMTP form-submission notifications (ACTIVE)
-- ============================================================================
-- Every new form submission emails the ESM inbox via Gmail SMTP. The Edge
-- Function `send-form-notification` (site/supabase/functions/send-form-notification/)
-- does the sending; a pg_net trigger POSTs each new row to it asynchronously,
-- so the email attempt NEVER blocks or fails the underlying insert.
--
-- Supersedes the earlier Resend-based `notify` function + supabase-notify.sql.
-- The generic trigger fn `private.notify_submission()` is reused (it just reads
-- its config from a table now instead of the app.* GUCs — Supabase managed
-- Postgres does not allow `ALTER DATABASE ... SET app.*`).
--
-- APPLIED to prod (sbexwyvsgqayxrsrlrpm) as migrations:
--   • notify_config_table_and_fn   (this file)
-- Triggers trg_notify_player / trg_notify_profile / trg_notify_tenerife already
-- exist (from the earlier notify migration) and call private.notify_submission().
--
-- Routing (all currently → elitesportsmanagement50@gmail.com; the Edge Function
-- labels each by "kind" in the subject line):
--   • players  source='application'  → Baseball / Softball / College / Coaching
--   • profiles (player or scout registration, pending approval)
--   • tenerife_registrations (Winter League €599.99 flow)
--   Softball was unified to the main inbox on 2026-08-14 (specialist removed).
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ TO GO LIVE (zero code changes): add ONE Edge Function secret —            │
-- │   GMAIL_APP_PASSWORD = <16-char Gmail App Password for                    │
-- │                        elitesportsmanagement50@gmail.com>                 │
-- │ in Supabase → Edge Functions → send-form-notification → Secrets.          │
-- │ Until then the function logs "GMAIL_APP_PASSWORD not set" and returns 200 │
-- │ without sending; submissions still save normally.                        │
-- └──────────────────────────────────────────────────────────────────────────┘
-- ============================================================================

create extension if not exists pg_net with schema extensions;   -- API stays in the `net` schema

-- Config read live by the trigger (in `private`, so never exposed via anon/PostgREST).
create table if not exists private.notify_config (
  id     smallint primary key default 1,
  url    text,
  secret text,
  constraint notify_config_singleton check (id = 1)
);

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

-- Triggers (idempotent — already present in prod from the earlier notify migration):
drop trigger if exists trg_notify_player on public.players;
create trigger trg_notify_player after insert on public.players
  for each row execute function private.notify_submission();

drop trigger if exists trg_notify_profile on public.profiles;
create trigger trg_notify_profile after insert on public.profiles
  for each row execute function private.notify_submission();

drop trigger if exists trg_notify_tenerife on public.tenerife_registrations;
create trigger trg_notify_tenerife after insert on public.tenerife_registrations
  for each row execute function private.notify_submission();

-- Point the triggers at the Gmail function. `secret` is the value the trigger
-- sends in the x-notify-secret header; it is only ENFORCED if the function also
-- has FORM_NOTIFY_SECRET set to the same value (optional hardening — see below).
-- NOTE: the real secret is stored in the DB, NOT committed here.
insert into private.notify_config (id, url, secret)
values (1, 'https://sbexwyvsgqayxrsrlrpm.supabase.co/functions/v1/send-form-notification',
           '<generated-secret — set in DB, not in git>')
on conflict (id) do update set url = excluded.url, secret = excluded.secret;

-- ============================================================================
-- TESTING (once GMAIL_APP_PASSWORD is set) — send a real test email:
--   curl -X POST \
--     https://sbexwyvsgqayxrsrlrpm.supabase.co/functions/v1/send-form-notification \
--     -H "Content-Type: application/json" \
--     -d '{"test": true}'
--   → {"ok":true,"test":true,"delivered":true}   (arrives at the ESM inbox)
--   Optionally target another address: -d '{"test": true, "to": "you@example.com"}'
--   Function logs: Dashboard → Edge Functions → send-form-notification → Logs.
--
-- OPTIONAL HARDENING: to lock the endpoint to the DB trigger only, set the Edge
-- Function secret FORM_NOTIFY_SECRET to the value in private.notify_config.secret.
-- The function then rejects any POST without a matching x-notify-secret header.
-- (Not required for correctness; the function only ever emails the fixed inbox.)
--
-- DISABLE without dropping anything:
--   update private.notify_config set url = null where id = 1;
-- ROLLBACK:
--   drop trigger if exists trg_notify_player   on public.players;
--   drop trigger if exists trg_notify_profile  on public.profiles;
--   drop trigger if exists trg_notify_tenerife on public.tenerife_registrations;
--   drop function if exists private.notify_submission();
--   drop table    if exists private.notify_config;
--   -- (Edge Function send-form-notification is deployed separately; delete in dashboard.)
-- ============================================================================
