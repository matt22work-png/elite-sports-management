-- Elite Sports Management — admin + player-portal auth
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL → New query → Run).
-- Safe to re-run: every statement is idempotent.
--
-- This assumes supabase-schema.sql has already been run (it creates the
-- private.esm_admins allow-list and the private.is_esm_admin() helper).

-- =========================================================
-- 1. Make Samuele an admin
-- =========================================================
-- The admin panel is gated by THIS table, not by anything in the HTML. A client-side
-- email check is only a nicety — the database is what actually enforces it.
insert into private.esm_admins (email) values
  ('brunosamuele48@gmail.com')     -- Samuele Bruno — CEO & Founder
on conflict (email) do nothing;

-- Check it worked:
--   select * from private.esm_admins;
--
-- To remove an admin later:
--   delete from private.esm_admins where email = 'someone@example.com';
--
-- IMPORTANT: keep this list in sync with ADMIN_EMAILS in site/admin/index.html.
-- If they disagree, someone will get into the panel and then watch every save fail.


-- =========================================================
-- 2. Player portal — an athlete can read their OWN row, and only their own
-- =========================================================
-- Athletes sign in with a magic link sent to the email on their application.
-- This policy matches their row on that email, so an athlete physically cannot
-- read another athlete's profile — it is not merely hidden in the UI.
--
-- Note there is deliberately NO update/insert/delete policy for athletes:
-- the portal is read-only, and the agency owns the stats.
drop policy if exists "athlete reads own row" on players;
create policy "athlete reads own row" on players for select to authenticated
  using ( lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) );


-- =========================================================
-- 3. Admins can insert and delete players too
-- =========================================================
-- The schema gave admins select + update. Adding a player by hand, or deleting a
-- spam application, needs these as well.
drop policy if exists "admin insert players" on players;
create policy "admin insert players" on players for insert to authenticated
  with check ( private.is_esm_admin() );

drop policy if exists "admin delete players" on players;
create policy "admin delete players" on players for delete to authenticated
  using ( private.is_esm_admin() );


-- =========================================================
-- 4. Sanity checks — run these after the above
-- =========================================================
-- Who are the admins?
--   select email from private.esm_admins order by email;
--
-- What policies exist on players?
--   select policyname, cmd, roles from pg_policies
--   where tablename = 'players' order by policyname;
--
-- Expected on `players`:
--   admin delete players   DELETE  {authenticated}
--   admin insert players   INSERT  {authenticated}
--   admin read all players SELECT  {authenticated}
--   admin update players   UPDATE  {authenticated}
--   athlete reads own row  SELECT  {authenticated}
--   public can apply       INSERT  {anon}
--   read approved players  SELECT  {anon}


-- =========================================================
-- 5. One thing you must do in the Dashboard (not here)
-- =========================================================
-- Auth → URL Configuration → Redirect URLs — add BOTH of these, or the magic
-- link will bounce people to localhost and the login will appear broken:
--
--   https://elite-sports-management.vercel.app/admin/
--   https://elite-sports-management.vercel.app/portal/
--
-- Auth → Providers → Email — make sure "Enable Email provider" is ON.
-- Magic links need nothing else; you do NOT need to set a password for Samuele,
-- and nobody should ever send a password over chat or email.
