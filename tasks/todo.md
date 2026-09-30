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

## Phase G: Glassmorphism pass

Planned in `tasks/glass-plan.md` (new file - `tasks/plan.md` and the Phase C/D
work above are untouched). Every visual surface in `extension/` moves to a full
glass treatment: translucent tinted layers, blur, luminous hairline, soft shadow,
modern radii. No tile limit was imposed, per the user's decision; the scroll cost
is handled by making blur cheap rather than by showing glass on fewer surfaces.

Design premise changes on purpose: the current system states "never shadows" and
"no chrome" and pins a 2px radius, and full glass inverts all three. The file's
comments get rewritten so the next change is not made against a premise that no
longer holds. Typography is not touched.

- [x] G0.1: `web_accessible_resources` for `ns-theme.css`; inject the real stylesheet into each shadow root instead of the `NS_TOKENS` + `NS_COMPONENTS` strings - done via `adoptedStyleSheets`; tokens arrive by inheritance from the `data-ns-theme` host, so no token block is needed in the shadow
- [x] G0.2: delete both JS CSS copies and fold the card-only rules (`.ns-head`, `.ns-score`, `.ns-row`, `.ns-badge`, `.ns-item`, `.ns-coach`, `.ns-chipbtn`, `.ns-skeleton`, `.ns-tags`) into `ns-theme.css`, which is missing them today
- [x] G0.3: `extension/tests/theme.test.mjs`, written red first - every `class="..."` token in `content.js` must resolve in `ns-theme.css` - red with 33 undefined classes, green after the fold; also asserts no script carries a `var(--ns-` reference
- [x] G0.4: `CONSTRAINTS.md` - contrast floor, blur cardinality rule, reduced-motion and reduced-contrast handling, and the rule that it is not weakened to make a change pass. Point `AGENTS.md` at it
- [x] G0.5: record which value is correct for the three drifts already present (`.ns-reading` 20px vs 19px, `.ns-strip .v` 13px vs 12.5px, `ns-enter` vs `ns-open`) - the card's shipped values won; see "Resolved" in `tasks/glass-plan.md`
- [ ] G0.6: live check - reload the extension, open a watch page, and confirm the card, research panel, tags, coach and skeleton render unchanged against a pre-G0 screenshot. **Blocks G1.** Superseded in part by W10/W11 below, which cover the two problems the first live check actually found.

- [ ] G1.1: glass token layer - per-theme tint alphas, blur radii, luminous hairline, inner highlight, separate dark/light shadow sets
- [ ] G1.2: radius scale - 12px surfaces, 8px inner, 999px pills
- [ ] G1.3: solve the tint alphas by measurement - the minimum that clears 4.5:1 for 11.5px ink over the worst-case backdrop, both themes, pinned in `CONSTRAINTS.md`
- [ ] G1.4: `prefers-contrast: more`, `prefers-reduced-transparency`, `forced-colors` handling; reduced motion still passes
- [ ] G2.1: watch card gets the full treatment - the reference surface
- [ ] G2.2: bind blur depth and tint warmth to the card's own urgency state
- [ ] G2.3: verify the close button, score row, meter, tags, coach textarea and skeleton survive translucency (the textarea and skeleton are what usually break)
- [ ] G3.1: popup surface, toggle tracks, status dot; light mode must read as elevated without the shadow doing all the work
- [ ] G4.1: research panel, its list rows, badges and chip buttons; a scrolling list inside one glass surface is a different cost shape from many surfaces
- [ ] G5.1: `IntersectionObserver` gates the blur - roughly ten cards blurred at a time instead of a hundred, and the class flips on intersection rather than per frame
- [ ] G5.2: `contain: paint` per tile so each blur region considers only its own card
- [ ] G5.3: strip gets the whole glass treatment with the blur omitted - a grid strip sits over a uniform page colour, so blurring it returns that same colour
- [ ] G5.4: hover icon keeps a real blur, because it sits on a photograph and the blur does visible work
- [ ] G5.5: measure scroll frame time with the overlay on and off, and the live blur-region count; if outside budget, fix with a cheaper blur technique and not fewer cards
- [ ] G6.1: contrast sweep of every surface, both themes, every urgency state, measured
- [ ] G6.2: `forced-colors` and `prefers-contrast: more` verified per surface
- [ ] G6.3: `extension/README.md` - the new look, what the depth-as-signal choice means, and how a person is told a preference made the surfaces solid
- [ ] G6.4: version bump, full gates, push

## Phase W10: Found by the first live check (before G1)

Both are pre-existing, not glass damage. Neither was reachable by a test,
because both are about where a thing is allowed to appear rather than what it
contains. Tokens were compared against the deleted JavaScript copies to confirm
G0 changed no value.

- [x] W10.1: the floating panels had no width and no height cap. A video with
  eight reading rows grew past the bottom of the viewport with nothing to
  scroll it back, which is what made the card look broken instead of plain.
  `.ns-host` in `content.css` now owns the width (capped against the viewport)
  and the cap, with `overflow-y: auto`. `position` and stacking stay inline on
  purpose, since a page rule can outrank a content-script stylesheet.
  *Test:* `theme.test.mjs` fails if a `.ns-host` rule appears without both a
  width and a height cap.
- [x] W10.2: the up-next list on a watch page got no strips. The old rule kept
  strips off watch pages so one would not land on the hero of the video you just
  opened - right about the hero, wrong about the sidebar, which holds the same
  compact cards a grid does. `NS_TILES.scanRoot` now answers with a root: the
  document on a grid route, the sidebar on a watch page, and null everywhere
  else. A watch page with no sidebar yet returns null rather than falling back to
  the document, which is the bug the scoping exists to prevent.
  *Test:* `watchPage.test.mjs`, fixture `watch.html`, whose `#primary` holds a
  valid lockup that must never get a strip.

## Phase W11: Open, needs a browser

- [ ] W11.1: reload the extension, open a watch page, confirm the card is 300px
  wide, stops at the viewport edge and scrolls when the readings are long, and
  that the close button still works.
- [ ] W11.2: confirm the up-next list now carries the same two-row strip as a grid, that the video being watched has no strip on it, and that no ad slot got one. The double-visit bug that would have put two strips on every sidebar video is fixed and covered by a test, but only a browser can confirm the strip lands once on a real tile.
- [ ] W11.3: the card is about to stop being a fixed overlay and become the first item of the up-next list, so W11.1's overlay check is superseded by Phase SB below. W11.2 still stands.

## Phase SB: Card in the up-next sidebar

Plan: `tasks/sidebar-plan.md`. The card holds the place of the first two
videos, in normal flow, with no `z-index`, and responsive. One rule for both
lists YouTube shows in a watch sidebar: the card is inserted immediately before
the list it displaces, takes its own space, and the list moves down. Different
work from the glass restyle; the two meet at G2, which gives this box its glass
surface. (Named SB, not S: the older "Phase S" above is Style V2 and keeps that
name.)

- [x] S0.1: one-shot probe - which sidebar selector matched, the first tile's parent and its computed display/overflow, one tile's measured height, whether an inserted `div` is visible, and the width at which YouTube drops the sidebar. One console line, read before anything is built. Ran three times; the first two reported the page as broken when the probe was the thing at fault. Now deleted (S5.1).
- [x] S0.2: fold the answers into `extension/tests/fixtures/watch.html` so the fixture stops being a guess, and record the measurements in the plan's Resolved section. Found the real chain, the 114px tile, the 8px gap, the list's own `div#header` - and a live double-visit bug in `each()` that the wrong fixture had been hiding.
- [x] S1.1: `extension/lib/placement.js` - `placementFor({doc, pathname, width})` and `mountAt(placement, host)`, tested against real fixtures. The slot is the first **tile**, not the container's first child: the list has a `div#header` with the "Up next" heading, and prepending puts the card above it. The same rule gained a second case when a playlist is open - see S1.4.
- [x] S1.2: the card leaves `position:fixed`, `right`, `top` and `z-index` and stops being appended to `body`, via `mountInlineCard()` alongside the old `mountHost()`. The search and channel panels keep the fixed mode. The host lives inside YouTube's container now and takes `width:100%` from it rather than a 300px cap of its own.
- [x] S2.1: the card's reserved height is `calc(var(--ns-tile-pitch) * 2)` - two measured **pitches** (top of one tile to top of the next), not heights. A video occupies 122px: 114 of card plus 8 of gap, so two heights would have pushed 1.97 videos and looked right. `measureTilePitch()` reads it off the live list at mount time and hands it in as a custom property; 122 is only the placeholder for a list that has not been laid out yet. **A floor, not a cap** - see S4.5.
- [x] S2.2: readings become a two-column grid at sidebar width. **No longer a cap-enabler** - that was its reason and the cap is gone - but kept on its own merits: a three-column stat row beside it is what the reference does, and eight readings in one column is the tallest thing on the card. Shipped as two halves. The three headline numbers now lead the card in one row of equal columns, label above value - **engagement, outlier, vph** - which is the arrangement the card was missing and the reason it read as a scroll of eight equal strips rather than a panel. Engagement had no home at all: likes and comments were both on the card as raw counts, and a count of 2.4k likes means nothing without the views it sits against. The remaining six readings demote to `repeat(auto-fit, minmax(140px, 1fr))` - two columns at sidebar width, one column in a collapsed sidebar, rather than six values squeezed into a phone's width. Equal columns and tabular figures are load-bearing, not cosmetic: three numbers animating side by side with proportional digits visibly writh, and content-sized columns make the row lean and read as a table instead of as three peers.
- [ ] S2.3: tags and the coach replace the readings in place instead of appending below, so nothing pushes the list past its cap
- [x] S3.1: re-insert when YouTube re-renders the sidebar; the mount is idempotent, never two cards. `onDomChange()` re-mounts before scanning, and `mountAt()` is a no-op when the card is already ahead of the right anchor.
- [x] S3.2: **the card folds, it is never destroyed.** Revised from "a dismissed card stays dismissed for that page": measuring the reference showed it has no close button at all - it folds with a chevron, and a fold cannot lose the card. The original design *was* the bug - destroying the host made `onDomChange` race the close, so the card came back on the next mutation or did not, and neither was reliable. One chevron now toggles `data-ns-open` on the host; collapsed keeps the header and drops the body, with `aria-expanded` and an accessible name the old `×` never had. To stop showing the card at all, the existing `showCard` popup preference is the switch. Doing it split one attribute that had been doing two jobs: `data-ns-expanded` was written by `setExpanded()` from `chartOpen`, so **opening the chart silently unfolded the whole card** and closing it silently refolded it. `data-ns-open` now belongs to the fold alone and is separate from `cardState.open`; the chart has no say in the card's height at all. The fold control is an icon, and an icon button with no text has no accessible name, so it carries a `.sr-only` label that changes with the state ("Fold…" / "Unfold…") - a chevron that turns round still announces the same words otherwise. Every control on the card now has a focus ring: the chart tabs had one and the header toggle and action buttons did not, so a keyboard reader could land on them and see nothing.
- [x] S4.1: desktop - card is the first item of the list, the first two videos sit below it
- [ ] S4.2: below YouTube's own sidebar breakpoint the sidebar is a drawer; insert anyway so the card is there when the drawer opens
- [x] S4.3: mobile - **decided: no card on a phone.** `placementFor` returns `none` below the sidebar breakpoint, no insertion is attempted, and a test asserts the up-next list is left exactly as YouTube shipped it. Squeezing a reading table into a phone is a worse surface than none. An **unreadable** width is also treated as narrow: guessing "desktop" would push a list that may not be there.
- [ ] S4.4: width pass at 320 / 768 / 1024 / 1440, in both themes
- [x] S4.5: **the card is taller than two videos.** Resolved by decision rather than by code: the two-pitch height is a floor, not a cap, so the card is as tall as its content and the list is pushed down by exactly that. In flow, so nothing overlaps and nothing is covered. The reference does the same - its panel runs 800-1200px - and that is the behaviour that was chosen.
- [x] S1.4: **a playlist watch is the same rule on a different surface.** Opening a playlist replaces "Up next" outright with `ytd-playlist-panel-renderer#playlist`, so there are no up-next tiles to displace. The card goes **above the panel element**, not above the panel's `#items` and not inside the panel: it is a sibling ahead of the whole panel, so the header, the playlist name, the controls and every video all move down under it together. The first attempt anchored to `#items` and put the card between the playlist's name and its videos - a third arrangement nobody asked for. The panel wins over the up-next case when both are present. Fixture: `extension/tests/fixtures/playlist-watch.html`, with a test asserting the panel is the card's next sibling and that the panel's own children are untouched. Playlist rows still get no readings - that is separate work, not a gap in this one.
- [x] S2.4: **the growth chart, and an honest empty state.** `/api/videos/history` reads the
      `video_snapshots` the poller already writes, so it costs no quota. **The chart is part of the card now, not
      behind a button** - it used to sit behind a "Growth" button, which made the most informative thing on a
      scorecard something you had to ask for, and hid the first week behind a control with an obvious name. Most
      videos a reader lands on are not on their watch list and so have no rows at all: the card says that and says
      what to do about it, rather than drawing a flat line that reads like "this video stopped growing". **This is
      a real ceiling, not a missing feature** - YouTube publishes a video's current views and not its history, so a
      series can only exist for videos this app has been watching.
- [x] S2.5: **the chart looks like a chart, and its ranges mean something.** Three changes, all from measuring
      the reference. The block leads with the number - 26px, tabular, with a 10px label under it - instead of two
      equal-weight lines reading like a file listing, the area under the line is filled with a gradient rather than
      left as a bare stroke, and the range tabs sit *above* the number rather than below the chart, because the
      tabs answer "which window am I looking at" and putting the value underneath made the reader read the number
      before finding out which number it was. **The ranges are measured from publication, not from today** - "the
      last 7 days" of a week-old video is its whole life, and of an eight-month-old video is the only part anyone
      can still see, so neither says how the video did. `extension/lib/chartRange.js` cuts the ranges from one
      fetch of the full window, so switching tabs is local and the tabs cannot race. That makes honesty load
      bearing: the app keeps 90 days, so "1st 7 days" of a video from last year is a question it cannot answer, and
      the chart says which piece is missing rather than drawing the part it has under a tab that claims the whole.
- [x] S2.6: **no range thinner than a line needs.** The reference offers a 24-hour tab because it reads views
      hourly. This app records one reading per day, so a 24h window holds exactly one point and can only ever say
      "not enough readings" - while sitting first in the row, where a reader lands by default. The tab looked
      reasonable and could not draw a chart in any circumstance, so it is gone, and the rule is now structural: a
      test asserts no range is short enough to hold fewer than the three points a line needs, so the next person to
      add one is asked whether the readings support it.
- [x] S2.7: a flat series draws across the middle of the chart and drops the fill, instead of pinning to the floor
      under 8px of shading. A video that got no views all week is ordinary, and the old rendering read as a
      collapse rather than as a week with no movement. `geometry()` in `lib/chartRange.js`, with the path
      arithmetic pulled out of a template string so its one edge case is testable. The fill is dropped too: a block
      of colour under a level line says "these views happened", and none did.
- [ ] S2.8: the card shows the **watched** video's numbers on a playlist, not the playlist's. Two different subjects; worth a test so a playlist context never swaps the card's subject.
- [x] S5.1: the S0 probe is deleted and out of `manifest.json`. It was 394 lines that polled every YouTube page for up to 20s and inserted 40px red divs into the list to measure it - fine as a one-shot diagnostic, actively harmful as a shipped content script, because it would have been mutating the very list this phase is about. `extension/lib/probe.js` removed; manifest content script is now `nsMeta, tiles, lineModel, chartRange, placement, thumb, content`. Its breakpoint question is still open (S4.4) and is answered by re-adding it temporarily during manual verification, which is what "temporary" has to mean.
- [ ] S5.2: `extension/README.md` - where the card lives, why it is in flow, and what "two videos" is measured against
- [ ] S5.3: version bump, full gates per `CONSTRAINTS.md`, push
- [ ] S5.4: hand off to G2, which gives the new box its glass surface
