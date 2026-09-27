# Implementation Plan: vidIQ-Style Extension v2 (Groq AI)

## Overview
Upgrade the existing Niche-Scope Chrome extension (currently watch-card + thumbnail pills) into a full vidIQ-style research + optimization tool. AI generation (title/description/tag suggestions, Magic Fill, AI Coach, Channel Audit summary, Daily Ideas) runs on the local server through Groq (`GROQ_API_KEY`, already the primary provider in `lib/aiAnalysis.ts`). Deep data comes from the already-present YouTube Data API + yt-dlp; keyword scoring reuses the existing free autocomplete engine. Extension stays MV3, no build step, no API key in the browser — everything proxies through `background.js` → `http://localhost:3000`.

## Architecture Decisions
- **AI stays server-side, Groq-first.** New `lib/aiStudio.ts` calls Groq (`openai/gpt-oss-20b`, api.groq.com/openai/v1) matching the existing provider pattern. All generated candidates get a deterministic heuristic score (`scoreCandidate`) so per-suggestion scores are instant, cheap, and stable (no extra AI round-trip for scoring).
- **Live Optimize Score = heuristic, not AI.** Title + thumbnail dominance (≈96% weight) per vidIQ; deterministic `computeOptimizeScore({title, description, tags})` so the score updates live as the user types without hammering Groq.
- **Tags from title + description + video content.** Content signal = yt-dlp auto-transcript (`lib/transcript.ts`). Groq merges title/desc/transcript into tag candidates; each candidate scored.
- **AI result cache in DB (`ai_cache` table, 24h TTL).** Groq calls are rate-limited/paid; identical requests (same inputs+action) are served from cache. Never cache in `chrome.storage.session` for AI (stale by design).
- **Vertical slices, one feature path at a time.** Foundation (server AI libs/endpoints) → YouTube research overlays → Studio optimizer → popup dashboard. Each phase ends with a checkpoint.
- **Defensive DOM handling everywhere.** YouTube/Studio are SPAs with unstable selectors → MutationObserver + fallbacks + graceful "server off / no data" states. Never break page UX.
- **No new Google quota pressure.** Outlier/channel-avg views come from the local `videos` table snapshots; transcript via yt-dlp; keyword demand via autocomplete. `search.list` only reused where already used.

## Task List

### Phase A0: Design System (see `tasks/style-plan.md`)

- [ ] **Task A0: `extension/ns-theme.css` — "Transmission" tokens + components + refactor existing overlay**
  - Tokens (soot/lift/ink/mute/amber/cyan/bad/glass) as CSS custom properties; component classes: `sig-meter` (segmented, fills amber/cyan), `strip`, `chip`, `pill`, `panel`; one mounted gesture (140ms) + instant action motion; `prefers-reduced-motion: reduce` honored.
  - Refactor existing watch card (Shadow DOM), thumbnail pills, and `popup.html/js` (+copy voice, sentence case) onto the new kit. Tokens single-sourced in `ns-theme.css`; shadow-root card copies the token block from a JS const with a pointer comment.
  - Acceptance: existing features (card, pills, popup, prefs) still work; no uppercase eyebrows / middle-dot metas / gradient headers remain; meter is the score rendering everywhere; contrast ≥ 4.5:1 on `soot`; reduced-motion has no animation.
  - Verification: `npm run typecheck`; load unpacked on YouTube light + dark, Studio, popup; visual review against `tasks/style-plan.md`.
  - Deps: None. Files: `extension/ns-theme.css`, `extension/content.css`, `extension/content.js`, `extension/popup.html`, `extension/popup.js`.

### Phase A: Server AI Foundation

- [ ] **Task 1: `lib/aiStudio.ts` — Groq generation lib + candidate scoring**
  - Actions: `titles`, `descriptions`, `tags`, `magicfill`, `coach`, `audit`, `ideas`.
  - `generateCandidates(action, inputs)` → typed candidates; `scoreCandidate()` heuristic (0-100) for titles/descriptions/tags; `computeOptimizeScore()` heuristic (0-100) updating with title/desc/tags; graceful provider-failure fallbacks.
  - Acceptance: exports cover all 7 actions; every title/desc/tag candidate carries a numeric score; `computeOptimizeScore` raises when title gains a keyword; no secrets logged.
  - Verification: `npm run typecheck`; `npm test` (new `lib/__tests__/aiStudio.test.ts`); manual: call lib from `tsx` with a fake key-free path check.
  - Deps: None. Files: `lib/aiStudio.ts`, `lib/__tests__/aiStudio.test.ts` (+ optional helper export from `lib/aiAnalysis.ts`).

- [ ] **Task 2: `lib/aiCache.ts` + `ai_cache` table**
  - `CREATE TABLE IF NOT EXISTS ai_cache (action, inputs_hash, result_json, created_at)`. `getAiCache`/`setAiCache` with 24h TTL hash lookup.
  - Acceptance: identical request → cached result, no duplicate Groq call (spy/test on hash fun + TTL); table auto-created on boot.
  - Verification: `npm run typecheck`; `npm test` (cache test with TTL).
  - Deps: None (DB init hook exists in `lib/db.ts`). Files: `lib/db.ts` (schema), `lib/aiCache.ts`, `lib/__tests__/aiCache.test.ts`.

- [ ] **Task 3: `lib/transcript.ts` — yt-dlp auto-transcript extraction**
  - Download auto-subs (VTT) via yt-dlp (`--skip-download --write-auto-sub --convert-subs srt` style), parse to plain text, cap ~10k chars. Graceful null on no-subs/age-restricted/yt-dlp missing.
  - Acceptance: returns text for a captioned video; null (not throw) on failure; no video downloaded.
  - Verification: `npm run typecheck`; `npm test` (parser unit tests with fixture VTT); manual `tsx` run on a known captioned video.
  - Deps: None. Files: `lib/transcript.ts`, `lib/__tests__/transcript.test.ts`, `test/fixtures/*.vtt`.

- [ ] **Task 4: `/api/ai/studio` route**
  - POST `{ action, videoId?, channelId?, title?, description?, tags?, query? }` → cached → generated candidate list (scored) or optimize score or coach answer. Wire transcript fetch when action needs content (`tags`, `magicfill`, `coach`).
  - Acceptance: all 7 actions return typed JSON; 400 on unknown action; cache hit on repeat with same inputs+action; 200 shape matches extension contract.
  - Verification: `npm run typecheck`; `npm run lint` scoped; manual `curl` for `titles`, `optimize`, `tags`, `coach` with Groq key set.
  - Deps: Tasks 1, 2, 3. Files: `app/api/ai/studio/route.ts`, `lib/types.ts` (AI candidates types).

- [ ] **Task 5: `/api/videos/tags` route + lookup enrichment (outlier/avg views)**
  - `GET /api/videos/tags?videoId=` → cached video tags + heuristic tag score + gap suggestions (from DB).
  - `POST /api/videos/lookup` extended: add `outlier` ratio (video views vs channel avg from `videos` table) + `channelAvgViews`.
  - Acceptance: tags endpoint returns typed tags w/ score; lookup includes outlier + channelAvgViews when channel data exists; backward-compatible.
  - Verification: `npm run typecheck`; `npm test`; manual curl on a public video.
  - Deps: None (reuses fetchVideos). Files: `app/api/videos/tags/route.ts`, `app/api/videos/lookup/route.ts`.

### Checkpoint: Server Foundation
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (aiStudio + cache + transcript + existing)
- [ ] curl `/api/ai/studio` (titles + optimize) returns scored data with Groq key
- [ ] Human review before Phase B

### Phase B: YouTube Research Overlays (content script)

- [ ] **Task 6: Hover stats bar + trending/outlier badges**
  - Thumbnail hover → tooltip: views, likes, comments, upload date, duration. Trending badge (VPH spike) + outlier badge from lookup enrichment.
  - Acceptance: hover tooltip appears on home/search/related thumbnails; badge shown when VPH high / outlier ratio ≥ threshold; prefs toggle.
  - Verification: load unpacked + `npm run dev`; hover on home feed; toggle in popup.
  - Deps: Task 5. Files: `extension/content.js`, `extension/content.css`, `extension/popup.html`, `extension/popup.js`, `extension/background.js`.

- [ ] **Task 7: Competitor tags reveal**
  - Watch page chip "Tags" → panel with all tags + score + notes. Data from `/api/videos/tags`.
  - Acceptance: chip on watch pages; panel opens with tags; missing tags → clear "no public tags".
  - Verification: manual on a video with tags + one without.
  - Deps: Task 5. Files: `extension/content.js`, `extension/content.css`.

- [ ] **Task 8: Search page keyword score panel + trending sidebar**
  - On `youtube.com/results?search_query=` → right panel: keyword demand/competition/overall (reuse `/api/keywords/research?term=` — free autocomplete scoring) + top trending videos in that niche (yt-dlp search result list).
  - Acceptance: panel renders on search pages; shows demand/competition/opportunity; links to top videos; toggleable.
  - Verification: manual search on YouTube with server on.
  - Deps: None (existing keyword API). Files: `extension/content.js`, `extension/content.css`, `extension/popup.js`.

- [ ] **Task 9: Channel research card on channel pages**
  - On `/@channel` pages → card: subs, total views, avg views/upload, upload cadence, top videos + outlier picks (from `/api/channels/lookup` + `videos` table + Task 5 enrichment).
  - Acceptance: card on channel pages; data from local DB when tracked, else lookup; graceful empty.
  - Verification: open a channel with saved videos + a fresh one.
  - Deps: Task 5. Files: `extension/content.js`, `extension/content.css`.

- [ ] **Task 10: AI Coach on watch page**
  - Duck-panel "Ask AI" on watch page → `POST /api/ai/studio {action:"coach", videoId, query}` (transcript + Groq) → streaming-style answer display.
  - Acceptance: answer renders for public captioned videos; non-AI answer + retry hint on no transcript; slow-call spinner.
  - Verification: ask "summarize this video" + follow-up on a captioned video.
  - Deps: Task 4 + 3. Files: `extension/content.js`, `extension/content.css`.

### Checkpoint: Research Layer
- [ ] All overlays render with server on; degrade cleanly with server off
- [ ] `npm run typecheck` still passes
- [ ] Human review before Phase C

### Phase C: YouTube Studio Upload Optimizer (Groq)

- [ ] **Task 11: Studio content script + floating toolbar**
  - New `extension/studio.js` (matched on `*://studio.youtube.com/*`), floating toolbar top-right in Studio (edit pages + upload flow). Manifest: add `*://studio.youtube.com/*` host permission.
  - Acceptance: toolbar always mounted in Studio; collapses; doesn't block Studio UI.
  - Verification: load unpacked, open a Studio video; toolbar visible.
  - Deps: Task 4. Files: `extension/studio.js`, `extension/content.css`, `extension/manifest.json`.

- [ ] **Task 12: Title suggestions panel (5 scored, click-to-insert, refresh)**
  - Panel lists 5 AI titles each with score bar; click inserts into the title textbox; Refresh re-rolls (new cache key). Live Optimize Score bump on insert.
  - Acceptance: 5 candidates with 0-100 scores; insert writes to the real title field; refresh yields a new set.
  - Verification: manual on Studio upload; verify title field value.
  - Deps: Task 11. Files: `extension/studio.js`, `extension/content.css`.

- [ ] **Task 13: Description suggestions (2-3 scored, click-to-insert)**
  - 3 description variants with scores; click inserts into description box.
  - Acceptance: 3 candidates w/ scores; insert works; live score updates.
  - Verification: manual Studio.
  - Deps: Task 12. Files: `extension/studio.js`, `extension/content.css`.

- [ ] **Task 14: Tag improve + addition (title + desc + transcript)**
  - "Tags" panel: current tags scored, weak ones flagged, additions recommended (from `{action:"tags"}`), each tagged keep/remove/add — click applies to tags input.
  - Acceptance: scored current tags; N additions from transcript; applying updates the tags field.
  - Verification: manual Studio with an uploaded video (transcript present).
  - Deps: Task 12 + 3. Files: `extension/studio.js`, `extension/content.css`.

- [ ] **Task 15: Optimize Score 0-100 + Magic Fill + Best Time to Post**
  - Live Optimize Score gauge (heuristic) always visible; Magic Fill button = one click `{action:"magicfill"}` fills title+desc+tags; Best Time to Post = heuristic from saved published times (own-analytics when connected, else similar-channel cadence) shown on schedule step.
  - Acceptance: gauge updates as fields change; Magic Fill populates all three fields; best-time chip appears when data available.
  - Verification: manual full upload-flow walkthrough.
  - Deps: Task 14 + Task 4. Files: `extension/studio.js`, `extension/content.css`.

### Checkpoint: Studio Optimizer
- [ ] Title/desc/tags insert + refresh + score all work in Studio
- [ ] Magic Fill populates fields; gauge live-updates
- [ ] Human review before Phase D

### Phase D: Popup AI Dashboard

- [ ] **Task 16: Channel Audit → AI summary in popup**
  - Popup "Audit" tab: reuse `/api/audit` for channel data + `/api/ai/studio {action:"audit"}` → concise AI findings + top fixes.
  - Acceptance: audit tab shows AI summary when channel connected; graceful "connect to run audit".
  - Verification: manual with connected OAuth channel (or mocked).
  - Deps: Task 4. Files: `extension/popup.html`, `extension/popup.js`, `extension/content.css`.

- [ ] **Task 17: Daily Ideas + Keyword research box + CSV export**
  - Popup tabs: Daily Ideas (Groq `{action:"ideas"}` from saved channels/niches), Keyword research box (existing `/api/keywords/research` + `/api/keywords` list), CSV export of current run.
  - Acceptance: ideas list renders; keyword box returns demand/competition rows; CSV downloads; prefs preserved.
  - Verification: manual in popup.
  - Deps: Task 16. Files: `extension/popup.html`, `extension/popup.js`, `extension/background.js` (CSV via blob + download).

### Checkpoint: Complete
- [ ] All acceptance criteria above met across server + extension
- [ ] `npm run typecheck`, `npm test`, `npm run lint` (new files clean)
- [ ] Full manual walkthrough: browse YouTube (overlays) → Studio (optimize) → popup (audit/ideas/keywords/CSV)
- [ ] README updated (`extension/README.md`)
- [ ] Human sign-off

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| YouTube/Studio DOM selectors change | Med | MutationObserver, defensive selectors, graceful no-op, no page-break |
| Groq rate limits / cost | Med | 24h `ai_cache`, small model, scored via heuristic not AI, one AI round-trip per action |
| yt-dlp transcript fails (no subs, age-restricted) | Med | Return null → clear "transcript unavailable" in UI; tags fall back to title+desc only |
| Best Time to Post without OAuth | Low | Heuristic from saved publish times; feature hidden when no data |
| Google API quota drain | Med | Prefer autocomplete/yt-dlp/DB; outlier/avg from local `videos` table, no new search.list calls |

## Open Questions
- **Design direction:** confirm the "Transmission" control-room instrument identity (dark glass panels, segmented signal meters, amber live-signal + cyan telemetry). Alternative if rejected: light instrument strips on near-white with the same meter language. See `tasks/style-plan.md`. (`tasks/style-plan.md`)
- Confirm Groq model choice: keep `openai/gpt-oss-20b` (already configured) vs switch to `llama-3.3-70b-versatile` for quality? (Default: keep gpt-oss-20b for cost/speed.)
- Best Time to Post: use own-channel analytics when connected (OAuth) — confirm that's acceptable vs heuristic-only.