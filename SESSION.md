# Niche-Scope — Session History

> Keep this file up to date. It is the single source of truth for reconstructing
> project context after a conversation gets compacted. Update "Changelog" after
> every working session.

## Overview

Build **Niche-Scope**: a fully-local, vidIQ-style YouTube toolkit as a Next.js
full-stack app plus a Chrome MV3 extension that overlays scores on
youtube.com. Everything runs against a local SQLite database (`node:sqlite`,
no native deps, no ORM). No accounts, no cloud backend.

Features (all selected by user):
1. Keyword research + difficulty/demand scoring (keyless autocomplete + free YouTube Data API)
2. Video & channel scorecard (vidIQ-style audit)
3. Competitor / keyword position tracking with snapshot history + charts
4. Channel audit of your own channel (requires OAuth)
5. Chrome extension overlay on youtube.com

Status: **Phase 3 complete**. Phases 4–7 pending (see Next Steps).

## Tech Stack & Environment

- Next.js **16.3.0** (App Router, Turbopack default), React 19.2.8, TypeScript strict
- Tailwind CSS v4
- Node **v24.18.0** (built-in `node:sqlite` → `DatabaseSync`, confirmed working)
- npm 11.16.0 — **must use `npm.cmd`** (npm.ps1 blocked by PowerShell execution policy)
- Vitest for tests, tsx for script probes, concurrently for `dev:full`
- Platform: Windows, PowerShell 5.1, dev server on `http://localhost:3000`

### Next.js 16 gotchas (READ BEFORE CODING)
- Docs live in `node_modules/next/dist/docs/` — read the relevant guide first.
- **Dynamic route `params` arrive URL-encoded raw** (e.g. `keto%20diet%20recipes`).
  Always run through `decodeTerm()` in `lib/keywordEngine.ts` before DB lookups.
- After adding/removing routes run `node node_modules/next/dist/bin/next typegen`
  to regenerate `LayoutProps`/`PageProps`/`RouteContext` types.
- No `PageProps`/`LayoutProps` imports by hand — use generated ones.
- ESLint is the default `eslint .` config in v16 (flat config).

## Repository & GitHub

- Repo initialized at `E:\Web App\Niche-Scope` (git history created this session).
- Remote: TBD — `gh` CLI is NOT installed on this machine.
- `.gitignore`: covers `.env*`, `.next/`, `node_modules`, plus `data/` (local SQLite DB).
- `.env.local` is git-ignored; `.env.example` is committed as the template.

## Scripts (`package.json`)

| Script | Purpose |
|---|---|
| `npm run dev` | next dev (Turbopack) |
| `npm run dev:full` | concurrently: next dev + poller |
| `npm run poller` | tsx scripts/poller.ts (snapshot loop) |
| `npm run build` / `start` | production build/run |
| `npm run lint` | eslint . |
| `npm run typecheck` | tsc --noEmit |
| `npm run test` | vitest run |
| `npm run typegen` | not defined; run `node node_modules/next/dist/bin/next typegen` |

## Configuration (`lib/config.ts`)

- `YOUTUBE_API_KEY` from `.env.local` (currently empty — feature still works, competition degrades to Low/0).
- Quota budget (YouTube Data API, per UTC day, tracked in `settings` table):
  - `data` bucket: 10,000 units/day
  - `search` bucket: 100 calls/day
  - bucket keys use UTC ymd: `quota_data_YYYYMMDD`, `quota_search_YYYYMMDD`
- TTLs: videos/channels 1h, keyword rankings 24h.
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- OAuth placeholders in `.env.example`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (needed Phase 5).

## Data Model (`lib/db.ts`, SQLite WAL, `./data/niche-scope.db`)

- `settings` — key/value (quota buckets, version)
- `keywords` — researched terms (demand, competition, score, display_term)
- `keyword_snapshots` — keyword_rank, term, ts, top_video_ids (daily snapshots for charts)
- `videos` / `channels` — cached YouTube entity data (with TTL)
- `video_snapshots` / `channel_snapshots` — hourly poller history (drives VPH + trend charts)
- `tracked_items` — watchlist (kind: video|channel|keyword, ref_id, label, added_at)
- `rankings` — per-search ranking history

All IDs from the API are numeric strings; stored as TEXT. `bigint` (Likes/Views)
normalized to Number in `lib/types.ts` helper types.

## Architecture / File Map

```
lib/
  config.ts          env, TTLs, quota limits, requireApiKey()
  db.ts              node:sqlite singleton (get/all/run/now), schema, WAL
  types.ts           shared row types (bigint-normalized)
  youtubeClient.ts   quota-ledgered fetches, TTL caching, parse helpers,
                     fetchVideos/fetchChannels/fetchChannelByHandle (forHandle),
                     searchVideos (search bucket), fetchChannelUploadIds (UU playlist),
                     parseVideoInput/parseChannelInput/parseDuration,
                     error classes YoutubeApiError/QuotaExceededError/RateLimitedError,
                     getQuotaStatus
  autocomplete.ts    fetchSuggestions (suggestqueries.google.com client=firefox&ds=yt),
                     expandSeed (a-z + 0-9 + question words), 502 retries
  keywordEngine.ts   computeDemand, competitionFromViews, overallScore, rankKeyword,
                     researchKeyword (single-pass expansion), decodeTerm, upsertKeyword,
                     getCachedKeywords/getKeyword/getKeywordSnapshots/getRankedVideos
  scorecard.ts       computeSeoScore (50% actionable + 50% performance), computeChannelSeoScore,
                     scoreLabel (A-F), seoCheckSections; SeoCheck/SeoResult/SeoInput types
  vphEngine.ts       computeVph (views/hour from video_snapshots, 24h window), getVideoSnapshots
  tracking.ts        addTracked/removeTracked/isTracked/listTracked (tracked_items)
app/
  layout.tsx + nav    header nav: Dashboard /, /keywords, /videos, /competitors, /audit, /settings
  page.tsx            dashboard with 4 tool cards
  keywords/           list page + [term] detail page (uses decodeTerm!)
  videos/             scorecard page (ScorecardLookup)
  api/
    health/ quota/          status endpoints (200 verified)
    keywords/research       POST research seed term
    keywords                GET list / POST upsert
    keywords/[term]         GET detail + snapshots / POST rerank
    videos/lookup           POST {url} -> video SEO + VPH + channel info (400 on bad input)
    channels/lookup         POST {url} -> channel SEO + recent uploads
    track                   POST add/remove, GET list tracked items
components/
  ScoreBadge.tsx       ScoreBadge, CompetitionBadge, scoreColor/scoreLabel/competitionColor
  KeywordResearch.tsx  client research form
  ScorecardLookup.tsx  client video/channel scorecard form + result rendering
  Sparkline.tsx        tiny SVG sparkline
  RerankButton.tsx     rerank action for detail page
  TrackButton.tsx      add/remove watchlist button
scripts/poller.ts      hourly snapshot loop for tracked items (10-min dedupe bucket)
lib/__tests__/         keywordEngine.test.ts (10) + scorecard.test.ts (8) — all passing
```

## Scoring Formulas (transparent, documented in code)

- **Overall keyword score** = demand × (100 − competition) / 100
- **Demand**: derived from autocomplete suggestion ordering (rank-based)
- **Competition**: share of top search results with ≥100k views + log-scaled avg of top-10 views
- **Video SEO score**: 50% actionable (title length 12, description ≥300 12, ≥5 tags 12,
  keyword-in-title 10, keyword-in-desc 8, keyword-in-tags 8, triple-keyword 8)
  + 50% performance (engagement 30, growth velocity views/day 30)
- **VPH**: Δviews / Δhours over last 24h of video_snapshots (needs ≥2 snapshots, ≥1h apart)
- **Channel SEO**: reuse computeSeoScore on title/description/channelTags/subscriberCount

## API Key / Quota Status

- `.env.local` currently has EMPTY `YOUTUBE_API_KEY`. With no key:
  - autocomplete still works (keyless)
  - ranked competition degrades to Low(0) — `requireApiKey()` gates it
  - lookup routes return a clean "API key required" error until key added
- To go live: add key to `.env.local`, restart dev server. Quota ledger resets daily.
- The free quota (10K data units/day) covers ~all lookup use-cases; `search.list` is capped at 100/day.

## How to Run / Verify

```powershell
npm.cmd run dev          # dev server http://localhost:3000
npm.cmd run dev:full     # dev + poller
npm.cmd run test         # 18 tests
npm.cmd run typecheck
npm.cmd run lint
node node_modules/next/dist/bin/next typegen   # after route changes
```

Known verified behaviors:
- `/api/quota` and `/api/health` return 200 with DB-backed quota JSON
- Keyword research: seed "keto diet" → ~344 related keywords, top ranked
- Scorecard: invalid input → 400; `/videos` page renders; track add/list/remove round-trips

## Next Steps (phases)

1. **Phase 4 — Competitor tracking**: wire `tracked_items` into poller (already snapshots),
   build `/competitors` dashboard (list tracked videos/channels + keyword rankings) with
   Sparkline charts over `*_snapshots`, show VPH trend per tracked video.
2. **Phase 5 — Channel audit (OAuth)**: `/audit` + `/settings` with Google OAuth
   (`youtube.readonly` + `yt-analytics.readonly`), own-channel insights.
3. **Phase 6 — Chrome MV3 extension** in `/extension`: content script overlay on
   youtube.com fetching `localhost:3000/api/...` (CORS enabled), popup with summary.
4. **Phase 7 — Hardening**: setup script (`npm run setup`), quota dashboard page,
   README polish, first production `npm run build` verification.

## Changelog

- **2026-08-06** (Session 1): scaffolded app (create-next-app, moved into workspace),
  DB layer + youtubeClient + autocomplete + poller, keyword research engine + API +
  UI, verified live; 10 engine tests; quota/health endpoints; typegen/lint/typecheck clean.
- **2026-08-07** (Session 2): Phase 3 scorecard — `lib/scorecard.ts` (SEO engine, A–F labels),
  `lib/vphEngine.ts`, `lib/tracking.ts`, `TrackButton`, `/api/videos/lookup`, `/api/channels/lookup`
  (+ `fetchChannelByHandle`), `/api/track`, `/videos` page + `ScorecardLookup` UI;
  scorecard.test.ts (8 tests) — **18/18 passing**, typecheck/lint/typegen clean, routes verified live.
  Repo initialized for GitHub.
