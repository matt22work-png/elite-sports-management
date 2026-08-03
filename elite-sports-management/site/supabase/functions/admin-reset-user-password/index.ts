import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin-only endpoint: lets an authenticated ESM admin set a player's or scout's
// password. Changing another user's password requires the service-role key, which is
// NEVER exposed to the browser — it lives only in this function's environment. The caller
// is authenticated (verify_jwt) AND authorized here against private.esm_admins, so a
// non-admin (or an anon-key-only / unauthenticated request) can never reset a password.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

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
  const newPassword = String(body.new_password ?? "");
  if (!targetId) return json({ error: "user_id is required." }, 400);
  if (newPassword.length < 8) return json({ error: "New password must be at least 8 characters." }, 400);

  // 4) Set the target user's password with the service-role admin API.
  const { error: updErr } = await admin.auth.admin.updateUserById(targetId, { password: newPassword });
  if (updErr) return json({ error: updErr.message }, 400);

  return json({ ok: true });
});
