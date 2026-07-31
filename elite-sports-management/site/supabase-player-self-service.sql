-- ============================================================================
-- ESM — Player self-service: profile edit RPC + own-photo upload
-- ============================================================================
-- Lets an authenticated athlete edit a SAFE subset of their own profile and
-- upload their own photo, with the boundary enforced in the database (not just
-- the UI). Athletes still have NO direct UPDATE policy on players.
--
-- Why an RPC and not an UPDATE policy + column grants: column-level UPDATE
-- grants apply to the whole `authenticated` role, so they cannot separate an
-- athlete from an admin (both are `authenticated`). A SECURITY DEFINER function
-- can: it updates only the whitelisted columns, only on the caller's own row.
--
-- APPLIED to prod (sbexwyvsgqayxrsrlrpm) as migrations player_self_edit_rpc,
-- player_self_edit_rpc_lockdown, athlete_self_photo_upload.
-- ============================================================================

-- 1. Whitelisted self-edit. status / stats / name / position / email / source
--    are intentionally NOT editable here — the agency owns those.
create or replace function public.update_my_profile(
  p_bio       text default null,
  p_instagram text default null,
  p_phone     text default null,
  p_age       text default null,
  p_image_url text default null
) returns public.players
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  r public.players;
begin
  if v_email = '' then
    raise exception 'not authenticated';
  end if;
  update public.players set
    bio       = nullif(btrim(p_bio), ''),
    instagram = nullif(btrim(p_instagram), ''),
    phone     = nullif(btrim(p_phone), ''),
    age       = nullif(btrim(p_age), ''),
    image_url = coalesce(nullif(btrim(p_image_url), ''), image_url)
  where lower(email) = v_email
  returning * into r;
  if not found then
    raise exception 'no athlete profile for %', v_email;
  end if;
  return r;
end;
$$;

-- Functions grant EXECUTE to PUBLIC by default (which anon inherits); revoke it.
revoke all on function public.update_my_profile(text,text,text,text,text) from public;
grant execute on function public.update_my_profile(text,text,text,text,text) to authenticated;

-- 2. Athlete photo upload, confined to a per-user folder self/<auth.uid>/...
--    inside the public player-photos bucket. One athlete cannot touch another's
--    file. Reads are already public; admin policies are unchanged.
drop policy if exists "athlete upload own photo" on storage.objects;
create policy "athlete upload own photo" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'player-photos'
    and (storage.foldername(name))[1] = 'self'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "athlete replace own photo" on storage.objects;
create policy "athlete replace own photo" on storage.objects for update to authenticated
  using (
    bucket_id = 'player-photos'
    and (storage.foldername(name))[1] = 'self'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'player-photos'
    and (storage.foldername(name))[1] = 'self'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ROLLBACK:
--   drop function if exists public.update_my_profile(text,text,text,text,text);
--   drop policy if exists "athlete upload own photo" on storage.objects;
--   drop policy if exists "athlete replace own photo" on storage.objects;
