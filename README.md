# ALX Pace — Data Analytics Self-Pace Tracker

A responsive, **mobile-first** web app that helps ALX Africa learners track their
progress through the **14-week Self-Paced Data Analytics** curriculum. No sign-up,
no login — everything lives in the browser. Styled after **alxafrica.com**'s live
brand system.

<p>
  <a href="https://github.com/alxdataprograms/alx-pace/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/alxdataprograms/alx-pace/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="React" src="https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white">
</p>

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173  (Vite dev server)
```

Other scripts:

```bash
npm run build          # production build to dist/
npm run preview        # serve the production build
npm run lint           # ESLint (flat config)
npm test               # Vitest unit tests (pacing, parser, schedule, forecast)
npm run parser:check   # run the deterministic CSV-parser verification in Node
```

Every push and pull request runs lint → unit tests → parser verification → build
via [GitHub Actions](.github/workflows/ci.yml); deployment to GitHub Pages only
runs after those gates pass on `main`.

> Requires Node 18+ (developed on Node 24).

---

## What it does

| Area | Behaviour |
| --- | --- |
| **Zero-login state** | Name, start date and completed lessons persist in `localStorage`. |
| **Pacing engine** | Enter a start date → the app computes the current week (1–14) and shows exactly what to work on. The week advances live at midnight, even with the tab left open. |
| **Current Focus** | The precise Module + Week + lessons for *this* week, with checkboxes. |
| **Graded Milestones** | Evaluation quizzes, graded tests and integrated projects due this week are surfaced prominently. |
| **Progress** | Overall % complete across all 27 lessons, plus per-week counts. |
| **Full roadmap** | Collapsible 14-week / 4-module browser; the current week auto-expands. |
| **Edge states** | Future start date → countdown · past week 14 → graduation · no date → onboarding · storage reset → clean defaults. |
| **Theming** | Light (default, matching alxafrica.com) and deep-navy dark mode, persisted. |

### The four learner states

```
no-start-date  →  future (countdown)  →  active (week 1..14)  →  completed (graduation)
```

---

## 📱 Install on your phone

The app is a **PWA** — visiting the live URL once is enough to install it like a
native app (standalone window, ALX home-screen icon, works offline afterwards):

- **Android (Chrome)**: open the app → tap the **⋮** menu → **Add to Home screen**
  (or tap the **Install app** prompt when it appears).
- **iPhone/iPad (Safari)**: open the app → tap **Share** (□↑) → **Add to Home
  Screen** → **Add**.
- **Desktop (Chrome/Edge)**: click the install icon in the address bar.

Progress is stored on the device, so the installed app picks up exactly where the
browser left off.

---

## 🔔 Weekly reminders

Learners can opt in via **Enable weekly reminders** in the footer. Two delivery
modes, best available wins:

1. **Local (zero infrastructure, on by default)** — Periodic Background Sync: the
   service worker wakes and shows the learner's latest status ("Week 3 — 2 graded
   items due") composed from data mirrored on-device. No data leaves the phone.
   Chromium on Android/desktop; installed app recommended.
2. **True Web Push (dormant until activated)** — works with the app fully closed,
   including iOS 16.4+ home-screen installs. Everything is wired: VAPID keys live
   as repo secrets, [`push/worker.js`](push/worker.js) is a ready-to-paste
   Cloudflare Worker (KV-backed subscription store), and
   [`.github/workflows/remind.yml`](.github/workflows/remind.yml) sends every
   Monday 08:00 WAT via [`scripts/send-reminders.mjs`](scripts/send-reminders.mjs).
   Activation steps are documented in
   [`src/lib/pushConfig.js`](src/lib/pushConfig.js) — deploy the worker, paste its
   URL, done. Until then the workflow exits as a no-op.

---

## 📊 Anonymous usage stats (dormant until configured)

[`src/lib/analytics.js`](src/lib/analytics.js) can report aggregate, cookieless
tallies to a free [GoatCounter](https://www.goatcounter.com) site: app opens,
installed-vs-browser, and a once-per-device-per-day week-number / pacing-status
event — bare numbers only, never anything identifying a learner. Do Not Track and
Global Privacy Control are honored, and no third-party script runs (plain GET
beacons). Off by default: set `GOATCOUNTER_SITE` in
[`src/lib/analyticsConfig.js`](src/lib/analyticsConfig.js) to activate.

---

## How the data works (deterministic by design)

This project applies the **Deterministic Tool & Data Normalization** principle: the
curriculum is a fixed developer asset and parsing is a pure, predictable state
machine — no AI, no guessing, same bytes → same model every time.

- **Source of truth:** [`src/data/schedule.csv`](src/data/schedule.csv) — the real ALX
  DA Self-Pace curriculum. Learners never see a file input.
- **Build-time bundling:** the CSV is imported with Vite's `?raw` suffix
  ([`src/lib/schedule.js`](src/lib/schedule.js)) so it is compiled straight into the
  bundle — the curriculum data needs no runtime `fetch` and is never missing or
  stale. (The Poppins typeface loads from Google Fonts with a system-font
  fallback, so the app remains fully functional without it.)
- **RFC 4180 parser** ([`src/lib/csvParser.js`](src/lib/csvParser.js)) handles the
  messy realities of a spreadsheet export: quoted cells containing commas and
  **newlines** (the Integrated Projects span two lines), escaped `""`, and mixed
  CRLF/LF line endings.
- **Forward-fill:** the export uses *merged cells*, so `Module` and `Week` are blank
  on continuation rows. `forwardFill()` carries the last value downward, so every one
  of the 27 lessons is deterministically tied to its module and week.
- **Stable ids:** lesson ids are content-derived slugs
  (`da-1-w1-ways-of-work`), not row positions — inserting or removing a CSV row can
  never silently re-map a learner's saved completion state.
- **Verification:** [`scripts/verify-parser.mjs`](scripts/verify-parser.mjs) runs the
  **production parser** against the real CSV in plain Node and asserts 14 weeks,
  4 modules, forward-fill integrity, multi-line cell parsing, and id stability.
  Run it with `npm run parser:check`.

### The pacing formula

Implemented exactly as specified in [`src/lib/pacing.js`](src/lib/pacing.js):

```
elapsedDays = today − startDate            (whole days, local midnight)
currentWeek = min(14, max(1, ⌊elapsedDays / 7⌋ + 1))
```

Dates are parsed as **local** dates (not UTC) so the calendar day never shifts in
negative timezones.

---

## localStorage contract

| Key | Type | Default | Travels on a move? |
| --- | --- | --- | --- |
| `learnerName` | string | `""` (unset) | yes |
| `startDate` | ISO date string `YYYY-MM-DD` | `""` (unset) | yes |
| `completedLessons` | JSON array of lesson ids | `[]` | yes |
| `alx-theme` | `"light"` \| `"dark"` | `"light"` | yes |
| `alx-lang` | `"en"` \| `"fr"` \| `"ar"` | browser language | yes |
| `alx-reminders` | reminder mode | unset | **no** — see below |
| `alx-metrics-day` | analytics dedupe stamp | unset | **no** — see below |
| `alx-handoff-done` | ISO date the handoff ran | unset | n/a |
| `alx-reminders-lapsed` | `"1"` while the re-enable prompt is pending | unset | set *by* the handoff |

Completed-lesson ids are validated against the bundled schedule (and deduplicated)
on read, so stale or corrupt entries are silently dropped — a defensive guardrail.

---

## Moving the app to a new address

`localStorage` is scoped to the **origin**. Publishing the app from a different
GitHub account changes the hostname, which means every learner's start date and
completed lessons become unreachable — silently, with no error and nothing to
restore from. Re-pointing a DNS record would avoid this; changing accounts does
not.

The fix is a one-way handoff. The only code that can read the old origin's
storage is code served *by* the old origin, so:

```
old origin                          new origin
──────────                          ──────────
bridge/index.html
  ├─ retires the old service worker and its caches
  ├─ reads the five keys marked "travels" above
  └─ encodes them into a URL FRAGMENT ─────────▶  src/lib/handoff.js
                                                    ├─ decodes + validates
     (a fragment, never a query string, so a         ├─ merges (see below)
      learner's name is never sent to a server       └─ strips the fragment
      or written to an access log)
```

`runHandoff()` is called from [`src/main.jsx`](src/main.jsx) **before React
mounts** — `useLocalStorage` reads storage in a `useState` initialiser that runs
once and never re-reads, so a handoff applied after render would sit invisibly
in storage until the learner happened to reload.

**Merge rules are deliberately asymmetric.** Completed lessons are *unioned*: a
lesson wrongly ticked costs one click to correct, while a lesson wrongly cleared
is indistinguishable from work never done. Everything else is written only if
the new origin has nothing there, so a stale bookmark cannot overwrite a date
the learner has since set. The whole thing runs at most once per device.

**Two keys deliberately stay behind.** `alx-reminders` records that the learner
granted notification permission — permission is origin-scoped and does *not*
survive the move, so carrying the flag across would leave the app promising a
weekly nudge it can never send. `alx-metrics-day` is the once-per-day analytics
dedupe stamp; carrying it would suppress the learner's first day on the new
origin from the counts.

**But dropping the reminder flag silently is its own failure.** A learner who
had reminders on would find their Monday nudge simply stops, with nothing to
explain it. So the bridge sends a separate advisory field, `remindersWereOn`,
which sets `alx-reminders-lapsed` on arrival. `ReminderToggle` reads that and
shows a dismissible line asking them to switch reminders back on. The asymmetry
is the point: the flag can only ever produce a *prompt*, never the claim that
anything is already enabled, so a stale hint costs one dismissed line rather
than a notification nothing is registered to send.

The bridge is dependency-free and unbuilt, because it has to keep working long
after nobody is maintaining it. Its encoder is a hand-mirrored copy of the one
in `handoff.js`; [`src/lib/handoff.test.js`](src/lib/handoff.test.js) reads
`bridge/index.html` off disk, extracts the block between the `handoff-codec`
sentinels and asserts it round-trips against the shipped decoder, so the two
cannot drift apart unnoticed.

---

## Project structure

```
src/
├── data/schedule.csv        # bundled ALX DA curriculum (source of truth)
├── assets/alx/              # official alx logo + duotone learner portraits
├── lib/
│   ├── csvParser.js         # RFC 4180 parser + forward-fill (pure)
│   ├── scheduleModel.js     # normalize CSV → weeks/modules/lessons (pure, testable)
│   ├── schedule.js          # Vite ?raw import wrapper → SCHEDULE
│   ├── pacing.js            # deterministic date/pacing engine (pure)
│   └── slogans.js           # ALX motivational slogans
├── hooks/
│   ├── useLocalStorage.js   # defensive persisted state (pure updaters, cross-tab sync)
│   ├── useLearnerProfile.js # the zero-login profile (name/date/completed)
│   └── useTheme.js          # light/dark, persisted
├── components/              # AlxLogo, PersonalizationWidget, CurrentFocusCard,
│                            # GradedMilestonesAlert, ProgressBar, WeekAccordion,
│                            # CountdownState, GraduationState, StartDatePrompt, Footer
├── App.jsx                  # state machine wiring it all together
└── main.jsx
```

---

## Branding

Design tokens sampled from the live **alxafrica.com** site (July 2026), typeface
**Poppins** (via Google Fonts, with a system-sans fallback):

| Token | Hex | Use |
| --- | --- | --- |
| Deep Navy | `#03134F` / `#020B33` | hero banner, dark-mode surfaces |
| Cobalt | `#0452F0` (`#0345C9` for small text) | primary brand blue, CTAs, focus ring |
| Lime | `#C4E878` / `#DAF2A7` | signature accent, chips, current-week highlight |
| Violet | `#5F3DC4` | graded-milestone alerts, exams |
| Green | `#02B75E` | integrated projects, completed weeks |
| Amber | `#EAB308` | graded tests |
| Ink | `#1C1F2A` | body text on light |
| Off-white | `#F8F8F8` | page background (light) |

The header wordmark and the duotone learner portraits in the hero widget are the
official assets from alxafrica.com (this is an internal ALX learner tool).

Built for **375px+** smartphone browsers: 44px minimum tap targets, safe-area
insets, WCAG-AA text contrast in both themes, `prefers-reduced-motion` support,
and a theme-aware focus ring.

---

## A note on the source CSV

The bundled CSV is the curriculum as provided, with one surgical correction: the
Week 12 graded cell in the original export contained an accidental duplicated
paste of the project title ("…Maji NdogoIntegrated Project…"), fixed to the single
title. Everything else is byte-for-byte verbatim. Edit `src/data/schedule.csv` and
re-run `npm run parser:check` to update the curriculum.
