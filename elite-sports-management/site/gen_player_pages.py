import json, re, os, html

SITE_DIR = "/tmp/work/repo/elite-sports-management/site"
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
  .pp-wrap{max-width:900px;margin:0 auto;padding:40px 22px 90px}
  .pp-back{display:inline-flex;align-items:center;gap:8px;color:var(--gold-soft);font-weight:700;font-size:13.5px;margin-bottom:26px}
  .pp-back:hover{color:var(--gold)}
  .pp-hero{display:grid;grid-template-columns:180px 1fr;gap:30px;align-items:center;border:1px solid var(--line);border-radius:20px;padding:32px;background:radial-gradient(circle at 12% 20%,rgba(217,177,84,.10),transparent 55%),linear-gradient(180deg,var(--card),var(--navy-2));margin-bottom:30px;position:relative}
  @media(max-width:640px){.pp-hero{grid-template-columns:1fr;text-align:center}}
  .pp-photo{font-family:'Anton';font-size:62px;color:var(--gold);width:160px;height:160px;border-radius:50%;border:2px solid rgba(217,177,84,.4);display:grid;place-items:center;background:rgba(6,20,42,.5);margin:0 auto;background-size:cover;background-position:center}
  .pp-tier{position:absolute;top:22px;right:22px;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;padding:6px 12px;border-radius:999px;background:rgba(6,20,42,.7);border:1px solid var(--line);color:var(--gold-soft)}
  .pp-flag{font-size:26px;margin-right:8px}
  .pp-name{font-size:clamp(28px,5vw,44px)}
  .pp-pos{color:var(--gold-soft);font-weight:700;margin-top:6px;font-size:15px}
  .pp-meta{color:var(--muted);margin-top:10px;font-size:14px}
  .pp-section{margin-top:30px}
  .pp-section h2{font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--teal-soft);margin-bottom:14px}
  .pp-bio{font-size:16.5px;color:#d6e1f2;line-height:1.65}
  .pp-stats{display:flex;gap:12px;flex-wrap:wrap}
  .pp-stat{border:1px solid var(--line);border-radius:12px;padding:14px 18px;text-align:center;background:rgba(8,26,51,.4);min-width:110px}
  .pp-stat b{font-family:'Anton';font-size:22px;color:var(--gold);display:block}
  .pp-stat span{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
  .pp-teams{display:flex;gap:9px;flex-wrap:wrap}
  .pp-contact{margin-top:38px;padding:26px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,var(--card),rgba(8,26,51,.4));text-align:center}
  .pp-contact h2{font-size:19px;margin-bottom:8px;color:var(--ink);font-family:'Anton';text-transform:none;letter-spacing:0}
  .pp-contact p{color:var(--muted);font-size:14.5px;margin-bottom:18px;max-width:48ch;margin-left:auto;margin-right:auto}
"""

def render_page(p):
    slug = p["slug"]
    name = esc(p["name"])
    flag = p.get("flag") or ""
    position = esc(p.get("position") or "")
    tier = esc(p.get("tier") or "")
    country = esc(p.get("country") or "")
    heritage = esc(p.get("heritage") or "")
    bio = esc(p.get("bio") or "")
    image = p.get("image_url") or p.get("image")
    meta_parts = []
    if p.get("born"): meta_parts.append(f"Born {esc(p['born'])}")
    if p.get("birthplace"): meta_parts.append(esc(p["birthplace"]))
    if p.get("bats"): meta_parts.append(f"Bats {esc(p['bats'])}")
    meta_line = "  ·  ".join(meta_parts)

    photo_style = f"background-image:url('{esc(image)}');background-size:cover;background-position:center top;font-size:0" if image else ""
    initials = "".join([w[0] for w in p["name"].split()[:2]]).upper()

    stats = p.get("stats") or []
    stats_html = ""
    if stats:
        chips = "".join(f'<div class="pp-stat"><b>{esc(s["value"])}</b><span>{esc(s["label"])}</span></div>' for s in stats)
        stats_html = f'<div class="pp-section"><h2>Career Highlights</h2><div class="pp-stats">{chips}</div></div>'
    else:
        stats_html = '<div class="pp-section"><h2>Career Highlights</h2><p style="color:var(--muted);font-size:14px">Stats coming soon.</p></div>'

    teams = p.get("teams") or []
    teams_html = ""
    if teams:
        chips = "".join(f'<span class="team-chip">{esc(x)}</span>' for x in teams)
        teams_html = f'<div class="pp-section"><h2>Teams &amp; Affiliations</h2><div class="pp-teams">{chips}</div></div>'

    desc = (p.get("bio") or f"{p['name']} — {position} represented by Elite Sports Management.")[:155]

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
    <span class="pp-tier">{tier}</span>
    <div class="pp-photo" style="{photo_style}">{"" if image else initials}</div>
    <div>
      <h1 class="display pp-name">{name} <span style="font-size:.55em">{flag}{heritage}</span></h1>
      <div class="pp-pos">{position}</div>
      <div class="pp-meta">{meta_line}</div>
    </div>
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
