-- ============================================================================
-- ESM — Length-cap CHECK constraints on players intake fields
-- ============================================================================
-- The audit flagged that anon INSERT had no DB-level input validation, so a
-- crafted request could store arbitrarily large text in any field.
--
-- We use LENGTH CAPS rather than strict format checks (e.g. an email regex) on
-- purpose: this is a lead-capture form, and a hard DB reject on a mistyped email
-- would silently lose a real applicant. Caps stop the abuse/flooding vector
-- without ever rejecting a plausible human submission. Client-side anti-spam
-- (honeypot + time trap) handles bots before they reach the DB; these caps are
-- the server-side backstop.
--
-- Verified safe against live data before applying (max name 19, max bio 219,
-- all other intake fields empty), so no existing row violates a cap.
-- Idempotent: each constraint is dropped-if-exists before being (re)created.
-- ============================================================================

alter table public.players drop constraint if exists players_name_len;
alter table public.players add  constraint players_name_len     check (char_length(name) <= 120);

alter table public.players drop constraint if exists players_email_len;
alter table public.players add  constraint players_email_len    check (email is null or char_length(email) <= 254);

alter table public.players drop constraint if exists players_phone_len;
alter table public.players add  constraint players_phone_len    check (phone is null or char_length(phone) <= 40);

alter table public.players drop constraint if exists players_age_len;
alter table public.players add  constraint players_age_len      check (age is null or char_length(age) <= 10);

alter table public.players drop constraint if exists players_applying_len;
alter table public.players add  constraint players_applying_len check (applying_for is null or char_length(applying_for) <= 60);

alter table public.players drop constraint if exists players_bio_len;
alter table public.players add  constraint players_bio_len      check (bio is null or char_length(bio) <= 5000);

alter table public.players drop constraint if exists players_message_len;
alter table public.players add  constraint players_message_len  check (message is null or char_length(message) <= 5000);

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   alter table public.players
--     drop constraint if exists players_name_len,
--     drop constraint if exists players_email_len,
--     drop constraint if exists players_phone_len,
--     drop constraint if exists players_age_len,
--     drop constraint if exists players_applying_len,
--     drop constraint if exists players_bio_len,
--     drop constraint if exists players_message_len;
-- ----------------------------------------------------------------------------
