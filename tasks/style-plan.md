# Style Plan: "Transmission" — Control-Room Instrument Identity

## Design Brief Grounding
- **Product / subject:** Niche-Scope Chrome extension — a research + optimization instrument that overlays YouTube and YouTube Studio.
- **Audience:** YouTube creators and channel researchers, browsing fast, scanning many thumbnails, optimizing uploads.
- **Primary job:** make opportunity signals instantly readable on top of someone else's UI (YouTube), without clashing with it, and give the upload flow a confident optimization voice. The tool *measures* — so it should look and behave like a measuring instrument, not like another SaaS card shelf.

## Direction Proposal: "Transmission"
A control-room instrument layer. Scores are read as **segmented signal meters** (VU-meter / equalizer style) — the one memorable, repeated element. Panels are dark instrument glass with cool slate body, amber live-signal accent, and cyan only for structural telemetry. Numerals are tabular and compressed (readings), labels are quiet sentence-case UI text. One accent at a time; everything else quiet. This is the deliberate opposite of clean-white Google Material cards, so the overlay reads as *our instrument*, never as YouTube's own UI.

## Token System

### Palette (6 core + 2 variants)
| Token | Hex | Use |
|---|---|---|
| `soot` | `#12161C` | panel base — deep blue-slate instrument glass (not generic near-black) |
| `lift` | `#1B222B` | raised panel, inputs, hover row |
| `ink` | `#F2F5F8` | primary text on panels (cool near-white, no glare) |
| `mute` | `#8A94A3` | secondary readings, labels, ticks |
| `amber` | `#F0A500` | live signal: scores, velocity spikes, high grade, primary highlight |
| `cyan` | `#3CC8DE` | structural telemetry: views/velocity baseline, upload cadence, dates |
| `bad` | `#E4574F` | failing signal only (low score / server off) — desaturated red |
| `glass` | `rgba(18,22,28,.82)` + `backdrop-filter: blur(8px)` | floating panels over YouTube |

Rules: amber and cyan never compete in one view; amber signals *live/momentum*, cyan signals *structure/time*. `bad` appears only on real failures. No gradients, no decorative washes.

### Type
- **Readings** (scores, numbers, timestamps, grades): `"Bahnschrift", "Segoe UI Variable Display", "Segoe UI", sans-serif` with `font-variant-numeric: tabular-nums;`. Bahnschrift is a compressed grotesk **shipped with Windows** — distinctive instrument digits, zero network/font-load dependency for a content-script context. Numerals stay tabular so readings line up in rows.
- **Interface** (labels, body, buttons, panels): `system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`. Quiet, sentence-case, normal spacing.
- No all-caps eyebrows, no letter-spacing cocktail, no monospace-everywhere. Mono/compressed styling is reserved for numerals that are *readings of a measurement* — justified by the instrument metaphor, not decoration.
- Score grades use amber numerals; secondary readings use mute; label → reading pairs left-aligned.

### Layout
- **"Instrument strips, not cards."** Content is a column of strips: `label ·········· reading` separated by hairlines (`rgba(242,245,248,.12)`) and 2px tick markers; no rounded-card stacking, no card shadows (a single soft scrim behind floating panels; hairlines for the rest).
- **Alignment: left, everywhere.** Left-edge ticks act as grouping rails. No centering, no middle-dot-joined meta strings, no spaced em-dash labels.
- Radius: one value (`2px`) used only on the meter case and small filter pills; half-pill for the grade chip. Nothing else rounds.
- Extra space is preferred over padding noise; panels breathe, rows are 2px-tick aligned to an 8px grid.

### Layout wireframes

Watch-page card (~232px):
```
┌─────────────────────────┐
│ ● Niche-Scope      ×    │   identity strip (mute dot + wordmark)
├┼────────────────────────┤
│ ▌▌▌▌▌▌▌▌▍▍  92   A      │   segmented meter + tabular grade
│ user_prompt               │
│ ──────────────────────── │
│ views        1 204 317   │   reading rows, tick rails
│ velocity     5 241 /hr①  │   ① amber numeral = live signal
│ posted       3 Jul 2026  │
│ channel      1.2 M subs  │
└──────────────────────────┘
```

Thumbnail pill (tiny, on any thumbnail):
```
┌──────────┐
│ ▌▌▌▌▌▌▍▍ │  6px-tall segmented micro-meter
└──────────┘   (no number — the meter IS the reading)
```

Hover stats bar (above thumbnail, follow mouse):
```
┌──────────────────────────────┐
│ 92  A · 1.2M views           │   score reading + first-strip summary
│ 5.2K/hr ① · 8 Jul · 4:12    │   velocity in amber when spiking
└──────────────────────────────┘
```

Studio dock (far-left vertical rail, like an editor tool rack):
```
┌─┐
│█│  ● gauge      (optimize meter, amber)
│▌│  T  titles
│▌│  D  description
│▌│  #  tags
│▌│  ✦  magic fill
│▌│  🕑 best time
└─┘   active tool = lift bg + amber tick on left edge
```

Popup (~380px): wordmark strip → live signal row (server dot + quota) → tab row (Research / Studio / AI) → content strips → footer link. Same token block.

### Component language
- **Signal meter** (reusable): N-segment bar, segments fill left→right with a 1px gap, filled = amber (score/velocity) or cyan (structural), unfilled = `mute` at 22%. Grade letter sits right of the meter in tabular reading. This is the extension's handshake — one glance tells grade without reading a number.
- **Reading strip**: `label (mute, 12px) — spacing — reading (ink/amber/cyan, tabular)`. Separators are hairlines; grouping via left ticks.
- **Grade chip**: half-pill (`border-radius: 999px` on left only) with tabular letter, amber border for A, mute for mid, `bad` for F. Used where a letter alone is better than a meter (hover bars).
- **Empty / error states are direction**, screen-voice: "Open a video to read its signal." / "Server isn't running — start it with npm run dev." Never "Error", never apologetic.

### Motion
- **One mounted gesture only:** the first panel per page opens with a 140ms slide + fade + meter segments filling once. Everything after that is instant (scrolling YouTube shouldn't animate).
- Motion answers actions: meter segments animate fill/collapse when a value *changes* (insert a title → Optimize Score segments tick up); open/expand of a panel animates; collapse is instant.
- `prefers-reduced-motion: reduce` → zero animation, instant fills.
- No scroll-triggered fade/slide choreography, no hover transitions on every row, no bounce.

### Copy voice (UI strings)
- Plain verbs, sentence case: "Insert title", "Refresh ideas", "Copy tags".
- One name per action through the whole flow: button "Magic fill" → toast "Magic fill applied".
- Numbers formatted with thin spaces (1 204 317); never "1.2M" inside instrument panels where a precise reading is the point (abbreviate only inside the tiny pill/hover contexts).
- Labels name what the user understands: "velocity", "posted", "subs" — not "vph computed", "publish_timestamp".

## Anti-Slop Review (this plan vs the brief)
Checked the direction against the generic tells and revised:
| Cliché | What we do instead |
|---|---|
| cream #F4F1EA + serif + terracotta | dark instrument glass `soot` + `ink`/`mute` neutral spectra |
| near-black + acid-green | deep blue-slate + amber (transmission) + cyan (telemetry); no acid green |
| broadsheet hairlines + 0 radius + newspaper columns | hairline strips **but** with a signature radii-2px meter, tabular numerals, tick rails — instrument, not newspaper |
| SaaS rounded-card kit + same radius + soft shadow | strips with tick rails, one radius per meter/pill, hairline not shadow |
| ALL-CAPS eyebrow above every heading | no eyebrows at all; identity strip uses a muted dot + wordmark |
| 'A · B · C' middle-dot meta strings | tick-rail rows, one reading per line, thin-space number grouping |
| 'WORD — fragment' em-dash labels | `label + reading` pairs; no dashes in labels |
| tinted-near-black #0B0B0B | `soot #12161C` blue-slate, deliberate |
| mono for all small data labels | tabular-numeral grotesk (Bahnschrift) reserved for readings |
| '→' on all links/buttons | sentence-case verbs; link affordance is color alone (link = amber underline on mute text) |
| one slide-fade-up entrance per section | zero entrances; one panel-open gesture + meter fills |

## Applying Across Phases
- **Phase A0 (Design System task, first):** `extension/ns-theme.css` = tokens + meter/pill/strip/chip components + motion + reduced-motion. Tokens defined once here; copyright into the Shadow-DOM card via a JS token block (single source kept in `ns-theme.css`, mirrored const in `content.js` with a pointer comment). Refactor existing watch card + pills + popup onto the new language in the same task so nothing ships in the old "gradient + uppercase label" kit.
- **Phase B overlays:** hover bar, tags panel, search panel, channel card, AI Coach — all consume A0 components.
- **Phase C Studio dock + panels:** dock layout + gauge per wireframe; Optimize Score gauge uses the meter with amber.
- **Phase D popup tabs:** same token block; audit/ideas/keywords/CSV tabs inside the strip language.
- **Checkpoints:** add a visual review step (open on YouTube light + dark + Studio; confirm meter readability, contrast ≥ 4.5:1 for ink/mute/amber on soot, reduced-motion passes).

## v2 — "Raster Instrument" + Adaptive (chosen direction A+D, 2026)

Keeps the Transmission DNA (instrument, not SaaS card shelf) and modernizes per 2026 data-tool conventions — quiet chrome, elevation-by-lightness, variable type, and a real light theme. Sources: Linear/Vercel/Grafana restraint, TheKitBase SaaS-dashboard 2026, Design Signal dashboard direction, Apple "liquid glass" done with discipline.

### Token changes (S0)
- Palette tuned to true-grey: base ≈ `#0F1115` family, reduce blue-slate cast; keep token *names* (`soot`/`lift`/`ink`/`mute`/`amber`/`cyan`/`bad`) so components don't churn.
- Add elevation tokens `--ns-e1/e2/e3` as **lightness steps** (base → card → floating; +3–6% each). Dark-mode depth comes from lighter surfaces, never box-shadows.
- Glass (`--ns-glass` + blur) is **chrome-only** (floating tools/tooltips); data-containing panels use flat `--ns-lift`/`--ns-glass`-flat so numbers keep full contrast.
- Theme switching on `[data-ns-theme="dark"]` (default) / `[data-ns-theme="light"]`; surface sets it from `prefers-color-scheme` + change listener. Light overrides: amber deepens to `#b97a00` (holds ≥4.5:1 on light), ink → `#1d232b`, muted slate, glass → `rgba(255,255,250,.88)`, hair/tick darker. Both themes pass WCAG 2.2 AA; `color-scheme` set so scrollbars/inputs match.

### Chrome & density (S1)
- `ns-strip` rows: drop the `border-top` hairline separator; separate strips by 8px air + weight/size hierarchy (Linear-style). Reserved 1px hairline only on the floating chrome frame.
- Popup content padding → 16px; table-list density (44px min touch rows per WCAG 2.5.8).
- Meter stays the single repeated bold identity element — unchanged anatomy.

### Type (S2)
- Bahnschrift is a variable font: use `font-variation-settings: "wght" <n>` via `--ns-w-read` (600 idle → 700 for live readings/velocity), numerals `tabular-nums` everywhere.
- Readings count up to value on surface mount (`prefers-reduced-motion` disables).

### Motion (S3)
- One entry gesture per surface (`ns-enter`, already gated). Live VPH reading gets a brief amber glow pulse on mount. No floating/looping motion.

### Popup (S4)
- Editorial header: state dot + wordmark + server-status reading; prefs as grouped strips; pill-limit as a control; custom toggle styling over default checkboxes; same token block.

### Verification (S6)
- eslint + vitest green; live check: www (dark + light), a watch page, search, channel, Studio, popup; contrast ≥ 4.5:1 both themes; `prefers-reduced-motion` honored; no `#000`, no pure-white body.