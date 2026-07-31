# ESM Website — Engineering Log

Persistent session memory. Append one entry per completed task (task, what changed,
files, commit, assumptions). Verify against actual code before redoing anything.
Priority order: security > correctness > reliability > accessibility > performance > SEO > UX > maintainability.

Site lives at `elite-sports-management/site/`. Prod: https://elite-sports-management.vercel.app
Supabase project: `sbexwyvsgqayxrsrlrpm` (Elite Sports Management). No-build vanilla JS + PWA.

---

## Completed

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

## In progress
- (Current-priority features + production hardening done + validated. See NEXT SESSION.)

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

**Current state:** Repository is deployable, fully pushed to `origin/main`, and verified live in prod. All four current-priority features (Sign In nav, Admin portal, Player portal, DB security) PLUS a full production-hardening pass (verification, security sweep, SEO, performance, accessibility) are complete and committed. Nothing is half-built. `git status` should be clean/ahead-0 after the final log commit.

**Completed — session 2026-07-30 (features):** Sign In nav; `player_notes` (admin-only) + `update_my_profile()` RPC + athlete photo storage (all APPLIED to prod); admin delete/archive/notes/expanded-edit; player self-service edit + photo; RLS init-plan optimization.

**Completed — session 2026-07-31 (production hardening):**
1. Portal verification (auth/route-protection/error/loading traced; SW confirmed network-first so auth pages never stale).
2. Mobile header overflow fix (nav fits to ~320px) + loading states in both portals.
3. Security sweep — verified live: anon blocked from players.*/PII/player_notes (42501); no secrets; no PII in players.json or player pages; storage confinement intact.
4. SEO — `robots.txt`, `sitemap.xml`, `SportsOrganization` JSON-LD.
5. Performance — logo width/height (CLS) + fetchpriority/lazy hints.
6. Accessibility — label associations + aria-live regions + icon-button labels across both portals.

**Commits this session (2026-07-31), newest last:** `mobile header + loading states` → `SEO robots/sitemap/JSON-LD` → `perf logo dims` → `a11y labels + live regions` → (this) `log + handoff`. Run `git log --oneline -10` for hashes. Latest pushed: b807d74 (before the final log commit).

**Validation performed:** JS syntax-checked admin/portal/index (node --check). Live prod curl checks: robots/sitemap 200, JSON-LD + logo dims + mobile CSS + portal aria-live all present. Anon PII/notes denial confirmed via REST. RLS/RPC proven earlier via simulated JWT.

**Exact next task (highest priority first):**
1. **Manual UI smoke test** the two portals in a real browser (magic-link login can't be driven headless here). Sign in as admin (mattswagj@gmail.com): add/edit/delete/archive a player, save an internal note, upload a photo — confirm toasts. Then as a test athlete: edit bio/photo and confirm the round-trip. This is the ONLY unproven-end-to-end path.
2. **Maintainability** (the two long-standing Deferred items, both need interactive verification): player-page dead-CSS trim via `gen_player_pages.py` (Python unavailable in the autonomous env — port generator to Node or run where Python exists), and shared-Supabase-client extraction across the 3 apps.
3. Optional polish: submit sitemap to Google Search Console (Manual Action); consider making athlete profiles indexable for SEO IF the business decides to un-paywall them (currently noindex by design — do NOT change without confirmation).

**Files to open first:** `ENGINEERING_LOG.md` (this file), `site/admin/index.html`, `site/portal/index.html`, `site/index.html` (nav ~line 386, signin CSS ~line 76, i18n ~line 720).

**Remaining risks:**
- Portals still not clicked-through live end-to-end (task #1). DB layer proven, JS parses, HTML live — but magic-link + storage-upload happy path is unverified by a human.
- Seed athletes (17) have `email = NULL` → none can log into the portal until an admin sets their email row.
- `update_my_profile` is intentionally SECURITY DEFINER + authenticated-executable (advisor WARN is expected/reviewed).

**Manual actions required (external / dashboard-only):**
- Supabase Auth → URL Configuration → Redirect URLs must include `https://elite-sports-management.vercel.app/admin/` and `/portal/` (magic links bounce to localhost without this — CONFIRM it's set; this is the most likely cause if login "doesn't work").
- Enable Supabase Auth leaked-password protection (dashboard).
- Provide a real 1200×630 branded OG share image (placeholder team photo in use at `/media/photos/twl-champions.jpg`).
- Submit `sitemap.xml` in Google Search Console (optional).
- To give a seed athlete portal access, an admin sets their email on the player row.
- Supabase free tier PAUSES when idle — if the live site/portal "won't load", restore the project (ref `sbexwyvsgqayxrsrlrpm`) first.
