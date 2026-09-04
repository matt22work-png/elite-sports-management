-- Per-player photo framing: focal point + zoom so admin-uploaded photos are never cropped with
-- the athlete's head cut off. All display surfaces show the photo in a `background-size:cover`
-- box; these columns drive `background-position` (focal point) and, when zoom>1, `background-size`
-- (scale past cover). Applied on: the public roster card + profile modal (index.html), the player
-- portal avatar (portal/index.html) and the admin card avatar + crop preview (admin/index.html).
--
-- Defaults: x=50 (centred horizontally), y=35 (biased toward the TOP so heads show by default),
-- zoom=1 (plain cover, i.e. exactly the previous behaviour aside from the small vertical bias).
-- Admin sets per-player values via the drag/zoom cropper in the player editor; RLS "admin update
-- players" already authorises those writes and "read approved players" exposes them to the site.

alter table public.players
  add column if not exists photo_pos_x smallint not null default 50,
  add column if not exists photo_pos_y smallint not null default 35,
  add column if not exists photo_zoom  real     not null default 1;

alter table public.players
  drop constraint if exists players_photo_pos_x_ck,
  drop constraint if exists players_photo_pos_y_ck,
  drop constraint if exists players_photo_zoom_ck;

alter table public.players
  add constraint players_photo_pos_x_ck check (photo_pos_x between 0 and 100),
  add constraint players_photo_pos_y_ck check (photo_pos_y between 0 and 100),
  add constraint players_photo_zoom_ck  check (photo_zoom between 1 and 4);

comment on column public.players.photo_pos_x is 'Focal point X% (0-100) for background-position in a cover box.';
comment on column public.players.photo_pos_y is 'Focal point Y% (0-100). Lower = more of the top (head). Default 35 biases toward heads.';
comment on column public.players.photo_zoom  is 'Zoom factor (1-4). >1 => background-size scales past cover; 1 = plain cover.';

-- CRITICAL: anon SELECT is COLUMN-SCOPED (see supabase-harden-players-columns.sql), so a brand-new
-- column is NOT readable by anon just because RLS "read approved players" allows the row. The public
-- roster query selects these three columns, so without this grant the WHOLE query fails for anon with
-- 42501 (permission denied) and the site silently falls back to its embedded seed roster — i.e. new
-- players stop appearing. Grant SELECT on each new column, exactly like season_stats does.
grant select (photo_pos_x, photo_pos_y, photo_zoom) on public.players to anon;
