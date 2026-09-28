# Implementation Plan: Card in the up-next sidebar - Phase SB

New plan file, and a different kind of work from either of the two that exist.
`tasks/plan.md` holds Phases A-D and is not touched. `tasks/glass-plan.md` is
the glass restyle; this is not glass, though the two will meet - the card gets
its glass treatment in G2, and it will land on whatever box this phase leaves
behind. Phase SB is appended to `tasks/todo.md`.

## Overview

The watch card is currently a fixed panel pinned to the top right of the
viewport (`position: fixed`, `right: 16px`, `top: 64px`, `z-index: 999999`). It
floats over YouTube's own sidebar, covers the up-next list, and looks like an
overlay rather than part of the page. It is also the reason the up-next videos
could not be annotated for so long: `scanRoot` deliberately scans only the
sidebar, and a card sitting on top of that sidebar is a worse answer than a card
inside it.

The change: on a watch page, insert the card as the first item of the up-next
list, so the first two videos are pushed down and the card holds their place. It
is in normal flow - no fixed positioning, no `z-index` - and it is responsive,
so a viewport with no sidebar gets a placement that is not an overlay either.

The displacement is a *derived* number, not a magic one. The card's height cap
is `2 x` the measured height of one compact video renderer, so "pushes two
videos" stays true when YouTube changes the size of a video card. The
measurement is taken once in the browser and written to a custom property.

## Architecture Decisions

- **In flow, not over it.** The card becomes a child of the container that holds
  the up-next videos, ahead of the first one. YouTube's own layout then does the
  work: the videos move down because something is above them, not because we
  repositioned them. This is also what removes the need for `z-index` at all.
- **Measure the neighbour, not the self.** A hard `min-height: 200px` would be a
  guess about YouTube's card size that goes stale silently. Reading one
  compact renderer's height and deriving the cap keeps the relationship the user
  asked for - two videos - true regardless of what YouTube ships.
- **Two columns, so two videos is achievable.** The card has up to eight
  reading rows. Stacked, that is roughly four video cards of displacement. At
  sidebar width (about 400px) the rows pair into a two-column grid, which halves
  the height and makes "two videos" reachable without a scrollbar. Below the
  mobile breakpoint it returns to one column.
- **The cap is on the card, and the card scrolls inside it.** Everything that
  opens - tags, the coach - replaces the readings in place rather than appending
  below, so no interaction can push the list further down than the two videos
  the design promised.
- **Placement is a pure function, so it can be tested.** The decision of *where*
  the card goes - sidebar, drawer, mobile column, or nowhere - takes a document,
  a pathname and a viewport width, and returns a node or null. That is testable
  against fixtures at each breakpoint, which "run it in a browser" is not.
- **A probe runs before any of this is built.** The fixture is my guess at
  YouTube's markup. The insertion point, the container's display, and the tile
  height are facts only a browser has, and every later task depends on them.
  This is the same move that found the missing hover icon: one `console.debug`,
  read once, before writing the fix.
- **Dismissal is respected until the route changes.** The card now lives inside
  a container YouTube re-renders, and the re-insert pass has to be idempotent.
  Without an explicit guard, closing the card and then scrolling would bring it
  straight back - a bug a user would file as "it will not stay closed".

## Task List

### Phase SB0: Read the page before writing to it

- [ ] **S0.1** One-shot placement probe. Log, once: which sidebar selector
  matched, the tag and classes of the first compact renderer's parent, that
  parent's computed `display` and `overflow`, the measured height of one
  compact renderer, whether a `div` inserted before that first renderer is
  visible and what height it takes, and the viewport width at which YouTube
  stops showing the sidebar.
  *Accept:* one line in the console that answers all six, or a clear "no
    sidebar here".
  *Files:* `extension/lib/probe.js` (temporary), removed in SB5.1. Kept out of
  `content.js` on purpose, so removal is a file delete and one manifest line
  rather than surgery on the file that carries the product.
- [x] **S0.2** Fold the answers into `extension/tests/fixtures/watch.html` so
  the fixture stops being a guess, and record the measurements in the "Resolved"
  section below.
  *Accept:* the fixture matches what the browser reported. Done - and the fixture
  was wrong in four places, one of which was hiding a live double-visit bug in
  `each()`. See Resolved.

### Checkpoint: SB0

- [x] The real insertion point is known, and it is written down. `div#contents`,
  before the first `yt-lockup-view-model`, below the list's own `div#header`.
- [x] The insertion was verified to displace a video, not merely to be visible:
  `works=true`.
- [x] The one unit the plan got wrong is corrected: pitch, not height.
- [ ] The sidebar breakpoint is still unmeasured - a second run at a narrower
  width. Deferred to SB4.2, where a browser is needed anyway; the design does
  not depend on the exact number.

### Phase SB1: Placement as a tested function

- [ ] **S1.1** `extension/lib/placement.js` exporting `sidebarSlot(doc)` (the
  node to insert before, or null) and `placementFor({ doc, pathname, width })`
  (a descriptor: `sidebar`, `drawer`, `mobile`, or `none`).
  *Sharpened after S0.* "The node to insert before" is not the first child of
  the container - the list has a `div#header` holding the "Up next" heading as
  its first child, so prepending puts the card above YouTube's own heading,
  where it reads as their chrome. The slot is the first **tile**, and the header
  is left above it. The fixture now carries the header so this is a test
  failure rather than a note nobody reads.
  *Test:* `placement.test.mjs` against the fixture - the slot is the first
  `yt-lockup-view-model`, with `div#header` still ahead of it; no sidebar returns
  null; each of the three
  breakpoints maps to its descriptor.
  *Dependencies:* S0.2. *Scope:* Small.
- [ ] **S1.2** `mountHost` gains an in-flow mode. The card stops being
  `position: fixed` with `right`/`top`/`z-index` and stops being appended to
  `document.body`; it is inserted at the slot from S1.1. The search and channel
  panels keep the fixed mode - they are not part of this change.
  *Note from S0:* the card host is appended to a YouTube container, so it
  inherits nothing and must carry its own width. `#secondary-inner` is 320px and
  the host must fill it rather than assume 300px.
  *Test:* a card host carries no `position: fixed` and no `z-index`; a search
  host still carries both.
  *Dependencies:* S1.1. *Scope:* Small.

### Checkpoint: SB1

- [ ] Placement is decided by a tested function, not by code that guesses.

### Phase SB2: Push exactly two videos down

- [ ] **S2.1** The card's height cap is **two measured tile pitches**, published
  as `--ns-tile-pitch` and consumed as `calc(var(--ns-tile-pitch) * 2)`.
  *Corrected after S0.* The plan originally said two tile *heights*, and the
  measurement says that is wrong: a 40px probe displaced the list by 48px, so
  each video occupies 122px - 114px of card plus 8px of gap. Two heights would
  have pushed 1.97 videos and looked correct while being off. Pitch is measured
  as the distance from one tile's top to the next one's, which includes the gap
  by construction, and is re-measured on layout change rather than baked in as
  the 122 it happens to be today. *That last part is the real fix:* a constant
  would be right until YouTube changed a margin, and then the card would be
  quietly wrong in a way no assertion catches.
  *Test:* the cap in `content.css` is expressed in pitches, never a literal
  pixel count; a fixture with a different tile height and a different gap
  produces a different cap, which is the assertion that would have caught the
  original mistake.
  *Dependencies:* S1.2. *Scope:* Small.
- [ ] **S2.2** Readings become a two-column grid at sidebar width, one column
  below the mobile breakpoint. This is what makes S2.1 reachable.
  *Test:* `theme.test.mjs` fails if `.ns-strips` has no column rule; a
  breakpoint assertion covers 1440px and 320px.
  *Dependencies:* S1.2. *Scope:* Small.
- [ ] **S2.3** Tags and the coach replace the readings in place instead of
  appending below, so nothing can push the list past its cap.
  *Test:* after opening tags, the readings are gone, the extras region holds
  the panel, and the card's declared height is unchanged.
  *Dependencies:* S2.2. *Scope:* Medium.

### Checkpoint: SB2

- [ ] Two videos are pushed down, measured, and the relationship survives a
  change in YouTube's card size.

### Phase SB3: Surviving the page

- [ ] **S3.1** Re-insert when YouTube re-renders the sidebar. `onDomChange`
  runs the card mount, and the mount is idempotent - one card, never two.
  *Test:* remove the card node, fire the observer, assert exactly one card
  returns.
  *Dependencies:* S1.2. *Scope:* Small.
- [ ] **S3.2** A dismissed card stays dismissed for the rest of that page, and
  returns when another video is opened.
  *Test:* dismiss, run a re-insert pass, assert still gone; change the route,
  assert it is back.
  *Dependencies:* S3.1. *Scope:* Small.

### Checkpoint: SB3

- [ ] The card survives a re-render, and obeys its own close button.

### Phase SB4: Responsive

- [ ] **S4.1** Desktop. The card is the first item in the sidebar and the first
  two videos sit below it.
- [ ] **S4.2** Below YouTube's own sidebar breakpoint the sidebar is a drawer.
  The card is inserted anyway, so it is there when the drawer opens and the
  videos shift correctly when it does.
  *Test:* insertion into a drawer-flagged fixture does not change the drawer's
  own layout.
  *Dependencies:* S1.1. *Scope:* Small.
- [ ] **S4.3** Mobile, where there is no sidebar and therefore nothing to push
  down. **Decided: the card does not appear on a phone.** `placementFor`
  returns `none` below the sidebar breakpoint, and no insertion is attempted.
  *Test:* `placement.test.mjs` asserts `none` at 320px and 700px, and the
  up-next list is left byte-identical to YouTube's own.
  *Rationale:* the card's content is a reading table, and a phone has neither
  the width for two columns nor the height for the one column. A squeezed
  version of it would be a worse surface than none, and the user's decision was
  the same: desktop only, nothing on a phone.
  *Dependencies:* S1.1. *Scope:* Small.
- [ ] **S4.4** Width pass at 320, 768, 1024 and 1440, in both themes. At 320
  and 768 the card is absent by S4.3, so the pass there is a check that the
  annotated videos are untouched and the page is unharmed - which is still a
  result worth having.
  *Accept:* at 1024 and 1440 the card is the first sidebar item with two
  videos below it; at 320 and 768 no card and no layout damage.

### Checkpoint: SB4

- [ ] Four widths checked, both themes, and the card is never an overlay.

### Phase SB5: Clean up and ship

- [ ] **S5.1** Remove the S0 probe, the dead fixed-card offsets, and any rule
  the new placement made meaningless. `content.css` keeps a card-specific
  `.ns-host` rule carrying both a width and a height cap, which is what
  `theme.test.mjs` enforces.
- [ ] **S5.2** `extension/README.md`: where the card lives, why it is in flow,
  and what "two videos" is measured against.
- [ ] **S5.3** Version bump, full gates per `CONSTRAINTS.md`, push.
- [ ] **S5.4** Hand off to G2, which gives this box its glass surface.

### Checkpoint: Complete

- [ ] The card holds the place of two up-next videos, in flow, with no
  `z-index`.
- [ ] It survives a sidebar re-render and obeys its close button.
- [ ] Four viewport widths checked in both themes.
- [ ] `theme.test.mjs`, `placement.test.mjs` and the full suite green.

## Resolved: what the live page actually says

Measured 2026-09-28 on a real watch page, viewport 1026×730, after the list
settled. Committed as `extension/lib/probe.js` (temporary, removed in SB5.1).

| Question | Answer |
| --- | --- |
| Where does the up-next list live? | `div#contents`, inside `ytd-item-section-renderer` inside `div#items` inside `ytd-watch-next-secondary-results-renderer` |
| What is one video tall? | **114px**, identical across 26 tiles, margin 0 |
| Does the gap between videos exist? | **8px** - a 40px probe displaced the list by 48px |
| Is a plain inserted `<div>` visible? | **Yes.** `works=true`, pushed the first video down |
| Which element does the scan match? | `#secondary-inner` (320px wide), not the renderer |
| Does the list have its own header? | **Yes** - `div#header` is the first child of `div#contents` |
| How long does the list take to settle? | 4.2s, 26 tiles |

Three of these contradicted the plan, and two of the three were the plan's
fault rather than the page's:

**The unit is pitch, not height.** The plan said the cap would be
`2 × tile height`. The measurement says a video *occupies* 122px - 114px of card
plus 8px of gap - so `2 × height` would have pushed 1.97 videos, not 2. The cap
is now written against the measured distance from one tile's top to the next,
which includes the gap by construction and cannot drift if YouTube changes its
margin. SB2.1 is rewritten accordingly; the `calc(var(--ns-tile-h) * 2)` draft
would have been subtly wrong forever, in a way no test could have caught.

**Inserting into the list is ambiguous, and one reading is wrong.** The list has
a `div#header` holding the "Up next" heading as its first child. "Prepend to the
list" puts the card *above* the heading, where it reads as YouTube's own chrome.
"Insert before the first tile" puts it under the heading, which is right. These
are different instructions and the phrase in S1.2 did not distinguish them. The
fixture now carries the header so the difference is testable rather than
noted.

**The guessed fixture was hiding a live bug.** The old fixture put the tiles
directly in `#contents` with no nesting, so no video was reachable through two
hosts. The real chain nests `ytd-item-section-renderer` inside
`ytd-watch-next-secondary-results-renderer`, and both are in `HOSTS`, so every
sidebar video was being visited **twice** - six visits for three videos. A
visitor that had not yet attached its strip would attach a second one, doubling
the readings on the page. Fixed in `each()` by tracking visited tiles, with a
test that fails without the fix. The lesson generalises past this file: a
fixture is a claim about a foreign system, and the parts of it that are easiest
to get wrong are the parts that never fail a test written beside them.

**Still unknown: the breakpoint.** Reading the media widths out of YouTube's
stylesheets returned `none-readable` - the rules live in shadow roots and
adopted sheets, which a content script cannot reach. So the sidebar breakpoint
is still to be found by a second run at a narrower width, at 1026px the sidebar
is present and 320px wide. S1.1 takes the width as an input and S4.2 confirms
it in a browser, so the unknown is a constant to be measured, not a risk to the
design.

**Unrelated, confirmed twice:** the `Expected arc flag` errors in the console are
YouTube's own paths. Ours are `a2 2 0 0 0 2 2` with seven operands; the failing
one has six and ends `2 2` where `2-2v-2` belongs. The ad CORS failures, the
preload warnings and the `powerPreference` notice are all YouTube's too.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| YouTube re-renders the sidebar and drops the card | Card vanishes on some navigations | S3.1 re-inserts, idempotently; S3.2 keeps dismissal from fighting it |
| A plain `div` is hidden or clipped inside the renderer | Card inserted but invisible, which is worse than not inserted | S0.1 measures visibility before anything is built; S0.2 records it in the fixture |
| The list is virtualised and the card scrolls out of existence | Card disappears on scroll | S3.1 re-inserts on the observer; verified in the browser at S4.1 |
| Our node confuses YouTube's own code | Undefined behaviour inside a page we do not own | Insert a leaf, never reorder or wrap YouTube's nodes; no removal of anything but our own |
| The card ends up taller than two videos and pushes four | The design promise is quietly broken | The cap is derived from the measured tile height, not chosen by eye; S2.1's test fails on a literal |
| Nothing to displace on mobile | Feature simply absent on phones, or a return to an overlay | S4.3 is a decision recorded before implementation, and `none` is a legitimate answer |
| Search and channel panels regress | Other surfaces break while the card improves | Their fixed mode is untouched; S1.2's test asserts they keep `position: fixed` |

## Open Questions

- **Mobile is settled: no card on a phone.** The card's content is a reading
  table, and a phone has neither the width for two columns nor the height for
  one. A squeezed version would be a worse surface than none, and
  `placementFor` returning `none` below the sidebar breakpoint is also the
  honest answer to "push two videos down" - there are no two videos in a
  column. S4.3 asserts the absence, because an absence that nothing checks
  becomes a card on someone's phone six months from now.
- **Does "two videos" survive a long video?** A video with eight reading rows at
  one column is four cards tall. S2.2's two-column grid is what makes the
  promise hold; if it is not enough, the readings may need to collapse behind a
  summary line. Decided against the real card, not on paper.
- **Should the close button remove the card for the session rather than the
  page?** S3.2 assumes per-page. A user who dismissed it once may not want it
  back on the next video.
- **Does the up-next list get the strip *and* the card, or is that too much
  chrome?** The card now sits directly above the annotated videos it summarises.
  Worth one look in the browser before S5 ships.
