import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin-only endpoint: lets an authenticated ESM admin change a user's LOGIN email (the
// Supabase Auth email they sign in with). This is DISTINCT from a player's/scout's contact
// email (players.email / profiles.email), which is edited separately in the admin panel and
// is intentionally left untouched here. Changing another user's auth email requires the
// service-role key, which is NEVER exposed to the browser — it lives only in this function's
// environment. The caller is authenticated (verify_jwt) AND authorized here against
// private.esm_admins (via is_admin_email), so a non-admin / anon / unauthenticated request
// can never change a login email. Mirrors admin-reset-user-password exactly.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Conservative email shape check — the real validation is Supabase Auth itself (and its
// uniqueness constraint), but reject obviously malformed input early with a clear message.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const email = userData?.user?.email;
  if (userErr || !email) return json({ error: "Not signed in." }, 401);

  // 2) Authorize server-side: the caller MUST be an ESM admin. Never trust the client.
  const { data: isAdmin, error: adminErr } = await admin.rpc("is_admin_email", { p_email: email });
  if (adminErr) return json({ error: "Authorization check failed." }, 500);
  if (isAdmin !== true) return json({ error: "Not authorized — admins only." }, 403);

  // 3) Validate input.
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty/invalid body handled below */ }
  const targetId = String(body.user_id ?? "").trim();
  const newEmail = String(body.new_email ?? "").trim().toLowerCase();
  if (!targetId) return json({ error: "user_id is required." }, 400);
  if (!EMAIL_RE.test(newEmail)) return json({ error: "Enter a valid email address." }, 400);

  // 4) Set the target user's LOGIN email with the service-role admin API. email_confirm:true
  //    marks it confirmed immediately so the user can sign in with the new email right away
  //    (matches this project's "email confirmation off" setup) — no confirmation round-trip.
  const { error: updErr } = await admin.auth.admin.updateUserById(targetId, {
    email: newEmail,
    email_confirm: true,
  });
  if (updErr) {
    // Surface the common case (address already in use) with a friendlier message.
    const msg = /already|registered|exists|duplicate/i.test(updErr.message)
      ? "That email is already in use by another account."
      : updErr.message;
    return json({ error: msg }, 400);
  }

  return json({ ok: true, email: newEmail });
});
