# Implementation Plan: Glassmorphism pass - Phase G

New plan file. `tasks/plan.md` is untouched: it still holds Phases A-D with their
unchecked work, and this is different work. Phase G is appended to `tasks/todo.md`
rather than replacing anything in it.

## Overview

Shift every visual surface in the `extension/` folder from the current
"Transmission" flat-grey system to a full glass treatment: translucent tinted
layers, blur, luminous hairline borders, soft shadows, modern radii. Every
surface gets it - the watch card, the popup, the research panel, the per-card
strip and the per-card hover icon. No tile limit is introduced.

The plan exists because the restyle cannot be done safely the way the codebase
is currently arranged. The component CSS lives in four places, two of them have
already drifted, and there is no test that would notice. Phase G fixes the
structure first, then applies the look one surface at a time, measuring as it
goes.

**The performance problem is solved by making blur cheap, not by removing it.**
The user was told this and chose full glass with no limit; this plan honours
that and spends its effort on the cost side instead.

## Architecture Decisions

- **The design system becomes single-source before it is restyled.** Today
  `ns-theme.css` is described as canonical but is not: the watch card, the
  research panel and their children are styled only by `NS_COMPONENTS`, a
  hand-maintained JavaScript string in `content.js`. Adding a glass surface to
  both "copies" is how they drift further. MV3 lets a content script read its
  own stylesheet, so the shadow roots get the real file and the JavaScript
  copies are deleted. Deleting the duplication is the point; policing it is the
  fallback if the fetch route is blocked.
- **Blur is applied where blur is visible, and skipped where it is a no-op.**
  This is not a scope reduction - it is the observation that `backdrop-filter`
  over a flat background returns the same flat background. On a YouTube grid the
  page behind the card strip is a uniform `#0f0f0f` or `#ffffff`, so the strip
  gets the whole glass *treatment* - tint, luminous hairline, radius, soft
  shadow - and looks identical while paying nothing for the blur. The hover icon
  sits on a photograph, where blur genuinely does something, so it keeps a real
  blur; it is 36px wide and only present on the one card being hovered.
- **Blur cost is controlled by viewport gating, not by reducing scope.** A blur
  on an element forces the compositor to snapshot and blur its backdrop every
  frame the page scrolls. With ~100 cards that is ~100 live blur regions. An
  `IntersectionObserver` toggles the blur only on cards near the viewport, which
  is roughly ten at a time, so the visible result is unchanged and the
  compositor only ever sees ten regions. `contain: paint` on each tile further
  bounds how much of the page each region considers.
- **Radius, shadows and the flat-data-surface rule all change, on purpose.** The
  current system states "elevation by lightness (never shadows)" and "flat data
  surface - no chrome" in its own comments, and pins `--ns-radius: 2px`. Full
  glass inverts each of those. The comments get rewritten to state the new rule
  so the next change is not made against a premise that no longer holds.
- **Light mode needs the shadow; dark mode does not.** A translucent light
  surface over a white page has almost no luminance edge to read as elevated, so
  in light theme the shadow becomes load-bearing rather than decorative. Both
  themes therefore ship their own shadow set, and the light one is the stricter
  of the two in review.
- **Urgency is the one signature move, and it is not decoration.** Every other
  part of the treatment is standard, which is what makes the single non-standard
  choice read as deliberate. Blur depth and tint warmth track the reading's own
  state: an amber spike or a hot outlier earns a warmer, slightly more specular
  surface; a cool or normal reading stays quiet. Glass becomes the carrier of
  the signal instead of a wallpaper.
- **Typography is untouched.** `Bahnschrift` / `Segoe UI Variable Display` with
  tabular figures is already a deliberate non-default choice and it has nothing
  to do with surface. A restyle is not a licence to also change the type.
- **Every number is measured, not asserted.** Tint alphas are chosen so the
  worst-case backdrop still clears 4.5:1 at the strip's 11.5px, and the
  computed value is recorded in `CONSTRAINTS.md` so a later edit cannot quietly
  drop below it.

## Task List

### Phase G0: Make the design system single-source (blocking)

Nothing else starts until this lands. Every later task would otherwise be
applied to two drifting dialects.

- [x] **G0.1** Add `web_accessible_resources` for `ns-theme.css`; inject it into
  each shadow root as a real stylesheet (`adoptedStyleSheets`) instead of the
  `NS_TOKENS` + `NS_COMPONENTS` strings.
  *Accept:* shadow-root surfaces render identically to before; the two JS
  strings are gone from `content.js`.
  *Files:* `extension/manifest.json`, `extension/content.js`.
- [x] **G0.2** Delete `NS_TOKENS` and `NS_COMPONENTS`; fold the card-only rules
  (`.ns-head`, `.ns-score`, `.ns-row`, `.ns-badge`, `.ns-item`, `.ns-coach`,
  `.ns-chipbtn`, `.ns-skeleton`, `.ns-tags`) into `ns-theme.css`, which is
  missing them today.
  *Accept:* every class used anywhere in `content.js` resolves in
  `ns-theme.css`.
  *Test:* a new `extension/tests/theme.test.mjs` extracts every `class="."` token
  from `content.js` and fails on any class the stylesheet does not define. This
  is the test that would have caught the drift, written first so it is red.
- [x] **G0.3** Write `CONSTRAINTS.md` with the numbers this phase commits to:
  contrast floor, a blur cardinality budget, reduced-motion and reduced-contrast
  handling, and the rule that `CONSTRAINTS.md` is not weakened to make a change
  pass.
  *Accept:* the file exists and every row names the command that produces the
  verdict.
- [x] **G0.4** Baseline the three drifts already present (`.ns-reading` 20px vs
  19px, `.ns-strip .v` 13px vs 12.5px, `ns-enter` vs `ns-open`) and record which
  value is correct, so G1 is not built on an accident.

### Checkpoint: G0

- [x] All tests pass, and the new theme test is green.
- [ ] Watch card, research panel, popup, strip and hover icon all render
  unchanged against a screenshot taken before G1. *Needs a live browser - not yet
  taken.*
- [x] No `NS_TOKENS` / `NS_COMPONENTS` string remains in `content.js`.

### Resolved

Drifts found by `extension/tests/theme.test.mjs` when it was first run, and how
each was settled. The card is a 320px column; the numbers there are what users
have been looking at, so where the two files disagreed on a size, the card won.
A structural refactor is not the moment to also resize type.

| Rule | `ns-theme.css` said | The card copy said | Settled on |
| --- | --- | --- | --- |
| `.ns-reading` | 20px | 19px | **19px** - the shipped size |
| `.ns-strip .v` | 13px | 12.5px | **12.5px** - the shipped size |
| entrance animation | `ns-enter` | `ns-open` | **`ns-enter`** - describes the class |
| `.ns-meter--xs` | absent | 3px | **kept**, it was in use |
| `.ns-surface` radius | 0 | 0 | no conflict; G1 rescales it |

Two classes were used by scripts and styled nowhere at all: `.ns-extras` and
`.ns-trend`. Both are slots the script fills later. They are declared as blocks,
with a comment saying they are intentionally unstyled - a flex gap would have
doubled up the margins their children already carry. Same for `.ns-card` and
`.ns-body`, which were also unstyled and stay that way.

### Phase G1: Glass tokens

- [ ] **G1.1** Add the glass token layer: per-theme tint alphas, blur radii,
  luminous hairline, inner highlight, and separate dark/light shadow sets.
  Rewrite the file's header comments to state the new premise.
  *Accept:* both themes compute; the light shadow is present.
- [ ] **G1.2** Move `--ns-radius: 2px` to a modern scale - ~12px for surfaces,
  8px for inner elements, 999px for pills - and update every consumer.
- [ ] **G1.3** Solve the alphas by measurement, not taste. Compute the minimum
  tint that clears 4.5:1 for 11.5px `--ns-ink` over the worst-case backdrop, in
  both themes, and pin the result in `CONSTRAINTS.md`.
  *Verification:* the computed contrast script; the numbers go in the file.
- [ ] **G1.4** Preference handling, in this order: `prefers-contrast: more` raises
  the tint toward opaque and drops the blur; `prefers-reduced-transparency`
  swaps in a solid tint; `forced-colors` keeps borders visible rather than
  transparent. `prefers-reduced-motion` already passes and must keep passing.
  *Accept:* each media query has a test or a manual check recorded.

### Checkpoint: G1

- [ ] Contrast clears the G1.3 numbers in both themes.
- [ ] Tokens are single-source; the theme test is green.

### Phase G2: Glass on the watch card (reference surface)

This is the surface the rest are matched against, so it goes first and alone.

- [ ] **G2.1** Apply the full treatment to `.ns-card` / `.ns-surface`: tint,
  blur, luminous top hairline, inner bottom shadow, radius, drop shadow.
- [ ] **G2.2** Bind depth to the reading: the card's own state picks the tint
  warmth and blur radius.
- [ ] **G2.3** Verify the close button, the score row, the meter, the tags, the
  coach textarea and the skeleton all survive on the new surface - the textarea
  and skeleton are the two that usually break when a panel becomes translucent.
  *Verification:* screenshot in both themes; `axe` clean; focus ring visible on
  every control.

### Phase G3: Popup

- [ ] **G3.1** Popup surface, the toggle tracks, and the status dot. The popup
  is one instance over browser chrome, so it can afford real blur.
  *Accept:* light mode reads as elevated without the shadow doing all the work.

### Phase G4: Research panel

- [ ] **G4.1** The search/channel research panel, plus its list rows, badges
  and chip buttons. The list has many rows inside one glass surface, which is a
  different cost shape from many surfaces - check it does not turn into a
  scrolling blur region.

### Phase G5: Per-card surfaces - glass everywhere, blur where it shows

The user asked for no limit here, and none is imposed. The two surfaces behave
differently because what sits behind them differs.

- [ ] **G5.1** `IntersectionObserver` gates the blur. A tile gains a viewport
  class when it approaches the viewport and loses it on exit; the blur is bound
  to that class. Roughly ten cards are ever blurred instead of a hundred, and
  the class flips on intersection changes rather than per frame.
  *Accept:* an automated check that the blur rule is not reachable from a
  `.ns-line` or `.ns-ovl-btn` selector when the tile is outside the viewport.
- [ ] **G5.2** `contain: paint` on the tile so each blur region considers only
  its own card.
- [ ] **G5.3** The strip: full glass treatment - tint, luminous hairline, radius,
  soft shadow - with the blur omitted, because the page behind a grid strip is a
  uniform colour and blurring it returns that same colour. The hover affordance
  from W6 keeps working on top of it.
  *Accept:* a screenshot shows no visible difference between a blurred and an
  unblurred strip; the perf trace does.
- [ ] **G5.4** The hover icon: real blur, because it sits on a photograph and the
  blur is doing visible work. It is 36px and only exists on the card being
  hovered, so the cost is one small region.
  *Accept:* the icon stays readable over a bright and a dark thumbnail.
- [ ] **G5.5** Measure. Scroll a grid and record frame time with the overlay on
  and off, and the count of live blur regions. If the on/off difference is not
  within the budget in `CONSTRAINTS.md`, the fix is a cheaper blur technique -
  a lower radius, `will-change` promotion, or a synthetic tint-and-gradient
  substitute for the blur on off-screen cards - and not fewer cards.

### Phase G6: Contrast, themes and the final pass

- [ ] **G6.1** Full contrast sweep of every surface in both themes, at every
  urgency state, measured rather than eyeballed.
- [ ] **G6.2** `forced-colors` and `prefers-contrast: more` verified per surface.
- [ ] **G6.3** Update `extension/README.md` with the new look, the meaning of
  the depth-as-signal choice, and how to tell a person that a preference made
  the surfaces solid.
- [ ] **G6.4** Version bump, full gates, push.

### Checkpoint: Complete

- [ ] Every surface in `extension/` carries the glass treatment.
- [ ] `CONSTRAINTS.md` numbers hold in both themes at every urgency state.
- [ ] Scroll cost is inside budget with the overlay on.
- [ ] No class used in `content.js` is missing from `ns-theme.css`.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 100 simultaneous blur regions on a scrolling page | Severe jank on the extension's main surface | Viewport gating plus `contain: paint`; measured in G5.5 with a fix path that reduces cost rather than scope |
| Tint chosen by eye, then fails contrast over a thumbnail or an ad | Unreadable text, a WCAG failure | Alphas computed from the worst case in G1.3 and pinned in `CONSTRAINTS.md`; `prefers-contrast: more` as the escape hatch |
| Glass over a flat page background looks like nothing | Wasted cost, no visual gain | Established in G5.3: the blur is a no-op there, so the treatment is applied without it |
| The two CSS copies drift further during the restyle | The card and the popup slowly diverge again | G0 removes the copies; the theme test fails the build if a class is undefined |
| Full glass reads as generic template chrome | The product loses its identity | The urgency-bound depth is the one deliberate exception; radius, shadow and tint stay standard because the brief asked for standard |
| `backdrop-filter` unsupported or disabled | Surfaces lose their edge and text contrast drops | Synthetic tint-and-gradient fallback with no blur; `prefers-reduced-transparency` uses it too |
| Light mode loses the elevation cue | The popup reads as a white rectangle | Light theme ships its own shadow set, reviewed as the stricter of the two |
| Shadow removal cascades into layout | Cards float over each other; text sits on artwork | Verification lists the surfaces where overlap is possible, and treats each as a named check |
| Restyle lands while W9 live check is still open | Two things change on YouTube at once | W9 is verified first; G1 onward is committed separately from any live check |

## Open Questions

- **Glow or no glow.** Urgency currently animates a text-shadow. On a
  translucent surface a glow reads differently than on flat grey. Decide per
  surface in G2.2 rather than globally.
- **Blur radius ceiling.** Proposed 10px on the card, less per surface. A larger
  radius is more obviously glass and more expensive; worth revisiting once the
  perf number from G5.5 exists.
- **Dark-mode elevation.** Dark mode currently needs no shadow to read as
  elevated. Whether it gets one anyway, for consistency with light, is a
  judgement call best made against a screenshot rather than a rule.
- **Whether `ns-theme.css` should be renamed.** It no longer describes a
  "Transmission" system. A rename is honest but touches the manifest, the
  popup link and the test; not worth doing inside this phase.
