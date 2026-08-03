// Node port of gen_player_pages.py — kept BYTE-FOR-BYTE in sync with the Python
// generator's output. Exists because the build environment had no Python installed;
// run either one (`node gen_player_pages.mjs` or `python gen_player_pages.py`) and they
// must produce identical players/*.html. Regenerates the individual player profile pages
// from players.json, reusing index.html's shared CSS. Chrome (nav/headings/labels/buttons)
// is trilingual EN/ES/IT via the site's standard DICT/t()/applyStatic/#lang pattern;
// Sam's entered content (bios, team names, stats) stays as-entered.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(SITE_DIR, "players");
fs.mkdirSync(OUT_DIR, { recursive: true });

const idx = fs.readFileSync(path.join(SITE_DIR, "index.html"), "utf-8");
const SHARED_CSS = idx.match(/<style>([\s\S]*?)<\/style>/)[1];
const players = JSON.parse(fs.readFileSync(path.join(SITE_DIR, "players.json"), "utf-8"));

const CONTACT_EMAIL = "elitesportsmanagement50@gmail.com";

// Mirrors Python html.escape(s, quote=True): & < > " ' → entities (apostrophe → &#x27;).
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const EXTRA_CSS = `
  .pp-wrap{max-width:760px;margin:0 auto;padding:40px 22px 90px}
  .pp-back{display:inline-flex;align-items:center;gap:8px;color:var(--gold-soft);font-weight:700;font-size:13.5px;margin-bottom:26px}
  .pp-back:hover{color:var(--gold)}

  .pp-hero{border:1px solid var(--line);border-radius:20px;padding:34px 30px;background:radial-gradient(circle at 12% 0%,rgba(217,177,84,.10),transparent 55%),linear-gradient(180deg,var(--card),var(--navy-2));margin-bottom:26px}
  .pp-tier-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
  .pp-tier{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:6px 12px;border-radius:999px;background:rgba(6,20,42,.7);border:1px solid var(--line);color:var(--gold-soft)}
  .pp-flagchip{font-size:13px;font-weight:700;color:var(--muted);display:inline-flex;align-items:center;gap:6px}
  .pp-flagchip .pp-flag{font-size:18px}
  .pp-sport{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--teal-soft);border:1px solid var(--line);border-radius:999px;padding:5px 11px;background:rgba(6,20,42,.5)}
  .pp-headline{font-size:clamp(24px,4.4vw,34px);line-height:1.25;margin:0 0 12px}
  .pp-name-line{display:block;font-size:.62em;color:var(--gold-soft);font-weight:700;margin-bottom:6px;letter-spacing:.02em}
  .pp-meta-list{display:flex;flex-direction:column;gap:6px;margin-top:16px;color:var(--muted);font-size:14px}
  .pp-meta-list b{color:#d6e1f2;font-weight:600}

  .pp-section{margin-top:34px;padding-top:2px}
  .pp-section h2{font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--teal-soft);margin-bottom:16px}
  .pp-bio{font-size:16.5px;color:#d6e1f2;line-height:1.7}

  .pp-stats{display:flex;flex-direction:column;gap:10px}
  .pp-stat{display:flex;justify-content:space-between;align-items:center;border:1px solid var(--line);border-radius:12px;padding:14px 18px;background:rgba(8,26,51,.4)}
  .pp-stat span{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
  .pp-stat b{font-family:'Anton';font-size:20px;color:var(--gold);font-weight:400;letter-spacing:.02em}

  .pp-exp-list{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:14px;overflow:hidden}
  .pp-exp-row{padding:14px 18px;font-size:15px;color:#d6e1f2;background:rgba(8,26,51,.28)}
  .pp-exp-row:nth-child(even){background:rgba(8,26,51,.5)}
  .pp-exp-row b{color:var(--ink);font-weight:700}

  .pp-contact{margin-top:38px;padding:26px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,var(--card),rgba(8,26,51,.4));text-align:center}
  .pp-contact h2{font-size:19px;margin-bottom:8px;color:var(--ink);font-family:'Anton';text-transform:none;letter-spacing:0}
  .pp-contact p{color:var(--muted);font-size:14.5px;margin-bottom:18px;max-width:48ch;margin-left:auto;margin-right:auto}

  .pp-social{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px}
`;

// Language switcher (reuses the shared .lang CSS from index.html) + the trilingual chrome
// DICT. IMPORTANT: keep this string identical to LANG_SWITCH + I18N_SCRIPT in
// gen_player_pages.py so both generators emit the same bytes.
const LANG_SWITCH = '<div class="lang" id="lang"><button type="button" data-l="en" aria-label="English">EN</button><button type="button" data-l="es" aria-label="Español">ES</button><button type="button" data-l="it" aria-label="Italiano">IT</button></div>';

const I18N_SCRIPT = `<script>
/* Player-page chrome i18n (EN/ES/IT). Shares the site-wide esm_lang localStorage key.
   Only chrome is translated; the athlete's entered content stays as-is. */
(function(){
  var DICT={
    en:{pp_nav_about:"What We Do",pp_nav_who:"Who I Am",pp_nav_roster:"Roster",pp_nav_events:"Events",pp_nav_join:"Join Us",pp_nav_cta:"Apply Now",pp_back:"← Back to Roster",pp_bio:"Bio",pp_highlights:"Career Highlights",pp_experience:"Playing Experience",pp_stats_soon:"Stats coming soon.",pp_exp_soon:"Details coming soon.",pp_birthplace:"Birthplace",pp_born:"Born",pp_bats:"Bats",pp_interested:"Interested in {name}?",pp_contact_p:"You have full roster access. Get in touch and we'll connect you with this athlete directly.",pp_contact_btn:"Contact ESM about this player",pp_rights:"All rights reserved.",pp_admin:"Admin"},
    es:{pp_nav_about:"Qué Hacemos",pp_nav_who:"Quién Soy",pp_nav_roster:"Jugadores",pp_nav_events:"Eventos",pp_nav_join:"Únete",pp_nav_cta:"Aplica Ahora",pp_back:"← Volver a Jugadores",pp_bio:"Bio",pp_highlights:"Momentos Destacados",pp_experience:"Experiencia Deportiva",pp_stats_soon:"Estadísticas próximamente.",pp_exp_soon:"Detalles próximamente.",pp_birthplace:"Lugar de nacimiento",pp_born:"Nacimiento",pp_bats:"Batea",pp_interested:"¿Te interesa {name}?",pp_contact_p:"Tienes acceso completo al roster. Ponte en contacto y te conectamos directamente con este atleta.",pp_contact_btn:"Contacta con ESM sobre este jugador",pp_rights:"Todos los derechos reservados.",pp_admin:"Admin"},
    it:{pp_nav_about:"Cosa Facciamo",pp_nav_who:"Chi Sono",pp_nav_roster:"Roster",pp_nav_events:"Eventi",pp_nav_join:"Unisciti",pp_nav_cta:"Candidati",pp_back:"← Torna al Roster",pp_bio:"Bio",pp_highlights:"Momenti Salienti",pp_experience:"Esperienza Sportiva",pp_stats_soon:"Statistiche in arrivo.",pp_exp_soon:"Dettagli in arrivo.",pp_birthplace:"Luogo di nascita",pp_born:"Nascita",pp_bats:"Batte",pp_interested:"Ti interessa {name}?",pp_contact_p:"Hai accesso completo al roster. Mettiti in contatto e ti collegheremo direttamente con questo atleta.",pp_contact_btn:"Contatta ESM per questo giocatore",pp_rights:"Tutti i diritti riservati.",pp_admin:"Admin"}
  };
  var SUP=["en","es","it"];
  var lang=(function(){try{var l=localStorage.getItem("esm_lang");return SUP.indexOf(l)>=0?l:"en";}catch(e){return "en";}})();
  function t(k){return (DICT[lang]&&DICT[lang][k])||DICT.en[k]||k;}
  function applyStatic(){
    document.documentElement.lang=lang;
    document.querySelectorAll("[data-i18n]").forEach(function(el){el.textContent=t(el.getAttribute("data-i18n"));});
    document.querySelectorAll("[data-i18n-tpl]").forEach(function(el){el.textContent=t(el.getAttribute("data-i18n-tpl")).replace("{name}",el.getAttribute("data-name")||"");});
    document.querySelectorAll("#lang button").forEach(function(b){b.classList.toggle("on",b.getAttribute("data-l")===lang);});
  }
  function setLang(l){if(SUP.indexOf(l)<0||l===lang){return;}lang=l;try{localStorage.setItem("esm_lang",l);}catch(e){}applyStatic();}
  document.querySelectorAll("#lang button").forEach(function(b){b.onclick=function(){setLang(b.getAttribute("data-l"));};});
  applyStatic();
})();
</script>`;

function headline_for(p){
  const position = p.position || "";
  const tier = p.tier || "";
  const teams = p.teams || [];
  const lead_team = teams.length ? teams[0] : "";
  const tier_phrase = ({Pro:"Professional", International:"International", College:"College"})[tier] ?? tier;
  const parts = [tier_phrase, position].filter(Boolean);
  let headline = parts.length ? parts.join(" ") : "Athlete";
  if (lead_team) headline += " — " + lead_team;
  return headline;
}

function render_page(p){
  const name = esc(p.name);
  const flag = p.flag || "";
  const tier = esc(p.tier || "");
  const country = esc(p.country || "");
  const bio = esc(p.bio || "");
  const sport = esc(p.sport || "Baseball");
  const sport_badge = '<span class="pp-sport">' + sport + '</span>';

  const meta_defs = [["birthplace","pp_birthplace"],["born","pp_born"],["bats","pp_bats"]];
  const meta_html = meta_defs
    .filter(([k]) => p[k])
    .map(([k,key]) => '<div><b><span data-i18n="' + key + '">' + ({pp_birthplace:"Birthplace",pp_born:"Born",pp_bats:"Bats"})[key] + '</span>:</b> ' + esc(p[k]) + '</div>')
    .join("");

  const headline = esc(headline_for(p));

  const stats = p.stats || [];
  let stats_html;
  if (stats.length){
    const rows = stats.map(s => '<div class="pp-stat"><span>' + esc(s.label) + '</span><b>' + esc(s.value) + '</b></div>').join("");
    stats_html = '<div class="pp-section"><h2 data-i18n="pp_highlights">Career Highlights</h2><div class="pp-stats">' + rows + '</div></div>';
  } else {
    stats_html = '<div class="pp-section"><h2 data-i18n="pp_highlights">Career Highlights</h2><p style="color:var(--muted);font-size:14px" data-i18n="pp_stats_soon">Stats coming soon.</p></div>';
  }

  const teams = p.teams || [];
  let teams_html;
  if (teams.length){
    const rows = teams.map(x => '<div class="pp-exp-row"><b>' + esc(x) + '</b></div>').join("");
    teams_html = '<div class="pp-section"><h2 data-i18n="pp_experience">Playing Experience</h2><div class="pp-exp-list">' + rows + '</div></div>';
  } else {
    teams_html = '<div class="pp-section"><h2 data-i18n="pp_experience">Playing Experience</h2><p style="color:var(--muted);font-size:14px" data-i18n="pp_exp_soon">Details coming soon.</p></div>';
  }

  const desc = (p.bio || (p.name + " — " + (p.position || "") + " represented by Elite Sports Management.")).slice(0,155);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>${name} — Elite Sports Management</title>
<meta name="description" content="${esc(desc)}" />
<meta name="robots" content="noindex,nofollow" />
<script>
/* Roster paywall. Player profiles are part of the paid roster, so bounce anyone
   who hasn't unlocked it back to the gate. Runs in <head>, before first paint.
   Keep the localStorage key in sync with UNLOCK_KEY in index.html. */
(function(){try{
  if(localStorage.getItem("esm_roster_unlock_v1")!=="1"){location.replace("../index.html#roster");}
}catch(e){}})();
</script>
<link rel="manifest" href="../manifest.json" />
<link rel="icon" type="image/png" sizes="192x192" href="../icons/icon-192.png" />
<link rel="icon" type="image/png" sizes="512x512" href="../icons/icon-512.png" />
<link rel="shortcut icon" href="../icons/icon-192.png" />
<meta name="theme-color" content="#081a33" />
<link rel="apple-touch-icon" href="../icons/apple-touch-icon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
${SHARED_CSS}
${EXTRA_CSS}
</style>
</head>
<body>
<div class="bg-fx"></div>

<header class="nav"><div class="wrap nav-in">
  <a class="brand" href="../index.html#top"><img class="logo-img" src="../logo.png" alt="Elite Sports Management" /></a>
  <div class="nav-right">
    <nav class="nav-links">
      <a href="../index.html#about" data-i18n="pp_nav_about">What We Do</a>
      <a href="../index.html#who" data-i18n="pp_nav_who">Who I Am</a>
      <a href="../index.html#roster" data-i18n="pp_nav_roster">Roster</a>
      <a href="../index.html#events" data-i18n="pp_nav_events">Events</a>
      <a href="../index.html#join" data-i18n="pp_nav_join">Join Us</a>
    </nav>
    ${LANG_SWITCH}
    <a class="nav-cta" href="../index.html#join" data-i18n="pp_nav_cta">Apply Now</a>
  </div>
</div></header>

<main class="pp-wrap">
  <a class="pp-back" href="../index.html#roster" data-i18n="pp_back">&larr; Back to Roster</a>

  <div class="pp-hero">
    <div class="pp-tier-row">
      <span class="pp-tier">${tier}</span>
      <span class="pp-flagchip"><span class="pp-flag">${flag}</span>${country}</span>
      ${sport_badge}
    </div>
    <h1 class="display pp-headline"><span class="pp-name-line">${name}</span>${headline}</h1>
    <div class="pp-meta-list">${meta_html}</div>
  </div>

  <div class="pp-section">
    <h2 data-i18n="pp_bio">Bio</h2>
    <p class="pp-bio">${bio}</p>
  </div>

  ${stats_html}

  ${teams_html}

  <div class="pp-contact">
    <h2 data-i18n-tpl="pp_interested" data-name="${name}">Interested in ${name}?</h2>
    <p data-i18n="pp_contact_p">You have full roster access. Get in touch and we'll connect you with this athlete directly.</p>
    <a class="btn btn-gold" href="mailto:${CONTACT_EMAIL}?subject=Enquiry:%20${encodeURIComponent(p.name)}%20%E2%80%94%20ESM%20Roster" data-i18n="pp_contact_btn">Contact ESM about this player</a>
  </div>
</main>

<footer><div class="wrap foot">
  <div>
    <a class="brand" href="../index.html#top"><img class="logo-img foot-logo" src="../logo.png" alt="Elite Sports Management" /></a>
    <p class="muted">&copy; <span id="yr"></span> Elite Sports Management. <span data-i18n="pp_rights">All rights reserved.</span></p>
    <a class="foot-admin" href="../admin/" data-i18n="pp_admin">Admin</a>
  </div>
  <div class="foot-links">
    <a class="pill" href="https://instagram.com/elite_sports_management__" target="_blank" rel="noopener">&#9678; @elite_sports_management__</a>
    <a class="pill" href="mailto:elitesportsmanagement50@gmail.com">&#9993; elitesportsmanagement50@gmail.com</a>
  </div>
</div></footer>

<script>document.getElementById("yr").textContent=new Date().getFullYear();</script>
${I18N_SCRIPT}
</body>
</html>
`;
}

const slugs = [];
for (const p of players){
  fs.writeFileSync(path.join(OUT_DIR, p.slug + ".html"), render_page(p), "utf-8");
  slugs.push(p.slug);
}
console.log(`Generated ${slugs.length} player pages`);
console.log(JSON.stringify(slugs));
