# NOTE: A byte-identical Node port lives at gen_player_pages.mjs. The build environment
# that last regenerated players/*.html had no Python installed, so `node gen_player_pages.mjs`
# was used. Keep this file and the .mjs in sync: both must emit identical players/*.html.
# Player-page CHROME (nav/headings/labels/buttons) is trilingual EN/ES/IT via the site's
# standard DICT/t()/applyStatic/#lang pattern; the athlete's entered content is left as-is.
import json, re, os, html
from urllib.parse import quote

SITE_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(SITE_DIR, "players")
os.makedirs(OUT_DIR, exist_ok=True)

with open(os.path.join(SITE_DIR, "index.html"), encoding="utf-8") as f:
    idx = f.read()

style_match = re.search(r"<style>(.*?)</style>", idx, re.S)
SHARED_CSS = style_match.group(1)

with open(os.path.join(SITE_DIR, "players.json"), encoding="utf-8") as f:
    players = json.load(f)

CONTACT_EMAIL = "elitesportsmanagement50@gmail.com"

def esc(s):
    return html.escape(s or "", quote=True)

EXTRA_CSS = """
  /* z-index:1 keeps the profile body ABOVE the fixed .bg-fx background layer
     (which is position:fixed;z-index:0). Without it the opaque background paints
     over the whole <main> and the profile renders blank — only the nav (z-50) and
     footer (z-1) escape. Mirrors the homepage's section/footer z-index:1. */
  .pp-wrap{position:relative;z-index:1;max-width:760px;margin:0 auto;padding:40px 22px 90px}
  .pp-back{display:inline-flex;align-items:center;gap:8px;color:var(--gold-soft);font-weight:700;font-size:13.5px;margin-bottom:26px}
  .pp-back:hover{color:var(--gold)}

  .pp-hero{border:1px solid var(--line);border-radius:20px;padding:34px 30px;background:radial-gradient(circle at 12% 0%,rgba(217,177,84,.10),transparent 55%),linear-gradient(180deg,var(--card),var(--navy-2));margin-bottom:26px}
  .pp-tier-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
  .pp-tier{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:6px 12px;border-radius:999px;background:rgba(6,20,42,.7);border:1px solid var(--line);color:var(--gold-soft)}
  .pp-flagchip{font-size:13px;font-weight:700;color:var(--muted);display:inline-flex;align-items:center;gap:6px}
  .pp-flagchip .pp-flag{height:16px;width:auto;border-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,.4)}
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
"""

# Language switcher (reuses the shared .lang CSS from index.html) + trilingual chrome DICT.
# Keep IDENTICAL to LANG_SWITCH + I18N_SCRIPT in gen_player_pages.mjs (byte-for-byte output).
LANG_SWITCH = '<div class="lang" id="lang"><button type="button" data-l="en" aria-label="English">EN</button><button type="button" data-l="es" aria-label="Español">ES</button><button type="button" data-l="it" aria-label="Italiano">IT</button></div>'

# Raw string so the \u escapes stay literal in the emitted JS (matching the Node output).
I18N_SCRIPT = r'''<script>
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
</script>'''

def headline_for(p):
    position = p.get("position") or ""
    country = p.get("country") or ""
    tier = p.get("tier") or ""
    teams = p.get("teams") or []
    lead_team = teams[0] if teams else ""
    tier_phrase = {"Pro": "Professional", "International": "International", "College": "College"}.get(tier, tier)
    parts = [x for x in [tier_phrase, position] if x]
    headline = " ".join(parts) if parts else "Athlete"
    if lead_team:
        headline += " — " + lead_team
    return headline

# Country flags as IMAGES (flagcdn) — emoji flags don't render on Windows (no emoji-flag
# font). Resolve the player's country/flag to an ISO code and emit an <img>.
# Keep IDENTICAL to _NAME_ISO/_emojiToIso/flagImgChip in gen_player_pages.mjs.
_NAME_ISO = {"italy":"it","italia":"it","united states":"us","usa":"us","estados unidos":"us","stati uniti":"us","dominican republic":"do","república dominicana":"do","repubblica dominicana":"do","venezuela":"ve","spain":"es","españa":"es","spagna":"es","colombia":"co","germany":"de","alemania":"de","germania":"de","portugal":"pt","canada":"ca","mexico":"mx","méxico":"mx","cuba":"cu","puerto rico":"pr","panama":"pa","nicaragua":"ni","costa rica":"cr","france":"fr","united kingdom":"gb","netherlands":"nl","brazil":"br","argentina":"ar","curaçao":"cw","curacao":"cw","aruba":"aw"}

def _emoji_to_iso(s):
    o = []
    for ch in str(s or ""):
        cp = ord(ch)
        if 0x1F1E6 <= cp <= 0x1F1FF:
            o.append(chr(cp - 0x1F1E6 + 97))
            if len(o) == 2:
                break
    return "".join(o) if len(o) == 2 else ""

def flag_img_chip(p):
    iso = _emoji_to_iso(p.get("flag")) or _emoji_to_iso(p.get("country")) or _NAME_ISO.get((p.get("country") or "").strip().lower(), "")
    return f'<img class="pp-flag" src="https://flagcdn.com/{iso}.svg" alt="" width="24" height="18" loading="lazy" decoding="async">' if iso else ""

def render_page(p):
    slug = p["slug"]
    name = esc(p["name"])
    flag_chip = flag_img_chip(p)
    position = esc(p.get("position") or "")
    tier = esc(p.get("tier") or "")
    country = esc(p.get("country") or "")
    heritage = esc(p.get("heritage") or "")
    bio = esc(p.get("bio") or "")

    sport = esc(p.get("sport") or "Baseball")
    sport_badge = '<span class="pp-sport">' + sport + '</span>'

    meta_rows = []
    if p.get("birthplace"): meta_rows.append(("Birthplace", "pp_birthplace", esc(p["birthplace"])))
    if p.get("born"): meta_rows.append(("Born", "pp_born", esc(p["born"])))
    if p.get("bats"): meta_rows.append(("Bats", "pp_bats", esc(p["bats"])))
    meta_html = "".join('<div><b><span data-i18n="' + key + '">' + label + '</span>:</b> ' + val + '</div>' for label, key, val in meta_rows)

    headline = esc(headline_for(p))

    stats = p.get("stats") or []
    stats_html = ""
    if stats:
        rows = "".join('<div class="pp-stat"><span>' + esc(s["label"]) + '</span><b>' + esc(s["value"]) + '</b></div>' for s in stats)
        stats_html = '<div class="pp-section"><h2 data-i18n="pp_highlights">Career Highlights</h2><div class="pp-stats">' + rows + '</div></div>'
    else:
        stats_html = '<div class="pp-section"><h2 data-i18n="pp_highlights">Career Highlights</h2><p style="color:var(--muted);font-size:14px" data-i18n="pp_stats_soon">Stats coming soon.</p></div>'

    teams = p.get("teams") or []
    teams_html = ""
    if teams:
        rows = "".join('<div class="pp-exp-row"><b>' + esc(x) + '</b></div>' for x in teams)
        teams_html = '<div class="pp-section"><h2 data-i18n="pp_experience">Playing Experience</h2><div class="pp-exp-list">' + rows + '</div></div>'
    else:
        teams_html = '<div class="pp-section"><h2 data-i18n="pp_experience">Playing Experience</h2><p style="color:var(--muted);font-size:14px" data-i18n="pp_exp_soon">Details coming soon.</p></div>'

    desc = (p.get("bio") or (p["name"] + " — " + (p.get("position") or "") + " represented by ESM Sports Network."))[:155]

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>{name} — ESM Sports Network</title>
<meta name="description" content="{esc(desc)}" />
<meta name="robots" content="noindex,nofollow" />
<script>
/* Roster paywall. Player profiles are part of the paid roster, so bounce anyone
   who hasn't unlocked it back to the gate. Runs in <head>, before first paint.
   Keep this gate in sync with UNLOCK_KEY / revalidateUnlock() in index.html (v2). */
(function(){{try{{
  var u=null;try{{u=JSON.parse(localStorage.getItem("esm_roster_unlock_v2")||"null");}}catch(_){{}}var cur="";try{{cur=localStorage.getItem("esm_roster_code_v1")||"";}}catch(_){{}}if(!(u&&(u.m==="user"?!!u.h:(u.m==="master"&&!!u.c&&u.c===cur)))){{location.replace("../index.html#roster");}}
}}catch(e){{}}}})();
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
{SHARED_CSS}
{EXTRA_CSS}
</style>
</head>
<body>
<div class="bg-fx"></div>

<header class="nav"><div class="wrap nav-in">
  <a class="brand" href="../index.html#top"><img class="logo-img" src="../logo.png" alt="ESM Sports Network" /></a>
  <div class="nav-right">
    <nav class="nav-links">
      <a href="../index.html#about" data-i18n="pp_nav_about">What We Do</a>
      <a href="../index.html#who" data-i18n="pp_nav_who">Who I Am</a>
      <a href="../index.html#roster" data-i18n="pp_nav_roster">Roster</a>
      <a href="../index.html#events" data-i18n="pp_nav_events">Events</a>
      <a href="../index.html#join" data-i18n="pp_nav_join">Join Us</a>
    </nav>
    {LANG_SWITCH}
    <a class="nav-cta" href="../index.html#join" data-i18n="pp_nav_cta">Apply Now</a>
  </div>
</div></header>

<main class="pp-wrap">
  <a class="pp-back" href="../index.html#roster" data-i18n="pp_back">&larr; Back to Roster</a>

  <div class="pp-hero">
    <div class="pp-tier-row">
      <span class="pp-tier">{tier}</span>
      <span class="pp-flagchip">{flag_chip}{country}</span>
      {sport_badge}
    </div>
    <h1 class="display pp-headline"><span class="pp-name-line">{name}</span>{headline}</h1>
    <div class="pp-meta-list">{meta_html}</div>
  </div>

  <div class="pp-section">
    <h2 data-i18n="pp_bio">Bio</h2>
    <p class="pp-bio">{bio}</p>
  </div>

  {stats_html}

  {teams_html}

  <div class="pp-contact">
    <h2 data-i18n-tpl="pp_interested" data-name="{name}">Interested in {name}?</h2>
    <p data-i18n="pp_contact_p">You have full roster access. Get in touch and we'll connect you with this athlete directly.</p>
    <a class="btn btn-gold" href="mailto:{CONTACT_EMAIL}?subject=Enquiry:%20{quote(p["name"])}%20%E2%80%94%20ESM%20Roster" data-i18n="pp_contact_btn">Contact ESM about this player</a>
  </div>
</main>

<footer><div class="wrap foot">
  <div>
    <a class="brand" href="../index.html#top"><img class="logo-img foot-logo" src="../logo.png" alt="ESM Sports Network" /></a>
    <p class="muted">&copy; <span id="yr"></span> ESM Sports Network. <span data-i18n="pp_rights">All rights reserved.</span></p>
    <a class="foot-admin" href="../admin/" data-i18n="pp_admin">Admin</a>
  </div>
  <div class="foot-links">
    <a class="pill" href="https://www.instagram.com/esm_sports_network__01/" target="_blank" rel="noopener">&#9678; @esm_sports_network__01</a>
    <a class="pill" href="mailto:elitesportsmanagement50@gmail.com">&#9993; elitesportsmanagement50@gmail.com</a>
  </div>
</div></footer>

<script>document.getElementById("yr").textContent=new Date().getFullYear();</script>
{I18N_SCRIPT}
<script src="/esm-legal.js"></script>
</body>
</html>
"""
    return page

slugs = []
for p in players:
    html_out = render_page(p)
    path = os.path.join(OUT_DIR, f"{p['slug']}.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(html_out)
    slugs.append(p["slug"])

print(f"Generated {len(slugs)} player pages")
print(json.dumps(slugs))
