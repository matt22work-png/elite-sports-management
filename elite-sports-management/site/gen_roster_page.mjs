/* ============================================================================
   gen_roster_page.mjs — builds site/roster/index.html FROM site/index.html.
   ============================================================================
   The roster moved off the homepage onto its own page (2026-09). Rather than
   fork the roster renderer, the unlock gate and the i18n dictionary into a
   second file, this script EXTRACTS those blocks straight out of index.html,
   so there is exactly one source of truth and the two pages cannot drift.

   RE-RUN THIS after editing any of the following in index.html: the <style>
   block, the T translation dictionary, the PLAYERS fallback list, the roster
   card renderer, the player modal, or the unlock-gate logic.

       node gen_roster_page.mjs

   Every block boundary is resolved by SEARCHING for anchor text, never by fixed
   line numbers, so ordinary edits to index.html shift lines harmlessly. If an
   anchor ever disappears the script throws instead of writing a broken page.
   ============================================================================ */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Resolves to this file's own directory, so the script runs from anywhere.
const SITE = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(SITE + '/index.html', 'utf8');
const L = src.split(/\r?\n/);
const slice = (a, b) => L.slice(a - 1, b).join('\n');   // 1-indexed inclusive

// ---- resolve every boundary by searching for its anchor text, so edits to index.html
//      (new i18n keys, added players, …) shift line numbers without corrupting the build ----
function find(needle, from = 1) {
  for (let i = from - 1; i < L.length; i++) if (L[i].includes(needle)) return i + 1;
  throw new Error(`anchor not found: ${needle}`);
}
function findExact(text, from = 1) {
  for (let i = from - 1; i < L.length; i++) if (L[i].trimEnd() === text) return i + 1;
  throw new Error(`exact anchor not found: ${text}`);
}
const A = {};
A.cssStart   = find('<style>') + 1;
A.cssEnd     = find('</style>') - 1;
A.cfgStart   = find('/* ===== CONFIG: Supabase');
A.cfgEnd     = find('/* ===== Media (Tenerife') - 1;
A.photos     = find('const LOCAL_PHOTOS');
A.staticpg   = find('const STATIC_PLAYER_PAGES');
A.dictStart  = find('const T = {');
A.dictEnd    = findExact('};', A.dictStart);
A.geoStart   = find('const DIAL_CODES=[');
A.playStart  = find('let PLAYERS = [');
A.geoEnd     = A.playStart - 1;
A.playEnd    = findExact('];', A.playStart);
A.coreStart  = find('let lang=', A.playEnd);
A.coreEnd    = find('function fmtDate', A.coreStart) - 1;
// openModal depends on loc() and seasonStatsHTML(). Take the modal stack starting at
// openLightbox, and pull `loc` in separately — the lines BETWEEN them are the
// testimonials block, which wires #testiAll unguarded and would throw here.
A.locLine    = find('const loc=');
A.modalStart = find('function openLightbox');
A.gateStart  = find('function getUnlock');
A.modalEnd   = A.gateStart - 1;
A.gateEnd    = find('/* Service cards', A.gateStart) - 1;
A.closem     = find('function closeModal');
for (const [k, v] of Object.entries(A)) if (!Number.isFinite(v) || v < 1) throw new Error(`bad boundary ${k}=${v}`);
console.log('boundaries resolved: ' + Object.entries(A).map(([k, v]) => `${k}=${v}`).join(' ') + '\n');

const CSS      = slice(A.cssStart, A.cssEnd);
const CONFIG   = slice(A.cfgStart, A.cfgEnd);
const PHOTOS   = slice(A.photos, A.photos);
const STATICPG = slice(A.staticpg, A.staticpg);
const DICT     = slice(A.dictStart, A.dictEnd);
const GEO      = slice(A.geoStart, A.geoEnd);
const PLAYERS  = slice(A.playStart, A.playEnd);
const CORE     = slice(A.coreStart, A.coreEnd);   // lang/t/helpers/applyI18n/setLang/filters/renderRoster
const LOCFN    = slice(A.locLine, A.locLine);      // localised-field reader used by openModal
const MODALJS  = slice(A.modalStart, A.modalEnd); // openLightbox + seasonStatsHTML + bbref + openModal
// Full unlock/revalidate/gate-form logic, verbatim EXCEPT for one thing: on the homepage
// a valid code redirects here (location.href="roster/"). Carrying that line onto this page
// would make /roster/ redirect to itself in a loop, so it is stripped — unlockRoster()
// already calls applyLockState() + renderRoster(), which is exactly the in-place behaviour
// this page wants. Everything security-relevant is untouched.
let GATE = slice(A.gateStart, A.gateEnd);
const redirectsFound = (GATE.match(/[ \t]*location\.href="roster\/";\r?\n/g) || []).length;
GATE = GATE.replace(/[ \t]*location\.href="roster\/";\r?\n/g, '');
if (GATE.includes('location.href="roster/"')) throw new Error('self-redirect still present in roster gate');
if (redirectsFound !== 3) throw new Error(`expected 3 self-redirects to strip, found ${redirectsFound}`);
console.log(`stripped ${redirectsFound} self-redirect(s) from the roster-page gate`);
const CLOSEM   = slice(A.closem, A.closem);

// ---- path fixes: /roster/ sits one level below the site root ----
const up = s => s
  .replace(/href="players\//g, 'href="../players/')
  .replace(/`players\/\$\{/g, '`../players/${')
  .replace(/"media\/photos\//g, '"../media/photos/')
  .replace(/url\('media\//g, "url('../media/")
  .replace(/src="assets\//g, 'src="../assets/')
  .replace(/url\(assets\//g, 'url(../assets/');

// setLang on the homepage also re-renders events + testimonials, which don't exist here.
const CORE2 = up(CORE).replace(
  /renderSportFilters\(\);renderFilters\(\);renderRoster\(\);renderEvents\(\);renderTesti\(\);/g,
  'renderSportFilters();renderFilters();renderRoster();');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>Roster — ESM Sports Network</title>
<meta name="robots" content="noindex,nofollow" />
<link rel="icon" type="image/png" sizes="192x192" href="../icons/icon-192.png" />
<link rel="icon" type="image/png" sizes="512x512" href="../icons/icon-512.png" />
<link rel="shortcut icon" href="../icons/icon-192.png" />
<link rel="apple-touch-icon" href="../icons/apple-touch-icon.png" />
<link rel="manifest" href="../manifest.json" />
<meta name="theme-color" content="#0f2036" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
${up(CSS)}
  /* ---------- /roster/ page-specific ---------- */
  /* .wrap supplies the 22px side padding; repeating it here is deliberate — this rule
     comes later in the cascade and a bare padding:34px 0 60px would wipe it out, leaving
     the page flush against the screen edge on anything narrower than 1124px. */
  .rp-main{padding:34px 22px 60px}
  /* On the homepage the roster lives in a horizontal scroll-snap rail. This is a
     dedicated page, so it becomes a proper wrapping grid with room to breathe. */
  #rosterList.roster{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));
    overflow:visible;scroll-snap-type:none;gap:18px}
  @media(max-width:560px){#rosterList.roster{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}}
  .roster-wrap.is-locked{min-height:520px}
  .rp-count{color:var(--tx-m);font-size:12.5px;text-align:center;margin:-4px 0 16px}
</style>
</head>
<body>

<div class="bg-fx"></div>

<header class="nav"><div class="wrap nav-in">
  <a class="brand" href="../index.html"><img class="logo-img" src="../logo.png" alt="ESM Sports Network" width="55" height="40" fetchpriority="high" /></a>
  <div class="nav-right">
    <nav class="nav-links">
      <a href="../index.html#about" data-i18n="nav_about"></a>
      <a href="../index.html#who" data-i18n="nav_who"></a>
      <a href="../index.html#college" data-i18n="nav_college"></a>
      <a href="../index.html#events" data-i18n="nav_events"></a>
      <a href="../index.html#join" data-i18n="nav_join"></a>
    </nav>
    <div class="lang" id="lang"><button type="button" data-l="en" class="on" aria-label="English">EN</button><button type="button" data-l="es" aria-label="Español">ES</button><button type="button" data-l="it" aria-label="Italiano">IT</button></div>
    <a class="nav-cta" href="../index.html#join" data-i18n="nav_cta"></a>
  </div>
</div></header>

<main class="wrap rp-main">
  <a class="backlink" href="../index.html">&larr; <span data-i18n="rp_back"></span></a>
  <div class="sec-head sec-head-c">
    <div class="kicker" data-i18n="roster_kicker"></div>
    <h2 class="display" data-i18n="roster_h2"></h2>
    <p data-i18n="roster_p"></p>
  </div>
  <div class="unlocked-note" id="unlockedNote">&#10003; <span data-i18n="gate_unlocked"></span></div>
  <div class="filters" id="sportFilters"></div>
  <div class="filters" id="filters"></div>
  <div class="rp-count" id="rpCount"></div>

  <!-- Same client-side unlock gate as before, just relocated. An unlocked visitor sees
       the grid; a locked or REVOKED one sees the code form right here, so landing on
       /roster/ directly is never a dead end. -->
  <div class="roster-wrap is-locked" id="rosterWrap">
    <div class="roster" id="rosterList"></div>
    <div class="gate">
      <div class="gate-in">
        <div class="gate-lock">&#128274;</div>
        <h3 data-i18n="gate_h"></h3>
        <p data-i18n="gate_p"></p>
        <label class="gate-or gate-label" for="gateInput" data-i18n="gate_code_label"></label>
        <form class="gate-code" id="gateForm">
          <input id="gateInput" type="text" autocomplete="off" spellcheck="false" data-i18n-ph="gate_ph" data-i18n-aria="gate_aria" />
          <button type="submit" data-i18n="gate_unlock"></button>
        </form>
        <label class="tc gate-tc"><input type="checkbox" class="tc-check" id="rosterTc"><span data-i18n="tc_label"></span> <a class="tc-more" href="../terms.html" target="_blank" rel="noopener" data-i18n="tc_more"></a></label>
        <div class="gate-err" id="rosterTcErr" data-i18n="tc_required"></div>
        <a class="gate-need" data-mail data-subject="Roster access code request — ESM" data-i18n="gate_need"></a>
        <div class="gate-err" id="gateErr" data-i18n="gate_err"></div>
      </div>
    </div>
  </div>
</main>

<footer><div class="wrap foot" style="display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap">
  <a class="brand" href="../index.html"><img class="logo-img foot-logo" src="../logo.png" alt="ESM Sports Network" width="88" height="64" loading="lazy" /></a>
  <span style="color:rgba(255,255,255,.6);font-size:12.5px">&copy; <span id="yr"></span> ESM Sports Network</span>
</div></footer>

<div class="modal" id="modal"><div class="scrim" data-close></div><div class="sheet"><button type="button" class="close" data-close aria-label="Close">&#10005;</button><div id="sheetContent"></div></div></div>

<script src="../bbref-stats.js"></script>
<script>
/* =====================================================================
   /roster/ — the unlocked roster, moved off the homepage (2026-09).
   GENERATED FILE — do not hand-edit. Run \`node gen_roster_page.mjs\` instead;
   every block below is extracted verbatim from index.html.

   The homepage #roster section is now a teaser: it takes the access code and
   redirects here on success. Everything security-relevant below — the code
   hashes, the versioned unlock record, master-code caching and revalidation,
   and the three-step submit path (personal hash → cached master → live RPC) —
   is the SAME code that ran on the homepage, moved verbatim, so gate
   versioning and revocation behave exactly as they did before.
   ===================================================================== */
${CONFIG}
${up(PHOTOS)}
${STATICPG}
${DICT}
${GEO}
${PLAYERS}
${CORE2}
${LOCFN}
${up(MODALJS)}
${GATE}
${CLOSEM}
document.querySelectorAll("[data-close]").forEach(e=>e.onclick=closeModal);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
document.getElementById("lang").querySelectorAll("button").forEach(b=>b.onclick=()=>setLang(b.dataset.l));
document.getElementById("yr").textContent=new Date().getFullYear();
document.querySelectorAll("[data-mail]").forEach(a=>{
  const s=a.getAttribute("data-subject")||"";
  a.href=CONTACT_MAILTO+(s?("?subject="+encodeURIComponent(s)):"");
});
/* Count line under the filters — reflects the CURRENT filter, and only when unlocked. */
function updateCount(){
  const el=document.getElementById("rpCount");
  if(!el)return;
  const n=document.querySelectorAll("#rosterList .pcard").length;
  el.textContent=isUnlocked()&&n?String(n)+" "+t(n===1?"rp_one":"rp_many"):"";
}
const _renderRoster=renderRoster;
renderRoster=function(){ _renderRoster.apply(this,arguments); updateCount(); };

/* NB: SB is already declared by the extracted core block (\`let lang=…, SB=null;\`),
   so it must NOT be re-declared here — doing so is a SyntaxError that kills the
   whole script and silently leaves the page unrendered. */
async function boot(){
  if(SUPABASE_URL&&SUPABASE_ANON_KEY){
    try{
      const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2");
      // Anonymous by design, exactly as the homepage does it: never adopt a stored
      // session, or a signed-in player's JWT would narrow the roster to their own row.
      SB=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      // Refresh the cached master code FIRST, then re-validate — this is what makes a
      // code Sam has just changed or retired re-lock this browser on the next load.
      // Only mutate the cache when the server actually ANSWERED (see index.html boot()).
      try{const {data:mc,error:mcErr}=await SB.rpc("get_roster_code");if(!mcErr){cacheMasterCode(mc);revalidateUnlock();}}
      catch(ex){console.warn("roster code cache refresh failed (cache preserved)",ex);}
      const {data,error}=await SB.from("players")
        .select("id,slug,name,group,position,country,flag,heritage,born,birthplace,tier,bats,bio,teams,stats,season_stats,image_url,photo_pos_x,photo_pos_y,photo_zoom,sport,level,sort_order")
        .eq("status","approved").order("sort_order");
      if(error)throw error;
      if(data&&data.length)PLAYERS=data.map(p=>({...p,image:p.image_url||p.image||null}));
    }catch(err){console.warn("Supabase load failed; using embedded roster.",err);}
  }
  PLAYERS=PLAYERS.map(p=>({...p,image:p.image||LOCAL_PHOTOS[p.slug]||null}));
  applyI18n();renderSportFilters();renderFilters();renderRoster();
  applyLockState();updateCount();
}
applyI18n();applyLockState();
boot();
</script>
<script src="/esm-legal.js"></script>
</body>
</html>
`;

fs.mkdirSync(SITE + '/roster', { recursive: true });
fs.writeFileSync(SITE + '/roster/index.html', html);
console.log(`wrote roster/index.html — ${(html.length/1024).toFixed(0)} KB`);
