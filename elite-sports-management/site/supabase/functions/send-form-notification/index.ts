// ============================================================================
// ESM — Gmail SMTP form-submission notifier
// ============================================================================
// Sends a formatted email to the ESM inbox whenever a new form submission lands
// (public application, player/scout registration, Tenerife registration).
//
// Invoked server-side by the existing pg_net trigger `private.notify_submission()`
// (see supabase-gmail-notify.sql), which POSTs { table, record } for every new
// relevant row. Because that POST is asynchronous and the trigger swallows its
// own errors, a mail failure here can NEVER block or fail the DB insert.
//
// ACTIVATION (ready to go live with ZERO code changes):
//   Add ONE Edge Function secret — GMAIL_APP_PASSWORD — in the Supabase dashboard
//   (Edge Functions → send-form-notification → Secrets), the 16-char Gmail App
//   Password for elitesportsmanagement50@gmail.com. Nothing else needs to change:
//   the function is already deployed and the triggers already point at it.
//   Until that secret exists, the function logs clearly and returns 200 without
//   sending — submissions keep saving normally.
//
// Env (Deno.env):
//   GMAIL_APP_PASSWORD  — REQUIRED to actually send. Missing → graceful no-op + log.
//   FORM_NOTIFY_SECRET  — OPTIONAL endpoint hardening. If set, requests must carry a
//                         matching `x-notify-secret` header (the DB trigger sends the
//                         value stored in app.notify_secret). If unset, the endpoint
//                         is open (it only ever emails the fixed ESM inbox).
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Hardcoded Gmail sending account (also the App Password owner).
const FROM_EMAIL = "elitesportsmanagement50@gmail.com";
// ⚠️ ONE-LINE SWAP POINT — where every submission notification is delivered.
// Sam is creating a NEW dedicated inbox for form submissions; until those
// credentials exist we use the current placeholder address. When the new inbox is
// ready, change ONLY this constant (and, if the SENDING account changes too, set a
// new GMAIL_APP_PASSWORD secret + update FROM_EMAIL above). All current routing
// targets resolve here (softball was unified in on 2026-08-14; see ENGINEERING_LOG).
const OPS_INBOX = "elitesportsmanagement50@gmail.com";

const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";
const FORM_NOTIFY_SECRET = Deno.env.get("FORM_NOTIFY_SECRET") ?? "";

// Supabase auto-injects these into every Edge Function. Used ONLY to mint short-lived
// signed download links for an applicant's private PDFs (application-docs bucket) so
// the notification email can link to them directly — see docLink().
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Mint a signed URL (7 days) for a private application-docs object path via the
// Storage REST API. Never throws — returns null on any failure so the email still
// sends. We deliberately DON'T attach files: links are far more reliable than
// multi-MB SMTP attachments and won't trip Gmail size limits.
async function docLink(path: string): Promise<string | null> {
  if (!path || !SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/application-docs/${path.split("/").map(encodeURIComponent).join("/")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
        body: JSON.stringify({ expiresIn: 604800 }), // 7 days
      },
    );
    if (!res.ok) return null;
    const j = await res.json();
    return j?.signedURL ? `${SUPABASE_URL}/storage/v1${j.signedURL}` : null;
  } catch {
    return null;
  }
}

// Look up a profile (name/email/status) by id via the REST API + service role.
// Scout details land in `scouts` but the email/name live on `profiles`, so we join
// them here for a complete notification. Never throws — returns null on failure.
async function fetchProfile(id: string): Promise<Record<string, unknown> | null> {
  if (!id || !SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=first_name,last_name,email,account_status`,
      { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } },
    );
    if (!res.ok) return null;
    const arr = await res.json();
    return Array.isArray(arr) && arr[0] ? arr[0] : null;
  } catch {
    return null;
  }
}

const escHtml = (s: unknown) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

// Render a readable label→value table, dropping empty fields (never raw JSON).
function rowsTable(rows: [string, unknown][]) {
  const trs = rows
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([k, v]) =>
      `<tr><td style="padding:5px 14px 5px 0;color:#7a8aa0;white-space:nowrap;vertical-align:top">${escHtml(k)}</td>` +
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

type Mail = { to: string; subject: string; html: string };

// A "Files" block: labelled links to the applicant's uploads. Photo is public
// (direct URL); the PDFs are private, so each is a 7-day signed link (docLink).
function filesTable(links: [string, string | null][]) {
  const items = links
    .filter(([, url]) => !!url)
    .map(([k, url]) => `<div style="margin:4px 0"><a href="${escHtml(url)}" style="color:#1f6feb">${escHtml(k)} →</a></div>`)
    .join("");
  return items ? `<div style="margin-top:12px"><div style="color:#7a8aa0;font-size:13px;margin-bottom:4px">Uploaded files</div>${items}</div>` : "";
}

// Map a DB record → one email, or null to skip (no email for this row type).
// A single template path formats each submission type by its fields. Async because
// building an application email mints signed download links for the private PDFs.
async function buildMessage(table: string, r: Record<string, unknown>): Promise<Mail | null> {
  if (table === "players" && r.source === "application") {
    // Public #join application form. applying_for drives the routing "kind".
    const applying = String(r.applying_for ?? "");
    const isSoftball = r.sport === "Softball" || /softball/i.test(applying);
    const isCollege  = /college/i.test(applying);
    const isTeams    = /team|scout/i.test(applying);
    const isCoaching = /coach/i.test(applying);   // legacy rows only
    const kind = isCollege ? "College application"
               : isTeams ? "Teams / scouts inquiry"
               : isSoftball ? "Softball application"
               : isCoaching ? "Coaching application"
               : "Baseball application";
    const rows: [string, unknown][] = [
      ["Name", r.name], ["Applying for", r.applying_for], ["Sport", r.sport],
      ["Nationality", r.nationality], ["Age", r.age], ["Position", r.position],
      ["Role", r.role], ["Country", r.country], ["Email", r.email], ["Phone", r.phone],
      ["Instagram", r.instagram], ["Education level", r.education_level],
      ["Goals", r.bio], ["What they'd like to study / goals", r.study_goals],
      ["Looking for", r.looking_for], ["Anything else", r.message],
    ];
    // Signed links for the private PDFs (best-effort); photo is a public URL.
    const [resume, english, diploma] = await Promise.all([
      docLink(String(r.resume_url ?? "")),
      docLink(String(r.english_cert_url ?? "")),
      docLink(String(r.diploma_url ?? "")),
    ]);
    const files = filesTable([
      ["Photo", r.image_url ? String(r.image_url) : null],
      ["Resume / CV", resume],
      ["English certificate", english],
      ["Diploma", diploma],
    ]);
    return { to: OPS_INBOX, subject: `New ${kind}: ${r.name ?? "athlete"}`, html: wrap(kind, rowsTable(rows) + files) };
  }
  if (table === "scouts") {
    // Scout/team details completed at /register/ (fires once on the scouts INSERT).
    // Join the account's name + email from profiles for a complete notification.
    const prof = await fetchProfile(String(r.id ?? ""));
    const acctName = prof ? [prof.first_name, prof.last_name].filter(Boolean).join(" ") : "";
    const displayName = String(r.name_or_team || acctName || "scout");
    const rows: [string, unknown][] = [
      ["Name / Team", r.name_or_team], ["Account name", acctName], ["Email", prof?.email],
      ["Nationality", r.nationality], ["Country", r.country], ["Phone", r.phone],
      ["Role", r.title], ["Looking for", r.looking_for],
      // Legacy columns (older scout rows) — shown only if populated.
      ["Organization", r.organization], ["School/Team", r.school_team], ["Notes", r.notes],
    ];
    const files = filesTable([["Photo", r.photo_url ? String(r.photo_url) : null]]);
    const kind = "Scout / team details submitted";
    return { to: OPS_INBOX, subject: `New scout details: ${displayName}`, html: wrap(kind, rowsTable(rows) + files) };
  }
  if (table === "profiles") {
    const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || "(no name)";
    const kind = r.role === "scout"
      ? "New scout registration (pending approval)"
      : "New player registration (pending approval)";
    const rows: [string, unknown][] = [
      ["Name", name], ["Role", r.role], ["Email", r.email],
      ["Account status", r.account_status], ["Payment", r.payment_status],
    ];
    return { to: OPS_INBOX, subject: `${kind}: ${name}`, html: wrap(kind, rowsTable(rows)) };
  }
  if (table === "tenerife_registrations") {
    const rows: [string, unknown][] = [
      ["Name", r.name], ["Email", r.email], ["Phone", r.phone], ["Country", r.country],
      ["Position", r.position], ["Sport", r.sport], ["Notes", r.notes],
    ];
    const kind = "Tenerife Winter League registration";
    return { to: OPS_INBOX, subject: `New ${kind}: ${r.name ?? ""}`, html: wrap(kind, rowsTable(rows)) };
  }
  return null;
}

// Attempt a Gmail SMTP send. NEVER throws — returns a result the caller logs.
// denomailer is imported dynamically AFTER the password check, so when the App
// Password is absent (today) the SMTP library is never even loaded.
async function sendMail(msg: Mail): Promise<{ delivered: boolean; reason?: string }> {
  if (!GMAIL_APP_PASSWORD) {
    console.error(
      `[send-form-notification] GMAIL_APP_PASSWORD not set — email NOT sent. ` +
      `Would have emailed "${msg.subject}" to ${msg.to}. ` +
      `Add the secret in Supabase → Edge Functions → send-form-notification → Secrets to go live.`,
    );
    return { delivered: false, reason: "GMAIL_APP_PASSWORD not set" };
  }
  let client: { send: (o: unknown) => Promise<unknown>; close: () => Promise<void> } | null = null;
  try {
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,            // implicit TLS
        tls: true,
        auth: { username: FROM_EMAIL, password: GMAIL_APP_PASSWORD },
      },
    }) as unknown as typeof client;
    await client!.send({
      from: `Elite Sports Management <${FROM_EMAIL}>`,
      to: msg.to,
      subject: msg.subject,
      content: "auto",        // auto-generate a text/plain part from the html
      html: msg.html,
    });
    console.log(`[send-form-notification] sent "${msg.subject}" to ${msg.to}`);
    return { delivered: true };
  } catch (err) {
    console.error(`[send-form-notification] SMTP send FAILED for "${msg.subject}" to ${msg.to}: ${String((err as Error)?.message ?? err)}`);
    return { delivered: false, reason: String((err as Error)?.message ?? err) };
  } finally {
    try { await client?.close(); } catch (_) { /* ignore close errors */ }
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, reason: "method not allowed" }, 405);

  // Optional endpoint hardening — only enforced when FORM_NOTIFY_SECRET is configured.
  if (FORM_NOTIFY_SECRET && req.headers.get("x-notify-secret") !== FORM_NOTIFY_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  let payload: { table?: string; record?: Record<string, unknown>; test?: boolean; to?: string };
  try { payload = await req.json(); } catch { return json({ ok: false, reason: "bad json" }, 400); }

  // ── Test mode ────────────────────────────────────────────────────────────
  // POST {"test": true} (optionally {"to": "you@example.com"}) to validate the
  // whole pipeline in isolation once GMAIL_APP_PASSWORD is set. Returns the send
  // result so you can see delivered:true / false + any SMTP error.
  if (payload?.test === true) {
    const to = typeof payload.to === "string" && payload.to.includes("@") ? payload.to : OPS_INBOX;
    const html = wrap("ESM email pipeline test", rowsTable([
      ["Status", "If you are reading this, Gmail SMTP is working."],
      ["Sent by", "send-form-notification Edge Function"],
      ["Server time", new Date().toISOString()],
    ]));
    const res = await sendMail({ to, subject: "ESM email pipeline test", html });
    return json({ ok: true, test: true, ...res }, 200);
  }

  // ── Normal path: build + send from the submission row ─────────────────────
  const msg = await buildMessage(String(payload?.table ?? ""), payload?.record ?? {});
  if (!msg) return json({ ok: true, skipped: true, reason: "no email for this row type" }, 200);

  const res = await sendMail(msg);
  // ALWAYS return 200. The caller (pg_net trigger) must never interpret a mail
  // failure as a submission failure — the DB insert has already committed.
  return json({ ok: true, ...res }, 200);
});
