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
// All current routing targets resolve to the main ESM ops inbox. (Softball was
// unified here on 2026-08-14 when the softball specialist was removed from the
// site; see ENGINEERING_LOG.md.)
const OPS_INBOX = "elitesportsmanagement50@gmail.com";

const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";
const FORM_NOTIFY_SECRET = Deno.env.get("FORM_NOTIFY_SECRET") ?? "";

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

// Map a DB record → one email, or null to skip (no email for this row type).
// A single template path formats each submission type by its fields.
function buildMessage(table: string, r: Record<string, unknown>): Mail | null {
  if (table === "players" && r.source === "application") {
    // Public #join application form. applying_for drives the routing "kind".
    const applying = String(r.applying_for ?? "");
    const isSoftball = r.sport === "Softball" || /softball/i.test(applying);
    const isCollege  = /college/i.test(applying);
    const isCoaching = /coach/i.test(applying);
    const kind = isCollege ? "College consulting inquiry"
               : isSoftball ? "Softball application"
               : isCoaching ? "Coaching application"
               : "Baseball application";
    const rows: [string, unknown][] = [
      ["Name", r.name], ["Applying for", r.applying_for], ["Sport", r.sport],
      ["Age", r.age], ["Country", r.country], ["Email", r.email], ["Phone", r.phone],
      ["Instagram", r.instagram], ["Goals", r.bio], ["Anything else", r.message],
    ];
    return { to: OPS_INBOX, subject: `New ${kind}: ${r.name ?? "athlete"}`, html: wrap(kind, rowsTable(rows)) };
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
  const msg = buildMessage(String(payload?.table ?? ""), payload?.record ?? {});
  if (!msg) return json({ ok: true, skipped: true, reason: "no email for this row type" }, 200);

  const res = await sendMail(msg);
  // ALWAYS return 200. The caller (pg_net trigger) must never interpret a mail
  // failure as a submission failure — the DB insert has already committed.
  return json({ ok: true, ...res }, 200);
});
