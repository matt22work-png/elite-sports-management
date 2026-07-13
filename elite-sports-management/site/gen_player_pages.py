import json, re, os, html

SITE_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(SITE_DIR, "players")
os.makedirs(OUT_DIR, exist_ok=True)

with open(os.path.join(SITE_DIR, "index.html"), encoding="utf-8") as f:
    idx = f.read()

style_match = re.search(r"<style>(.*?)</style>", idx, re.S)
SHARED_CSS = style_match.group(1)

with open(os.path.join(SITE_DIR, "players.json"), encoding="utf-8") as f:
    players = json.load(f)

CONTACT_PAYPAL_URL = "https://paypal.me/elitesportsmanagement"

def esc(s):
    return html.escape(s or "", quote=True)

EXTRA_CSS = """
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
"""

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

def render_page(p):
    slug = p["slug"]
    name = esc(p["name"])
    flag = p.get("flag") or ""
    position = esc(p.get("position") or "")
    tier = esc(p.get("tier") or "")
    country = esc(p.get("country") or "")
    heritage = esc(p.get("heritage") or "")
    bio = esc(p.get("bio") or "")

    sport = esc(p.get("sport") or "Baseball")
    sport_badge = '<span class="pp-sport">' + sport + '</span>'

    meta_rows = []
    if p.get("birthplace"): meta_rows.append(("Birthplace", esc(p["birthplace"])))
    if p.get("born"): meta_rows.append(("Born", esc(p["born"])))
    if p.get("bats"): meta_rows.append(("Bats", esc(p["bats"])))
    meta_html = "".join('<div><b>' + label + ':</b> ' + val + '</div>' for label, val in meta_rows)

    headline = esc(headline_for(p))

    stats = p.get("stats") or []
    stats_html = ""
    if stats:
        rows = "".join('<div class="pp-stat"><span>' + esc(s["label"]) + '</span><b>' + esc(s["value"]) + '</b></div>' for s in stats)
        stats_html = '<div class="pp-section"><h2>Career Highlights</h2><div class="pp-stats">' + rows + '</div></div>'
    else:
        stats_html = '<div class="pp-section"><h2>Career Highlights</h2><p style="color:var(--muted);font-size:14px">Stats coming soon.</p></div>'

    teams = p.get("teams") or []
    teams_html = ""
    if teams:
        rows = "".join('<div class="pp-exp-row"><b>' + esc(x) + '</b></div>' for x in teams)
        teams_html = '<div class="pp-section"><h2>Playing Experience</h2><div class="pp-exp-list">' + rows + '</div></div>'
    else:
        teams_html = '<div class="pp-section"><h2>Playing Experience</h2><p style="color:var(--muted);font-size:14px">Details coming soon.</p></div>'

    desc = (p.get("bio") or (p["name"] + " — " + (p.get("position") or "") + " represented by Elite Sports Management."))[:155]

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>{name} — Elite Sports Management</title>
<meta name="description" content="{esc(desc)}" />
<link rel="manifest" href="../manifest.json" />
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
  <a class="brand" href="../index.html#top"><img class="logo-img" src="../logo.png" alt="Elite Sports Management" /></a>
  <div class="nav-right">
    <nav class="nav-links">
      <a href="../index.html#about">What We Do</a>
      <a href="../index.html#who">Who I Am</a>
      <a href="../index.html#roster">Roster</a>
      <a href="../index.html#events">Events</a>
      <a href="../index.html#join">Join Us</a>
    </nav>
    <a class="nav-cta" href="../index.html#join">Apply Now</a>
  </div>
</div></header>

<main class="pp-wrap">
  <a class="pp-back" href="../index.html#roster">&larr; Back to Roster</a>

  <div class="pp-hero">
    <div class="pp-tier-row">
      <span class="pp-tier">{tier}</span>
      <span class="pp-flagchip"><span class="pp-flag">{flag}</span>{country}</span>
      {sport_badge}
    </div>
    <h1 class="display pp-headline"><span class="pp-name-line">{name}</span>{headline}</h1>
    <div class="pp-meta-list">{meta_html}</div>
  </div>

  <div class="pp-section">
    <h2>Bio</h2>
    <p class="pp-bio">{bio}</p>
  </div>

  {stats_html}

  {teams_html}

  <div class="pp-contact">
    <h2>Interested in {name}?</h2>
    <p>Recruiters and coaches: pay the contact fee to unlock this athlete's direct contact info.</p>
    <a class="btn btn-gold" href="{CONTACT_PAYPAL_URL}" target="_blank" rel="noopener">Pay to contact this player</a>
  </div>
</main>

<footer><div class="wrap foot">
  <div>
    <a class="brand" href="../index.html#top"><img class="logo-img foot-logo" src="../logo.png" alt="Elite Sports Management" /></a>
    <p class="muted">&copy; <span id="yr"></span> Elite Sports Management. All rights reserved.</p>
    <a class="foot-admin" href="../admin/">Admin</a>
  </div>
  <div class="foot-links">
    <a class="pill" href="https://instagram.com/elite_sports_management__" target="_blank" rel="noopener">&#9678; @elite_sports_management__</a>
    <a class="pill" href="mailto:elitesportsmanagement50@gmail.com">&#9993; elitesportsmanagement50@gmail.com</a>
  </div>
</div></footer>

<script>document.getElementById("yr").textContent=new Date().getFullYear();</script>
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
