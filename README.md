# YouTube Creator Tool (Niche-Scope)

A fully-local, vidIQ-style toolkit for YouTube creators. Keyword research,
video/channel scorecards, competitor tracking, channel audits, and a Chrome
extension overlay — all running against your own SQLite database with no
accounts or cloud backend.

## Features

- **Keyword research** — seed a topic, expand through YouTube autocomplete
  (a–z + question words), rank candidates by demand vs. competition
- **Video & channel scorecard** — vidIQ-style audit (50% on-page SEO +
  50% audience performance), plus 24h view velocity (VPH)
- **Competitor tracking** — watchlist with hourly snapshot history and trend charts
- **Channel audit** — your own channel insights (requires Google OAuth)
- **Chrome extension** — overlay scores directly on youtube.com

## Tech

- Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind v4
- Node 24 built-in `node:sqlite` (no native deps, no ORM)
- Free YouTube Data API (quota-ledgered) + keyless autocomplete

## Getting Started

```bash
npm.cmd install
cp .env.example .env.local      # add YOUTUBE_API_KEY (optional; research works without it)
npm run dev                     # http://localhost:3000
npm run dev:full                # dev server + snapshot poller
```

```bash
npm run test                    # unit tests
npm run typecheck && npm run lint
```

## Project status

Phases 1–3 complete (research engine, scorecard engine, tracking API).
See `SESSION.md` for architecture, scoring formulas, and the roadmap.
