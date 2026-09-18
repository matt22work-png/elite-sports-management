// ============================================================================
// ESM — Baseball/Softball consent form: auto-fill -> PDF -> email to Sam
// ============================================================================
// Called once, right after a player row is created by the /register/ flow. It:
//
//   1. loads the players row with the service role,
//   2. fills the Baseball/Softball Representation consent form with that athlete's
//      details, choosing the block the document itself prescribes for their age
//      (terms-baseball-softball.html s.23 18+, s.24 14-17, s.25 under 14),
//   3. renders it to a PDF,
//   4. stores it in the private application-docs bucket,
//   5. writes consent_doc_url + consent_signed_at back onto the row,
//   6. emails it to the ESM inbox WITH THE PDF ATTACHED.
//
// Steps 1-5 are independent of email. If GMAIL_APP_PASSWORD is absent the PDF is
// still generated, stored and linked — the send is skipped with a clear log, the
// same graceful-degradation contract send-form-notification already uses.
//
// The generated PDF is an UNSIGNED form: it carries the athlete's and guardians'
// details already filled in, with signature rules left blank to be signed. It is a
// convenience artefact, not a substitute for the document itself — the full,
// legally binding Italian text lives at /terms-baseball-softball.html and the PDF
// links back to it.
//
// ACTIVATION: add GMAIL_APP_PASSWORD (Edge Functions -> Secrets), the App Password
// for the FROM_EMAIL account below. Nothing else changes.
//
// Env (Deno.env):
//   GMAIL_APP_PASSWORD  — REQUIRED to actually send. Missing → PDF still made, no email.
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — auto-injected.
// ============================================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const FROM_EMAIL = "esmsportsnetworkinfo@gmail.com";
// Where the signed consent form is sent. Sam asked for this specific address for the
// legal paperwork — deliberately the direct-correspondence inbox, not the automated
// notifications one that send-form-notification uses.
const CONSENT_INBOX = "elitesportsmanagement50@gmail.com";
const SITE = "https://esm-sports-network.vercel.app";
const DOC_URL = `${SITE}/terms-baseball-softball.html`;

const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BUCKET = "application-docs";

type Row = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

// pdf-lib's standard fonts are WinAnsi-encoded and THROW on anything outside it.
// Italian accents are all inside WinAnsi; the document's ballot-box glyphs are not,
// so they become [ ] / [X]. Anything else unexpected degrades to "?" rather than
// failing the whole render.
function winAnsi(input: string): string {
  return input
    .replace(/☐/g, "[ ]").replace(/☑|☒/g, "[X]")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/–/g, "-").replace(/—/g, "--")
    .replace(/…/g, "...").replace(/ /g, " ")
    .replace(/[^\x09\x0A\x20-\x7E -ÿ]/g, "?");
}

function ageFromDob(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
}

// ─── PDF rendering ──────────────────────────────────────────────────────────
async function buildPdf(p: Row): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const A4: [number, number] = [595.28, 841.89];
  const M = 48, W = A4[0] - M * 2;
  let page = pdf.addPage(A4);
  let y = A4[1] - M;

  const nl = (h: number) => { y -= h; if (y < M + 40) { page = pdf.addPage(A4); y = A4[1] - M; } };
  const draw = (text: string, o: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
    const size = o.size ?? 10, f = o.f ?? font, color = o.color ?? rgb(0.09, 0.12, 0.18);
    // naive greedy wrap at the content width
    const words = winAnsi(text).split(/\s+/);
    let line = "";
    const flush = () => {
      if (!line) return;
      nl(size + 3);
      page.drawText(line, { x: M, y, size, font: f, color });
      line = "";
    };
    for (const w of words) {
      const cand = line ? line + " " + w : w;
      if (f.widthOfTextAtSize(cand, size) > W) flush(), (line = w);
      else line = cand;
    }
    flush();
    if (o.gap) nl(o.gap);
  };
  const rule = (label: string, value: string) => {
    nl(16);
    const lab = winAnsi(label + ": ");
    page.drawText(lab, { x: M, y, size: 10, font: bold, color: rgb(0.09, 0.12, 0.18) });
    const x0 = M + bold.widthOfTextAtSize(lab, 10);
    page.drawText(winAnsi(value || ""), { x: x0 + 2, y, size: 10, font, color: rgb(0.09, 0.12, 0.18) });
    page.drawLine({ start: { x: x0, y: y - 3 }, end: { x: M + W, y: y - 3 }, thickness: 0.5, color: rgb(0.75, 0.78, 0.83) });
  };
  const h = (text: string) => { nl(20); page.drawText(winAnsi(text), { x: M, y, size: 12, font: bold, color: rgb(0.05, 0.1, 0.2) }); nl(4); };

  const dob = s(p.date_of_birth);
  const age = ageFromDob(dob);
  const minor = age !== null && age < 18;
  const both = age !== null && age < 14;
  const section = !minor ? "23" : both ? "25" : "24";

  // Title block
  page.drawText(winAnsi("ESM SPORTS NETWORK OF SAMUELE BRUNO"), { x: M, y, size: 14, font: bold, color: rgb(0.05, 0.1, 0.2) });
  nl(16);
  draw("Terms & Conditions, Privacy Notice and Consent to the Use of Images and Video", { size: 10.5, f: bold });
  draw("Baseball / Softball Representation — consent form, auto-filled from the athlete's registration.", { size: 9, color: rgb(0.35, 0.4, 0.48) });
  draw(`P.IVA 18698281005 · ATECO 74.99.93 · ${CONSENT_INBOX}`, { size: 9, color: rgb(0.35, 0.4, 0.48) });
  draw(`Full document (Italian original is the binding text): ${DOC_URL}`, { size: 9, color: rgb(0.35, 0.4, 0.48) });
  draw(`Generated ${new Date().toISOString().slice(0, 10)} · applicable consent section: ${section}`, { size: 9, color: rgb(0.35, 0.4, 0.48), gap: 8 });

  h("Athlete");
  rule("Full name", s(p.name));
  rule("Date of birth", dob + (age !== null ? `  (age ${age})` : ""));
  rule("Email", s(p.email));
  rule("Phone", s(p.phone));
  rule("Country", s(p.country));
  rule("Position / sport", [s(p.position), s(p.sport)].filter(Boolean).join(" / "));
  nl(10);

  if (minor) {
    h(both ? "Parent 1 (section 25 — both parents required)" : "Parent / legal guardian (section 24)");
    if (!both) rule("Capacity", s(p.guardian_relation) === "guardian" ? "Legal guardian" : "Parent");
    rule("Full name", [s(p.guardian1_first_name), s(p.guardian1_last_name)].filter(Boolean).join(" "));
    rule("Email", s(p.guardian1_email));
    rule("Phone", s(p.guardian1_phone));
    nl(6);
    draw("I declare that I am entitled to give this consent.", { size: 9.5 });
    nl(6);
    if (both) {
      h("Parent 2 (section 25)");
      rule("Full name", [s(p.guardian2_first_name), s(p.guardian2_last_name)].filter(Boolean).join(" "));
      rule("Email", s(p.guardian2_email));
      rule("Phone", s(p.guardian2_phone));
      nl(6);
      draw("I declare that I exercise parental responsibility.", { size: 9.5 });
      nl(6);
    }
  }

  if (s(p.guardian_notes)) {
    h("Information / notes supplied at registration");
    draw(s(p.guardian_notes), { size: 9.5, gap: 6 });
  }

  h("Declaration (section 28)");
  for (const line of [
    "[ ] I have read these Terms and Conditions;",
    "[ ] I have read the Privacy Notice;",
    "[ ] I understand how personal data is processed;",
    "[ ] I understand that consent to publication of images and video is separate and optional;",
    "[ ] I understand the right to withdraw consent;",
    "[ ] I have provided correct and truthful information.",
  ]) draw(line, { size: 9.5 });
  nl(8);
  draw("ACCEPTANCE OF THE TERMS", { size: 9.5, f: bold });
  draw("[ ] I ACCEPT THE TERMS AND CONDITIONS AND DECLARE THAT I HAVE READ THE PRIVACY NOTICE.", { size: 9.5, gap: 4 });
  draw("IMAGE CONSENT — OPTIONAL", { size: 9.5, f: bold });
  draw(minor
    ? "[ ] I CONSENT to the use and publication of the minor's images/video.    [ ] I DO NOT CONSENT."
    : "[ ] I CONSENT to the use and publication of my images/video.    [ ] I DO NOT CONSENT.",
    { size: 9.5, gap: 10 });

  h("Signatures");
  rule("Place", "");
  rule("Date", "");
  rule("Athlete's signature", "");
  if (minor) rule(both ? "Parent 1 signature" : "Parent / guardian signature", "");
  if (both) rule("Parent 2 signature", "");
  nl(18);
  draw("This PDF is generated from the athlete's registration for convenience. The Italian version of the full document at the link above is the legally binding text.",
    { size: 8, color: rgb(0.45, 0.5, 0.57) });

  return await pdf.save();
}

// ─── storage + db ───────────────────────────────────────────────────────────
async function upload(path: string, bytes: Uint8Array): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY,
      "Content-Type": "application/pdf", "x-upsert": "true",
    },
    body: bytes,
  });
  if (!res.ok) console.error(`[generate-consent-pdf] upload failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.ok;
}

async function markRow(id: unknown, path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/players?id=eq.${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY,
      "Content-Type": "application/json", Prefer: "return=minimal",
    },
    body: JSON.stringify({ consent_doc_url: path, consent_signed_at: new Date().toISOString() }),
  });
  if (!res.ok) console.error(`[generate-consent-pdf] row update failed ${res.status}`);
}

// ─── email (with attachment) ────────────────────────────────────────────────
// send-form-notification deliberately links rather than attaches, because those
// emails can reference several multi-MB uploads. This one attaches exactly one
// generated PDF of a few KB, which is well inside Gmail's limits and is what Sam
// needs in his inbox to print and sign.
async function sendMail(subject: string, html: string, pdf: Uint8Array, filename: string) {
  if (!GMAIL_APP_PASSWORD) {
    console.error(
      `[generate-consent-pdf] GMAIL_APP_PASSWORD not set — PDF generated and stored, email NOT sent. ` +
      `Would have emailed "${subject}" to ${CONSENT_INBOX} with ${filename} attached.`,
    );
    return { delivered: false, reason: "GMAIL_APP_PASSWORD not set" };
  }
  let client: { send: (o: unknown) => Promise<unknown>; close: () => Promise<void> } | null = null;
  try {
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    client = new SMTPClient({
      connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: FROM_EMAIL, password: GMAIL_APP_PASSWORD } },
    }) as unknown as typeof client;
    await client!.send({
      from: `ESM Sports Network <${FROM_EMAIL}>`,
      to: CONSENT_INBOX,
      subject,
      content: "auto",
      html,
      attachments: [{ filename, content: pdf, encoding: "binary", contentType: "application/pdf" }],
    });
    return { delivered: true };
  } catch (err) {
    const reason = String((err as Error)?.message ?? err);
    console.error(`[generate-consent-pdf] SMTP send FAILED: ${reason}`);
    return { delivered: false, reason };
  } finally {
    try { await client?.close(); } catch (_) { /* ignore */ }
  }
}

// Unlike send-form-notification — which is only ever called server-side by a pg_net
// trigger and so never meets a browser — this one is invoked from /register/ in the
// page. The Authorization + apikey + Content-Type headers make that a non-simple
// request, so the browser sends an OPTIONS preflight first; without these headers it
// is rejected before the POST is ever attempted. Origin is open because the function
// is deployed with verify_jwt, so a valid session token is required regardless.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, reason: "method not allowed" }, 405);

  let body: { player_id?: number | string; record?: Row; test?: boolean };
  try { body = await req.json(); } catch { return json({ ok: false, reason: "bad json" }, 400); }

  let row: Row | null = null;
  if (body.test === true) {
    row = {
      id: 0, name: "Test Athlete", email: "test@example.com", country: "Italy",
      position: "Catcher", sport: "Baseball", date_of_birth: "2013-05-04",
      guardian_relation: "parent", guardian1_first_name: "Giulia", guardian1_last_name: "Rossi",
      guardian1_email: "g@example.com", guardian2_first_name: "Marco", guardian2_last_name: "Rossi",
      guardian_notes: "Generated by the built-in self-test.",
    };
  } else if (body.player_id !== undefined) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/players?id=eq.${encodeURIComponent(String(body.player_id))}&select=*`,
      { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } },
    );
    const rows = res.ok ? await res.json() : [];
    row = Array.isArray(rows) && rows[0] ? rows[0] : null;
  } else if (body.record) {
    row = body.record;
  }
  if (!row) return json({ ok: false, reason: "player not found" }, 404);

  // Scope: this consent form belongs to the Baseball/Softball Representation document.
  // A row with no date of birth predates the DOB field and has nothing to fill in.
  if (!s(row.date_of_birth)) return json({ ok: true, skipped: true, reason: "no date_of_birth on row" });

  let bytes: Uint8Array;
  try { bytes = await buildPdf(row); }
  catch (err) {
    console.error(`[generate-consent-pdf] PDF build failed: ${String((err as Error)?.message ?? err)}`);
    return json({ ok: false, reason: "pdf build failed" }, 200);
  }

  const safe = s(row.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "athlete";
  const filename = `esm-consent-${safe}.pdf`;
  const path = `consent/${safe}-${row.id}-${Date.now()}.pdf`;

  let stored = false;
  if (body.test !== true) {
    stored = await upload(path, bytes);
    if (stored) await markRow(row.id, path);
  }

  const age = ageFromDob(s(row.date_of_birth));
  const html =
    `<p>A new athlete completed registration and the Baseball/Softball consent form has been auto-filled.</p>` +
    `<p><b>${s(row.name)}</b> — date of birth ${s(row.date_of_birth)}${age !== null ? ` (age ${age})` : ""}.<br>` +
    `${age !== null && age < 18 ? "Minor: the attached form carries the parent/guardian block that applies." : "Over 18: the athlete signs alone."}</p>` +
    `<p>The filled form is attached as a PDF, ready to print and sign. Full document: <a href="${DOC_URL}">${DOC_URL}</a></p>`;

  const mail = await sendMail(`ESM consent form — ${s(row.name)}`, html, bytes, filename);

  return json({ ok: true, bytes: bytes.length, stored, path: stored ? path : null, ...mail });
});
