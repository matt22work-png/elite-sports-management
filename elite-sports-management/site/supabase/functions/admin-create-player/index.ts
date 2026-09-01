import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin-only endpoint: creates a brand-new player that Sam has already signed, giving them a
// REAL Supabase Auth account (not just a bare public.players row). This fixes the long-standing
// gap where admin-added players had no auth.users entry, so the admin-set-user-email and
// admin-reset-user-password functions (which target a user by their auth id) had nothing to act
// on — Sam could never manage their login email or password.
//
// What it does, all with the service-role key (NEVER exposed to the browser):
//   1) Creates the auth user (email + random temp password + email_confirm:true, role metadata),
//      which fires handle_new_user() to create the matching public.profiles row.
//   2) Inserts the linked public.players row (owner_id = the new auth id, source 'admin',
//      status 'approved') — mirrors the old direct insert, just now owner-linked.
//   3) Upserts the profile to account_status 'approved' so it shows as an active account and the
//      existing Accounts panel controls (Set email / Set password) work identically to a
//      self-registered player. Self-registration is completely unaffected — same tables, same
//      triggers, same linkage (profiles.id = auth.users.id = players.owner_id).
//
// The caller is authenticated (verify_jwt) AND authorized here against private.esm_admins (via
// is_admin_email), so a non-admin / anon request can never create an account. Mirrors the
// security model of admin-set-user-email / admin-reset-user-password exactly.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const slugify = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Strong random temp password. Sam changes it immediately via the existing "Set password"
// control, so it is never shown or shared — it just needs to satisfy the account's password rule.
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
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!name) return json({ error: "Full name is required." }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: "Enter a valid login email." }, 400);

  const position = String(body.position ?? "").trim();
  const sport = String(body.sport ?? "Baseball").trim() || "Baseball";
  const country = String(body.country ?? "").trim();
  const bio = String(body.bio ?? "").trim();
  const image_url = String(body.image_url ?? "").trim() || null;
  const teams = Array.isArray(body.teams)
    ? (body.teams as unknown[]).map((t) => String(t).trim()).filter(Boolean)
    : [];
  const parts = name.split(/\s+/);
  const first_name = parts[0] || name;
  const last_name = parts.slice(1).join(" ");

  // 4) Create the auth account (fires handle_new_user -> profiles row).
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

  // 5) Insert the linked, approved roster row (owner_id ties it to the new auth account).
  const slug = (slugify(name) || "player") + "-" + Date.now().toString(36);
  const { error: insErr } = await admin.from("players").insert({
    slug, name, group: position || "Player", position, sport, country,
    bio: bio || "", teams, stats: [], image_url,
    source: "admin", status: "approved", email, owner_id: uid,
  });
  if (insErr) {
    // Roll back the orphaned auth account so a retry can reuse the email.
    await admin.auth.admin.deleteUser(uid).catch(() => {});
    return json({ error: "Could not create the roster profile: " + insErr.message }, 400);
  }

  // 6) Mark the profile approved so it shows as an active account with the full Accounts controls.
  //    Upsert (not just update) guarantees the row exists even in the rare case the signup trigger
  //    didn't create it. This fires sync_player_status, which just re-affirms the row above.
  const { error: profErr } = await admin.from("profiles").upsert({
    id: uid, role: "player", first_name, last_name, email, account_status: "approved",
  }, { onConflict: "id" });
  if (profErr) {
    // Non-fatal: the account + roster row exist and are linked; the profile just isn't marked
    // approved yet. Surface it so the admin knows to approve from the Accounts panel.
    return json({ ok: true, user_id: uid, email, warning: "Account created but could not auto-approve: " + profErr.message });
  }

  return json({ ok: true, user_id: uid, email });
});
