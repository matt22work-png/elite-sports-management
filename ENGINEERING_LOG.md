# ESM Website — Engineering Log

Persistent session memory. Append one entry per completed task (task, what changed,
files, commit, assumptions). Verify against actual code before redoing anything.
Priority order: security > correctness > reliability > accessibility > performance > SEO > UX > maintainability.

Site lives at `elite-sports-management/site/`. Prod: https://elite-sports-management.vercel.app
Supabase project: `sbexwyvsgqayxrsrlrpm` (Elite Sports Management). No-build vanilla JS + PWA.

---

## Completed

### Full ownership review + roster position-filter fix (2026-08-19, session 2)

**Autonomous end-to-end review of the whole project against LIVE prod (Supabase + Vercel), using
real test-account signups, direct RLS/API probes, and headless-Chrome CDP.** Commits `932ba7a`
(fix), `5733b6c` (repo hygiene).

**BUG FOUND & FIXED — roster position filters hid 70% of athletes.** The position tabs matched
`p.group === activeTab` exactly, but the live roster's `group`/`position` are admin free-text
("Player", "Catcher/Swich Hitter", "2 Way Player (C-Pitcher-1B)", "Outfield/DH", "Starting
Pitcher", …). Result: of 10 approved athletes, only 3 appeared under any position tab; the other 7
(incl. the founder) were visible only under "All" — a scout filtering by position saw a broken
roster. Also there was **no Outfielder tab** despite 2 outfielders.
- Fix (client-only, NO DB mutation): added `posCategory(p)` — a tolerant, order-sensitive matcher
  over `group+position` (Two-Way checked first so P+C combos don't double-count) returning exactly
  one canonical tab per athlete. `renderRoster` now filters by it. Added the missing **Outfielder**
  tab (FILTERS + `groupKey` + `filter_outfielder` EN/ES/IT).
- Verified live: All=10, Pitcher=3, Catcher=3, Infielder=0, Outfielder=2, Two-Way=2 → sum=10, clean
  partition (no overlap, no gaps); empty Infielder shows the graceful empty state. SW v9→v10.

**Everything else tested and PASSED (no other bugs):**
- Player signup→profile(auto-created by `handle_new_user` trigger, `on conflict do nothing`)→own-data
  read via RLS; anon can't see pending player; cross-user RLS isolation holds. Email confirmation is
  disabled (immediate session — no confirm block).
- Scout signup→pending (`scout_roster` returns 0)→admin approval→`scout_roster` returns 10 rows WITH
  contact fields; anon calling `scout_roster` → `42501 permission denied`.
- Application form file uploads (College path): anon uploads photo→application-photos + 3 PDFs→
  application-docs; row inserts with all fields; public photo readable; **private docs return 400 to
  anon on read/sign, `[]` on list — no leakage** (re-verified from 4 angles). Dropdown switching,
  T&C blocking, file validation all work in real Chrome.
- Roster code gate: `get_roster_code`→"ESM13", correct→true, wrong/empty→false.
- All 7 pages (home/register/scout/portal/admin/tenerife + a static player page), desktop AND mobile:
  **0 console errors, 0 failed requests**; hero photo loads (naturalWidth>0); no broken images; 0
  mobile horizontal overflow; no dead in-page anchors; all buttons have accessible names; testimonials
  (3) + events (2) render; language switcher EN/ES/IT works on every page and **"visibilità" renders
  correctly in real Chrome**.
- i18n validator: 0 hard problems. All 58 inline scripts + JS files syntax-clean. Prod schema fully
  applied (8 player cols, 4 scout cols, both buckets, 4 notify triggers, 5 storage policies). Security
  advisors: unchanged — the 8 warnings are all pre-existing & by-design (this session added no DB
  objects). All test data + temp policies cleaned; repo tree clean; throwaway test scripts removed +
  gitignored (`site/_*`).

**Still needs Matt/Sam (unchanged from session 1):** `GMAIL_APP_PASSWORD` secret unset → notifications
are a deployed no-op until added; admin editor "declutter" still needs specifics (nothing
Coaching-specific found to remove); rep/college file uploads are required by design (say if any should
be optional). Optional hardening: enable Supabase Auth leaked-password protection (dashboard setting).
Admin UI click-through (approve/reject/edit/stats/password-reset/testimonials editing) couldn't be
exercised without admin credentials, but its full data layer (RLS, edge fn, RPCs) is verified.

### Expanded application form + scout fields + Teams/Scouts option + IT tagline + hero photo — built & 3-pass reviewed (2026-08-19)

**Four batches of work, all deployed to prod and verified live. Commits `bc956b3`, `e468268`,
`98d6f3e`, `fd1df81` on `main`.**

**1 — Category-driven public application form (`#join`, index.html).** The "I'm applying for"
dropdown now drives which field set shows: Baseball/Softball Representation and College Placement
collect a full profile + file uploads; College adds English cert + education level + diploma.
- New Storage buckets: `application-photos` (PUBLIC, jpg/png) for headshots; `application-docs`
  (PRIVATE, pdf) for resume/CV, English cert, diploma. Both 10 MB + mime-limited at the bucket
  level. RLS: anon INSERT on both; admin (authenticated) SELECT on docs; photos public via bucket
  flag. Client validation mirrors the limits. Migration file `supabase-application-fields.sql`.
- New `players` columns: `nationality, resume_url, english_cert_url, diploma_url, education_level,
  study_goals` — length-capped, **not** added to the anon column SELECT grant (admin-only).
- Admin pending cards show every new field + download the files (signed URLs for the private PDFs
  via `openDoc`/`createSignedUrl`; direct link for the public photo).
- `send-form-notification` email template expanded with new fields + file links (7-day signed URLs
  for PDFs via the Storage sign REST API + auto-injected `SUPABASE_SERVICE_ROLE_KEY`).

**2 — Team/scout fields on scout self-registration (register/).** Photo, Full Name / Team Name,
nationality, phone+code, country, role (→ existing `title` col), positions/players sought. Account
creation (email/pw) unchanged. Migration `supabase-scout-fields.sql`: new `scouts` columns
`photo_url, name_or_team, nationality, looking_for`; legacy `organization/school_team/notes` kept
(not dropped). Added an authenticated INSERT policy on `application-photos` (scouts upload signed-in).
New scouts-INSERT notify trigger + edge-function `scouts` branch (joins `profiles` for name/email).
Admin Scouts view shows all new fields + photo.

**3 — "Coaching" → "Teams and Scouts" dropdown option.** Selecting it shows the team/scout field
set (mirrors registration; saves to `players` as a lead). New `players` cols `role, looking_for`
(migration `supabase-application-teams-fields.sql`). Email labels this kind "Teams / scouts inquiry".

**4 — Italian hero tagline + Arath Zapien hero photo.** Tagline → "...al livello successivo:
*visibilità, contratti e sviluppo*" — à verified as UTF-8 `c3 a0`. Photo `<figure>` + corner caption
added to the hero (all 3 langs, caption untranslated); `onerror` hides the figure until the JPG lands.

Trilingual EN/ES/IT throughout. Edge function redeployed to v4 (verify_jwt:false). SW cache v7→v9.

**Admin editor "declutter" (Sam's ambiguous ask): NO CHANGES MADE — flagged.** Reviewed the admin
player/account editor for Coaching-specific or orphaned fields; found none (every section is
general-purpose and in use). Per the "leave & flag if ambiguous" guidance, left it untouched.

**3-PASS REVIEW — confirmed solid (verified against prod, not just source):**
- Pass 1 (live): dropdown shows Baseball/Softball Rep, College, Teams and Scouts, **0 "Coaching"
  options**; all 3 langs; IT tagline `visibilità` present in served bytes; hero photo markup + SW
  `esm-v9` live; register scout fields present, old `s-org/s-school/s-notes` removed; admin
  signed-URL handler + new displays deployed.
- Pass 2 (regression): `get_roster_code` RPC 200; anon reads approved public roster; **all 13
  intake/PII columns (old + new) return 401 to anon — zero leakage**; no clickable PayPal/Wise
  targets anywhere (only descriptive comments remain); T&C enforced on index (`joinTc`), register
  (`acctTc`), tenerife (`teTc`); `validate_i18n.mjs` → **0 hard problems**.
- Pass 3 (skeptical/security): **private `application-docs` does not leak** — anon public-read 400,
  authed-path read 400, anon sign 400, anon list `[]`; anon cannot enumerate `application-photos`
  (list `[]`); Supabase security advisors show **no new issues** (all 8 warnings pre-existing &
  by-design: roster-gate RPCs, scout_roster, self-service, esm_admins lockdown, auth leaked-pw).

**Fixes applied during review (commit `fd1df81`):**
- Hero photo was `margin:auto` (centered) but the hero copy is left-aligned → `margin:30px 0 0`.
- Application "Teams and Scouts" photo was required, but the scout-registration photo is optional
  and a team/org may lack a headshot → made `ts_photo` optional (still validated + uploaded if given).

**RESOLVED after review:** `site/assets/arath-zapien.jpg` now committed (commit `1f775d7`). The file
had been saved as `arath-zapien.jpg.jpg` (accidental double extension); renamed to match the `<img>`
src. Valid JPEG 1280×854, 124 KB. Verified live: `GET /assets/arath-zapien.jpg` → 200 `image/jpeg`
126760 bytes; `<figcaption>` (static, no data-i18n) renders in all 3 languages; onerror-hide never fires.

**Needs Sam/Matt input:**
- **Admin "declutter"** — tell me exactly which editor sections to remove; I found nothing
  Coaching-specific to safely remove.
- **`GMAIL_APP_PASSWORD` secret still unset** → all notifications (applications, scouts, teams) are
  deployed but a graceful no-op until it's added (Supabase → Edge Functions → send-form-notification
  → Secrets). New dedicated submissions inbox = one-line swap of `OPS_INBOX`.
- Judgment calls flagged: rep/college file uploads (resume/cert/diploma) are **required** per Sam's
  field lists — say if any should be optional. Teams/Scouts photo made optional (above).
- Couldn't run a headless browser here; validation was live-curl + byte-level + DB/RLS + syntax.
  Worth a real mobile+desktop eyeball, especially once the photo file is added.

---

### "Sam sees no updates" — verified all fixes ARE live; bumped SW cache to force stale clients (2026-08-18)

**Report:** Sam said none of the recent updates show on the live site, and re-flagged the two
player-profile display issues + the tier-selection dead end.

**Investigation — everything is already deployed and live (verified against prod):**
- **Deploy pipeline healthy.** Local `main` == `origin/main` == `ae602c0`; tree clean. Vercel
  deployment `dpl_DbB1N6j9uFtmoJDHsSWgm2ysiXha` is `state:READY`, `target:production`, built from
  `ae602c0` — the exact HEAD. Not stuck/failed, not a preview.
- **Payment-gate fix IS live.** `curl` of the prod homepage: 0 old `data-mail`/`data-subject`
  tier CTAs, 2 new `href="register/" data-tier-name…` CTAs. `/register/` completes cleanly —
  step 3 is a confirmation, no payment step; the players INSERT carries `message` = the tier.
- **Tier IS recorded + visible to Sam.** `players.message` exists in prod with anon+authenticated
  INSERT grants and a ≤5000-char CHECK (tier string ~50 chars — safe). Admin `select("*")` +
  `cardPending` renders `<b>Message:</b> …` (admin/index.html:766) → the "Requested profile tier:
  … (€…)" line shows on the pending card. No CHECK on `tier`; `sport` CHECK matches the form's
  Baseball/Softball options — no schema dead-end anywhere in the flow.
- **Display bug #1 fix IS live.** Prod `players/jose-cedeno.html` serves
  `.pp-wrap{position:relative;z-index:1;…}` — the blank-body fix. Flags resolve to flagcdn `<img>`.
- **Display bug #2 fix** (portal flag `<img>`) present in `portal/index.html`.
- **Cache headers are correct:** HTML + `sw.js` served `Cache-Control: public, max-age=0,
  must-revalidate` (revalidate every load); SW is network-first for HTML. Server side is current.

**Root cause of "no updates": a stale client — an old installed PWA / service worker on Sam's
device**, not the code. **Fix applied:** bumped `sw.js` `CACHE` `esm-v6 → esm-v7`. The changed
bytes make the browser detect a new worker on Sam's next visit; `skipWaiting()` + `clients.claim()`
activate it immediately and the `activate` handler deletes every non-current cache — purging the
stale shell so all already-deployed fixes appear. (Also available to Sam: pull-to-refresh, which
calls `reg.update()` then reloads.)

**For Sam if it still looks stale:** hard-refresh (Ctrl/Cmd-Shift-R), or if the site was
"Add to Home Screen"/installed, remove and re-add it — his device is holding an old cached copy.

**Files:** `site/sw.js` (cache bump). No app-logic changes — the reported bugs were already fixed
in `ae602c0` and confirmed live this session.

### Remove payment gate blocking profile creation + fix two player-profile display bugs (2026-08-17)

**Reported by Sam:** (1) "two issues when displaying player profiles" (vague), (2) selecting
either pricing tier (€129.99 / €149.99) blocked profile creation — a dead end.

**#2 — payment-gate dead end (root cause + fix).** On the homepage profile-creation section
(`index.html` `#profile`), each tier CTA was a `data-mail` mailto link — clicking it only
opened an email; there was NO on-site path to actually build a profile (the real flow lives
at `/register/`, which itself has no payment gate). Per Matt: selecting a tier must record the
choice and take the athlete straight into profile creation, no paying first. Fix:
- Homepage tier CTAs → `href="register/"` + `data-tier-name`/`data-tier-price`; on click they
  stash `esm_reg_tier` (`{name,price}`) in localStorage. T&C acceptance still gates the click
  (legal, not payment). Removed the `data-mail`/`data-subject`/`data-body` attrs.
- `/register/` reads the stash: writes `Requested profile tier: <name> (<price>)` into
  `players.message` (shown on the admin pending card, so **Sam sees the tier**), and the
  confirmation step (`renderPayStep`) now shows the chosen tier's title + price. Stash cleared
  on sign-out. Notification email fires on the `profiles` insert (before tier is known), so the
  tier reaches Sam via the admin panel, not the email — acceptable per the task.
- **Validated** with real end-to-end signups (Playwright) for BOTH tiers: account → profile +
  stats → confirmation, no dead-end; confirmation showed "Official Player Profile — Standard
  €129.99" / "— Direct Contact €149.99"; DB rows carried the tier in `message` and the season
  stats. **Test rows + auth users cleaned up afterward** (players/profiles/auth back to 8/11/14).

**#1 — two display bugs.**
- **Public player pages rendered with a BLANK body.** `.pp-wrap` (`<main>`) lacked
  `position/z-index`, so the fixed `.bg-fx` background layer (`position:fixed;z-index:0`) painted
  OVER the entire profile — only the nav (z-50) and footer (z-1) escaped. The whole hero/bio/
  stats/teams/contact were invisible on all 17 pages. Fix: added `position:relative;z-index:1`
  to `.pp-wrap` in BOTH generators (`gen_player_pages.mjs` + `.py`, kept in sync) and
  regenerated all 17 `players/*.html`. Verified via headless screenshot (full profile + flag
  now render).
- **Player portal showed country as a raw emoji flag** (`${p.flag}`) → blank/letter-boxes on
  Windows (Sam's OS), inconsistent with the flagcdn `<img>` flags used on the homepage + player
  pages (the exact bug fixed site-wide in commit 57aac23, but the portal was left behind). Fix:
  added self-contained `NAME_ISO`/`emojiToIso`/`iso2For`/`flagImg` helpers + `.pflag` CSS to
  `portal/index.html` and render the flag as an image. Verified (Venezuela flag renders).

**Files:** `site/index.html`, `site/register/index.html`, `site/portal/index.html`,
`site/gen_player_pages.mjs`, `site/gen_player_pages.py`, `site/players/*.html` (17 regenerated).

### Notification-system reconciliation — audit's "Resend" claim was WRONG (2026-08-16)

**A later audit reported email notifications as "dormant, needs a new Resend account +
domain verification." That is INCORRECT.** Verified against the live prod project
(`sbexwyvsgqayxrsrlrpm`) — the real, wired notification path is **Gmail SMTP**, not Resend:

- **`send-form-notification`** (Gmail SMTP) is deployed **v1 ACTIVE** (`verify_jwt=false`).
- **`private.notify_config`** (the single row the trigger reads) points at
  `…/functions/v1/send-form-notification` — i.e. the Gmail function, NOT Resend.
- All three triggers (`trg_notify_player` / `trg_notify_profile` / `trg_notify_tenerife`)
  are **enabled** and call `private.notify_submission()`, which POSTs to that URL.
- **The ONLY thing blocking go-live is the `GMAIL_APP_PASSWORD` Edge Function secret** on
  `send-form-notification`. **No Resend account, API key, or domain verification is required.**
  Until the password is added, the function logs a clear line and returns 200 without sending;
  submissions still save normally (verified 2026-08-15).

**Why the audit got it wrong:** an orphaned **Resend**-based function (`notify`, v3 ACTIVE) and
its old `supabase-notify.sql` were still sitting in the repo/project from the superseded Phase 6
design. Nothing pointed at them (no `app.notify_url`, config table points elsewhere, no
`RESEND_API_KEY` ever set), so they never fired — but their presence made the audit describe the
wrong system. **Resolved by removing the redundant path:**
- **Deleted from the repo:** `site/supabase/functions/notify/index.ts` and `site/supabase-notify.sql`.
- The deployed `notify` Edge Function is now fully orphaned and harmless (no secret, nothing calls
  it). It can be deleted from the Supabase dashboard at leisure; leaving it does nothing.
- **Going forward there is ONE notification path: Gmail SMTP `send-form-notification`.**

Also in this pass: **College Placement CTA copy** corrected to Sam's exact phrase "to get
connected and have an evaluation" (`col_cta_p`, EN/ES/IT in `index.html`). **Player-page
generator drift fixed** — `gen_player_pages.py` still emitted the pre-flagcdn **emoji** flag
markup (`.pp-flag{font-size:18px}` + `<span class="pp-flag">{flag}</span>`) while
`gen_player_pages.mjs` and the live 17 pages use **flagcdn `<img>`** flags (commit 57aac23 was
never ported to the `.py`); ported `_NAME_ISO`/`_emojiToIso`/`flagImgChip` + the img CSS into the
`.py` so both generators emit byte-identical output. (The audit's "dead #roster redirect" framing
was a mischaracterization — the `#roster` paywall bounce is live/correct and identical in both
generators and all 17 files; the actual drift was **stale embedded CSS**: the 17 pages predated
recent `index.html` CSS edits — name-color fix, T&C, two-tier profile, `gate-need` — so all 17
were **regenerated** via `node gen_player_pages.mjs` to resync.) **Testimonials:** the 3 DB rows
("ESM Athlete"/"Parent"/"ESM Athlete") are still generic placeholders shown live; added a
self-clearing **PLACEHOLDER badge + warning banner in the admin Testimonials panel** so Sam/Matt
see they're example filler, not real quotes (badge clears once the generic name is replaced).

### Gmail SMTP form-notification system — built + wired, ready to activate (2026-08-15)

**Goal:** email the ESM inbox on every form submission, via Gmail SMTP. Gmail App
Password not available yet (Sam provides it), so build everything to go live with
**zero code changes** once the secret is added.

**Edge Function `send-form-notification`** (`site/supabase/functions/send-form-notification/index.ts`,
deployed **v1 ACTIVE**, verify_jwt=false):
- Reads `GMAIL_APP_PASSWORD` via `Deno.env.get`. **Missing → logs a clear line and
  returns `{ok:true,delivered:false,reason:"GMAIL_APP_PASSWORD not set"}` (HTTP 200)**,
  never crashes. denomailer is **dynamically imported only after** the password
  check, so with no password the SMTP lib never even loads.
- From-address hardcoded `elitesportsmanagement50@gmail.com`; SMTP `smtp.gmail.com:465`
  implicit TLS, auth user = from-address, pass = the App Password.
- One template path (`buildMessage`) formats each type into a readable label→value
  HTML table (empty fields dropped; never raw JSON). Subjects: "New Baseball/Softball/
  Coaching application: <name>", "New College consulting inquiry: <name>",
  "New player/scout registration (pending approval): <name>", "New Tenerife Winter
  League registration: <name>".
- **Routing:** all recipients currently `elitesportsmanagement50@gmail.com` (softball
  unified here 2026-08-14 when the specialist was removed — see below). "kind" is
  labeled in the subject for triage.
- **Test mode:** `POST {"test":true}` (optional `"to"`) sends a test email and returns
  the send result — for validating the pipeline once the password is in.
- Returns **200 on every path** so the caller never treats a mail failure as a
  submission failure.

**Wiring** (`site/supabase-gmail-notify.sql`, migration `notify_config_table_and_fn`):
- Reused the generic `private.notify_submission()` trigger (async `pg_net` POST,
  exception-guarded so it can never block the insert) + existing triggers on
  `players` / `profiles` / `tenerife_registrations`.
- Config moved from the `app.*` GUCs to a **`private.notify_config` table** (url +
  secret, single row) because managed Postgres rejects `ALTER DATABASE SET app.*`
  (`42501 permission denied`). The table is in `private` (never anon-exposed) and is
  read live by the trigger — also fixes the GUC connection-caching gotcha. Row now
  points at the `send-form-notification` URL.
- Supersedes the Resend-based `notify` function + `supabase-notify.sql` (that function
  is now orphaned/harmless — nothing points at it; left deployed, not deleted).

**Secret needed to go live (only this — no code/SQL changes):**
`GMAIL_APP_PASSWORD` as an Edge Function secret on `send-form-notification`. Optional
hardening: set `FORM_NOTIFY_SECRET` = the value in `private.notify_config.secret` to
lock the endpoint to the trigger (function enforces the x-notify-secret header only
when that env var is present; today it's unset → endpoint open but only ever emails
the fixed inbox).

**Verified today (password NOT set, as expected):**
- Function deploys **ACTIVE** (v1).
- Trigger fires: inserted a marked test application row (id 88) → `pg_net` POST hit the
  function → `net._http_response` shows **200** `{delivered:false,reason:"GMAIL_APP_PASSWORD not set"}`;
  edge logs show `POST | 200` + the clear `[send-form-notification] GMAIL_APP_PASSWORD
  not set … Would have emailed "New Baseball application: TEST Email Pipeline" to
  elitesportsmanagement50@gmail.com`. Test row then **deleted**.
- **Submission NOT blocked:** the insert returned the row normally despite the email
  no-op — the key property. Explicit `{"test":true}` POST also returned 200 gracefully.
- Could not test actual delivery (no password yet) — that's tomorrow's one step.

### Marianna Zumerle fully removed from the site (2026-08-14, commit 508b1c5)

Per Sam. Deleted the whole `#collab` Collaborators section (cover + card + reveal JS +
`.collab-cover` CSS + `nav_collab`/`collab_*`/`mz_*` i18n EN/ES/IT), her photo
`marianna.jpeg`, and regenerated all 17 `players/*.html` (vestigial CSS dropped).
Softball-application email routing unified to Sam (elitesportsmanagement50@gmail.com);
`notify` redeployed v3 + `supabase-notify.sql` updated. Admin access revoked: removed
from `admin/index.html` ADMIN_EMAILS and her `private.esm_admins` row deleted (3 admins
left). Her `auth.users` login still exists (zero admin rights now). Verified: i18n
validator 0 hard problems, no orphaned refs, page renders no console errors.

### Country flags fixed (emoji → flagcdn images) + full regression sweep (2026-08-06, session 5)

**PRIORITY BUG — country flags not rendering. Root cause (two compounding issues):**
1. **Emoji flags don't render on Windows.** Flags were Unicode regional-indicator emoji (🇻🇪, 🇩🇴 …).
   Windows ships **no emoji-flag font**, so Chrome/Edge on Windows — the OS Sam and many ESM users
   run — render them as blank or two letter-boxes, never a flag. (Firefox bundles its own emoji
   font so it looked fine there, which is why it seemed intermittent.)
2. **Inconsistent `country` data + mismatched lookup tables.** Live data has `country` stored three
   ways: full name ("Venezuela"), a flag **emoji** ("🇩🇴", "🇻🇪"), even **multi** ("🇪🇸/🇲🇽/🇻🇪", Daniel).
   The card body used `countryFlag()`→`CC_FLAG` (English names only) and silently returned "" for
   emoji-stored or unlisted countries; the top-left used `flagFor()`→a different `FLAGS` table.

**Fix — image-based flags via flagcdn.com (judgment call, documented).** Chosen over emoji-with-a-
Twemoji-font because images are reliable on every OS/browser and also let us normalize the messy
data. New resolver (index.html): `iso2For(p)` returns an ISO-3166 alpha-2 code from a stored flag
emoji (decoding regional indicators, e.g. 🇻🇪→"ve") OR the country name (EN/ES/IT, via `NAME_ISO`
built from DIAL_CODES — single source of truth — plus market-language aliases). `displayCountry(p)`
converts emoji-stored countries (incl. multi → "Spain / Mexico / Venezuela") back to names.
`flagImg(iso,…)` emits `<img src="https://flagcdn.com/{iso}.svg" loading="lazy">`. The country NAME
text still shows beside the flag, so a failed image degrades gracefully. Applied to: roster card
(top-left flag + heritage flag + body country line) and detail modal (index.html); scout portal
roster (scout/index.html, self-contained copy of the resolver); and the 17 static player pages
(gen_player_pages.mjs updated + regenerated — this also refreshed their embedded card CSS, so they
picked up the flag + Level-badge styles they were missing). **No player data mutated** — the
resolver handles all three storage formats, so the inconsistent data renders correctly as-is.
Removed the old emoji `FLAGS`/`flagFor`/`CC_FLAG`/`countryFlag`. Commit `57aac23`.
Validated live (headless Chrome, desktop 1280 + mobile 390): **40/40 flag images load** with
`naturalWidth>0` on both viewports; emoji-stored countries resolve correctly (Brayan→Dominican
Republic, Jose→Venezuela, Daniel→"Spain / Mexico / Venezuela"); Oscar Romero (no country) correctly
shows no flag. Screenshot confirmed visually. NOTE for future: flagcdn images are opaque
cross-origin so the SW won't cache them (no risk of pinning a broken flag); if flagcdn is ever
unreachable the country name still shows.

**FULL REGRESSION SWEEP — all live-tested, nothing broken (fixes were only needed for the flag bug).**
- ✅ **i18n**: `validate_i18n.mjs` — 0 hard problems across index/portal/scout/register/tenerife; all keys resolve EN/ES/IT.
- ✅ **Payment links/prices**: all 6 (PayPal py.pl + Wise × roster €49.99 / profile €129.99 / Tenerife €599.99) present and matching across every surface (index/register/scout/portal/tenerife).
- ✅ **Roster filters**: headless clicked all **15** sport×group combos — every one renders cards or the empty-state (never a blank/broken list), **zero card-rect overlap**.
- ✅ **Page health**: homepage + /portal/ + /scout/ + /admin/ + /register/ + /tenerife/ all load with key UI and **no unexpected JS/console errors**.
- ✅ **Jesús Delgado** appears **once** (id=7, approved — no duplicate).
- ✅ **Stale wording**: no "access code"/"unlock code" in any public page (gate copy is "Code/Código/Codice" + "Unlock/Desbloquear/Sblocca"). The only "access code" strings are the admin panel's intentional "Roster access code" feature label/toast (Sam-facing).
- ✅ **RLS boundaries (anon REST)**: `players.email`, `profiles`, `scouts`, `player_notes`, `app_settings` all return 42501 to anon; `scout_roster()` denied to anon; public approved-player names readable. Intact after the Level + master-code work.
- ✅ **Player portal flow (real E2E)**: signed up a throwaway player via the API — got an **immediate session** (email-confirm OFF), `handle_new_user()` **auto-created the profile** (role=player, pending), and RLS scoped reads to **own data only**; admin-only `player_notes` invisible. Test account deleted afterward (0 leftover). NOTE: a logged-in player reading `players` sees 0 approved rows — this is **by design** (the `read approved players` policy is **anon-only**; the homepage reads via a session-less anon client, and approved scouts get the full roster via the `scout_roster()` SECURITY DEFINER RPC). Not a regression.
- ✅ **Admin mechanisms**: /admin/ loads clean and contains the master-code editor (view/change/**retire** — `rc-current-val`/`showActiveCode`), the Level dropdown, etc.; the `admin-reset-user-password` Edge Function correctly rejects unauth/anon with **401** ("Not signed in."). Live master code confirmed = **ESM13**.
- ❓ **Fully-interactive admin/scout actions** (clicking approve/reject, editing a player, running a password reset, changing the code from the UI) were **not** driven end-to-end because they require Sam's admin password, which I don't have. Each was validated at the mechanism layer instead: RLS write-path (admin allowed / non-admin blocked, verified in sessions 4–5), page-load, element presence, and Edge-Function auth. Recommend Sam do a 2-minute click-through when convenient.

---

### Master roster code is now FULLY admin-managed via cached lookup (2026-08-06, session 5) — SUPERSEDES "hardcoded ESM13, do not remove"

**⚠️ Supersedes prior guidance.** Earlier this session the fix hardcoded `const
MASTER_ACCESS_CODE = "ESM13"` as a synchronous fallback and the log/memory said "DO NOT
re-remove the hardcoded ESM13 check." **That is no longer true.** There is NO hardcoded code in
`index.html` anymore. The master code is 100% admin-controlled (DB `app_settings.roster_master_code`)
and Sam can change OR retire it from the admin panel with no deploy. The reliability property is
preserved by CACHING the admin-set code in localStorage instead of pinning a fixed string.

**Why.** The hardcode made "ESM13" permanently unchangeable — retiring/rotating it required a code
deploy, defeating the point of the admin-managed code. Goal: keep the "always works instantly, even
if the esm.sh CDN import is slow/blocked" property WITHOUT a fixed string.

**Mechanism.**
- New RPC `public.get_roster_code()` (migration `add_get_roster_code_rpc`; SECURITY DEFINER,
  `search_path=''`, granted to anon) returns the current master code TEXT, or NULL when
  empty/retired. The code is a soft convenience gate, NOT a secret (it shipped in page source as
  ESM13 for most of its life), so exposing the current value to anon is consistent. Kept
  `verify_roster_code()` (true/false) for the live check. Snapshot: `site/supabase-app-settings.sql`.
- `index.html` `boot()`: on every successful load, calls `get_roster_code()` and caches the value
  in `localStorage['esm_roster_code_v1']` (normalized trim+UPPER). **Only mutates the cache when
  the server actually answered (`!error`)** — on a network error the RPC resolves to
  `{data:null,error}`, and writing that null would WIPE the last-known-good cache and destroy the
  offline fallback exactly when the network is down; so on error the existing cache is preserved.
  A retired code (server returns null, no error) clears the cache.
- Gate handler (`#gateForm`): (1) per-user SHA-256 personal codes — offline, unchanged; (2) NEW
  fast path — compare `val` against the cached value SYNCHRONOUSLY (network-free; replaces the
  hardcoded ESM13); (3) live `verify_roster_code()` for a code Sam JUST changed that this browser
  hasn't re-cached — and on success it seeds the cache with the confirmed-current value.
- Admin (`admin/index.html`): "Roster access code" card now shows the ACTIVE code prominently
  (`#rc-current-val`), and a BLANK save retires the master code entirely (confirm dialog; stores
  '' → verify returns false, get_roster_code returns null → browsers clear their cache).

**Self-update / rotation semantics.** Changing the code in admin is live for return visitors on
their NEXT page load (boot re-caches). The old code stops working after that reload: cache holds
only the new value (path 2 fails for the old code) and the live RPC (path 3) rejects it. Narrow
accepted edge case (explicitly signed off in the task): a BRAND-NEW visitor with an empty cache AND
a blocked/slow network has only the live RPC path — same as before the ESM13 hardcode ever existed;
not a regression, since caching covers the vast majority of return visits.

**Validation (headless puppeteer-core vs prod, after each deploy — 22/22 across 3 phases + DB
checks).** Orchestrated by changing `app_settings` via SQL (identical to the admin Save's
`app_settings` UPDATE; admin RLS write-path already verified in session 4):
- Phase TEST99 (10/10): fresh session unlocks with the new code (desktop+mobile); `  test99  `
  case/whitespace unlocks; OLD "ESM13" stays locked; garbage stays locked; per-user SHA-256 still
  unlocks; **net-blocked (esm.sh + supabase.co both aborted) + cached code unlocks via cache
  alone** (desktop+mobile) — the reliability test; net-blocked + OLD stays locked; net-blocked +
  per-user SHA-256 unlocks offline.
- Phase RETIRE (2/2): blank code → fresh visitor can't unlock; a stale-cache browser clears its
  cache on reload and rejects the old code.
- Phase RESTORE ESM13 (10/10): same battery, confirming the live site is back to the real
  handed-out code ("ESM13"), fully working through the new mechanism.
This run also CAUGHT AND FIXED a real bug: the first implementation cleared the cache on a
network-error RPC (see boot() note above) — fixed in commit 4af31be before re-validating.

**⚠️ Bug caught mid-validation** — see the cache-preservation note; do not reintroduce
`cacheMasterCode(mc)` without the `!error` guard.

Commits `e28b3b2` (feature) + `4af31be` (cache-preservation fix), pushed; Vercel auto-deployed and
confirmed live before each test phase. Live master code left as "ESM13".

---

### Add editable "Level" field (College/International/Pro) to players (2026-08-06, session 5)

Sam-editable classification per player, managed live from the admin panel, shown publicly.

**DB** (migration `add_player_level_field`, APPLIED to prod; snapshot `site/supabase-player-level.sql`).
New nullable `public.players.level text` with `CHECK (level is null or level in
('college','international','pro'))`. No default — a player with no level shows no badge. Grant:
`grant select (level) on public.players to anon` — REQUIRED because anon reads `players` via
COLUMN-LEVEL grants (table-level SELECT was revoked in supabase-harden-players-columns.sql), so
new columns aren't auto-readable by the public site. `authenticated` has TABLE-LEVEL
select/update/insert, so admin edits (as authenticated) cover the column with no extra grant.

**Admin** (`site/admin/index.html`). Added `levelOptions()` helper (mirrors `sportOptions`; first
option is `— None —` → NULL) and a "Level" `<select>` in the player edit form right after Sport.
Save reuses the existing `[data-saveprofile]` handler — one line added to the patch:
`level: box.querySelector(".pf-level").value || null`. Admin reads via `select("*")` so the
dropdown pre-selects the current value. Admin panel stays EN-only (option labels hardcoded).

**Public** (`site/index.html`). Added `level` to boot()'s anon `.select(...)`. New `levelLabel(v)`
helper returns the trilingual label (empty when unset). Rendered as a teal `.lvl` pill (distinct
from the gold position text) on the roster card body (after position) and inline in the detail
modal's `.sh-pos`. i18n keys `level_college/international/pro` added to EN/ES/IT dicts:
EN College/International/Pro · ES Universitario/Internacional/Profesional · IT
Universitario/Internazionale/Professionista.

**Scoping (flagged).** Per the task's default, this is display+edit only — NO new roster filter
tab. The site already has two filter systems (`activeSport` Baseball/Softball + `active`
position-group tabs); a third is non-trivial (new bar, state, render path, i18n tab labels) and
Matt didn't ask for it. Easy to add later if wanted. Also: the 17 pre-generated static
`players/*.html` pages are built from `players.json` (no `level` data) — they don't show the
badge; the DB-driven homepage roster card (which every player has) does, so the requirement
"visible on each player's card" is met. Regenerating static pages with level would need a
generator change + level in the export — out of scope, flagged.

**Validation.**
- i18n validator (`node validate_i18n.mjs`): 0 hard problems, all keys resolve EN/ES/IT, scripts
  parse (only an advisory length flag on IT "Professionista", a `nowrap` badge — fine).
- Node `--check` on both inline module scripts (admin + index): syntax OK.
- Admin write-path via REAL RLS (simulated `authenticated` + jwt claims): admin (mattswagj) UPDATE
  → 1 row; non-admin UPDATE → 0 rows (blocked); CHECK rejects out-of-set value. Confirms Save
  works for admins only and existing field edits are unaffected (same patch/handler, +1 line).
- Live headless (puppeteer-core vs prod, after deploy): seeded 3 real approved players
  (international/college/pro), verified the badge text on the roster CARD and detail MODAL across
  EN/ES/IT on BOTH desktop (1280×900) and mobile (390×844), plus the negative case (no badge when
  level null). 22/22 PASS. Test data then reverted to NULL (didn't assert classifications I can't
  verify) — all players currently have level=null; Sam sets real values from admin.

Commit `abdf0d9` "Add editable Level field (College/International/Pro) to player profiles"
(pushed; Vercel auto-deployed; new bundle confirmed live before testing).

---

### FIX: ESM13 master code not unlocking roster (2026-08-06, session 5)

**Symptom (real user).** A real user typed `ESM13` (case-insensitive) into the roster gate's
Code field and it did NOT unlock the roster — it showed the "that code isn't right" error.

**Investigation.**
1. Gate logic (`site/index.html` `#gateForm` submit, ~L1614) has two paths: (1) per-user
   SHA-256 codes checked offline against `ROSTER_CODE_HASHES`, then (2) the DB-backed
   `verify_roster_code()` RPC. I confirmed `SHA-256("ESM13") = 8225e2e0…`, which is **NOT** in
   `ROSTER_CODE_HASHES` (only `99b2bfb3…` is). So **ESM13 was recognized ONLY by the RPC path.**
2. DB state (prod `sbexwyvsgqayxrsrlrpm`, ACTIVE_HEALTHY — not paused): `app_settings` table
   exists, `verify_roster_code(text)` exists, seed row `roster_master_code = 'ESM13'` present,
   anon has EXECUTE, and the RPC returns `true` for `ESM13`/`esm13`/`  Esm13  `. **The DB
   migration was fully complete and correct — the server side was never the problem.**
3. **Root cause = client-side fragility introduced by commit `2c39e13` (session 4, Part 2).**
   That commit deleted the synchronous hardcoded `MASTER_ACCESS_CODE = "ESM13"` constant and
   made ESM13 depend on the RPC path. But the RPC path is guarded by `if(SB)`, and `SB` is
   assigned only *after* `boot()` finishes an async dynamic `import()` from the external CDN
   `esm.sh` (L1745). So whenever `SB` is still `null`, path 2 is silently skipped and — because
   ESM13 isn't in the offline hash list — a valid ESM13 is REJECTED. `SB` is null when: the user
   submits before the CDN import resolves (race — common on a fast typist / slow connection);
   `esm.sh` is blocked or down (ad-blockers, corporate/school networks, CDN hiccup) — the
   `catch` swallows it and `SB` stays null forever; the device is offline; or the DB was
   momentarily paused. The pre-migration hardcoded string compare had none of these
   dependencies, so it *always* worked. The migration regressed reliability for the exact
   people (trusted players/coaches/scouts) the master code exists for.
4. Caching: not the cause, but the SW (`sw.js`) is network-first for HTML so returning
   visitors get new deploys; still bumped `CACHE` esm-v5→esm-v6 to purge any stale bundle.

**Fix (simple, reliable — both paths work, per the "reliable fallback + DB on top" directive).**
Restored a **synchronous, network-free hardcoded `ESM13` check** in the gate handler that always
unlocks (case-insensitive + whitespace-trimmed; `val` is already `.trim().toUpperCase()` and is
compared to `MASTER_ACCESS_CODE.toUpperCase()`), inserted as path 2 BEFORE the RPC call. The
DB-backed `verify_roster_code()` RPC is KEPT as path 3 (best-effort) so Sam can still add/rotate
admin-managed custom codes with no deploy — but ESM13 no longer depends on any async/network
path. Per-user SHA-256 codes (path 1) are byte-for-byte untouched. Files: `site/index.html`
(added `const MASTER_ACCESS_CODE = "ESM13"` + synchronous path-2 check), `site/sw.js` (cache bump).
No DB change needed (migration was already correct).

**Live validation (headless Chrome via puppeteer-core against prod, after deploy — 8/8 PASS).**
Each case ran in a fresh incognito context with cache disabled, confirmed the roster started
`is-locked`, then verified unlock via `#rosterWrap` losing `is-locked` + `localStorage
esm_roster_unlock_v1==='1'` + the ✓ note:
- A `ESM13`, B `esm13`, C `Esm13`, D `  esm13  ` → all UNLOCK (desktop 1280×900).
- E per-user SHA-256 path (injected a test code's hash via the page's own `sha256Hex` into
  `ROSTER_CODE_HASHES`, then unlocked with it) → UNLOCKS ⇒ SHA path unaffected.
- F wrong code `NOPE123` → stays LOCKED + shows error (negative control).
- G `ESM13` on MOBILE viewport (390×844) → UNLOCKS.
- H `ESM13` with `esm.sh` request BLOCKED so `SB` stays **null** (reproduces the exact original
  failure mode) → still UNLOCKS. This is the definitive proof the fix is independent of the
  async/network/DB path.

Commit `73d919e` "Fix ESM13 master code not unlocking roster access" (pushed to `main`; Vercel
auto-deployed; new bundle confirmed live before testing). Assumption: the opaque plaintext of the
existing `99b2bfb3…` per-user code is not recorded anywhere I could find, so path 1 was validated
functionally (inject-hash-and-unlock) rather than with its real plaintext — acceptable because the
path-1 code is unchanged in the diff.

---

### Admin-managed roster access code — DB-backed, no-deploy (2026-08-04, session 4 — Part 2)

Replaced the hardcoded `MASTER_ACCESS_CODE = "ESM13"` constant with a database-backed master code
Sam manages from the admin panel. Changing it takes effect immediately, no deploy. Files:
`site/index.html` (gate), `site/admin/index.html` (UI + load/save), `site/supabase-app-settings.sql`
(migration snapshot). DB migration `roster_master_code_settings` (APPLIED to prod).

**DB.** New table `public.app_settings(key pk, value, updated_at, updated_by)`, RLS **admin-only**
(`"admin manage settings"` via `private.is_esm_admin()`); anon has NO access. Seeded
`('roster_master_code','ESM13')` so rollout is behaviour-identical. New function
`public.verify_roster_code(p_code text) returns boolean` — SECURITY DEFINER, `search_path=''`,
case-insensitive + trims, granted to anon+authenticated. It returns only true/false, so the code
value is **never exposed** to the browser (an improvement over ESM13, which was readable in page
source). RLS on the table means even authenticated non-admins can't read or write it.

**Client.** Gate (`#gateForm`) now: (1) checks per-user SHA-256 personal codes offline first
(ROSTER_CODE_HASHES — unchanged); (2) else calls `SB.rpc('verify_roster_code', {p_code})` and
unlocks on `true`. The old hardcoded ESM13 check is removed — the DB value (seeded ESM13) is the
single source of truth, so when Sam changes it the new code works and the old one stops. Admin panel
gained a **"Roster access code"** card (loads the current value via `loadRosterCode()`, saves via a
standard `app_settings` update with `updated_by`) — EN-only, consistent with the rest of the admin UI.

**Validation (all live):**
- RPC (as anon): `ESM13`→true, `esm13`→true, `"  EsM13 "`→true (case-insensitive + trims),
  wrong/empty→false.
- RLS: non-admin authenticated can't UPDATE (0 rows) and can't read the value; anon has no table access.
- Admin change (rolled back): after an admin sets `SUMMER-26!`, `verify_roster_code` returns true for
  the new code and **false for ESM13** — immediate.
- **Headless-Chrome gate test, real page:** with prod code ESM13 → `esm13` and `  ESM13  ` unlock, a
  wrong code stays locked + shows the error. Then changed the prod code to `ROSTER-2026` (as an admin
  would) → the gate immediately unlocked on `ROSTER-2026`/`roster-2026` and **rejected `ESM13`**;
  reverted prod back to `ESM13` afterward.
- Per-user SHA-256 codes unaffected (offline path unchanged, still checked first). Validator
  (`node validate_i18n.mjs`) → 0 hard problems (scripts parse). Advisor WARN on `verify_roster_code`
  (anon-executable SECURITY DEFINER) is **intentional/expected** — same reviewed pattern as
  `scout_roster`; it returns only a boolean and never leaks the code.

**Note:** `verify_roster_code` is convenience access, not a hardened secret — a brute-force guesser
could still probe codes (same threat model as the old client-side ESM13, but now the value isn't in
page source). One master code only, per Matt's scope; per-category codes remain a future option
(app_settings can hold more keys).

### Full 3-portal live functionality sweep (2026-08-04, session 4 — Part 1)

Tested each portal **live end-to-end** with real approved test accounts driven through headless
Chrome (CDP) — actual logins, rendered UI, console-error capture, mobile + desktop — plus RLS
probes via simulated JWTs. **All three portals pass; no bugs found; no code changes needed.**
Test accounts (player/scout/admin) + a leftover `esm-audit` test account from a prior session were
all cleaned up afterward (DB back to 22 players / 8 profiles / 4 real admins, 0 `@example.com` users).

- ✅ **Player portal (`/portal/`).** Live login as an approved test player rendered the full profile:
  avatar, name, position+flag, APPROVED chip, "You're live on the ESM roster", bio, details
  (sport/position/country/age/IG/phone), career highlights, and the **BBREF career register**
  (batting/pitching/fielding) via the shared `window.BBREF.renderAll()` — same renderer/layout as
  admin + public pages, with correct auto-calc (ERA 2.25 = 9·20/80, W-L% .800). **Fully read-only**
  (no edit/upload controls; the edit-related dict keys are vestigial). **No console errors**; mobile
  (390px) clean. Immediate login confirmed (email confirmation OFF — session-3 result).
  - **Cross-player access BLOCKED at the API/RLS layer (not just UI):** `"read approved players"`
    is scoped to `{anon}` only (and anon can't read email/phone via column grants); an authenticated
    non-admin gets only `"athlete reads own row"` (own row). Simulated approved player querying OTHER
    approved rows → **0 rows, 0 emails, 0 phones**. Own row matched by `owner_id` then `email`.
  - Pending state shows €129.99 PayPal (`py.pl/zN5Dh…`) + Wise (`wise…/NKJf…`) + ESM email; trilingual.
- ✅ **Scout portal (`/scout/`).** Live login as an approved test scout rendered **"ROSTER — SCOUT
  ACCESS · 21 players"** — full read-only detail (photo, bio, teams, contact) + full BBREF career
  tables, same data admins see. **No console errors.** Pending state (re-confirmed): €49.99
  PayPal+Wise + Sam's email (`brunosamuele56@gmail.com` + `elitesportsmanagement50@gmail.com`).
  Rejected/unapproved + anon **blocked via direct API** (`scout_roster()` → 0 rows / 401 — session-2/3).
  Roster code-gate + ESM13 remain independent (homepage; re-verified session-3, and again in Part 2).
- ✅ **Admin portal (`/admin/`).** Live login (test admin temporarily added to the LOCAL `ADMIN_EMAILS`
  for the test, **edit reverted** — working tree clean) rendered the full panel with **no console
  errors**: PENDING ACCOUNTS with payment verify toggle, Approve/Reject/Archive, internal notes,
  and Reset-password field per account; ADD A PLAYER; ROSTER with the **All / ⚾ Baseball / 🥎 Softball**
  filter; PENDING APPLICATIONS. The admin client gate is the hardcoded `ADMIN_EMAILS` constant (it
  correctly rejected a DB-only admin), and the sport filter is `inSport = SPORT_FILTER==="All" ||
  (p.sport||"Baseball")===SPORT_FILTER` — **sport-based, no admin-identity restriction**, so all
  admins see all players. Edit/stats (BBREF register editor w/ auto-calc), approve/reject, password
  reset edge fn — all present (edge-fn security path live-tested session-3).
- ✅ **Languages / regressions.** Player portal trilingual EN/ES/IT (switcher live); scout/admin
  EN-only **by design** (internal/roster tools) — unchanged, nothing regressed. No broken links or
  console errors surfaced on any portal in the live runs.

### Targeted troubleshooting pass on reported bugs + Jesús Delgado de-duplication (2026-08-04, session 3)

Live reproduction pass over the recently-reported bug categories (signup/RLS, session-independence,
roster filters, access). Tested actual behavior — real signups against prod, headless-browser
screenshots, live edge-function calls — not code reads. **Result: every reported category is solid;
one real production-data bug (a duplicate roster entry) found and fixed.**

- ✅ **Player signup → portal linking.** Ran a REAL end-to-end signup against prod Supabase (anon
  key, exactly like the browser): signup returns an **immediate session** (email confirmation is
  **OFF** — no confirm-block), the `on_auth_user_created` trigger auto-creates the profile, the
  `players` insert **succeeds (201)** with `owner_id = auth.uid()` (**user_id linking, not email
  strings**) and **season stats saved** (RLS race fix holds), immediate password login works
  (`uid` matches), and the user reads their own real data. Test accounts deleted after.
- ✅ **Session-independence.** Same live test created a player AND a scout → **distinct uids**, both
  independent (201). Reinforced in code: register signs out a different active session before
  `signUp` (register/index.html:604-611) and `ensureProfile()` has a **session-bleed guard** —
  only creates a profile when the active session's email matches the stashed signup email
  (register/index.html:640-646). No attachment to an admin session possible.
- ✅ **Roster access.** Gate shows €49.99 with **both** buttons — PayPal (`py.pl/GJ510klc…`) + Wise
  (`wise.com/pay/r/Zhxkm…`). Submit handler accepts per-user SHA-256 codes AND **ESM13**
  case-insensitively (`.trim().toUpperCase()`, checked before the hash).
- ✅ **Scout flow end-to-end.** Live scout signup inserted (201). Pending state shows €49.99
  PayPal+Wise + Sam's email (`brunosamuele56@gmail.com` hint + `elitesportsmanagement50@gmail.com`
  mailto), trilingual. Approval trigger `trg_sync_player_status` + `scout_roster()` gating
  re-confirmed (approved → full read-only roster w/ contact; rejected/anon → none).
- ✅ **Accessibility.** Prod `https://elite-sports-management.vercel.app/` fetched from an external
  cloud IP (an "outside visitor") returned the **real homepage** — no Vercel SSO/password wall.
  Supabase `sbexwyvsgqayxrsrlrpm` is **ACTIVE_HEALTHY** (not paused).
- ✅ **Roster filter tabs (thorough — this was the recurring layout bug).** Drove **headless Chrome
  via CDP** over the live local page (real Supabase data, roster unlocked) and screenshotted **all
  7 filter states × desktop(1440) + mobile(390)**. Ran a **geometric overlap check** (every
  card-rectangle pair) in each state: **ZERO overlaps anywhere**; no chip overflow on mobile; empty
  Softball state renders the centered "no athletes" message (grid-column:1/-1), not a broken grid.
  Visually confirmed edge cases (1-card Catcher, empty Softball, 7-card Pitcher, mobile stack).
  `.filters` is `flex-wrap`, `.roster` is a responsive 3→2→1 grid — no overlap mechanism exists.
- ✅ **Password reset + confirmation.** Signup password-mismatch guard verified (register:600,
  trilingual `r_err_pwmatch` + HTML5 required/minlength). Admin reset edge function
  `admin-reset-user-password` is ACTIVE + source correct (verify_jwt, `is_admin_email` gate,
  8-char min); tested its security path **live**: anon token → `401 "Not signed in"`, no auth →
  `401 Missing authorization header`. Full admin happy-path click needs Matt's actual admin login.
- ✅ **Trilingual.** `node validate_i18n.mjs` → 0 hard problems; heuristic English "hits" on
  register/scout/portal/tenerife are all fallback text inside `data-i18n`/`data-i18n-html`
  elements (replaced at runtime), not leftover strings.
- 🔧 **Jesús Delgado — duplicate roster entry FIXED (DB data change, per Matt's decision).** He
  existed as TWO approved rows: **id 7** (`jesus-delgado`, curated profile — LHP, real bio, static
  stats page, but NO account/contact) and **id 68** (`player-f55ccca5c6`, his self-registration
  account — owner_id/email/IG/phone, but sparse: no position/bio). He appeared **twice** on the
  public roster. Neither row had any BBREF stats or notes. **Resolution (Matt chose "merge onto row
  7, delete row 68"):** moved his account link + contact onto row 7 (`owner_id
  f55ccca5-c6f7-4510-9bb8-e86763665354`, email `jesusdegado1509@gmail.com`, IG `@jesus_delgado2020`,
  phone `+58 4125810866`), merged teams → `["Texas Rangers org.","Arizona Complex League",
  "Montpellier"]`, and deleted row 68. **Verified:** one Jesús Delgado remains (keeps the
  `jesus-delgado` slug + static stats page), and a simulated authenticated read as his uid returns
  the consolidated row — so his **portal login links correctly** via `owner_id`. Roster count 23→22.
  - **Deleted row 68's exact data (for reversibility):** name "JESUS DELGADO", slug
    `player-f55ccca5c6`, group "Player", source "registration", owner_id
    `f55ccca5-c6f7-4510-9bb8-e86763665354`, email `jesusdegado1509@gmail.com`, IG
    `@jesus_delgado2020`, phone `+58 4125810866`, teams `["Texas Rangers org.","Montpellier"]`,
    country Venezuela, no position/bio/age/photo/stats.
- ❓ **Still missing for Jesús (can't infer — Sam to add via admin panel):** age, season/career
  stats (BBREF register), and a photo. Bio + position are now present on the consolidated row.

**Recommendation (not actioned — Matt's call):** the duplicate arose because a curated roster player
(added via "application") later self-registered, and the register flow always creates a new `players`
row. A guard that links to an existing row on email match would prevent recurrence, but curated rows
often have `email = NULL` (as row 7 did), so it wouldn't have caught this case — low priority, flagged
only. **No code files changed this session** (all reported bugs were already solid); the only change
is this DB de-duplication + this log entry.

### Full-site audit resume + handle_new_user API-exposure hardening (2026-08-04, session 2)

**Context — recovering an interrupted session.** The prior session was killed when the terminal
closed mid-task. On resume: `git status` **clean**, branch **up to date with origin/main**, no
uncommitted/half-done work — the interrupted session had already committed AND pushed its two
fixes (`1feb154` RLS signup race fix, `5d1a8af` ESM13 master code) and documented both (the entry
directly below). Nothing to finish or roll back. So this session re-ran the **full live site
audit** (testing flows against prod, not just reading code) and fixed what it surfaced.

**Audit results — ✅ pass / 🔧 fixed this session / ❌ broken / ❓ needs a human:**
- ✅ **Roster code-gate + ESM13.** `index.html` gate: ESM13 master code checked (case-insensitive,
  `.trim().toUpperCase()`) BEFORE the SHA-256 hash path; per-user hashed codes unaffected; wrong
  codes still fail. Account-based access (scout/player portals) is independent — ESM13 is roster-gate only.
- ✅ **Payment links + pricing.** All py.pl + Wise pairs and prices consistent site-wide: roster/scout
  **€49.99** (`py.pl/GJ510klc…` + `wise…/Zhxkm…`), profile **€129.99** (`py.pl/zN5Dh…` + `wise…/NKJf…`),
  Tenerife **€599.99** (`py.pl/vb5Fr…` + `wise…/f9KLiw…`). Present on every surface (roster gate, register
  pay step, tenerife, portal + scout pending reminders). Zero stale `$`/old-€ values.
- ✅ **Player signup → portal (LIVE, rolled-back txns w/ simulated JWTs).** Fresh authenticated user
  with **NO profiles row** inserts own `pending` players row → **SUCCEEDS** (id 77, rolled back) —
  proves the race fix. Self-approve (`status='approved'`) → **BLOCKED 42501**. Impersonation
  (`owner_id` = another user) → **BLOCKED 42501**. Portal read gated by `athlete reads own row` +
  `own profile read` (own row only).
- ✅ **Scout signup → approval → roster (LIVE).** Approved scout `scout_roster()` → **21 rows w/
  contact** (5 email, 4 phone). Rejected scout → **0 rows**. Anon → **42501 permission denied**.
  Approval trigger `trg_sync_player_status` tested live: flipping a profile to approved flips the
  player's roster row to `approved`.
- ✅ **Admin capabilities.** Client `ADMIN_EMAILS` == DB `private.esm_admins` exactly (brunosamuele48,
  softball.esm, mattswagj, matt22work-png). Add-player / edit / notes / archive / delete / accounts
  queue present. Both edge functions **ACTIVE** (`notify`, `admin-reset-user-password` verify_jwt=true).
- ✅ **Password confirmation.** register `password`+`password2` w/ trilingual mismatch guard
  (`r_err_pwmatch`, EN/ES/IT); admin self-reset (`pw-new`/`pw-confirm`) + per-user reset
  (`rp-new`/`rp-confirm`). Register is the sole account-creation surface (role selector) — covered.
- ✅ **Trilingual EN/ES/IT.** `node validate_i18n.mjs` → **0 hard problems**; every `data-i18n*` key
  resolves in all 3 langs across index/portal/scout/register/tenerife/player pages. Only advisory
  length flags (wrapping section headings, not tight buttons).
- ✅ **Collaborators section.** `#collab` cover→reveal (Marianna Zumerle card), nav `nav_collab`,
  full `collab_*`/`mz_*` keys EN/ES/IT.
- ✅ **Copy fixes.** No stale `$49.99`/`€124.99`/`€559.99`, no `3/4 years`, no user-facing "access
  code" (the lone "three years" hit is Samuele's real bio; "access code" only in a code comment).
- 🔧 **Supabase health.** Project `sbexwyvsgqayxrsrlrpm` **ACTIVE_HEALTHY** (not paused). Advisors
  reviewed. **Fixed one real item this session** (below). Remaining WARNs are all known/reviewed:
  `scout_roster`/`update_my_profile` SECURITY DEFINER (intentional — must be authenticated-callable,
  enforce own row/role boundaries), leaked-password protection OFF (dashboard-only), `esm_admins`
  RLS-no-policy INFO (safe — private-schema deny-all). Performance WARNs are all "multiple permissive
  policies" (admin + owner policy on the same table/action) — by-design, negligible on these tiny tables.

**🔧 Fix applied — `handle_new_user()` API exposure (commit `f0ca1e2`).** Security advisor lints
0028/0029 flagged `public.handle_new_user()` — the `AFTER INSERT ON auth.users` trigger that seeds a
profiles row on signup — as executable by `anon` AND `authenticated` via `/rest/v1/rpc/handle_new_user`.
It's a trigger function only (references `NEW`; a direct RPC call would error) with no business in the
exposed API. **Migration `revoke_handle_new_user_api_exposure` (APPLIED to prod):**
`revoke execute on function public.handle_new_user() from anon, authenticated, public;` — recorded in
`site/supabase-accounts.sql`. **Verified:** advisor WARN cleared; only `service_role`/`postgres` retain
EXECUTE; the `auth.users` trigger still fires (signup profile-seeding intact — triggers run as table
owner, need no EXECUTE grant). Client never RPC'd it (only `scout_roster` is RPC'd), so zero client impact.

**❓ Still needs a human (unchanged, can't be done headless):** visual browser click-through in all 3
languages; clicking the 6 external py.pl/Wise buttons to confirm PayPal/Wise destinations + amounts;
`python gen_player_pages.py` parity run (Node mirror produced the committed pages); enable Supabase
leaked-password protection (dashboard); Jesus Delgado's missing fields (position/age/bio/season stats)
added via admin panel from his screenshot. **Pre-existing flag left as-is:** anon `"public can apply"`
INSERT policy on `players` (spam vector) — out of scope, Matt to decide.

### Fix: RLS blocked legitimate player signup + ESM13 universal roster master code (2026-08-04)
Two tasks in one commit.

**(1) Signup RLS bug — "Impossibile salvare il tuo profilo: new row violates row-level
security policy".** A real signup (Jesus Delgado, Venezuela, via /register/ IT flow with
season stats) failed at step-2 "Salva profilo e continua". Root cause: the `public.players`
INSERT policy **"player creates own row"** required `private.is_registered_player()` — a
`public.profiles` row (role='player') visible at insert time. The profiles row is created by
the exception-safe `on_auth_user_created` trigger, but that hard dependency is a race: when
the row isn't present/visible at the exact insert moment, PostgREST rejects with `42501`.
Reproduced exactly (authenticated user, no profile row → 42501).
- **Fix (migration `fix_player_self_insert_rls_race`, APPLIED to prod):** policy WITH CHECK is
  now `owner_id = auth.uid() AND status = 'pending'` — race-free, no profile dependency. Still
  secure: verified legit self-insert (incl. season stats, no profile) SUCCEEDS; wrong-owner
  impersonation BLOCKED (42501); self-approve (status='approved') BLOCKED (42501). Not weaker
  than the pre-existing anon "public can apply" policy.
- **Client hardening (`site/register/index.html`):** photo upload is now non-fatal (a photo
  hiccup no longer loses the whole profile + season stats — logs and saves without image);
  defensive idempotent `ensureProfile()` before the players insert.
- **User recovery:** Jesus's rich step-2 data was lost (only a minimal self-heal row survived,
  id 68, created when Sam later approved him). Restored VERIFIABLE fields into row 68 from the
  screenshot: country Venezuela + 🇻🇪 flag, teams ["Texas Rangers org.","Montpellier"], IG
  @jesus_delgado2020, phone +58 4125810866. **NOT guessed / still missing:** position, age, bio,
  season-stats numbers — Sam should add these from the screenshot via the admin panel (Jesus
  can't re-add via /register/ because his players row now exists → insert is idempotent). His
  account is already `approved` and on the public roster.
- **Flagged:** the anon `"public can apply"` INSERT policy on `players` still lets any anon key
  holder insert `status='pending'` rows (spam vector) — pre-existing, left as-is (out of scope);
  Matt may want to tighten/remove it if no public application path still uses it.

**(2) ESM13 universal master roster code (`site/index.html`).** Added `const
MASTER_ACCESS_CODE = "ESM13"` right below `ROSTER_CODE_HASHES`/`UNLOCK_KEY` (~line 746, clearly
commented — change the string there to rotate). Wired into the existing roster code-gate
(`#gateForm` submit): entering ESM13 unlocks full roster the same as a valid personal code,
checked before the SHA-256 hash so it needs no hash entry. **Case-insensitive** (reuses the
gate's existing `.trim().toUpperCase()`; "ESM13"/"esm13"/" esm13 " all work). Existing per-user
SHA-256 codes unaffected; wrong codes still fail.
- **Scope (ASSUMPTION — confirm with Matt):** ADDITIONAL access door alongside the code-gate,
  scout/coach accounts, and player portal — replaces nothing. Deliberately scoped to the roster
  code-gate ONLY (the one place a "code" concept exists in the UI). Did NOT add an ESM13 bypass
  to /scout/ or /portal/ login — those already have account-based auth and a bypass there is a
  bigger security decision for Matt to confirm separately.
- **Security note:** ESM13 is a static string shipped in client-side JS — anyone reading the
  page source can find it. Acceptable per Sam's "give it to trusted people" convenience intent;
  it's a shortcut, NOT a secret. Rotate the constant (and tell Sam) if it leaks widely.
- Gate copy (EN/ES/IT) reviewed — "enter the code he sends you" etc. is neutral, doesn't imply
  codes are unique/per-user, so no copy changes. Validator (`node validate_i18n.mjs`) green.

### Baseball-Reference "Register" stats system (batting / pitching / fielding)
Full raw-entry stat system replicating baseball-reference.com's Register format. Three
layers, validated each before the next.

**Schema** (`site/supabase-bbref-stats.sql`, migrations `bbref_register_stats`,
`bbref_stats_anon_select_grant`, `bbref_stats_fn_search_path`,
`bbref_batting_ops_full_precision`, `grant_anon_players_id_for_stats_join` — ALL APPLIED to prod):
- 3 tables `player_batting_stats` / `player_pitching_stats` / `player_fielding_stats`.
  PK `id` (bigint identity), FK `player_id → players(id) on delete cascade`, `sort_order`
  (multiple rows per year allowed, e.g. "2 Teams" aggregate + per-team rows).
- Raw columns per the schema spec (batting: g,pa,ab,r,h,doubles,triples,hr,rbi,sb,cs,bb,so,hbp,sh,sf,ibb,gdp
  + year,age,age_dif,tm,lg,lev,aff; pitching: w,l,g,gs,gf,cg,sho,sv,ip,h,r,er,hr,bb,ibb,so,hbp,bk,wp,bf;
  fielding: g,gs,cg,inn,ch,po,a,e,dp,pb,wp,sb,cs,position,lg_cs_pct). `age_dif` and `lg_cs_pct`
  are manual text.
- **Denormalized calc columns** maintained by BEFORE INSERT/UPDATE triggers
  (`private.calc_batting/pitching/fielding`): batting tb,ba,obp,slg,ops; pitching w_l_pct,era,ra9,
  whip,h9,hr9,bb9,so9,so_w; fielding fld_pct,rf9,rf_g,cs_pct. OPS uses FULL-precision OBP+SLG
  (matches bbref, .869 not .870). IP/INN stored in baseball notation (0.2 = 2 outs); rate math
  converts via `private.ip_to_real` (outs = floor*3 + fracDigit, real = outs/3).
- **RLS**: admins (`private.is_esm_admin`) full CRUD; logged-in player reads only own rows
  (`private.owns_stats_player`); anon + authenticated read only APPROVED players' rows
  (`private.stats_player_approved`); anon has SELECT grant only (no writes). Verified live:
  admin JWT insert OK, non-admin insert → 42501, anon insert → 42501, anon sees approved (1)
  not pending (0). Also granted anon `select(id)` on players so public pages map slug→id.
- Math validated live against the sample: AB 82 / H 26 → **BA .317**, OBP .394, SLG .476, OPS .869,
  TB 39; IP 5.2 → ERA 3.18 / WHIP 1.235; totals recompute from summed raw (IP summed via outs).

**Shared module** `site/bbref-stats.js` (`window.BBREF`): column layout (bbref order), calc
(mirrors SQL), "All Levels (N Seasons)" totals (sum raw → recompute), read-only renderer +
injected CSS. Single source of truth for admin editor, homepage modal, static pages.

**Admin UI** (`site/admin/index.html`): 3 add/edit tables per player inside the Edit editor
(lazy-loaded on open). Raw inputs only; BA/ERA/Fld%/totals recompute live on input; totals
row recomputed from summed raw. Save = insert new / update existing (by id) / delete removed
(identity PK so no upsert). Mobile: horizontal scroll, 16px inputs.

**Public display**: homepage player modal (`openModal` → `loadPublicBbref`, needs `id` in the
roster select) + all 17 static player pages (`players/*.html`, bulk-patched: `#ppRegister`
section before `.pp-contact` + a slug-scoped anon Supabase fetch/render, hidden until rows exist).

Commits: `b8cfc16` (schema), `6819254` (shared module + OPS precision), `669d2f1` (admin UI),
+ public-display commit. Stat header abbreviations (AB/OBP/…) intentionally NOT translated;
section labels are EN/ES/IT. Open: old `players.season_stats` jsonb editor + this new register
coexist in admin (didn't remove the legacy one to avoid data loss — flag for Matt).

### Feature/content batch (pre-autonomous)
- **5a59be3** Dropdown restructure (Baseball/Softball Representation, College Placement, Coaching; legacy options commented, i18n kept), tagline rewrite ("from the young", pathways expanded), banner quote (`join_pitch`). EN/ES/IT.
- **f063ac6** Gate Winter League Tenerife gallery behind event click — removed `#media` section + nav link + `renderMedia()`; added `openEventModal()` (reel+gallery inside the shared modal), `media:true` flag, `ev_gallery` keys EN/ES/IT.
- **653a815** Marianna "Contact Her" mailto link (`.founder-contact`, `mz_contact` EN/ES/IT).

### Security / correctness
- **9d5813b** XSS: added `esc()` helper, wrapped all 16 untrusted interpolations (roster, modal, testimonials, events). Narrowed public players `select("*")` → explicit non-PII columns.
- **390107e** DB migration `harden_players_column_grants` (APPLIED to prod): `revoke select on players from anon` + column-scoped `grant select(...)` — anon can no longer read email/phone/age/message (verified 42501). File: `supabase-harden-players-columns.sql`.
- **fa54898** Anti-spam on anon INSERT: off-screen honeypot (`company` field) + 1.5s time-trap → show success UI, skip insert. Dependency-free.
- **b555fc2** DB migration `players_intake_length_caps` (APPLIED to prod): length-cap CHECK constraints (name≤120, email≤254, phone≤40, age≤10, applying_for≤60, bio/message≤5000). File: `supabase-players-constraints.sql`.

### Reliability
- **def3836** Paywall flash bug (Tier 1): `applyLockState()` ran after boot()'s awaits (esm.sh import + Supabase fetch), so unlocked users saw the "$49.99" gate flash on slow networks. Now applied synchronously before boot(). Root cause = lock gated behind network; fixed by decoupling.

### Performance
- **7eee0d5** `sw.js`: added `res.ok` + non-opaque guards to both cache branches (no more caching error/opaque responses); bumped `CACHE` esm-v4 → esm-v5.
- **0bb9049** `logo.png` 220KB → 22KB. Was 727×438 displayed at height:40px; downscaled to 199×120 (3× retina) via PowerShell System.Drawing, alpha + aspect ratio preserved.

### Docs
- **34f75d6** Synced `supabase-schema.sql` with live (added `sport` column + CHECK; refreshed applying_for comment). Doc-only; disproved the audit's "applications failing" scare (sport exists in prod).
- **43926a0** Added this ENGINEERING_LOG.md.

### Content / UX
- **a160ddb** Sam "Contact Him" founder-card button mirroring Marianna's `.founder-contact` pill. Sam→elitesportsmanagement50@gmail.com, Marianna→softball.esm@gmail.com, both with pre-filled subject. `sam_contact` EN/ES/IT. Assumption: kept gendered labels (Contact Her/Him) over literal "Contact Now" to preserve Marianna's prior explicit label.
- **f1b7b04** Footer Instagram: replaced `◎` glyph with inline SVG icon (currentColor, aria-hidden + link aria-label). Link/handle unchanged.

### SEO
- **25b3677** OG + Twitter Card + canonical meta. Base https://elite-sports-management.vercel.app. og:image = /media/photos/twl-champions.jpg (1600x900 placeholder, verified live). English-only by design. Swap in a 1200x630 branded card later (Manual Action).

### Maintainability (Tier 4)
- **e732d6b** Reconciled design tokens across index/admin/portal. Canonical = index: admin --teal #2ec4b6→#3a9aa6 + now declares --teal-soft; portal --red #ff8f8f→#e05d5d. Consolidated admin's duplicate `.msg.ok`.
- **fc79d5c** Removed unused local `sam.jpeg` (48KB; founder photo served from Supabase; unreferenced; in git history).
- **ecb2b28** manifest `id:"/"` for stable install identity. (Screenshots = Manual Action.)
- **0fc1d1c** A11y pass: global `:focus-visible` outline (was only inputs/event-cards); `type="button"` on all non-submit buttons (lang, chips, gallery, modal/install); aria-labels on icon-only controls + lang buttons.

---

## Verified facts (live)
- players table: 17 approved rows, served from DB (embedded array is fallback). `sport` column exists (default Baseball, CHECK Baseball/Softball). **All 17 have `email = NULL`** — they are curated seed athletes, so NONE can currently sign into the player portal (which matches on email). The portal serves *applicants* (form sets email) + any player an admin gives an email. To onboard a seed athlete: admin edits their row to set the email, then that athlete magic-links in.
- Anon PII read now blocked (column grant). Public roster read still 200 with 17 rows, no PII keys. `source` and internal notes are NOT anon-readable.
- Prod serves `site/` at root: `/`, `/logo.png`, `/media/photos/*`, `/icons/*` all 200.
- RLS proven (simulated JWT, session 2026-07-30): athlete sees only own players row + 0 player_notes; update_my_profile only touches whitelisted cols on own row.
- Supabase advisors after this session: SECURITY = 1 INFO (esm_admins no-policy, by design) + 2 WARN (update_my_profile SECURITY DEFINER — intentional self-service pattern; leaked-password protection — dashboard Manual Action). PERFORMANCE = 1 WARN left (multiple_permissive_policies on players SELECT — inherent to admin+athlete both being `authenticated`; accepted, not worth merging).

### Portals + auth (autonomous session 2026-07-30)
- **Homepage Sign In nav** — native `<details class="signin">` dropdown between the language switch and Apply CTA, brand-styled (gold caret, navy popover), links to `/admin/` + `/portal/`. Closes on outside-click / Escape. i18n `nav_signin`/`nav_signin_admin`/`nav_signin_player` EN/ES/IT. (index.html)
- **DB — internal notes** (`supabase-player-notes.sql`, APPLIED as `player_internal_notes`): admin-only `public.player_notes` table (player_id PK → players, notes, updated_at, updated_by). Deliberately a SEPARATE table, not a players column, because "athlete reads own row" would leak a column to that athlete. No anon grants; admin-only RLS. Verified: athlete sees 0 notes.
- **DB — player self-service** (`supabase-player-self-service.sql`, APPLIED as `player_self_edit_rpc` + `player_self_edit_rpc_lockdown` + `athlete_self_photo_upload`): `update_my_profile(p_bio,p_instagram,p_phone,p_age,p_image_url)` SECURITY DEFINER RPC, search_path='', updates ONLY whitelisted cols on the caller's OWN row (matched on JWT email). Revoked from PUBLIC/anon, granted to authenticated. Storage policies let an athlete upload/replace only under `self/<uid>/` in player-photos. Verified via simulated JWT: bio/instagram/age change; name/status/stats untouched.
- **Admin portal** (admin/index.html): added hard **Delete** (confirm dialog, distinct from Archive; cascade removes notes), **Archive**/Restore (`status='archived'`, hidden from public roster by the anon status=approved policy), **internal notes** editor (player_notes, labelled "never shown publicly"), and expanded profile editor to name/position/sport/country/age/instagram/phone + bio/teams (name required; patch-object shape → easy to extend). Notes merged into load().
- **Player portal** (portal/index.html): now self-service — athletes edit own bio/Instagram/phone/age + upload a profile photo via the RPC + `self/<uid>/` storage. Stats/position/status stay read-only/agency-owned.
- **Perf** (`supabase-rls-initplan.sql`, APPLIED as `rls_initplan_optimization`): wrapped `auth.jwt()` / `private.is_esm_admin()` in `(select …)` across players + player_notes policies (lint 0003). Semantics identical, verified RLS still isolates (athlete sees 1 row of 18, 0 notes).

### Production hardening (autonomous session 2026-07-31)
- **Portal verification** — traced auth/route-protection/error/loading paths. Service worker (`sw.js`) reviewed: network-first for HTML means `/admin/` + `/portal/` always get fresh auth pages online (cache is offline-only fallback), skips Range/video, guards on `res.ok`. No SW change needed. Magic-link redirect uses `location.href.split('#')[0]` → works on any host; the redirect-URL allow-list stays a dashboard Manual Action.
- **Mobile header fix** (index.html) — adding Sign In could overflow the header on <~400px (brand+lang+SignIn+Apply). Added `@media(max-width:560px)` + `@media(max-width:380px)` blocks tightening nav spacing/padding so it fits to ~320px. No desktop change.
- **Loading states** — portal shows "Loading your profile…"; admin shows "Loading players…" on first fetch (was momentarily empty).
- **Security sweep** — verified against live prod: anon `players?select=*` → 42501 (denied, `*` includes ungranted PII); explicit PII select → denied; `player_notes` → denied. No secrets in repo (grep clean). `players.json` + generated player pages carry NO player PII (only agency contact); player pages `noindex`. Public roster query uses explicit non-PII columns (index.html:1565). Storage: athletes confined to `self/<uid>/`, admin policies intact.
- **SEO** — added `robots.txt` (allow site; disallow /admin/,/portal/; /players/ left crawlable so noindex is honoured; sitemap ref), `sitemap.xml` (homepage only — player pages noindex by design), and `SportsOrganization` **JSON-LD** on the homepage. OG/Twitter/canonical were already complete.
- **Performance** — added explicit `width`/`height` to both logo `<img>`s (CLS), `fetchpriority=high` on nav logo, `loading=lazy` on footer logo. Confirmed homepage payload is light (logo 22KB; gallery uses thumb/full split + lazy; CSS-gradient backgrounds, no hero image). Full gallery JPEGs (100–340KB) load only behind an event click.
- **Accessibility** — associated every form label with its control (for/id on login + add-player + player self-edit; aria-label on the class-based admin per-player editor); `role=status`/`aria-live` on toast; `role=alert`/`aria-live=assertive` on inline error/success msgs; aria-label on icon-only remove-stat button; type=button on save actions.
- **Deploy verified live**: robots.txt 200, sitemap.xml 200, JSON-LD/logo-dims/mobile-CSS/portal-a11y all present in prod HTML.

### Account registration + manual-approval workflow (autonomous session 2026-07-31)
Two account types (player, scout) with email+password registration, external payment, and admin approval.
- **DB backbone** (`supabase-accounts.sql`, APPLIED as `accounts_profiles_and_scouts` + `scout_roster_revoke_anon`):
  - `profiles` (1 per auth user): role, first/last name, email, account_status (pending/approved/rejected/archived), payment_status (unpaid/submitted/verified). Users create only their OWN pending/unpaid profile; only admins approve/verify. `scouts` table = scout-specific data (owner-managed + admin-read).
  - players: `owner_id` links registered athletes (unique partial index); own-row read now matches owner_id OR email (legacy applicants intact); players insert only their OWN pending row; **scout_roster()** SECURITY DEFINER RPC returns the approved roster WITH contact info to approved scouts only (revoked from anon/public — verified 401). Column grants can't separate scout from player (same `authenticated` role), so the RPC is the boundary.
  - Trigger `sync_player_status`: approving/rejecting/archiving a player ACCOUNT mirrors onto their roster row (one admin action). Helpers `private.is_approved_scout()`, `private.is_registered_player()`.
  - `account_notes` (`supabase-account-notes.sql`, APPLIED as `account_internal_notes`): admin-only internal notes per account (separate table — a notes column on profiles would leak via own-profile read).
  - **Validated with simulated JWTs (rolled back):** no self-approve; pending player isolated to own row; can't insert an approved row; trigger sync works; approved scout sees full roster w/ PII; cross-account isolation (scout A sees only own profile/scout row, 0 account_notes); anon blocked from profiles/scouts/account_notes (401) and scout_roster (401).
- **/register/** — 3-step wizard: account+role (signUp) → role-specific profile (player creates owned pending roster row + optional photo; scout creates scout record) → payment screen with configurable `PAYMENT_URL`. Resumable across the email-confirm path.
- **/portal/** — added email+password sign-in (kept magic-link fallback); `gate()` routes: approved player→profile, pending/rejected/archived→professional status screen, scout account→nudge, legacy applicant→email-matched profile.
- **/scout/** — new scout portal: approved scouts get the elevated roster (contact info) via `scout_roster()`, client-side search; unapproved→status screen.
- **/admin/** — Pending accounts + All accounts sections: type/payment/reg-date/profile/contact, Approve&activate / Reject / Archive, payment-status selector, per-account internal notes.
- **Homepage** — Sign In dropdown now: Create Account / Player Portal / Scout Portal / Admin Portal (i18n EN/ES/IT). Public site client made **session-less** (persistSession:false) so a logged-in user's JWT can't shrink the public roster to their own row.

### Accounts follow-ups (autonomous session 2026-07-31, cont.)
- **Password reset** added to `/portal/` and `/scout/`: "Forgot your password?" → `resetPasswordForEmail(redirectTo=self)`; a "Set a new password" view shown on the `PASSWORD_RECOVERY` event / `#type=recovery` return; a `RECOVERING` guard stops normal routing from skipping the reset form; success → `updateUser({password})` → signed in. (These portals had password login but no recovery path.)
- **Verified email-confirmation is ON in prod** (real signup to a throwaway mailinator address → no session returned, `confirmation_sent_at` set; test user deleted). The register page already handles this (confirm interstitial + resume-on-return via the localStorage stash), so registration works as-is; turning confirm OFF in the dashboard would just make it smoother (see Manual Actions).
- **robots.txt**: also disallow `/scout/` and `/register/` (private app routes).

### Admin self-service + roster filter (session 2026-08-01)
- **Admin change-password** (`admin/index.html`): new "Your account" section at the bottom of the panel — shows "Signed in as <email>" and a "🔑 Change password" toggle (reuses the `.editor` open/close pattern from Add-a-player) with new + confirm password fields. On submit: validates ≥8 chars and that both fields match (client-side, focuses the offending field, no network call on failure), then `SB.auth.updateUser({ password })` on the current session — no email/redirect. Success/error via the existing `.msg ok`/`.msg err` inline pattern + a `toast`. Works for whoever is logged in (Sam/Marianna/Matt); no special permission. "Signed in as" line set in `admitOrReject`. No change to login/logout/route-guard flow. JS parses (node --check). NOT yet clicked-through live (needs a real browser session).
- **Roster sport filter** (`admin/index.html`): "Roster" segmented bar (All / ⚾ Baseball / 🥎 Softball) above the player roster, built from existing `.btn`/`.row-btns` styles (active = `btn-gold`, inactive = `btn-ghost`, `aria-pressed`) — no new visual pattern. In-session `SPORT_FILTER` (default "All", not persisted); `setSportFilter()` toggles button state + re-renders. `render()` filters `PLAYERS` by `(p.sport||"Baseball")` so a null sport counts as Baseball (matches DB default + the edit form). Applies to BOTH player views (Pending applications + All players); empty states say "…in Baseball/Softball". Filter buttons are static HTML bound once at load, so clicking into a player edit doesn't reset the choice (render() re-runs but SPORT_FILTER persists). Scope note: the accounts queues (profiles/scouts) are auth accounts, not the sport-based roster, so they're intentionally unfiltered. Not tied to the logged-in admin. JS parses.

### Mobile / iPhone experience pass (session 2026-08-01)
Verification-first; commits are separate per task. Method note: no headless browser was available in-env, so TASK 3 was a rigorous static responsive-CSS audit (all sections), not pixel emulation.
- **TASK 1 — iOS status-bar overlap (`f7a878f`): NEEDED FIX.** Verified (not assumed): status-bar-style meta is `black-translucent` + `viewport-fit=cover`, and safe-area was applied only to the BOTTOM (install/footer). The sticky `header.nav` had NO top inset → nav rendered under the clock/battery. Added `padding-top:env(safe-area-inset-top,0px)` to `header.nav`. (Public site only — admin/portal/scout headers are in-flow, not sticky/translucent.)
- **TASK 2 — $49.99 roster paywall (`c841dca`): MOSTLY FINE, one hardening.** Verified fine: the prior Italian-iOS fix (`format-detection: telephone=no`, c62e6c9) is still present (line 9) → "$49.99" won't linkify as a tel: in any locale; full i18n parity across EN/ES/IT for all gate keys (147/147, scripted check); the two gates are independently keyed (`esm_roster_unlock_v1`/`ROSTER_CODE_HASHES` vs `esm_profile_unlock_v1`/`PROFILE_CODE_HASHES`, separate DOM/forms — €124.99 gate can't collide); flash fix intact (`applyLockState()` synchronous, pre-boot); admin `source` field never touches the paywall (public roster query doesn't select it). FIXED (likely match for Sam's unconfirmed issue): `wirePayButtons()` ran inside async `boot()`, so on slow iOS a tap on "Unlock — $49.99" during load hit the initial `href="#"` and did nothing. Moved it to run synchronously (hrefs come only from top-level consts). NOTE STILL OPEN: `STRIPE_ROSTER_URL` is empty so the button still falls back to a mailto — payment wiring is Matt's call (unchanged, off-limits per instructions).
- **TASK 3 — general mobile pass (`e527443`): MOSTLY FINE, one fix.** Audited header/nav (incl. Sign In dropdown), hero, stats, roster grid, both gates, event/player modal, footer at iPhone widths. Fine: responsive breakpoints (860/560/380 nav; roster 3→2→1; do-grid 3→2→1; founder/creds stack; form grid2→1; iOS 16px inputs; bottom safe-area on footer/install). FIXED: the bottom-sheet modal (event + player) is flush to the screen bottom on mobile, so its `.sh-body` content sat under the iOS home indicator — added `padding-bottom:calc(34px + env(safe-area-inset-bottom,0px))`. FLAGGED (no change): `.stats-in{grid-template-columns:repeat(2,1fr)!important}` (line ~311) forces the stats band to 2-up at ALL widths, overriding the 3-up rule — appears intentional but the global `!important` is worth Matt confirming.
- **TASK 4 — pull-to-refresh (`ebb06c1`): BUILT (admin + main).** Installed PWAs lose Safari's native pull-to-refresh. Added a self-contained gesture to BOTH `admin/index.html` (priority — stale roster matters) and `index.html`. Arms only in `display-mode:standalone` (or iOS `navigator.standalone`), only when `scrollingElement.scrollTop<=0`; a >70px downward pull shows a gold spinner (injected `#ptr`, `var(--gold)`, safe-area-aware top). On release past threshold: `navigator.serviceWorker.getRegistration().update()` (pull a new sw.js if deployed — the SW already self-activates via skipWaiting+clients.claim) THEN `location.reload()` → re-runs the app → re-fetches Supabase (network-first) = genuinely fresh data, not cosmetic. Passive touch listeners (no `preventDefault`) so normal scrolling is never blocked; whole thing is a no-op in a browser tab. Both files node --check clean. NOT yet clicked-through on a real installed PWA (needs a device).

### PHASE 1 — Profile-creation account flow (€124.99) — REFERENCE PATTERN (session 2026-08-01)
The €124.99 profile flow is the TEMPLATE to be replicated to the $49.99 roster (Phase 2) and €559.99 Tenerife (Phase 2). Built on the EXISTING account system (`/register/` + profiles/scouts + approval), NOT new auth. Phase 0 finding: the prompt assumed auth needed building — it was ~70% done; this phase extended it.

**The reference pattern (how a paid, approved, self-managed flow works end-to-end):**
1. `/register/` wizard: `SB.auth.signUp` (email+password) → `profiles` row (role, pending/unpaid) → role-specific record (`players` owned pending row for athletes / `scouts` row) → **payment step** (off-site Wise link) → close. RLS: user creates only their OWN pending/unpaid rows; nobody self-approves.
2. Admin approves in `/admin/` (existing "Pending accounts" queue → `setAccountStatus('approved')`). Trigger `sync_player_status` flips the owned roster row to approved → it goes live on the public roster.
3. Player signs in at `/portal/` (same email+password) → sees own profile, edits the whitelisted subset via `update_my_profile` RPC. Stats are agency-owned after submission (edited by admin in Phase 3).
Payment is role-keyed (`PAY` object in register) so roster/Tenerife drop in without reworking the step. Notification is a single named stub (`notifyNewSubmission`) at each submission site.

**Changes this phase (commit → last, newest first):**
- **`log`** (this entry).
- **Email stub** (`register`): `notifyNewSubmission(type,payload)` no-op called after player-profile + scout submits. Phase 6 should wire a Supabase Edge Function fired by a DB insert trigger (server-side, tab-close-proof) + Resend. Routing documented for Phase 6: player/profile+scout+Tenerife→Sam, softball apps→Marianna.
- **Render season_stats** (`index` modal + `portal`, read-only): shared `seasonStatsHTML()` — batting/pitching/fielding tables; derived AVG/OBP/SLG · ERA/WHIP · Fld% computed on render, never stored. `modal_season_stats` i18n EN/ES/IT. Added `season_stats` to the public `boot()` select. (Duplicated the pure render fn into both files — no-build, no shared include; identical shape.)
- **Homepage** (`index`): retired the SHA-256 €124.99 gate. `#profile` is now a marketing card (service bullets + "3 years + 1 year free") linking to `/register/`. Removed `PROFILE_CODE_HASHES`/`PROFILE_UNLOCK_KEY`/`PAYPAL_PROFILE_URL` + `isProfileUnlocked`/`applyProfileState`/`unlockProfile`/`profileForm` + `profilePayBtn` wiring. `#join` apps now always `source:'application'`. `pg_*` copy rewritten EN/ES/IT (parity verified). NOTE: the admin "💳 Paid profile" badge keys off `source==='profile-gate'` which nothing sets anymore — harmless, left in place (registration uses `source:'registration'`, shown in the Accounts queue).
- **Register** (`register`): step2player gained a batting/pitching/fielding **season-stats builder** → `players.season_stats`. Payment is now role-keyed `PAY` object; player = Wise €124.99 (`https://wise.com/pay/r/NKJf01HKt8PuX2s`) + service summary + "3 years + 1 year free". Scout still the old PayPal.me placeholder (Phase 2 → Wise `Zhxkm7xyYL04RjA`). Service copy is a placeholder draft — **Sam to finalize**.
- **DB** (`supabase-season-stats.sql`, APPLIED to prod as `players_season_stats_column`): `players.season_stats jsonb default '[]'` + `grant select(season_stats) to anon`. Separate from legacy `stats` ({label,value} highlights). RLS verified live via simulated JWTs (rolled back): anon reads season_stats on approved rows only + no PII (phone 42501); owner sees only own row, never another account's.

**Validation:** all four HTML files `node --check` clean; EN/ES/IT parity verified (scripted); RLS verified server-side via MCP. NOT yet clicked-through end-to-end on a real browser (signup→profile+stats→Wise→approve→portal render needs a human — password login + storage upload can't be driven headless). Project `sbexwyvsgqayxrsrlrpm` ACTIVE_HEALTHY.

**Open for Sam / next:** (1) finalize the €124.99 service-description copy (placeholder). (2) Dashboard: allowlist redirect URLs + keep "Confirm email" per accounts-workflow notes. (3) Phase 2 (roster $49.99 + Tenerife €559.99) only after Sam reviews Phase 1. (4) STOP&ASK C/D/E still open (bank info; Tenerife gallery "take away picture"; folder UX) — those Phase-5 items skipped.

### PHASE 7 — public roster filter-tab layout bug (session 2026-08-01) — FIXED (`211f208`)
Root cause (not a symptom patch): the paywall gate is `position:absolute;inset:0` inside `.roster-wrap`, so it takes the wrap's height. A sport/position filter matching FEW or ZERO athletes shrank the blurred `.roster` (and thus the wrap) below the gate card's own height, so the gate spilled over the sections above/below — only visible in the LOCKED state (hence distinct from the admin filter, which has no overlay). Fix: `.roster-wrap.is-locked{min-height:540px}` reserves room for the overlay regardless of match count. Also added a graceful empty-state (`.roster-empty` + `roster_empty` EN/ES/IT) for zero-match filters (useful once unlocked). One-line root fix + UX nicety; parity + parse verified.

### PHASE 4 — Collaborators/Staff section (session 2026-08-01) — DONE (`<next commit>`)
- Moved Marianna's card OUT of `#who` (which is now Sam only) into a NEW `#collab` section (same card markup, no rebuild; dropped its `margin-top:22px`). Section header uses new `collab_kicker`/`collab_h2`.
- Added a nav item `#collab` ("Collaborators") between "Who I Am" and "College" in `.nav-links`; new `nav_collab` key. All three keys EN/ES/IT (parity verified). Nav-links are desktop-only (existing `@media(max-width:860px)` hides them on mobile — Marianna's section is still reachable by scrolling, same as every other section).
- Verified: exactly one `#who`, one `#collab`, one Marianna card, one `specialistPhoto`; no JS references the moved node (both founder/specialist photos are static bg-image divs). No orphaned refs.

### PHASE 3 — Admin stats editing UI (session 2026-08-01) — DONE (`<next commit>`)
- **Season-stats editor** in `admin/index.html` player editor: batting/pitching/fielding blocks (raw totals only), pre-filled from `players.season_stats`, add/remove per block, **live auto-computed derived line** (AVG/OBP/SLG · ERA/WHIP · Fld%) that recomputes on input — derived values are never entered/editable (Phase-3 requirement). Save writes `players.season_stats`. Reuses the exact shape/formulas of the register builder + public `seasonStatsHTML()` (duplicated pure helpers per file — no-build). Delegated input/click listeners on `#season-<id>` cover pre-rendered + newly-added blocks. Legacy `{label,value}` "Stats" relabeled "Career highlights" to distinguish from the new "Season stats".
- **Full edit access regardless of source (sub-task 2):** verified via `pg_policies` that `players` has a single row-level `admin update players` UPDATE policy (`is_esm_admin()`), NOT column-restricted — so an admin edits ANY player row (legacy seed / admin-added / self-created) and ANY column incl. season_stats. The existing admin editor already covers profile/photo/legacy-stats; season_stats now joins it.
- **RLS verified server-side (rolled back):** simulated an admin JWT (email from `private.esm_admins`) → `is_esm_admin()=true`, `UPDATE players.season_stats` affected 1 row, then rolled back (player 1 season_stats back to `[]`). No migration needed — season_stats is an existing column under existing policies.
- **Sub-task 3 (Tenerife registrant admin section):** N/A yet — belongs to Phase 2, which is GATED on Sam's Phase-1 review. Deferred with the rest of Phase 2.
- Admin JS `node --check` clean.

### PHASE 5 — Pricing & content copy (session 2026-08-01) — DONE (items 1–7,9; D+E blocked)
Commits `9c93dbf` → `e2ea38e`, each atomic. All copy EN/ES/IT (parity verified each commit).
- **Item 1** — Representation card: `€500 / 6 months` price + bullets (progress tracking, personalized training, nutrition, WhatsApp support). New `.do-price`/`.do-bul`; keys `svc5_per`/`svc5_b1..4`.
- **Item 2** — College: removed the price element entirely; reframed as consulting → `col_cta_p` "get connected and set up an evaluation", `col_cta_btn` "Get connected →". (€3,000 was never displayed; it already said "Pricing on request".) Still routes to `#join` (→ Phase 6 email).
- **Item 3** — Hero reworked to action/agency: `hero_h1` = "We get baseball and softball athletes **seen, signed and developed**."; `band_p` echoes "get seen/signed/developed" (consistent, not identical). **DISCREPANCY:** the referenced quote "Train Like an Athlete. Play Like a Pro." was NOT in the code — reworked the actual hero/band instead; old copy in git if Sam prefers a revert.
- **Item 4** — roster headline `roster_h2` → "A growing family of baseball players from around the world".
- **Item 5** — "See all testimonials": José stays featured on the grid; a button opens a modal (`openTestiModal`) listing the full set. Extra testimonials fetched from the `testimonials` CMS table in `boot()` (anon read verified; they're generic placeholders — Sam should curate). Button hidden when no extras. `testi_seeall`/`testi_all_h`.
- **Item 6** — country flags for all players: `flagFor(p)` = stored flag → country-derived (`FLAGS`) → globe, used in roster card + modal; register now stores `flag` from country at signup so new players get one.
- **Item 7** — country-code phone input: dial-code `<select>` (curated to ESM's Caribbean/LatAm/Europe/US markets) + number, combined to "+39 340…" via `combinePhone()`, on `#join` (index) + player/scout registration. No library. Phone fields pulled to full width.
- **Item 9** — CeasAI footer cross-promo (`938f2dd`, finalized): logo + "Website built by CeasAI — Create your own site like this →" strip, linking to **https://protiqai.com** (new tab). `ceasai-logo.jpeg` optimized 1024×1024 ~1MB → 160×160 ~8.8KB (System.Drawing, quality 88), stored at `site/` like `marianna.jpeg`; displayed 34×34 with explicit dims (no CLS). `ceasai_cta` EN/ES/IT. index.html only (portal/register/scout/admin don't share the footer).
- **Items 8 (Tenerife gallery rename) + D/E (STOP&ASK) — SKIPPED** (blocked pending Sam's answers on the gallery "folder" UX and "take away picture").
- Validation: index + register `node --check` clean each commit; EN/ES/IT parity scripted; testimonials anon-read verified via MCP. Not clicked-through live (forms/phone need a browser).

### PHASE 6 — Email notifications (session 2026-08-01) — BUILT + DEPLOYED (activation is manual)
Server-side, provider-agnostic (reacts to the submission row, not to how payment was taken — survives a Wise→Stripe switch).
- **Edge Function `notify`** (`site/supabase/functions/notify/index.ts`) — DEPLOYED to prod (version 1, `verify_jwt=false`, does its own shared-secret auth). Routes: `players` INSERT `source='application'` → Softball(sport or applying_for)→Marianna, College/Baseball/else→Sam; `profiles` INSERT (player/scout registration)→Sam. Sends via Resend. **Closed by default:** returns 503 until `NOTIFY_SECRET` is set (verified live: POST → 503); then requires `x-notify-secret`; no-ops (logs) until `RESEND_API_KEY` is set.
- **DB triggers** (`supabase-notify.sql`, APPLIED as `notify_submission_triggers`): enabled `pg_net` (0.20.3); `private.notify_submission()` (SECURITY DEFINER, search_path='') async-POSTs the new row via `net.http_post` with the secret header. Triggers `trg_notify_player`/`trg_notify_profile` AFTER INSERT. **Non-blocking + exception-safe + INERT until `app.notify_url` is set** — verified: pg_net present, both triggers present, notify_url unset, a test insert succeeded untouched (rolled back). players `source='registration'/'admin'` are skipped (profiles covers registrations; admin adds don't email).
- **Client stub removed** from `register/index.html` (the `notifyNewSubmission` no-op) — superseded by the DB trigger (a closed tab can't skip a trigger).
- **MANUAL ACTIVATION (Sam/Matt)** — full steps in `supabase-notify.sql` header: (1) Resend account + **verified sending domain** + API key (Gmail delivery needs a verified domain; onboarding@resend.dev only reaches the Resend owner). (2) Set function secrets `RESEND_API_KEY`, `NOTIFY_SECRET`, `NOTIFY_FROM` (dashboard/CLI — no MCP tool for function secrets). (3) `alter database postgres set app.notify_url=…` + `app.notify_secret=<same NOTIFY_SECRET>`. (4) Submit a test application. Disable anytime with `alter database postgres reset app.notify_url`.
- Tenerife notifications (Phase 2) will ride the existing profiles path → Sam once that flow exists.

### PHASE 2 — Roster $49.99 + Tenerife €559.99 (session 2026-08-01) — DONE + validated
Replicated the Phase 1 pattern (account/registration → external Wise payment → admin approval), provider-agnostic.
- **Roster $49.99** (`5de71d4`): removed the homepage SHA-256 blur gate entirely (HTML gate + `.is-locked` blur CSS + all JS: `isUnlocked`/`sha256Hex`/`applyLockState`/`unlockRoster`/`gateForm` + `ROSTER_CODE_HASHES`/`UNLOCK_KEY`/`STRIPE_ROSTER_URL`). Public roster is now OPEN (names/positions, still no PII). Added a coaches/teams CTA below it → `/register/` (full contact access = the scout account flow → `/scout/`, `scout_roster()` RPC). Scout registration payment → **Wise $49.99** (`Zhxkm7xyYL04RjA`) + roster service summary + "1 year + 1 year free". Copy: "coach or team" (was scouts & teams). Dead `gate_*` i18n keys left inert (unused).
- **Tenerife €559.99 DB** (`02b71ad`, `supabase-tenerife.sql`, APPLIED as `tenerife_registrations`): one-time event signup, NO login account (unlike player/scout). Table + RLS: anon/authenticated INSERT pending+unpaid only, admin read/manage. **RLS verified two ways** — simulated roles (rolled back) AND a LIVE anon REST test: pending insert→201, approved insert→401 (blocked), anon read→42501 (denied); test rows deleted. Notify: extended `notify_submission()` + `trg_notify_tenerife` → Sam; redeployed the notify Edge Function (v2) with the Tenerife branch.
- **Tenerife page** (`113a27b`, `/tenerife/index.html`): standalone anon form (name/email/phone[country-code]/country/sport/position/notes) → insert-only (return=minimal) → Wise €559.99 (`f9KLiw__7mOkDTI`) payment step. noindex; robots disallow.
- **Tenerife admin + entry** (`6ea8d21`): admin "Tenerife registrants" section (confirm spot / reject / archive, payment selector, pending count). Winter League event modal "Register" → `/tenerife/` (new event `reg_url` field; email fallback for other events).
- All pages `node --check` clean; advisors clean (no new issues). Not clicked-through in a browser (forms need a real session), but the anon insert path is LIVE-verified.

### STOP & ASK C / D / E — BLOCKED pending Matt (do NOT re-ask; skip these sub-items)
- **C. Bank info** — "add Samuele's bank info": purpose + location unclear. Wise links already route payment. NOT added (won't put banking details on the site without knowing why/where). Awaiting Matt.
- **D. "Take away picture from the photos"** (Tenerife gallery) — ambiguous (remove which photo? the reel? a placeholder?). Gallery untouched. Awaiting Matt.
- **E. Gallery "folder" UX** ("Tenerife 2025 Edition") — intended interaction unclear (folder grid? accordion? separate page?). Not built. Awaiting Matt.
These are the only outstanding master-prompt items; everything else is complete.

### Fresh self-audit pass (session 2026-08-01, post-Phase-2)
Priority order: security > correctness > reliability > a11y > perf > SEO > UX > maintainability.
- **CORRECTNESS (fixed, `a774125`):** the 17 generated player pages had a head redirect `if(esm_roster_unlock_v1!=='1') location.replace('#roster')`. Phase 2 removed the roster gate so that key is never set → every player page bounced away (unreachable). Removed the redirect from all 17 → they load openly. **Follow-up:** `gen_player_pages.py` still emits it (+ dead roster-gate CSS) — update the generator (needs Python, unavailable here).
- **SECURITY (verified, no change):** advisors clean of NEW issues (only the accepted esm_admins-INFO, scout_roster/update_my_profile SECURITY-DEFINER WARNs, leaked-password dashboard WARN). Now that the roster + player pages are open: confirmed the public `boot()` select carries no PII, anon column grants still block PII, and the 17 player pages expose ONLY agency contact (no athlete email/phone/IG). `tenerife_registrations` RLS re-verified live (anon insert 201 / approved 401 / read 42501).
- **PERFORMANCE (fixed, `058c3b8`):** scoped the `register tenerife` policy to `anon` only (the form inserts as anon), clearing the new `multiple_permissive_policies` lint on tenerife INSERT.
- **Full sweep:** all 6 app pages `node --check` clean; EN/ES/IT parity intact; all internal link targets exist.
- **Known-minor / deferred (logged, not changed — low value vs. churn/risk):** dead `gate_*` i18n keys + a few dead gate-only CSS rules on index (kept `.gate-in/.gate-lock/.gate-price` — shared with the #profile card); player-page dead CSS + noindex (both need the Python generator to change cleanly; noindex→index is also a visibility decision for Sam).

## In progress
- Phase 1 (profile-creation flow) built + validated; awaiting Sam's live click-through review before Phase 2. Phases 3, 4, 7 done. STOP&ASK C/D/E open. Remaining roadmap: Phase 2 (roster/Tenerife — GATED on Sam's Phase-1 review; includes the Tenerife admin section), Phase 5 (pricing/copy incl. form-field reduction B), Phase 6 (email notifications).

### Tier 5 content + priority interrupts
- **74f0b71** Nav reorder: What We Do, Who I Am, College, Roster, Events, Join. (No Media item — already removed in f063ac6.)
- **0f9ae5c** Merged Indy Ball + Winter League → "Professional Leagues" card (svc_pro, EN/ES/IT). Old svc2/svc6 keys kept unused for revert.
- **23af1bb** "Specialized Personalized Training" highlight (.do-hl) in Representation card (svc5_hl_*, EN/ES/IT).
- **04e3489** Fixed Sam's bio (who_bio2): removed Dubai/South America/Asia → "North America and Australia". EN/ES/IT.
- **f7b9710** Added 3 cred chips to Sam's card: Hastings College · All-GPAC Honorable Mention; College of the Desert · 3 HR in One Game; ECC College · Region 16 Champions (cred_hastings/cred_cod/cred_ecc, EN/ES/IT).
- **a8a4c8a** €124.99 profile-creation gate (#profile section) — 2nd independent instance of the roster paywall. Own key `esm_profile_unlock_v1`, own hash. Code: ESM-PROFILE-2026. PayPal instructions (brunosamuele56@gmail.com) + PayPal _xclick pay button. Unlock → CTA to #join. pg_* keys EN/ES/IT. FLAG: separate section, does NOT hard-block the open #join form.
- **31b5fb2** Removed redundant standalone Europe card (svc3) — now covered by Professional Leagues. 5 cards in "What We Do".

### Admin portal (Tier 1)
- **9d3d926** Fixed Marianna's admin access — `softball.esm@gmail.com` was in DB `esm_admins` but missing from client `ADMIN_EMAILS`, so she got signed out on login. Added her. Built "Add Player" admin form (name/position/sport/country/bio + photo → insert status='approved'). Verified live: both accounts confirmed in auth.users, all 4 admins in esm_admins, insert shape valid against schema. Roster-view / bio-edit / photo-upload already worked (no change).

### Finding to report (no change made — awaiting Matt)
- **$49.99 roster gate payment method**: `STRIPE_ROSTER_URL` is EMPTY (index.html), so `wirePayButtons` falls the "Unlock the roster — $49.99" button back to `FALLBACK_EMAIL` (mailto:elitesportsmanagement50@gmail.com). So it is NOT wired to a working Stripe link — it just opens an email. Not changed per instruction; Matt to decide (Stripe link vs PayPal like the €124.99 gate).

## Deferred (with reason — do NOT redo blindly)
- **Strip dead CSS from 17 generated player pages** — DEFERRED. Python is unavailable in this env, so `gen_player_pages.py` (the source of truth) can't be run to regenerate safely. Trimming the 17 files by hand or porting the generator to Node risks generator↔output drift and unverifiable layout regressions. Low impact (pages are noindex + paywalled, only 17). Recommended fix: update `gen_player_pages.py` to inline a curated BASE_CSS (root vars, base reset, fonts, `.wrap/.display/.bg-fx`, nav+brand+logo+nav-cta, `.btn/.btn-gold`, footer/`.foot`/`.pill`/`.muted` + their media queries) instead of the whole index `<style>`, then `python gen_player_pages.py`. Used classes on a player page: bg-fx, nav*, brand, logo-img, wrap, display, nav-cta, btn(-gold), foot*, pill, muted, pp-*.
- **Extract shared Supabase client + esc/$/initials into one file** — DEFERRED. Touches 3 working apps incl. admin/portal auth; can't manually test the admin magic-link/password login unattended, so regression risk > the DRY gain. A no-build `<script src>` include is viable when it can be interactively verified.

## Pending (roadmap)
- Tier 4 done except the two Deferred items above.
- Tier 5: ONLY remaining item = admin "Add Player" direct flow (investigate admin/index.html; build minimal add-player writing status='approved' if absent). Everything else in Tier 5 done.
- Then: fresh full-repo audit pass (security > correctness > reliability > a11y > perf > SEO > UX > maintainability).

## Manual actions required (external blockers)
- Enable Supabase Auth leaked-password protection (dashboard-only).
- Provide a proper 1200×630 branded social share image (placeholder hero used).
- BLOCKED per instructions: push notifications, email routing (Resend/EmailJS), softball copy finalization, real player stats, DNS/payment/pricing.

## Notes / assumptions
- marianna.jpeg (829×1456, 81KB) left as-is: displayed downscaled (already sharp), below-fold, and the crop (`background-position:54% 27%`) was deliberately tuned in 2a1f6d4 — pre-crop risked regression for little gain.
- Push access for ceasaipro-art confirmed working (all commits pushed to origin/main).

---

# NEXT SESSION

**Current state:** Repository is deployable, pushed to `origin/main`, and verified live in prod. The full **account registration + manual-approval workflow** (players + scouts) is complete on top of the earlier portals + production-hardening work. Nothing is half-built. All 4 new pages return 200 live. `git status` clean/ahead-0 after the final log commit.

**Completed — session 2026-07-30:** Sign In nav; player_notes + update_my_profile RPC + athlete photo storage; admin delete/archive/notes/expanded-edit; player self-service; RLS init-plan opt.
**Completed — session 2026-07-31 (hardening):** portal verification; mobile header fix + loading states; security sweep; SEO (robots/sitemap/JSON-LD); perf (logo dims); a11y (labels + live regions).
**Completed — session 2026-07-31 (accounts workflow):** profiles+scouts+account_notes tables & RLS; scout_roster RPC; approval trigger; `/register/` wizard; `/portal/` password+status; `/scout/` portal; admin accounts queue; nav wiring; session-less public client. (See the "Account registration + manual-approval workflow" section above for detail.)

**Commits (accounts workflow), newest last:** `DB accounts backbone` → `/register/ wizard` → `portal password+gate` → `scout portal` → `admin accounts queue` → `nav + session-less client`. Latest pushed: 2ad32a3 (before scout_roster anon-revoke + this log commit). Run `git log --oneline -12` for hashes.

**Validation performed (DB, via simulated JWTs, rolled back):** no self-approve; pending isolation to own row; approved-scout elevated roster; trigger sync; cross-account isolation; anon 401 on profiles/scouts/account_notes/scout_roster. JS syntax-checked all pages (node --check). Live: register/scout/portal/admin all 200; nav + session-less client present.

**Exact next task (highest priority first):**
1. **Manual browser smoke test of the whole flow** (can't be driven headless — password/magic login + storage upload). (a) Register a Player → complete profile → payment screen; register a Scout. (b) As admin (mattswagj@gmail.com) open /admin/ → Pending accounts → set payment=verified → Approve; confirm the player's roster row flips to approved (trigger) and an internal note saves. (c) Sign in at /portal/ as the player (pending first → status screen; after approval → profile + edit). (d) Sign in at /scout/ as the approved scout → confirm the elevated roster with contact info; a pending scout sees the status screen.
2. **Maintainability** (long-standing Deferred, need interactive verify): player-page dead-CSS trim via `gen_player_pages.py`; shared-Supabase-client extraction across the now-5 apps.
3. Optional: submit sitemap to Search Console; branded OG image.

**Files to open first:** `ENGINEERING_LOG.md`; `site/register/index.html`, `site/scout/index.html`, `site/portal/index.html`, `site/admin/index.html`; `site/supabase-accounts.sql` (schema/RLS reference); `site/index.html` (nav ~line 397, i18n ~line 747).

**Remaining risks:**
- Whole account flow not yet clicked-through live end-to-end (task #1). DB/RLS proven, JS parses, pages 200 — but signUp→profile→approve→login→scout-roster happy path is unverified by a human.
- `scout_roster` / `update_my_profile` are intentionally SECURITY DEFINER + authenticated-executable (advisor WARNs are expected/reviewed — the functions enforce their own row/role boundaries).
- Seed athletes (17) still have `email = NULL` and no owner_id → not tied to any account (unchanged; they're admin-managed roster entries).

**Manual actions required (external / dashboard-only):**
- **Supabase Auth → "Confirm email" is currently ON (verified 2026-07-31).** Registration works either way (the register page shows a confirm interstitial and resumes from the localStorage stash when the user returns via the email link). For the smoothest flow (signUp returns a session → profile created immediately, no email round-trip before payment), turn email confirmation OFF — payment + admin approval is the real gate. Password reset + magic-link also depend on redirect URLs being allowlisted (below).
- **Supabase Auth → Redirect URLs**: include `https://elite-sports-management.vercel.app/` and the `/admin/ /portal/ /scout/ /register/` paths (magic-link + email-confirm redirects).
- **Set the real payment link**: `PAYMENT_URL` at the top of `site/register/index.html` (currently a PayPal.me placeholder). Payment stays entirely off-site.
- Enable Supabase Auth leaked-password protection (dashboard).
- Provide a real 1200×630 branded OG share image (placeholder team photo in use).
- Supabase free tier PAUSES when idle — restore project `sbexwyvsgqayxrsrlrpm` if the site/portal "won't load".

---

## Session 2026-08-03 — scout full roster + site-wide trilingual retrofit

**Part 1 — Scout portal (`/scout/`) approved vs pending, full read-only detail.**
- Approved scouts now see the FULL admin-equivalent roster read-only: photo, name/position/country/sport, contact (email/phone/IG/age), bio, career-highlight pills, teams, AND the full **Baseball-Reference career register (batting/pitching/fielding)** — rendered with the shared `window.BBREF.renderAll()` (same renderer as the admin panel + public profile pages, `bbref-stats.js`), NOT a re-implemented table. Stats are fetched in bulk from `player_batting/pitching/fielding_stats` and grouped by `player_id`; no admin-only content (internal notes / edit controls) is ever rendered.
- Pending scouts get payment instructions (€49.99 PayPal py.pl + Wise) + a "make sure you've paid" message + a clickable `mailto:elitesportsmanagement50@gmail.com`. Never a dead-end.
- **RLS (DB-enforced, verified live):** roster/contact comes only via `public.scout_roster()` (SETOF players, `SECURITY DEFINER`), gated by `private.is_approved_scout()` = `exists(profiles where id=auth.uid() and role='scout' and account_status='approved')`. Test (throwaway scout, cleaned up): UNAPPROVED → `scout_roster()` returns `[]`; after approval → 18 players with contact. BBREF stat tables are public for approved players by design (same data the public profile pages show), so surfacing them to scouts adds no new exposure.

**Part 2 — Full-site EN/ES/IT trilingual audit + retrofit.** Established pattern (from `index.html`/`portal/`): `DICT{en,es,it}` + `t()` + `applyStatic()` for `[data-i18n]`/`[data-i18n-html]`/`[data-i18n-ph]` + `#langsw` switcher + `esm_lang` localStorage (shared across all pages; homepage writes it too).

| Page | Final i18n state |
|------|------------------|
| `index.html` | ✅ already trilingual (151 keys) |
| `portal/` (player) | ✅ already trilingual |
| `scout/` | ✅ **retrofitted this session** (25 keys) |
| `tenerife/` | ✅ **retrofitted this session** (36 keys) + fixed missing `.btn-ghost` CSS (Wise button was unstyled) |
| `register/` | ✅ **retrofitted this session** (70 keys; PAY copy moved to per-role i18n keys; season-stats builder + all JS messages translated) |
| `admin/` | ⬜ **intentionally EN-only** — internal staff tool (Sam/Marianna/Matt), not customer-facing. Out of scope. |
| `players/*.html` (17) | ⬜ **remaining** — public profile pages have vestigial `.lang` CSS but no functional i18n. Bulk content (bios/stats) is English data entered by Sam (not auto-translatable); only chrome (nav/section headings) is translatable, which requires editing `gen_player_pages.py` and regenerating all 17. Recommended as a follow-up. |

**Universal strings left untranslated on purpose:** baseball stat abbreviations (G/AB/H/HR/AVG/OBP/SLG/ERA/WHIP…) and the `Baseball`/`Softball` `<option>` values (they are DB `sport` field values feeding FLAGS/roster consistency).

**Commits (newest last):** `4357fae` scout roster+trilingual → `3536329` tenerife trilingual+btn-ghost fix → `fed225e` register trilingual. (Also earlier this day: signup-robustness trigger + self-heal, read-only portal owner_id fix, py.pl↔Wise dual payment buttons — see git log.)

**Validation:** every module script syntax-checked via `new Function()` (register done by hand + re-checked here); scout approved/pending RLS proven live against the API with a throwaway account (deleted); all 5 apps carry `#langsw` + `esm_lang`. **Not done headless:** actual browser click-through of every page in all 3 languages (login/session/storage can't be driven headless) — recommend a manual pass.

**Remaining i18n follow-up:** `players/*.html` chrome via `gen_player_pages.py` (the long-standing "player-page generator" maintenance item — now also the i18n gap).

---

## Session 2026-08-03 (cont.) — autonomous QA sweep (Parts 1–3)

**Part 1 — Player pages (`players/*.html`) trilingual chrome. CLOSED.** Edited `gen_player_pages.py` to inject the site i18n system (DICT/t()/applyStatic/#lang switcher, shared `esm_lang`) with `data-i18n`/`data-i18n-tpl` on chrome only (nav, headings, meta labels, back link, contact block, footer). Athlete content (bios, team names, stats) left as-entered. The build env had **no Python** (Windows Store stub only), so a byte-identical Node port `gen_player_pages.mjs` was written and used to regenerate all 17 pages (`node gen_player_pages.mjs`). Both generators are kept in sync (same LANG_SWITCH + I18N_SCRIPT + template). Validated: all 17 pages' scripts parse, switcher present, all keys resolve EN/ES/IT, and **bio/team/stat data is byte-identical to players.json** (0 data-integrity problems). ⚠️ `gen_player_pages.py` itself could not be executed here (no Python) — its edits mirror the Node version but a **Python parity run should be confirmed by a human** when Python is available.

**Part 2 — Automated validation pass. ALL GREEN.** Added a reusable headless validator `site/validate_i18n.mjs` (run `node validate_i18n.mjs`; exit 1 on any hard problem). Results across index/portal/scout/register/tenerife/player pages:
- **Scripts parse:** every `<script>` block parses (module imports stubbed). 0 errors.
- **i18n resolution:** every `data-i18n*` key used resolves in EN/ES/IT with full key parity; **0 missing keys, 0 key-name fallbacks**. (index 203 keys, register 91, portal 71, scout 50, tenerife 33, player 20.)
- **Hardcoded English:** none genuine (the one heuristic hit — a "Scout sign in" `<a>` — is covered by its parent `data-i18n-html="r_already"`, translated in all 3 langs).
- **Text-length overflow:** 7 advisory flags, ALL section headings/kickers/messages (e.g. "Career stats" → "Estadísticas de carrera") that wrap gracefully — none are tight buttons. Low risk; a mobile glance is optional, not required.
- **RLS re-verify (direct anon API calls):** `scout_roster`, `profiles`, `scouts`, `account_notes`, `player_notes`, `tenerife_registrations` → all `42501 permission denied` for anon. `players` → anon reads only public columns of approved players (18 rows); **anon cannot select `email`/PII columns at all** (column-level grant). Contact info reachable only via `scout_roster()` for approved scouts. Authed side re-confirmed earlier this session (unapproved scout → `[]`, player reads only own row). **All unauthorized read paths blocked.**

**Part 3 — General QA sweep + fix-as-you-go. CLOSED.**
- **Payment links/prices audit (code):** all three flows carry the correct py.pl + Wise pair and price — roster/scout €49.99 (`py.pl/GJ510klc…` + `wise…/Zhxkm…`), profile €129.99 (`py.pl/zN5Dh…` + `wise…/NKJf…`), Tenerife €599.99 (`py.pl/vb5Fr…` + `wise…/f9KLiw…`). Matches this log's documented values. Both buttons present on every surface (roster gate, register pay step, tenerife, portal & scout pending reminders).
- **Old-copy sweep:** `access code` → **0**; old prices `€124.99`/`€559.99` → **0**; old durations `3 years`/`4 years total` → **0**. **Fixed:** stale `$49.99` in code comments (index.html ×6, and — via the shared CSS comment — all 17 player pages); regenerated the player pages so they're now `€49.99`. **0** `$NN.NN` remain site-wide. Note: `unlock-code` survives only in internal comments as the accurate name for the SHA-256 roster gate — user-facing copy correctly says "code" (not "unlock/access code").
- **Admin stat editing verified intact** (parses; `battingCalc`/`derivedInner` auto-calc, season-stats save, BBREF register editor, `admin-reset-user-password`, contact-email edit all present).
- **Portal/scout states** confirmed rendering (scripts parse + earlier live approved/pending tests).

### FINAL STATE — what's closed vs. what needs a human in a browser
**Fully closed (verified headless):** player-page trilingual chrome (17 pages regenerated + generator edited); i18n key resolution EN/ES/IT across all pages (0 missing, 0 fallbacks, via `node validate_i18n.mjs`); RLS on all read paths (anon + authed); payment links/prices; old-copy sweep; admin/portal/scout script integrity.

**Needs a human (can't be done headless — flag before calling 100% done):**
1. **`gen_player_pages.py` Python parity** — the build env had no Python, so the runnable **Node mirror `gen_player_pages.mjs`** produced the committed pages. The `.py` edits mirror it but were not executed. Run `python gen_player_pages.py` once Python is available and confirm `git diff` on `players/*.html` is empty.
2. **Visual browser pass in all 3 languages** — headless checks can't see layout. Low-risk advisory: 7 ES/IT strings are longer than EN but all are wrapping section headings/messages (e.g. "Career stats" → "Estadísticas de carrera"), not tight buttons. Worth a mobile glance on scout/portal/register.
3. **Click each of the 6 py.pl / Wise payment buttons** to confirm the external PayPal/Wise destinations + amounts (external redirects can't be followed headlessly).

**Reusable tool added:** `site/validate_i18n.mjs` — re-run after any i18n change to catch missing keys/parse errors/length flags.

---

## 2026-08-31 — Batch of 10 updates from Sam (worked in order, per-item commits)

**1. Deleted Dario Cardoso player profile — DONE (DB-only, no code).** Sam wrote "Danio"; the only Cardoso in the DB is **Dario Cardoso** (single unambiguous match). He was a self-registered player (`source=registration`), **status=rejected** (so never on the public approved roster). Purged in one transaction: `public.players` id=117 → `public.profiles` id=`c9440e61-7d9f-43f2-b5f3-0dd09f90caab` → `auth.users` same id. No batting/pitching/fielding/notes rows existed (players→stats FKs are ON DELETE CASCADE anyway); all image/resume/cert/diploma URLs were null and he had **zero** storage objects in player-photos/application-photos/application-docs. Verified 0 rows remain across players/profiles/auth/stats/notes. Nothing on the frontend referenced him (homepage roster is DB approved-only; no static players/*.html page — those are the 17 seed athletes).

**2. Social link-preview image → new logo — DONE.** Generated `site/og-image.png` (1200×630, standard OG size): the transparent ESM Sports Network wordmark (from `logo.png`) centered on the site's navy vertical gradient (#0d2547→#06142a) with a subtle gold top-right glow matching `.bg-fx`. Updated `index.html` `og:image` + `twitter:image` from `media/photos/twl-champions.jpg` → `og-image.png`, `og:image:width/height` 1600×900 → 1200×630, and the explanatory comment. **Left as-is:** the JSON-LD `"image"` (line ~44, still the team action photo) — that's the schema.org org image for rich results, distinct from `"logo"` (already `logo.png`) and not a link-preview card. Scope was og/twitter only.

**3. Roster code change now revokes ALL existing access — DONE.** Previously the unlock flag (`esm_roster_unlock_v1="1"`) was never re-checked against the code, so an already-unlocked browser stayed unlocked forever. Now the unlock is **versioned against the granting code** (key bumped to `esm_roster_unlock_v2`, JSON):
  - master-code unlock → `{m:"master", c:<normalized code>}`
  - per-user code unlock → `{m:"user", h:<sha-256>}`
  New `revalidateUnlock()` runs (a) synchronously at load against the cached code, and (b) again inside `boot()` immediately after `get_roster_code()` re-fetches the LIVE code — so the SAME reload after Sam changes/retires the code re-locks the browser. Master mismatch OR empty cache (retired) → `lockRoster()`; unknown/corrupt shape fails closed. Gate call sites updated to pass the versioned object; added `lockRoster()`/`getUnlock()`; `isUnlocked()` now checks the object shape (revalidate prunes stale ones before render). Bumping v1→v2 forces a one-time re-entry for everyone (immediately enforces the model). **DESIGN DECISION TO FLAG:** per-user SHA-256 codes (`ROSTER_CODE_HASHES`) are treated as **permanent per-user grants** — a master-code rotation does NOT revoke them; only removing their hash from the deploy does. This matches their nature (deploy-managed, not admin-rotated). If Sam wants per-user codes ALSO killed on master rotation, that's a one-line change (flag it). Validated headless: 10/10 state-machine scenarios pass (unlock→change→revoke→re-enter, retire, per-user persistence, hash removal, legacy-v1 ignored, corrupt fails closed). Not runnable headless: the live browser reload against the DB RPC — logic + boot() re-fetch path are proven, but worth Sam doing the exact change-code-and-reload check once.

**4. Remove PayPal/Wise + Stripe placeholder structure — DONE (Stripe URLs pending from Sam).** Discovery: a prior 2026-08 session had ALREADY pulled the live py.pl/wise button URLs site-wide and routed every payment surface to a working "Contact ESM →" mailto (no dead-ends). This item finished the job cleanly:
  - **Stripe-link variable pattern extended** to all paid flows: `STRIPE_PROFILE_URL` (player €129.99) + `STRIPE_ROSTER_URL` (scout €49.99) in `register/index.html`; `STRIPE_TENERIFE_URL` (€599.99) in `tenerife/index.html`. All empty for now. When a URL is filled the button becomes a real "Pay securely →" checkout link (target=_blank, trilingual key `r_pay_now`/`te_pay_now` added EN/ES/IT); while empty it stays the "Contact ESM →" mailto fallback so nothing dead-ends. Follows the existing `href = STRIPE_URL || fallback` idiom.
  - **Roster gate (index.html):** left as the code-entry gate (buyer arranges payment with ESM → gets a code). Did NOT add a Stripe pay button there because Stripe checkout wouldn't auto-issue an unlock code — that pay→code automation is a product decision for Sam (flagged). The homepage roster's paid path is really the scout registration flow, which now has `STRIPE_ROSTER_URL`.
  - **Zero PayPal/Wise references** confirmed across all html/js/mjs/py (word-boundary grep, excluding the historical ENGINEERING_LOG). Scrubbed brand names from all comments/copy. (ENGINEERING_LOG retains history intentionally.)
  - **BLOCKED until Sam sends Stripe links:** the three `STRIPE_*_URL` consts stay empty; paste-and-done, no code change needed. Also open: does he want a `STRIPE_ROSTER_URL` pay button ON the homepage gate (needs pay→code automation)?
