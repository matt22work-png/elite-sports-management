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
- players table: 17 approved rows, served from DB (embedded array is fallback). `sport` column exists (default Baseball, CHECK Baseball/Softball).
- Anon PII read now blocked (column grant). Public roster read still 200 with 17 rows, no PII keys.
- Prod serves `site/` at root: `/`, `/logo.png`, `/media/photos/*`, `/icons/*` all 200.

## In progress
- (Tier 3 complete. Next: Tier 4 maintainability, then Tier 5 content.)

### Tier 5 content + priority interrupts
- **74f0b71** Nav reorder: What We Do, Who I Am, College, Roster, Events, Join. (No Media item — already removed in f063ac6.)
- **0f9ae5c** Merged Indy Ball + Winter League → "Professional Leagues" card (svc_pro, EN/ES/IT). Old svc2/svc6 keys kept unused for revert.
- **23af1bb** "Specialized Personalized Training" highlight (.do-hl) in Representation card (svc5_hl_*, EN/ES/IT).
- **04e3489** Fixed Sam's bio (who_bio2): removed Dubai/South America/Asia → "North America and Australia". EN/ES/IT.
- **f7b9710** Added 3 cred chips to Sam's card: Hastings College · All-GPAC Honorable Mention; College of the Desert · 3 HR in One Game; ECC College · Region 16 Champions (cred_hastings/cred_cod/cred_ecc, EN/ES/IT).
- **a8a4c8a** €124.99 profile-creation gate (#profile section) — 2nd independent instance of the roster paywall. Own key `esm_profile_unlock_v1`, own hash. Code: ESM-PROFILE-2026. PayPal instructions (brunosamuele56@gmail.com) + PayPal _xclick pay button. Unlock → CTA to #join. pg_* keys EN/ES/IT. FLAG: separate section, does NOT hard-block the open #join form.
- **31b5fb2** Removed redundant standalone Europe card (svc3) — now covered by Professional Leagues. 5 cards in "What We Do".

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
