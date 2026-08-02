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
