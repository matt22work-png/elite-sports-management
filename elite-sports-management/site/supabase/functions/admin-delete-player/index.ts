import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin-only endpoint: PERMANENTLY and COMPLETELY delete a player. This is the destructive
// "🗑 Delete" action in the admin panel — distinct from Reject/Archive, which only change a
// player's status (the row, account and files all stay). Full deletion needs the service-role
// key because two parts of the cleanup are impossible from the browser:
//   • the linked auth.users account (only the Admin API can delete a user), and
//   • the uploaded files in application-photos / application-docs (anon can upload but there is
//     deliberately no admin DELETE storage policy on those buckets — see supabase-application-fields.sql).
//
// What it removes, all with the service-role key (NEVER exposed to the browser):
//   1) Storage files: the profile photo (image_url, in player-photos or application-photos) and any
//      resume/CV, English certificate and diploma PDFs (application-docs). Best-effort — a missing
//      object never blocks the delete; anything that fails is reported back as a warning.
//   2) The public.players row. This CASCADES to player_batting_stats / player_pitching_stats /
//      player_fielding_stats / player_notes (all FK ON DELETE CASCADE); the jsonb stats/season_stats
//      columns go with the row.
//   3) The linked auth.users account (owner_id), if any. This CASCADES to public.profiles and
//      public.scouts. (A player never has a scouts row, but the cascade is harmless.)
//
// Scope: players ONLY. It loads the row from public.players by id and deletes exactly that row and
// its own dependents — it never touches scouts except via the auth cascade of the player's own
// account. Scout deletion is a separate flow and is intentionally untouched.
//
// Security mirrors admin-create-player / admin-link-player-account exactly: verify_jwt=true at the
// platform level AND a server-side is_admin_email check, so a non-admin / anon request can never
// delete anything.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Turn a stored image_url (a full public URL from getPublicUrl) into { bucket, path } so we can
// delete the underlying object. Handles the public/sign/authenticated URL shapes. Returns null if
// the value isn't a recognisable Storage URL (e.g. an external link) — caller skips it.
function parseStorageUrl(u: string): { bucket: string; path: string } | null {
  const m = /\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?([^/]+)\/(.+?)(?:\?|$)/.exec(u);
  if (!m) return null;
  try { return { bucket: m[1], path: decodeURIComponent(m[2]) }; }
  catch { return { bucket: m[1], path: m[2] }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) Identify the caller from their bearer token (the admin's own session JWT).
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "Missing authorization." }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  const callerEmail = userData?.user?.email;
  if (userErr || !callerEmail) return json({ error: "Not signed in." }, 401);

  // 2) Authorize server-side: the caller MUST be an ESM admin. Never trust the client.
  const { data: isAdmin, error: adminErr } = await admin.rpc("is_admin_email", { p_email: callerEmail });
  if (adminErr) return json({ error: "Authorization check failed." }, 500);
  if (isAdmin !== true) return json({ error: "Not authorized — admins only." }, 403);

  // 3) Validate input.
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* handled below */ }
  const playerId = Number(body.player_id);
  if (!Number.isInteger(playerId)) return json({ error: "player_id (integer) is required." }, 400);

  // 4) Load the player row so we know its files and linked account.
  const { data: player, error: pErr } = await admin
    .from("players")
    .select("id, name, owner_id, image_url, resume_url, english_cert_url, diploma_url")
    .eq("id", playerId).maybeSingle();
  if (pErr) return json({ error: "Couldn't load the player: " + pErr.message }, 500);
  if (!player) return json({ error: "Player not found — it may already have been deleted." }, 404);

  const warnings: string[] = [];

  // 5) Delete storage files (best-effort). Group object paths by bucket, then one remove() call
  //    per bucket. The photo lives in player-photos (admin uploads) or application-photos (public
  //    applications); the PDFs are object paths in the private application-docs bucket.
  const byBucket: Record<string, string[]> = {};
  const addPath = (bucket: string, path: string) => {
    if (!path) return;
    (byBucket[bucket] ||= []).push(path);
  };
  if (player.image_url) {
    const loc = parseStorageUrl(String(player.image_url));
    if (loc) addPath(loc.bucket, loc.path);
    else warnings.push("Photo URL wasn't a recognisable storage path, left untouched: " + player.image_url);
  }
  // Docs are stored as bare object paths inside the application-docs bucket.
  for (const col of ["resume_url", "english_cert_url", "diploma_url"] as const) {
    const v = player[col];
    if (v) addPath("application-docs", String(v));
  }
  let filesRemoved = 0;
  for (const [bucket, paths] of Object.entries(byBucket)) {
    const { data: removed, error: rmErr } = await admin.storage.from(bucket).remove(paths);
    if (rmErr) warnings.push(`Could not delete ${paths.length} file(s) from ${bucket}: ${rmErr.message}`);
    else filesRemoved += (removed?.length ?? 0);
  }

  // 6) Delete the player row (cascades stats + notes). This is the point of no return; if it fails
  //    nothing important is lost yet, so surface the error and stop.
  const { error: delErr } = await admin.from("players").delete().eq("id", playerId);
  if (delErr) return json({ error: "Could not delete the player row: " + delErr.message }, 500);

  // 7) Delete the linked auth account (cascades profiles + scouts). Non-fatal: the roster row and
  //    files are already gone, so a lingering login is a warning, not a failure.
  let accountDeleted = false;
  if (player.owner_id) {
    const { error: authErr } = await admin.auth.admin.deleteUser(String(player.owner_id));
    if (authErr) warnings.push("Player row deleted, but couldn't remove the login account: " + authErr.message);
    else accountDeleted = true;
  }

  return json({
    ok: true,
    player_id: playerId,
    name: player.name,
    files_removed: filesRemoved,
    account_deleted: accountDeleted,
    had_account: !!player.owner_id,
    warnings,
  });
});
