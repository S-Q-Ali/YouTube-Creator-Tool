# YouTube Creator Tool (Niche-Scope)

A fully-local, vidIQ-style toolkit for YouTube creators — keyword research,
video/channel scorecards, competitor tracking, your own channel audit, and a
Chrome extension overlay. Everything runs against your own SQLite database.
No accounts, no cloud backend, no subscription.

## Features

- **Keyword research** — seed a topic, expand through YouTube autocomplete
  (a–z + question words), rank candidates by demand vs. competition
- **Video & channel scorecard** — vidIQ-style audit (50% on-page SEO +
  50% audience performance), plus 24h view velocity (VPH)
- **Competitor tracking** — watchlist with hourly snapshot history and trend charts
- **Channel audit** — your channel’s YouTube Analytics via Google OAuth
- **Chrome extension** — SEO scores and VPH overlaid directly on youtube.com
- **API quota dashboard** — your daily 10k-unit / 100-search budget, tracked locally

## Quick start

```bash
npm.cmd install
npm.cmd run setup     # creates .env.local, verifies the DB, prints a checklist
npm.cmd run dev       # web server → http://localhost:3000
npm.cmd run dev:full  # web server + background snapshot poller
```

Then edit `.env.local` and add your keys (see below). Restart the dev server after changing it.

## Credentials

**YouTube Data API key** (needed for scorecards, rankings, lookups):
1. [Google Cloud console](https://console.cloud.google.com) → create a project
2. APIs & Services → Library → enable **YouTube Data API v3**
3. Credentials → Create credentials → **API key** → paste into `YOUTUBE_API_KEY` in `.env.local`

**Google OAuth** (only for your own channel audit on `/audit`):
1. Credentials → Create credentials → **OAuth client ID** → Web application
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback`
3. Consent screen scopes: `youtube.readonly`, `yt-analytics.readonly`
4. Paste `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` into `.env.local`

## Chrome extension

Load the `extension/` folder unpacked (`chrome://extensions` → Developer mode →
**Load unpacked**). It overlays scores on YouTube, backed by your local server.
See `extension/README.md`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run setup` | one-time environment check + `.env.local` creation |
| `npm run dev` | dev server (Turbopack) |
| `npm run dev:full` | dev server + poller (concurrently) |
| `npm run poller` | run the snapshot poller standalone |
| `npm run build` / `start` | production build / run |
| `npm run test` | unit tests |
| `npm run typecheck` | tsc --noEmit |
| `npm run lint` | eslint |

## Tech & notes

- Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind v4
- Node 24 built-in `node:sqlite` (no native deps, no ORM)
- Free YouTube Data API (quota-ledgered) + keyless Google autocomplete
- Data lives in `./data/niche-scope.db` (git-ignored); API keys live in `.env.local` (git-ignored)

See `SESSION.md` for architecture, the scoring formulas, and the roadmap.
