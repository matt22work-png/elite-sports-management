import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin-only endpoint: give an EXISTING roster player (public.players row) a real Supabase Auth
// account when they don't have one yet (owner_id IS NULL). This is the forward fix for the same
// gap that stranded six legacy players — an approved player with no auth.users entry can't have
// their login email/password managed by the Set email / Set password admin controls, because
// those target a user by auth id. It complements admin-create-player: that one creates a brand-new
// player + account together; this one links an account onto a player row that already exists
// (e.g. a public applicant Sam just approved, or any legacy row).
//
// It does NOT hardcode any player — it works for any players.id whose owner_id is null. All with
// the service-role key (never in the browser): create the auth user (temp password, email_confirm,
// role metadata -> handle_new_user makes the profile), set players.owner_id, upsert the profile to
// approved so the Accounts panel controls light up. Sam then sets the real password via "Set
// password" — the temp is random and never shown, so no plaintext password is ever stored by us.
//
// Security mirrors admin-create-player exactly: verify_jwt=true AND server-side is_admin_email.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Strong random temp password — Sam changes it immediately via "Set password", so it is never
// shown or shared; it just needs to satisfy the account's password rule.
const tempPassword = () => {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return "Aa1!" + btoa(String.fromCharCode(...b)).replace(/[^A-Za-z0-9]/g, "").slice(0, 20);
};

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
  const emailOverride = String(body.email ?? "").trim().toLowerCase();

  // 4) Load the player row and guard against double-linking.
  const { data: player, error: pErr } = await admin
    .from("players").select("id, name, email, owner_id").eq("id", playerId).maybeSingle();
  if (pErr) return json({ error: "Couldn't load the player: " + pErr.message }, 500);
  if (!player) return json({ error: "Player not found." }, 404);
  if (player.owner_id) return json({ error: "This player already has a login account." }, 409);

  const email = emailOverride || String(player.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return json({ error: "This player has no email on file — add a login email to create their account." }, 400);
  }

  const name = String(player.name ?? "").trim() || email.split("@")[0];
  const parts = name.split(/\s+/);
  const first_name = parts[0] || name;
  const last_name = parts.slice(1).join(" ");

  // 5) Create the auth account (fires handle_new_user -> profiles row).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword(),
    email_confirm: true,
    user_metadata: { role: "player", first_name, last_name },
  });
  if (createErr || !created?.user) {
    const msg = /already|registered|exists|duplicate/i.test(createErr?.message || "")
      ? "That email is already in use by another account."
      : (createErr?.message || "Could not create the account.");
    return json({ error: msg }, 400);
  }
  const uid = created.user.id;

  // 6) Link the existing roster row to the new account (do this BEFORE approving the profile so
  //    sync_player_status finds the row and updates it, rather than inserting a duplicate).
  const { error: linkErr } = await admin.from("players")
    .update({ owner_id: uid, email }).eq("id", playerId);
  if (linkErr) {
    await admin.auth.admin.deleteUser(uid).catch(() => {});   // roll back the orphaned account
    return json({ error: "Could not link the account to the player: " + linkErr.message }, 400);
  }

  // 7) Mark the profile approved so the Accounts panel controls (Set email / Set password) work.
  const { error: profErr } = await admin.from("profiles").upsert({
    id: uid, role: "player", first_name, last_name, email, account_status: "approved",
  }, { onConflict: "id" });
  if (profErr) {
    return json({ ok: true, user_id: uid, email, warning: "Account created and linked, but could not auto-approve the profile: " + profErr.message });
  }

  return json({ ok: true, user_id: uid, email });
});
