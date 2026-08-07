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

Status: **Phases 1–6 complete**. Phase 7 pending (see Next Steps).

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
- Remote: `https://github.com/S-Q-Ali/YouTube-Creator-Tool.git` (branch `main`).
  - **Commit/push workflow**: every session ends with `git add -A && git commit -m "<summary>" && git push`.
  - Identity (project-local): `S-Q-Ali <syedqasim963@gmail.com>`.
  - `gh` CLI is NOT installed — create repos on github.com manually and paste the URL.
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
snapshot.ts        snapshotTrackedVideos/Channels/Keywords + runAllSnapshots — shared by the
                     poller and POST /api/competitors/refresh (keyword re-rank is 24h-cached)
  competitorEngine.ts getCompetitorDashboard → { videos, channels, keywords } with snapshot series,
                     VPH, 7-day subscriber growth, and current keyword rankings
  oauth.ts           OAuth core: consent URL + CSRF state, code/refresh token exchange, persisted
                     token storage (settings table), getValidAccessToken (auto-refresh), clearOAuth,
                     isConnected/oauthChannelId/oauthEnabled, redirectUri
  ownanalytics.ts    OAuth-authenticated calls: fetchOwnChannel (mine=true), fetchChannelAnalytics
                     (youtubeanalytics reports, totals + per-day), getOwnAudit, snapshotOwnChannel,
                     getOwnRecentVideos (from local cache)
app/
  layout.tsx + nav    header nav: Dashboard /, /keywords, /videos, /competitors, /audit, /settings
  page.tsx            dashboard with 4 tool cards
  keywords/           list page + [term] detail page (uses decodeTerm!, has Track keyword button)
  videos/             scorecard page (ScorecardLookup)
  competitors/        tracking dashboard (CompetitorsView)
  audit/              own-channel audit dashboard (ConnectCard / stats + daily views sparkline + recent uploads)
  settings/           OAuth connect/disconnect + quota readout + env/redirect info
  api/
    health/ quota/          status endpoints (200 verified)
    keywords/research       POST research seed term
    keywords                GET list / POST upsert
    keywords/[term]         GET detail + snapshots / POST rerank
    videos/lookup           POST {url} -> video SEO + VPH + channel info (400 on bad input)
    channels/lookup         POST {url} -> channel SEO + recent uploads
    track                   POST add/remove, GET list tracked items
    competitors             GET dashboard JSON
    competitors/refresh     POST runAllSnapshots + return fresh dashboard
    auth/start              GET 302 → Google consent (sets oauth_state cookie)
    auth/callback           GET exchange code → store tokens → redirect /audit (CSRF-state checked)
    auth/status             GET { connected }
    auth/logout             POST clear OAuth tokens
    audit                   GET/POST own-channel audit (analytics + cached recent uploads)
components/
  ScoreBadge.tsx       ScoreBadge, CompetitionBadge, scoreColor/scoreLabel/competitionColor
  KeywordResearch.tsx  client research form
  ScorecardLookup.tsx  client video/channel scorecard form + result rendering
  CompetitorsView.tsx  client dashboard: refresh-now + video/channel/keyword sections w/ sparklines
  ConnectCard.tsx      client: Connect-with-Google link or Disconnect button
  RefreshButton.tsx    client: POST /api/audit + router.refresh()
  Sparkline.tsx        tiny SVG sparkline
  RerankButton.tsx     rerank action for detail page
  TrackButton.tsx      add/remove watchlist button
scripts/poller.ts      hourly snapshot loop via lib/snapshot.ts (10-min dedupe bucket)
lib/__tests__/         keywordEngine (10) + scorecard (8) + competitorEngine (2) — all passing
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

- `YOUTUBE_API_KEY` is **set** (added by user) — all live YouTube calls work.
- OAuth creds (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) are **set**; consent redirect is
  `http://localhost:3000/api/auth/callback`. OAuth scopes: `youtube.readonly` + `yt-analytics.readonly`.
- Quota: 10K data units/day + 100 search.list/day, per-UTC-day in `settings` (OAuth calls also count).

## How to Run / Verify

```powershell
npm.cmd run dev          # dev server http://localhost:3000
npm.cmd run dev:full     # dev + poller
npm.cmd run test         # 20 tests
npm.cmd run typecheck
npm.cmd run lint
node node_modules/next/dist/bin/next typegen   # after route changes
```

Known verified behaviors:
- `/api/quota` and `/api/health` return 200 with DB-backed quota JSON
- Keyword research: seed "keto diet" → ~344 related keywords, top ranked
- Scorecard: invalid input → 400; `/videos` page renders; track add/list/remove round-trips
- `/competitors` page renders; `/api/competitors` returns dashboard JSON; `/api/competitors/refresh`
  returns 200 + summary (0s without an API key)

## Next Steps (phases)

1. **Phase 7 — Hardening**: setup script (`npm run setup`), quota dashboard page,
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
- **2026-08-07** (Session 3): added `SESSION.md` (session history), proper project `README.md`,
  `.gitignore` for `data/`, initialized git, added remote
  `https://github.com/S-Q-Ali/YouTube-Creator-Tool.git`, merged remote initial commit, pushed `main`.
  Established commit/push workflow: every session ends with a commit + push.
- **2026-08-07** (Session 4): **Phase 4 done** — competitor tracking. `lib/snapshot.ts` (shared
  poller/refresh logic + 24h-cached keyword re-rank), `lib/competitorEngine.ts` (dashboard with
  VPH + 7d sub growth + keyword rankings), `lib/db.ts` `closeDb()`, `/api/competitors` GET +
  `/api/competitors/refresh` POST, `/competitors` page + `CompetitorsView` (refresh-now, sparkline
  sections, per-row untrack buttons), Track button on keyword detail page, refactored `poller.ts`
  to use snapshot lib. competitorEngine.test.ts (temp-DB via `DATABASE_DIR`). **20/20 tests**,
  typegen/typecheck/lint clean, routes verified live.
- **2026-08-07** (Session 5): **Phase 5 done** — OAuth channel audit. `lib/oauth.ts` (consent URL +
  CSRF state cookie, code/refresh token exchange, persisted tokens, auto-refresh),
  `lib/ownanalytics.ts` (fetchOwnChannel via mine=true, youtubeanalytics reports totals+per-day,
  getOwnAudit, snapshotOwnChannel, getOwnRecentVideos). API routes /api/auth/{start,callback,status,logout}
  + /api/audit. Pages /settings (connect/disconnect + quota readout) and /audit (channel stats,
  28-day analytics cards + daily-views sparkline + cached recent uploads). Components ConnectCard,
  RefreshButton. tokens stored in `settings` table. **20/20 tests**, typegen/typecheck/lint clean,
  live-verified: /settings & /audit 200, /api/auth/start 302→Google consent, auth/status → connected:false.
- **2026-08-07** (Session 6): **Phase 6 done** — Chrome MV3 extension in `/extension`.
  `manifest.json` (host_permissions `http://localhost:3000/*`), `background.js` (message proxy +
  10-min `chrome.storage.session` cache), `content.js` (watch-page floating card via Shadow DOM +
  thumbnail score pills with MutationObserver + History-API re-route), `popup.html/popup.js`
  (server status, quota, tracked counts, audit status), `content.css`, `README.md`.
  No build step — load unpacked. OAuth round-trip VERIFIED live (user connected "MovieMinds USA",
  analytics populated); API key verified via real lookup (Never Gonna Give You Up → seo 80,
  actionable 100%/perf 59%). lint clean after removing unused var, node --check all JS OK,
  20/20 tests, all 4 extension endpoints confirmed 200.
