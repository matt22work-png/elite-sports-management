import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin-only endpoint: takes pasted, unstructured stat text (a box score, a transcribed
// screenshot, a scouting note) + a category (batting/pitching/fielding) and uses the Claude
// API to extract ONLY the RAW countable stats into the exact Baseball-Reference register
// schema used by bbref-stats.js. It returns structured rows the admin UI pre-fills into the
// existing register editor for Sam to REVIEW and SAVE (this function never writes to the DB).
// Calculated fields (BA/OBP/SLG/OPS/ERA/WHIP/Fld%/…) are intentionally NOT extracted — the
// editor + DB triggers compute those from the raw values.
//
// Security mirrors admin-reset-user-password: verify_jwt=true AND server-side is_admin_email
// check, so only an authenticated ESM admin can spend Claude API credits here.
// Requires the Supabase secret ANTHROPIC_API_KEY (flagged to Matt if not yet set).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// RAW (non-calculated) columns per kind — MUST stay in sync with COLUMNS in bbref-stats.js
// (only type 'num'/'txt', never 'calc'). These are the only keys the model may emit.
const RAW_KEYS: Record<string, string[]> = {
  batting: ["year","age","age_dif","tm","lg","lev","aff","g","pa","ab","r","h","doubles","triples","hr","rbi","sb","cs","bb","so","hbp","sh","sf","ibb","gdp"],
  pitching: ["year","age","age_dif","tm","lg","lev","aff","w","l","g","gs","gf","cg","sho","sv","ip","h","r","er","hr","bb","ibb","so","hbp","bk","wp","bf"],
  fielding: ["year","age","tm","lg","lev","aff","position","g","gs","cg","inn","ch","po","a","e","dp","pb","wp","sb","cs","lg_cs_pct"],
};
// String-typed keys (everything else in a kind is an integer count).
const STRING_KEYS = new Set(["year","age_dif","tm","lg","lev","aff","ip","inn","position","lg_cs_pct"]);

const KEY_NOTES = `Key notes (Baseball-Reference abbreviations -> schema key):
  year=season (e.g. "2023"), tm=team, lg=league, lev=level (e.g. NAIA, NJCAA, A, A+, AA, AAA, Rk, Ind, Winter League), aff=MLB affiliate/org.
  Batting: g=G, pa=PA, ab=AB, r=R, h=H, doubles=2B, triples=3B, hr=HR, rbi=RBI, sb=SB, cs=CS, bb=BB, so=SO/K, hbp=HBP, sh=SH, sf=SF, ibb=IBB, gdp=GDP.
  Pitching: w=W, l=L, g=G, gs=GS, gf=GF, cg=CG, sho=SHO, sv=SV, ip=IP (baseball notation like 45.2 = 45 and 2/3), h=H, r=R, er=ER, hr=HR, bb=BB, ibb=IBB, so=SO/K, hbp=HBP, bk=BK, wp=WP, bf=BF/TBF.
  Fielding: position=Pos, g=G, gs=GS, cg=CG, inn=Inn (baseball notation), ch=Ch, po=PO, a=A, e=E, dp=DP, pb=PB, wp=WP, sb=SB, cs=CS, lg_cs_pct=lgCS%.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) Authenticate the caller from their bearer token.
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "Missing authorization." }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  const email = userData?.user?.email;
  if (userErr || !email) return json({ error: "Not signed in." }, 401);

  // 2) Authorize: ESM admins only (this spends Claude API credits).
  const { data: isAdmin, error: adminErr } = await admin.rpc("is_admin_email", { p_email: email });
  if (adminErr) return json({ error: "Authorization check failed." }, 500);
  if (isAdmin !== true) return json({ error: "Not authorized — admins only." }, 403);

  // 3) Validate input.
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* handled below */ }
  const text = String(body.text ?? "").trim();
  const category = String(body.category ?? "").trim().toLowerCase();
  if (!RAW_KEYS[category]) return json({ error: "category must be batting, pitching, or fielding." }, 400);
  if (!text) return json({ error: "Paste some stat text first." }, 400);
  if (text.length > 8000) return json({ error: "That's a lot of text — please paste one player's stats at a time (max 8000 chars)." }, 400);

  // 4) Ensure the API key exists (flagged to Matt as a required new secret if missing).
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json({ error: "ANTHROPIC_API_KEY is not set on this project. Matt needs to add it as a Supabase Edge Function secret (like GMAIL_APP_PASSWORD) before paste-and-parse works." }, 503);
  }

  const keys = RAW_KEYS[category];
  const system =
    `You extract ${category} baseball statistics from messy, pasted text into a strict JSON schema. ` +
    `Return ONLY a JSON object of the form {"rows":[ { ... }, ... ]} and nothing else — no prose, no markdown fences. ` +
    `Each row is one team-season line. Use ONLY these keys: ${keys.join(", ")}. ` +
    `Integer count keys must be numbers; these keys are strings: ${[...STRING_KEYS].filter(k=>keys.includes(k)).join(", ")}. ` +
    `OMIT any key you cannot confidently determine (do NOT guess or fill zeros for unknowns). ` +
    `NEVER output calculated stats (BA, OBP, SLG, OPS, TB, ERA, RA9, WHIP, H9, HR9, BB9, SO9, W-L%, Fld%, RF/9, RF/G, CS%) — they are computed downstream. ` +
    `If the text clearly contains multiple seasons/teams, return multiple rows. If nothing is parseable, return {"rows":[]}.\n\n` + KEY_NOTES;

  let apiRes: Response;
  try {
    apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: text }],
      }),
    });
  } catch (e) {
    return json({ error: "Couldn't reach the Claude API: " + (e as Error).message }, 502);
  }
  if (!apiRes.ok) {
    const detail = await apiRes.text().catch(() => "");
    return json({ error: `Claude API error (${apiRes.status}). ${detail.slice(0, 300)}` }, 502);
  }

  const payload = await apiRes.json().catch(() => null);
  const raw = payload?.content?.[0]?.text ?? "";
  // Be tolerant: strip accidental code fences and grab the outermost JSON object.
  let parsed: any = null;
  try {
    const cleaned = String(raw).replace(/```json\s*|\s*```/g, "").trim();
    const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
    parsed = JSON.parse(start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned);
  } catch {
    return json({ error: "The AI response wasn't valid JSON. Try again, or enter the stats manually." }, 502);
  }

  // 5) Sanitize: keep only allowed keys, coerce number vs string, drop empties. This is the
  //    trust boundary — the model output is untrusted, so we never pass unknown keys through.
  const rowsIn = Array.isArray(parsed?.rows) ? parsed.rows : [];
  const rows = rowsIn.map((row: any) => {
    const out: Record<string, string | number> = {};
    if (row && typeof row === "object") {
      for (const k of keys) {
        let v = row[k];
        if (v === null || v === undefined || v === "") continue;
        if (STRING_KEYS.has(k)) { out[k] = String(v).trim(); }
        else { const n = Number(v); if (Number.isFinite(n)) out[k] = n; }
      }
    }
    return out;
  }).filter((r: Record<string, unknown>) => Object.keys(r).length > 0);

  return json({ ok: true, rows });
});
