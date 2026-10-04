# ALX Pace — Self-Pace Tracker

A responsive, **mobile-first** web app that helps ALX Africa learners track their
progress through their self-paced curriculum. No sign-up, no login — everything
lives in the browser. Styled after **alxafrica.com**'s live brand system.

| Program | Track | Length | Modules | Items |
| --- | --- | --- | --- | --- |
| **Data Analytics** | — | 14 weeks | 4 | 27 lessons |
| **Creative Tech** | Content Creation | 22 weeks (5 buffer) | 5 | 250 lessons, activities & quizzes |
| **Creative Tech** | Graphic Design | 32 weeks (10 buffer, 2 half weeks) | 10 | 373 lessons, activities & quizzes |

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
npm test               # Vitest unit tests (pacing, parser, schedules, programs, forecast)
npm run parser:check   # verify all three program CSVs with the production parser in Node
```

Every push and pull request runs lint → unit tests → parser verification → build
via [GitHub Actions](.github/workflows/ci.yml); deployment to GitHub Pages only
runs after those gates pass on `main`.

> Requires Node 18+ (developed on Node 24).

---

## What it does

| Area | Behaviour |
| --- | --- |
| **Program picker** | The first screen says what Pace is (*Free · No login · Saved on this phone*), then asks *Data Analytics or Creative Tech?* — and for Creative Tech, *Content Creation or Graphic Design?* Change it any time from the hero card; each program's ticks are kept separately. |
| **Zero-login state** | Program, name, start date and completed lessons persist in `localStorage`. |
| **Pacing engine** | Enter a start date → the app computes the current week of *your* program and shows exactly what to work on. The week advances live at midnight, even with the tab left open. |
| **Current Focus** | The precise Module + Week + lessons for *this* week, with checkboxes, directly under the status card so the first lesson is on the first screen. |
| **Catch up first** | Behind in an ordinary week, the focus card opens with the three oldest items still open from earlier weeks, each labelled with its week, above this week's lessons; the status card's *Catch up now* goes straight there. |
| **Catch-up weeks** | Creative Tech buffer weeks turn the focus card into a catch-up list: the oldest still-open items from earlier weeks. |
| **Graded Milestones** | Evaluation quizzes, graded tests, integrated projects, module quizzes and mastery projects due this week are surfaced prominently. |
| **Progress** | Overall % complete across every item in the program, plus per-week counts. In an active week the status card also shows it in one line ("41% · 11 of 27"). |
| **Full roadmap** | Collapsible week / module browser (buffer and ½ weeks flagged); once the course has begun, the current week auto-expands and is flagged *Current*, and each earlier week with items still open is marked *N overdue* in amber. |
| **Edge states** | No program → picker · future start date → countdown · past the final week → graduation · no date → onboarding · storage reset → clean defaults. |
| **Theming** | Light (default, matching alxafrica.com) and deep-navy dark mode, persisted. |

### The four learner states

```
no-program (picker)  →  no-start-date  →  future (countdown)  →  active (week 1..N)  →  completed (graduation)
```

Learners who used the tracker before programs existed (they have a start date
or ticked lessons but no `program` key) are pinned to Data Analytics on their
first load, so their tracker opens exactly as before — no picker, no lost ticks.

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

Learners can opt in via **Enable weekly reminders** in the footer, offered once
they have set a start date. Two delivery modes, best available wins:

1. **Local (zero infrastructure, on by default)** — Periodic Background Sync: the
   service worker wakes and shows the learner's latest status ("Week 3 — 2 graded
   items due", or the catch-up count on a buffer week) composed from data
   mirrored on-device. No data leaves the phone.
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
installed-vs-browser, and a once-per-device-per-day program / week-number /
pacing-status event (`program-gd`, `gd-week-5`, `status-behind`; DA keeps its
original bare `week-N` names) — never anything identifying a learner. Do Not Track and
Global Privacy Control are honored, and no third-party script runs (plain GET
beacons). Off by default: set `GOATCOUNTER_SITE` in
[`src/lib/analyticsConfig.js`](src/lib/analyticsConfig.js) to activate.

---

## How the data works (deterministic by design)

This project applies the **Deterministic Tool & Data Normalization** principle: the
curriculum is a fixed developer asset and parsing is a pure, predictable state
machine — no AI, no guessing, same bytes → same model every time.

- **Source of truth:** one CSV per program in [`src/data/`](src/data) — the real ALX
  self-paced curricula. Learners never see a file input.
  - [`da-schedule.csv`](src/data/da-schedule.csv) — Data Analytics
  - [`cc-schedule.csv`](src/data/cc-schedule.csv) — Creative Tech · Content Creation
  - [`gd-schedule.csv`](src/data/gd-schedule.csv) — Creative Tech · Graphic Design
- **Program registry:** [`src/lib/programs.js`](src/lib/programs.js) lists each
  program's family (drives the two-step picker), sheet layout and CSV file.
- **Build-time bundling:** the CSVs are imported with Vite's `?raw` suffix
  ([`src/lib/schedule.js`](src/lib/schedule.js)) so they are compiled straight into the
  bundle — the curriculum data needs no runtime `fetch` and is never missing or
  stale. The Poppins typeface is bundled too (`src/assets/fonts`, OFL), so
  first paint waits on no third party and the app keeps its look offline.
- **RFC 4180 parser** ([`src/lib/csvParser.js`](src/lib/csvParser.js)) handles the
  messy realities of a spreadsheet export: quoted cells containing commas and
  **newlines** (the Integrated Projects span two lines), escaped `""`, and mixed
  CRLF/LF line endings.
- **Forward-fill:** the export uses *merged cells*, so `Module` and `Week` are blank
  on continuation rows. `forwardFill()` carries the last value downward, so every
  item is deterministically tied to its module and week.
- **Two sheet layouts, same five columns:**
  - *DA* (`Module | Week | Lessons | Check Your Understanding | Graded`) — one row
    per lesson; its CYU line and graded milestone ride along.
  - *Creative Tech* (`Module | Week | Lessons | Activity | Evaluation quiz`) — one
    item per row: a lesson, an activity, or a graded quiz / mastery project.
    Buffer weeks hold a single `Buffer / catch-up week` marker, which declares the
    week but is not a task.
- **Stable ids:** lesson ids are content-derived slugs
  (`da-1-w1-ways-of-work`, `gd-5-w14.5-working-with-imagery`), not row positions —
  inserting or removing a CSV row can never silently re-map a learner's saved
  completion state. Module codes namespace them, so one `completedLessons` array
  holds every program's progress without collisions.
- **Verification:** [`scripts/verify-parser.mjs`](scripts/verify-parser.mjs) runs the
  **production parser** against all three CSVs in plain Node and asserts program
  length (14 / 22 / 32 weeks), module counts, a gap-free day timeline, buffer and
  half weeks, forward-fill integrity, multi-line cell parsing, graded
  classification, one mastery project per Creative Tech module (in its final
  content week, named as a module post quotes it), and id uniqueness within and
  across programs. Run it with `npm run parser:check`.

### The pacing formula

Implemented in [`src/lib/pacing.js`](src/lib/pacing.js). For a plain N-week
program (Data Analytics) it is exactly the original spec:

```
elapsedDays = today − startDate            (whole days, local midnight)
currentWeek = min(N, max(1, ⌊elapsedDays / 7⌋ + 1))
```

The Graphic Design sheet also has **half weeks** (`Week 13 (½ week)`) followed by
weeks labelled mid-week (`Week 13.5 (Buffer)`, `Week 14.5`, …). So every schedule
carries a day timeline built from its labels, and pacing looks the elapsed day up
in it:

```
startDay(Week W) = ⌈(W − 1) × 7⌉           (a mid-day start begins next morning)
endDay(Week W)   = startDay(next week)     (last week: a full week, or half if "½ week")
totalDays        = endDay(final week)      DA 98 · CC 154 · GD 224
```

On a uniform timeline this reduces to the formula above (unit-tested), and the
target finish date is always `start + totalDays − 1`.

Dates are parsed as **local** dates (not UTC) so the calendar day never shifts in
negative timezones.

---

## localStorage contract

| Key | Type | Default | Travels on a move? |
| --- | --- | --- | --- |
| `program` | `"da"` \| `"cc"` \| `"gd"` \| `""` (not chosen) | `""` — or `"da"` for pre-existing learners (one-time migration) | **no** — derived on arrival, see below |
| `learnerName` | string | `""` (unset) | yes |
| `startDate` | ISO date string `YYYY-MM-DD` | `""` (unset) | yes |
| `completedLessons` | JSON array of lesson ids | `[]` | yes |
| `alx-theme` | `"light"` \| `"dark"` | `"light"` | yes |
| `alx-lang` | `"en"` \| `"fr"` \| `"ar"` | browser language | yes |
| `alx-celebrated` | JSON array of milestone ids already shown (`module:DA-1`, `module:CC-2`, `programme` for DA, `programme:cc` / `programme:gd`) | `[]` | yes (unioned) |
| `alx-reminders` | reminder mode | unset | **no** — see below |
| `alx-metrics-day` | analytics dedupe stamp | unset | **no** — see below |
| `alx-handoff-done` | ISO date the handoff ran | unset | n/a |
| `alx-reminders-lapsed` | `"1"` while the re-enable prompt is pending | unset | set *by* the handoff |

`program` does not travel because it does not need to: the old address only ever
paced Data Analytics. A handoff that brings a start date or completed lessons
pins `program` to `"da"` when none has been chosen on the new origin (including
`""` from an earlier empty visit), and `main.jsx` runs the handoff *before*
`migrateLegacyProgram`, so an arrival never sees the program picker.

Completed-lesson ids are validated against the active program's bundled schedule
(and deduplicated) on read, so stale or corrupt entries are silently dropped — a
defensive guardrail. Ids from the *other* programs stay in storage untouched, so
switching program and back restores each program's progress.

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
├── data/                    # bundled curricula (source of truth)
│   ├── da-schedule.csv      #   Data Analytics
│   ├── cc-schedule.csv      #   Creative Tech · Content Creation
│   └── gd-schedule.csv      #   Creative Tech · Graphic Design
├── assets/alx/              # official alx logo + duotone learner portraits
├── lib/
│   ├── csvParser.js         # RFC 4180 parser + forward-fill (pure)
│   ├── scheduleModel.js     # normalize CSV → weeks/modules/lessons + day timeline (pure)
│   ├── programs.js          # program registry + legacy-learner migration (pure)
│   ├── schedule.js          # Vite ?raw imports → SCHEDULES (one per program)
│   ├── pacing.js            # deterministic date/pacing engine (pure)
│   ├── paceStatus.js        # behind / on-track / ahead, catch-up list, forecast
│   ├── slogans.js           # ALX motivational slogans
│   └── appUrl.js            # canonical address + per-program share URLs
├── hooks/
│   ├── useLocalStorage.js   # defensive persisted state (pure updaters, cross-tab sync)
│   ├── useLearnerProfile.js # the zero-login profile (name/date/completed)
│   └── useTheme.js          # light/dark, persisted
├── components/              # AlxLogo, PersonalizationWidget, ProgramPicker,
│                            # CurrentFocusCard, GradedMilestonesAlert, ProgressBar,
│                            # WeekAccordion, CountdownState, GraduationState,
│                            # StartDatePrompt, Footer
├── App.jsx                  # state machine wiring it all together
└── main.jsx
```

---

## Branding

Design tokens sampled from the live **alxafrica.com** site (July 2026), typeface
**Poppins** (bundled under `src/assets/fonts`, with a system-sans fallback for
scripts it does not cover, such as Arabic):

| Token | Hex | Use |
| --- | --- | --- |
| Deep Navy | `#03134F` / `#020B33` | hero banner, dark-mode surfaces |
| Cobalt | `#0452F0` (`#0345C9` for small text) | primary brand blue, CTAs, focus ring |
| Lime | `#C4E878` / `#DAF2A7` | signature accent, chips, current-week highlight, focus ring on navy |
| Violet | `#5F3DC4` | graded-milestone alerts, exams |
| Green | `#02B75E` | integrated projects, completed weeks |
| Amber | `#EAB308` | graded tests |
| Ink | `#1C1F2A` | body text on light |
| Off-white | `#F8F8F8` | page background (light) |

The header wordmark and the duotone learner portraits in the hero widget are the
official assets from alxafrica.com (this is an internal ALX learner tool).

Built for **375px+** smartphone browsers: 44px minimum tap targets, safe-area
insets, WCAG-AA text contrast in both themes, `prefers-reduced-motion` support,
and a theme-aware focus ring: cobalt on light surfaces, lime on navy ones (the
hero is navy in both themes; mark such a surface `on-navy`). Native controls
follow the app's theme, not the phone's. Each setup step hands focus to the
next card's heading, and the milestone dialogue keeps focus inside it and hands
it back when it closes.

---

## Link previews (one card per program)

LinkedIn, WhatsApp, X and Slack build a link's preview from Open Graph tags in
the HTML they are served, and never run JavaScript — so the app root can only
ever show one card. The root's card (`index.html`, `public/og-image.png`) is
program-neutral. Each program also has a tiny static page with its own card:

| Page | Card |
| --- | --- |
| `share/da/` | Data Analytics · 14 weeks |
| `share/cc/` | Content Creation · 22 weeks |
| `share/gd/` | Graphic Design · 32 weeks |

A milestone post links to the learner's program page; a person following it is
sent straight on to the app (JavaScript at once, a meta refresh after two
seconds without it, and a visible link). The service worker leaves `share/`
alone, so a share page can never be cached as the offline app shell.

The pages and images are generated, not hand-edited — `src/lib/sharePages.test.js`
fails if a committed page drifts from the generator:

```bash
npm run share:cards                 # rewrite public/share/*/index.html
npm run share:cards -- --images     # …and re-render every og-image.png (needs Playwright)
```

Images render an HTML template in headless Chromium with Poppins vendored under
`scripts/share-cards/fonts` (OFL), so they come out the same offline. If
`playwright` is not installed in the repo, set `PLAYWRIGHT_MODULE` to its path and
`CHROMIUM_PATH` to a browser binary. LinkedIn caches a card per URL: after
changing one, run the URL through LinkedIn's Post Inspector to refresh it.

---

## A note on the source CSVs

The bundled CSVs are the curricula as provided:

- **Data Analytics** — verbatim, with one surgical correction: the Week 12 graded
  cell in the original export contained an accidental duplicated paste of the
  project title ("…Maji NdogoIntegrated Project…"), fixed to the single title.
- **Content Creation / Graphic Design** — the `CC` and `GD` sheets of the Creative
  Tech self-paced workbook, exported cell-for-cell (columns A–E, blank rows kept;
  the parser skips them).

Edit a file in `src/data/` and re-run `npm run parser:check` to update a
curriculum. To add a program, drop its CSV in `src/data/`, register it in
`src/lib/programs.js` and `src/lib/schedule.js`, add its name to
`t.programs` in `src/i18n/translations.js`, and give it a block in the
verification script.
