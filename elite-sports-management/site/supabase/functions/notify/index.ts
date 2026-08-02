// ============================================================================
// ESM — submission notification Edge Function (Phase 6)
// ============================================================================
// Emails Sam / Marianna whenever a new submission lands. Invoked server-side by a
// DB trigger (see supabase-notify.sql) that POSTs the new row via pg_net, so it
// fires on EVERY submission regardless of the client (a closed tab can't skip it).
//
// Provider-agnostic by design: this reacts to the submission row itself, not to
// how payment was taken — so it keeps working whether the flow uses Wise, Stripe,
// or anything else. Payment method and notification are fully decoupled.
//
// Routing:
//   • Baseball application / College consulting inquiry / registrations → Sam
//   • Softball application → Marianna
//   (Tenerife registrations, Phase 2, will funnel to Sam via the profiles path.)
//
// Security: closed by default. Refuses every request until NOTIFY_SECRET is set,
// then requires a matching `x-notify-secret` header (the trigger sends it).
//
// Env (set as function secrets — see supabase-notify.sql for the activation steps):
//   RESEND_API_KEY  — Resend API key. Until set, the function no-ops (logs only).
//   NOTIFY_SECRET   — shared secret; must match the DB's app.notify_secret setting.
//   NOTIFY_FROM     — verified Resend sender, e.g. "ESM <noreply@yourdomain>".
//   NOTIFY_SAM / NOTIFY_MARIANNA — override the default recipient addresses.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const NOTIFY_SECRET  = Deno.env.get("NOTIFY_SECRET") ?? "";
const FROM           = Deno.env.get("NOTIFY_FROM") ?? "Elite Sports Management <onboarding@resend.dev>";
const SAM            = Deno.env.get("NOTIFY_SAM") ?? "elitesportsmanagement50@gmail.com";
const MARIANNA       = Deno.env.get("NOTIFY_MARIANNA") ?? "softball.esm@gmail.com";

const escHtml = (s: unknown) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

function rowsTable(rows: [string, unknown][]) {
  const trs = rows
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([k, v]) =>
      `<tr><td style="padding:5px 14px 5px 0;color:#7a8aa0;white-space:nowrap">${escHtml(k)}</td>` +
      `<td style="padding:5px 0;color:#0b1f3a"><b>${escHtml(v)}</b></td></tr>`)
    .join("");
  return `<table style="border-collapse:collapse;font-size:14px">${trs}</table>`;
}
function wrap(title: string, inner: string) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px">
    <h2 style="font-size:18px;color:#0b1f3a;margin:0 0 14px">${escHtml(title)}</h2>
    ${inner}
    <p style="color:#9aa7ba;font-size:12px;margin-top:20px">Automated notification from the Elite Sports Management website.</p>
  </div>`;
}

// Map a DB record to { to, subject, html }, or null to skip (no email for this row).
function buildMessage(table: string, r: Record<string, unknown>) {
  if (table === "players" && r.source === "application") {
    const applying = String(r.applying_for ?? "");
    const isSoftball = r.sport === "Softball" || /softball/i.test(applying);
    const isCollege  = /college/i.test(applying);
    const to = isSoftball ? MARIANNA : SAM;
    const kind = isCollege ? "College consulting inquiry"
               : isSoftball ? "Softball application" : "Baseball application";
    const rows: [string, unknown][] = [
      ["Name", r.name], ["Applying for", r.applying_for], ["Sport", r.sport],
      ["Age", r.age], ["Country", r.country], ["Email", r.email], ["Phone", r.phone],
      ["Instagram", r.instagram], ["Goals", r.bio], ["Anything else", r.message],
    ];
    return { to, subject: `New ${kind}: ${r.name ?? "athlete"}`, html: wrap(kind, rowsTable(rows)) };
  }
  if (table === "profiles") {
    const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || "(no name)";
    const kind = r.role === "scout" ? "New scout registration" : "New player registration";
    const rows: [string, unknown][] = [
      ["Name", name], ["Role", r.role], ["Email", r.email],
      ["Account status", r.account_status], ["Payment", r.payment_status],
    ];
    return { to: SAM, subject: `${kind}: ${name}`, html: wrap(kind, rowsTable(rows)) };
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  // Closed by default: no secret configured → refuse; otherwise require a match.
  if (!NOTIFY_SECRET) return new Response(JSON.stringify({ ok: false, reason: "not configured" }), { status: 503 });
  if (req.headers.get("x-notify-secret") !== NOTIFY_SECRET) return new Response("Forbidden", { status: 403 });

  let payload: { table?: string; record?: Record<string, unknown> };
  try { payload = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const msg = buildMessage(String(payload.table ?? ""), payload.record ?? {});
  if (!msg) return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });

  if (!RESEND_API_KEY) {
    console.log(`[notify] RESEND_API_KEY unset — would send "${msg.subject}" to ${msg.to}`);
    return new Response(JSON.stringify({ ok: true, delivered: false, reason: "no RESEND_API_KEY" }), { status: 200 });
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [msg.to], subject: msg.subject, html: msg.html }),
  });
  const body = await res.text();
  if (!res.ok) console.error(`[notify] resend ${res.status}: ${body}`);
  return new Response(JSON.stringify({ ok: res.ok, delivered: res.ok }), { status: 200 });
});
