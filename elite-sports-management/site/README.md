# Elite Sports Management — App + Website (PWA)

One codebase that works as a **website** and an installable **app** (iOS/Android home screen, and wrappable for the App Store / Play Store). Built for Vercel + Supabase + GitHub + Claude Code.

```
site/
├── index.html            ← the whole app (trilingual EN/ES/IT, all sections)
├── manifest.json         ← PWA manifest (name, icons, colors)
├── sw.js                 ← service worker (offline + installable)
├── icons/                ← app icons (192 / 512 / maskable / apple-touch)
├── players.json          ← roster source of truth (17 athletes)
├── supabase-schema.sql   ← players + events + testimonials tables
└── supabase-seed.sql     ← loads the 17 athletes
```

## What's built
- **Hero + stats**, **What We Do** (College · Indy Ball · Europe · Social Media · Representation & Development)
- **Who I Am** — Samuele Bruno (CEO & founder) bio + credentials
- **Roster** — 17 athletes, filterable, tap a card for a full profile with **baseball stats** + teams
- **Events** — upcoming + past camps/showcases/tournaments
- **Testimonials**
- **Join Us form** — combined Representation + Coaching application. **Submitting creates an athlete profile** that appears on the roster automatically.
- **Trilingual**: English / Español / Italiano via the EN·ES·IT switcher.
- **Installable PWA** with offline support and an "Install" prompt.

## 1. Ship it (GitHub → Vercel)
1. Put the `site/` files in a GitHub repo.
2. Vercel → **Add New → Project → Import** → framework **Other**, no build command → **Deploy**.
3. PWA needs HTTPS — Vercel gives that automatically, so install/offline work live (not from a local file).

## 2. App Store & Google Play
The site is a PWA, so:
- **iPhone/Android now:** open the site → *Add to Home Screen*. It launches full-screen like an app.
- **Google Play:** wrap the PWA as a TWA with **PWABuilder** (pwabuilder.com) or Bubblewrap → upload the generated `.aab`.
- **App Store:** package with **PWABuilder** or **Capacitor**, then submit via Xcode/App Store Connect.
Same code, no rewrite — ask Claude Code: *"Wrap this PWA for the Play Store with Bubblewrap."*

## 3. Go dynamic (Supabase)
1. Create a project at supabase.com.
2. SQL Editor → run `supabase-schema.sql`, then `supabase-seed.sql`.
3. Settings → API → copy **Project URL** + **anon key**.
4. In `index.html`, fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` at the top of the script.
Now the roster loads live, and **form submissions are saved as real profiles** in the `players` table (with age/phone/email/Instagram/message captured). The anon key is browser-safe — RLS only allows reading approved profiles and inserting applications.

## 4. Replace the placeholder content
- **Events & testimonials:** edit the `EVENTS` and `TESTIMONIALS` arrays near the top of the script (or the Supabase tables). The current ones are samples.
- **Photos:** each player/event supports an `image`/`image_url`. Add Sam's photos (e.g. host in Supabase Storage or `/icons`-style folder) and set the field — cards and profiles use the photo automatically, falling back to the gold monogram.
- **Founder photo:** swap the `SB` monogram for a real headshot by setting a background image on `#founderPhoto`.

## 5. Decisions still open (from our chat — for later)
- **Moderation:** profiles currently auto-publish. To require approval, change the `players.status` default to `'pending'` and only show approved ones (already wired).
- **Athlete logins / who edits stats:** schema has an `owner_id` column reserved. When ready, add Supabase Auth + an edit page so athletes update limited fields while the agency controls stats. Good Claude Code task: *"Add Supabase Auth so an athlete can log in and edit their own bio/photo but not their stats."*

---
*Train like an athlete. Play like a pro.*
CEO & Founder: Samuele Bruno · @elite_sports_management__ · elitesportsmanagement50@gmail.com
