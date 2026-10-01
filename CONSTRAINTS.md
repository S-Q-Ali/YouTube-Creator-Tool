# CONSTRAINTS

The bar this extension is held to, in numbers that can be checked. A change that
lowers one of these has not been made, it has been broken.

Every threshold here is either enforced by a command in CI or by a test that
fails. A rule nobody can run is a wish, so each one names the thing that checks
it.

## Commands

| Check | Command | Bar |
| --- | --- | --- |
| Tests | `npx vitest run` | **157 minimum**, 0 failing (currently 253) |
| Types | `npm run typecheck` | 0 errors |
| Lint (extension) | `npx eslint extension` | 0 problems |
| Lint (repo) | `npx eslint .` | baseline, do not regress |

Source files are edited with a tool that writes UTF-8. PowerShell 5.1's
`Set-Content` and `Out-File` default to Windows-1252, which is invisible on a
file of pure ASCII and silently collapses every em dash in it from three bytes to
one - and then Chrome refuses the whole extension with "Could not load manifest",
which looks like a broken build and is not one. Enforced by
`extension/tests/encoding.test.mjs`, which checks the bytes rather than the text
(a Windows-1252 file of pure ASCII decodes as valid UTF-8 and would pass a
naive read) and names every offending file in one run.

The test count is a floor, not a snapshot. It was a hard number once, and it
went stale immediately - the suite grew to 212 while the file still said 157,
so the row had stopped describing anything and would have kept passing if half
the suite were deleted. A floor fails in the one direction that matters: a diff
that removes tests is a regression, and adding tests is the expected way to move
it.

The repo-wide lint run has 5 errors and 62 warnings that predate the glass work
and live in components this extension never touches. They are a known baseline,
not a licence: the count must not go **up**, and `npx eslint extension` must stay
at zero.

## Contrast

- Body and reading text on any glass surface: **4.5:1** minimum.
- Large text (>=18.66px bold or >=24px) and UI borders or icons: **3:1** minimum.
- A glass surface that cannot reach the floor on YouTube's own background gets an
  opaque or higher-opacity tint. The alternative - shipping unreadable text - is
  not on the table.
- Both themes are checked: light overrides colours only, and inherits fonts,
  weights, radius and motion from the dark block. A token that exists in one and
  not the other is a bug (`extension/tests/theme.test.mjs`).
- Enforced by `npm run check:contrast`, which reads the hexes out of
  `ns-theme.css` and measures each colour the card paints as text against
  `--ns-glass-solid`. It is a test rather than a script because a test cannot be
  forgotten in a run and cannot report a passing grade for a colour that stopped
  being used. Written after this floor had already failed three times unnoticed:
  the stat row's amber and cyan at 4.23:1 and 4.19:1 in light, and its error red
  at 4.13:1 in dark. The hexes are read from the stylesheet, never copied into
  the test - a copied copy rots the moment someone nudges a value.
- The tightest pairing on the card is `--ns-mute` on `--ns-glass-solid`: 4.89:1
  dark, 5.01:1 light. It is the label colour for every secondary reading, so a
  small drift in it degrades a dozen labels at once and no other pair fails.
- A token is measured against the surface it is painted on. An accent tuned
  against the card is not thereby safe on a raised cell inside the card: in
  light theme no grey between `#ececec` and `#f8f8f8` clears 4.5:1 for both
  `--ns-amber` and `--ns-cyan`, which is why the stat row is grouped with a
  border rather than a fill.

## One stylesheet, no copies

- `extension/ns-theme.css` is the only place component CSS is written.
- No script may contain a custom-property reference (`var(--ns-…)`). That is the
  signature of a hand-copied stylesheet, and hand-copied stylesheets drift. The
  shadow roots adopt the real file via `adoptedStyleSheets`.
- Every `ns-` class a script asks for must resolve in `ns-theme.css` or
  `extension/content.css`. A class that renders in the product but exists in no
  stylesheet is a class nobody can change safely.

## Blur is a budget, not a look

- At most **8** elements with `backdrop-filter` in the viewport at once.
- `IntersectionObserver` gates the blur. An off-screen card is not blurred.
- Every blurred element carries `contain: paint` and a compositor hint
  (`will-change` is not a licence to set everywhere).
- A value-carrying surface is opaque. Glass reads badly behind 11px numerals, so
  the strip's numbers sit on solid or near-solid fills and only the card behind
  them is translucent.
- Blur radius <= **16px**. Larger is not "more glass", it is more pixels moved
  per frame.
- If scroll drops below 45fps while the extension is mounted, the blur layer
  goes, and it stays off until reload. Feature beats its own decoration.

## Motion

- Every animation is inside `@media (prefers-reduced-motion: no-preference)`, or
  is explicitly disabled in the `reduce` block.
- The glow animation is decorative. Under `reduce` it is `none`, not "faster".
- Nothing animates on load longer than **900ms**, and no animation loops.

## Per-user settings are load-bearing

- `prefers-reduced-transparency` and `prefers-contrast: more` both increase the
  tint opacity, because both mean the user is asking for less translucency.
- `forced-colors: active` drops every custom background and border. The signal
  has to survive a palette we do not control.

## Scope

- Typography does not change in the glass pass. Bahnschrift, Segoe UI Variable
  Display and tabular numerals stay; only surfaces, radii, shadows and tint
  change. Re-picking type mid-redesign is how a redesign loses its reader.
- The two-row strip is a data contract, not a styling surface: subscribers, then
  views-per-hour with its outlier. No extra rows, no duplicated channel, view or
  age data.
- All data comes from the server. No estimate is ever computed client-side to
  fill a gap.

## Anti-silencing

These are the ways a change gets to green without being finished. None of them
are acceptable in a diff:

- A new `@ts-ignore`, `@ts-expect-error` or `eslint-disable`.
- A deleted, skipped or `it.only`'d test.
- An assertion weakened from a value to a type, or a threshold loosened.
- A stub that returns an empty value and a comment saying to finish it.
- A `// TODO` where a test should be.

If a threshold genuinely needs to move, it moves in this file, in the same
commit, with the reason. Silently is the problem, not moving.
