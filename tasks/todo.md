# Task List — vidIQ-Style Extension v2 (Groq AI)

## Phase A0: Design System ("Transmission" — see `tasks/style-plan.md`)

- [x] Task A0: `extension/ns-theme.css` tokens + components (meter/strip/chip/pill/panel) + motion; refactor watch card, pills, popup onto it; sentence-case copy

### Checkpoint: Design System
- [x] Existing features (card/pills/popup/prefs) still work on new kit
- [x] No uppercase eyebrows / middle-dot metas / gradient header remain
- [x] Contrast ≥ 4.5:1 on `soot`; reduced-motion honored
- [ ] Visual review on YouTube light + dark + Studio against `tasks/style-plan.md` (manual)

## Phase A: Server AI Foundation

- [x] Task 1: `lib/aiStudio.ts` — Groq generation lib + candidate scoring (titles/descriptions/tags/magicfill/coach/audit/ideas) + `computeOptimizeScore`
- [x] Task 2: `lib/aiCache.ts` + `ai_cache` table (24h TTL hash cache)
- [x] Task 3: `lib/transcript.ts` — yt-dlp auto-transcript extraction + parser tests
- [x] Task 4: `/api/ai/studio` route (all 7 actions, cached, typed JSON)
- [x] Task 5: `/api/videos/tags` route + lookup enrichment (outlier + channelAvgViews)

### Checkpoint: Server Foundation
- [x] `npm run typecheck` passes
- [x] `npm test` passes
- [x] curl `/api/ai/studio` returns scored data with Groq key
- [x] Human review before Phase B (approved via continue)

## Phase B: YouTube Research Overlays

- [x] Task 6: Hover stats bar + trending/outlier badges (thumbnails)
- [x] Task 7: Competitor tags reveal (watch page)
- [x] Task 8: Search page keyword score panel + trending sidebar
- [x] Task 9: Channel research card (channel pages)
- [x] Task 10: AI Coach on watch page (transcript + Groq)

### Checkpoint: Research Layer
- [x] `npm run typecheck` passes
- [ ] All overlays render with server on; degrade cleanly with server off (manual)
- [ ] Human review before Phase C

## Phase C: Studio Upload Optimizer (Groq)

- [ ] Task 11: `extension/studio.js` + floating toolbar + manifest host permission
- [ ] Task 12: Title suggestions (5 scored, click-to-insert, refresh)
- [ ] Task 13: Description suggestions (2-3 scored, click-to-insert)
- [ ] Task 14: Tag improve + addition (title + desc + transcript), scored
- [ ] Task 15: Optimize Score 0-100 live + Magic Fill + Best Time to Post

### Checkpoint: Studio Optimizer
- [ ] Title/desc/tags insert + refresh + score work in Studio
- [ ] Magic Fill populates; gauge live-updates
- [ ] Human review before Phase D

## Phase D: Popup AI Dashboard

- [ ] Task 16: Channel Audit → AI summary (popup tab)
- [ ] Task 17: Daily Ideas + Keyword research box + CSV export (popup tabs)

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] `npm run typecheck`, `npm test`, `npm run lint` clean (new files)
- [ ] Full manual walkthrough (YouTube → Studio → popup)
- [ ] `extension/README.md` updated
- [ ] Human sign-off

## Phase S: Style V2 — "Raster Instrument" + Adaptive (A+D)

Direction chosen: evolve Transmission with quiet chrome, elevation-by-lightness, variable Bahnschrift weight, amber reserved for state; plus `prefers-color-scheme` light/dark adaptive. See `tasks/style-plan.md` §v2.

- [ ] S0: Token base — perceptual palette (oklch-era hex), elevation tokens (`--ns-e1/e2/e3` = lightness steps), theme attr `[data-ns-theme="dark|light"]` + `color-scheme`; sync mirror in `content.js` NS_TOKENS
- [ ] S1: Quiet chrome / density — strips sans border-top hairline (8px gap + type hierarchy), shadow/border hatao data surfaces (elevation = lightness), popup padding 16px
- [ ] S2: Typography — Bahnschrift variable `font-variation-settings: "wght"` (`--ns-w-read`), live readings heavier / structure lighter, count-up reveal for readings (respects reduced motion), tabular everywhere
- [ ] S3: Micro-interaction — one entry moment per surface, live-VPH amber glow pulse, reduced-motion gates intact
- [ ] S4: Popup restructure — editorial header (dot + name + server reading), prefs as grouped strips, custom toggle controls, footer; same tokens
- [ ] S5: Light/dark adaptive — content surfaces set `data-ns-theme` from `matchMedia("(prefers-color-scheme)")` + change listener; light token overrides (amber darkens to `#b97a00`, ink→`#1d232b`, glass→light); content.css + pills adapt; popup `color-scheme: light dark`
- [ ] S6: Verify — eslint, vitest, live render on YouTube dark+light, Studio, popup; contrast ≥4.5:1 both themes; reduced-motion