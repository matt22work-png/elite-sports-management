# Elite Sports Management — App + Website (PWA)

One codebase that works as a **website** and an installable **app** (iOS/Android home screen, and wrappable for the App Store / Play Store). Built for Vercel + Supabase + GitHub.

```
site/
├── index.html            ← the whole app (trilingual EN/ES/IT, all sections)
├── manifest.json         ← PWA manifest
├── sw.js                 ← service worker (offline + installable)
├── icons/                ← app icons
├── media/
│   ├── photos/           ← Tenerife Winter League gallery + José Cedeño
│   └── video/            ← 9 match clips (MP4) + poster frames
├── players.json          ← roster source of truth
├── players/              ← 17 generated athlete pages (PAYWALLED — see below)
├── gen_player_pages.py   ← regenerates players/ from players.json
├── admin/                ← hidden admin panel
├── supabase-schema.sql
└── supabase-seed.sql
```

## Sections
Hero · **Contracts band** (50+ since 2025 + José Cedeño testimonial) · Stats (19 athletes / 6 countries) ·
What We Do · **College Placement** · Who I Am (Samuele Bruno) · **Roster (paywalled)** · Events · **Media** ·
Testimonials · Join Us (with $125 registration)

---

## Payments — read this first

All payments go through **Stripe Payment Links**. See **`../STRIPE-SETUP.md`** for the
step-by-step. Three links, pasted near the top of the `<script>` in `index.html`:

```js
const STRIPE_ROSTER_URL   = "";   // $49.99 — lifetime roster access (scouts & teams)
const STRIPE_REGISTER_URL = "";   // $125   — athlete registration
const STRIPE_COLLEGE_URL  = "";   // college placement — price TBD
```

**While these are empty, every pay button falls back to emailing ESM.** Nothing is
broken — it just isn't collecting money yet.

There is no PayPal anywhere. Stripe is the only payment method.

---

## How the roster paywall works

The roster is gated client-side:

1. Roster renders **blurred** behind a lock card with the $49.99 Stripe button.
2. Buyer pays → Stripe's confirmation page shows them the **access code**.
3. They type it into the "Already paid?" box → unlocked, and remembered in
   `localStorage` (`esm_roster_unlock_v1`) so they only enter it once.

The code is **`ESM-SCOUT-2026`**. Only its **SHA-256 hash** lives in the page source
(`ROSTER_CODE_HASHES`), so the code itself can't be read out of the HTML.

**The 17 player pages are gated too.** Each checks the same `localStorage` key in
`<head>` and redirects to the paywall before first paint, and carries
`noindex,nofollow` so Google stops serving them free. Without this, anyone could google
an athlete and walk straight past the paywall.

### Honest limitations
- One shared code. It can be forwarded, and you can't tell who used it.
- The player HTML still reaches the browser — a technical person can dig it out.
- Clearing browser data means re-entering the code.

This is a reasonable trade-off for launching without a login system, but it is **not**
real access control. When revenue justifies it, upgrade to Supabase Auth with per-buyer
accounts. To rotate the code meanwhile, see `STRIPE-SETUP.md`.

---

## Join Us flow (athletes, $125)

Deliberately **form first, pay last**:

1. Athlete fills in the application → saves to Supabase as `status: "pending"`.
2. *Then* the $125 Stripe panel appears.

So the lead is captured **even if they never pay**, and you can follow up. Payments
aren't auto-linked to applications — match the Stripe notification email to the pending
application in the admin panel, then approve.

---

## Regenerating player pages

```bash
cd site && python3 gen_player_pages.py
```

Rebuilds `players/*.html` from `players.json`, pulling shared CSS from `index.html`.
The generator reproduces the paywall gate and `noindex` automatically — **don't remove
them**, or the roster paywall becomes trivially bypassable. Running it with no data
changes is a no