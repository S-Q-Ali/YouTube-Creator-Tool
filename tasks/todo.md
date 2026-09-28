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

- [x] S0: Token base — perceptual palette (oklch-era hex), elevation tokens (`--ns-e1/e2/e3` = lightness steps), theme attr `[data-ns-theme="dark|light"]` + `color-scheme`; sync mirror in `content.js` NS_TOKENS
- [x] S1: Quiet chrome / density — strips sans border-top hairline (8px gap + type hierarchy), shadow/border hatao data surfaces (elevation = lightness), popup padding 16px
- [x] S2: Typography — Bahnschrift variable `font-variation-settings: "wght"` (`--ns-w-read`), live readings heavier / structure lighter, count-up reveal for readings (respects reduced motion), tabular everywhere
- [x] S3: Micro-interaction — one entry moment per surface, live-VPH amber glow pulse, reduced-motion gates intact
- [x] S4: Popup restructure — editorial header (dot + name + server reading), prefs as grouped strips, custom toggle controls, footer; same tokens
- [x] S5: Light/dark adaptive — content surfaces set `data-ns-theme` from `matchMedia("(prefers-color-scheme)")` + change listener; light token overrides (amber darkens to `#9a6300`, ink→`#1d232b`, glass→light); content.css + pills adapt; popup `color-scheme: light dark`
- [x] S6: Verify — eslint, vitest, live render on YouTube dark+light, Studio, popup; contrast ≥4.5:1 both themes; reduced-motion
  - Code gates green (typecheck, vitest 48, eslint extension 0, CSS braces OK); live visual walkthrough on YouTube/Studio still manual (S5/S6 render check)

## Phase T: Always-On Card Data (no hover)

Replaces the hover tooltip: every card states its data without being pointed at. Patterns chosen: **P1 meta-line** + **P3 verdict chip**, **gaps-only** content, default `chip + line`. The watch-page card stays as the detail surface.

Two numbers, deliberately separate: **velocity** = views ÷ hours since publish (`lib/velocity.ts`, works for any video) and **24h trend** = snapshot delta (watchlist only, `lib/vphEngine.ts`).

- [x] T1: `lib/velocity.ts` — lifetime views/hour, age floored at 1h, 1-decimal rounding, daily rate derived from the hourly rate; spike threshold in one place
- [x] T2: `extension/lib/nsMeta.js` as the Tier 0 grid reader — parses the text a card already prints (abbreviated counts, separators, `No views`, `Streamed`/`Premiered`/`yesterday`, absolute dates); loaded as a classic content script and covered by `extension/tests/nsMeta.test.mjs`, including a contract test pinning its maths to `lib/velocity.ts`
- [x] T3: `POST /api/videos/grid` — up to 50 ids per call (one `videos.list` unit), lean row via `lib/gridRows.ts` (exact views, runtime, velocity, grade, spike), server TTL cache makes re-scrolls free
- [x] T4: Always-on line under every grid card — painted from the card's own text with no request, scoped to grid routes, inserted in the card's own metadata block, refilled in place so a tile never reflows twice
- [x] T5: Tier 1 upgrade — ids queued per pass, one request 250ms after the DOM settles, runtime shown only when the card has no runtime badge of its own
- [x] T6: Verdict chip carries the grade letter and reads the same batch row (per-video lookups dropped)
- [x] T7: Hover tooltip, its pref and its CSS removed; popup gains `Card data` (off / velocity only / everything) and `Cards per pass`
- [x] T8: Watch card shows `velocity` and `24h trend` as separate readings; spikes and the trending badge follow the lifetime rate
- [x] T9: Extension 0.3.0 + README rewritten around always-on data
- [ ] T10: Live check on YouTube home/search/channel — line lands under the card's own metadata, no reflow, both themes, reduced motion

## Phase U: Richer Card Block + Thumbnail Save

Phase T's single line grew into two rows, and the watch page gained a save action. Decisions locked by the user: **gaps-only** (the channel name and YouTube's own view count are never repeated), the block is `exact views · date · subscribers` over `velocity · outlier`, and the thumbnail save lives in the **watch menu under "Audio and captions"**.

New readings, and where they come from: **subscribers** and the **outlier baseline** both ride on one `channels.list` per page (2 quota units per 50 cards). An outlier is a video's views against the channel's lifetime views per video, so it works for channels nobody tracked; the watch card prefers the average of videos it has stored and says which basis it used. `lib/lineModel.js` owns the wording and is tested without a browser.

- [x] U1: `lib/outlier.ts` — channel average from lifetime views ÷ video count, 3-video floor, NaN/zero guards; the watch card falls back to it and labels the basis (`outlierBasis`)
- [x] U2: `POST /api/videos/grid` — one `channels.list` adds `subscribers` + `outlier` per row (degrades to video-only rows if it fails); `toVideoInfo`/`toChannelInfo` prefer the API's `maxres` thumbnail
- [x] U3: `extension/lib/nsMeta.js` — `fmtExact`, `fmtDate`, `fmtSubs`, `fmtDur`, `fmtOutlier`, `outlierTone`; the content script and the watch card now share them instead of keeping copies
- [x] U4: Two-row line — context row (exact views, absolute date, subscribers, runtime gap-fill) + judgment row (velocity, outlier); `extension/lib/lineModel.js` + tests; density modes `off` / `compact` / `full` with `full` the default
- [x] U5: `Download thumbnail` row cloned into the watch menu under "Audio and captions"; `chrome.downloads` with a maxres → hq → mq fallback chain; `extension/lib/thumb.js` + tests for naming, candidate order and which row to follow
- [x] U6: Extension 0.4.0 + README rewritten around the two-row block, the 2-unit page cost and the save action
- [x] U7: Fixes found while wiring the above — a failed batch is retried instead of dropped, a video in two slots upgrades both lines, changing density repaints, an old `line` mode value upgrades to `full`
- [ ] U8: Live check — block lands under the title on home/search/channel, the menu row appears under "Audio and captions", a save lands in the downloads folder at the best size, both themes

## Phase V: The Card Says Only What It Cannot

Decisions locked by the user, after looking at the real cards: the strip hangs **under the whole card** (not inside YouTube's metadata block), it says only `subscribers` / `views per hour` / `outlier score`, the **grade chip is gone** (the watch page keeps score and grade), and the thumbnail save moves onto the card itself as an icon **below the Volume and Captions buttons**. Data is **server-only** - the strip waits rather than guessing from a card's own text.

- [x] V1: `extension/lib/lineModel.js` rewritten to three readings on two rows (`subscribers` / `views per hour` | `outlier score`), a value-class-title cell so the explanation lives in the hover text, and an explicit blank until the server answers; `fmtOutlierScore` + `outlierHint` added to `nsMeta.js`
- [x] V2: `extension/lib/tiles.js` - which cards qualify, decided apart from the painting and tested against a real grid: only the inner `yt-lockup-view-model`, never the `ytd-rich-item-renderer` wrapper; ads and linkless tiles skipped; the strip is appended to the tile so it lands below the title
- [x] V3: Server-only strip - the card's own text is no longer parsed, the runtime gap-fill and the compact mode are gone, the line separator is `|`, and the grid model carries only the four numbers the strip renders
- [x] V4: Verdict chip removed end to end - overlay code, prefs (`showPills`, `pillLimit`), popup toggles and `.ns-pill*` CSS; the watch-page score and grade are untouched
- [x] V5: `extension/lib/thumb.js` - the hover icon: prefer the language-independent overlay classes, fall back to the labels, never climb out of the thumbnail, and add nothing when there is no overlay; one place (`saveThumb`) asks the worker to save, so the watch menu and the card icon cannot drift
- [x] V6: Extension 0.5.0, README and popup copy rewritten around the three readings and the new icon
- [x] V7: The Tier 0 grid reader retired - `parse`/`velocity`/`parseViews`/`parseAge` had no caller left once the strip went server-only, and `lib/velocity.ts` is now the only velocity implementation
- [ ] V8: Live check - strip lands under the card on home/search/channel, no reflow, no duplicates, no chip, the icon appears under Volume and Captions on hover and saves the file, both themes, reduced motion
- [ ] V9: `NS_TOKENS` in `content.js` re-checked against `extension/ns-theme.css` (canonical)

## Phase W: Hover icon repair + card polish

Follow-up to Phase V, from the user's report: the strip renders, the hover download icon does not. Root cause is in the plan - the current YouTube hover controls are created inside the hover *preview* on hover, so they are absent from the DOM when the card pass runs, and `findAnchor` returned null and skipped silently.

- [x] W1: Diagnostic shipped with the fix - one `console.debug` per page load naming cards/mounted/missed, the image box element, and why a card was missed. A `__nsHover()` global was dropped: content scripts live in an isolated world, so a function the content script defines is invisible from the DevTools console, which is where the report is actually read.
- [x] W2: `findAnchor` is now the first half of a cascade - (a) sit under the site's own row when one is really in the DOM, (b) otherwise the button is appended to the image box, `position: relative` only if static, `overflow` never touched. `hoverSlot` + `attach` are the tested seams
- [x] W3: `cardTitle` learned the current lockup title (`a.ytLockupMetadataViewModelTitle`, `a#video-title-link`) with the BEM `h3` shapes as fallback
- [x] W4: `.ns-ovl-btn--boxed` in the bottom-left corner (duration badge owns bottom-right), revealed on container hover and on focus, 36px hit area, one-button-per-card guard inside `attach` itself
- [x] W5: Fixture gained the shape that actually ships - a `yt-lockup-view-model` with a `yt-thumbnail-view-model` and no hover row at all, which is what the old fixture was missing. 9 new tests cover both branches, the no-escape rule, the single-mount rule, the position-context rule and the honest no-image case. 154 pass
- [x] W6: The readings now take the pointer (`pointer-events: auto` on the values only, so a click in the gaps still falls through) with a faint wash on hover, and every tip says what the number is - "Views per hour — lifetime views divided by how many hours the video has been up"
- [x] W7: Strip hierarchy fixed - subscribers recedes to muted 400, the two judgements carry 700, the typed `|` became a drawn rule that lines up with tabular figures, cells can shrink and ellipsis, calmer leading
- [x] W8: 0.5.1, `extension/README.md` (including how to read the probe line), gates, push
- [ ] W9: Live check - hard-refresh YouTube, hover a card on **home** (not `/watch`, where the grid pass is off by design), confirm the icon, the tooltip, and an actual saved `.jpg`

Two bugs the new tests caught before a browser ever saw them, both worth the
fixture fix: `querySelector` with a comma-separated list returns the first match
in *document* order, not the order you wrote, so the image link was beating the
image element; and the one-button-per-card guard only existed at the call site,
so a repeated page pass could stack icons.
