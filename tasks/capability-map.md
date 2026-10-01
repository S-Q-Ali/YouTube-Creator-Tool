# Capability Map: Studio AI Toolkit

Approved 2026-10-01. This map is the index; module ids never change once written.

The initiative exists to close a measured vidIQ parity gap. Niche-Scope already
has the scores, the keyword data and all seven AI actions on the server. What is
missing is the surface: Studio has no integration at all, so none of that work is
reachable at the moment a creator is about to publish. This map is the smallest
set of modules that puts it there.

Coverage measured before this map: 16 features complete, 11 partial, 12 missing.
This initiative closes #13 (recommended tags), #14 (Boost This Video), #16
(Optimize Score), #17-19 (AI titles, descriptions, tags), #23-25 (thumbnail
preview, compare, builder).

## Modules

| Module id | Responsibility | Depends on | Closes |
|---|---|---|---|
| `studio-host` | Manifest host permission, content-script entry, `ytcp-*` SPA routing via `yt-navigate` + observer, debug surface | — | prerequisite |
| `studio-dom` | Brittle Studio selectors isolated behind stable handles: video rows, Edit buttons, edit-form fields | `studio-host` | prerequisite |
| `ai-routing` | Per-action provider selection across text, vision and image. Keeps text-only providers out of vision calls | — | #25 |
| `studio-server` | Studio API contract: video lookup from a Studio URL, optimize score, apply/replace, vision thumbnail score | `ai-routing` | #16 |
| `studio-content-table` | Content page: Videos and Shorts rows carrying our own stats plus an Edit action | `studio-dom`, `studio-server` | #13 |
| `studio-edit-panel` | Edit page: per-field scores, suggestions, Magic Fill that writes into the form | `studio-dom`, `studio-server` | #16-19 |
| `studio-upload-panel` | Upload flow: pre-publish suggestions, reusing the edit panel | `studio-edit-panel` | #14 |
| `studio-thumbnail` | Thumbnail score from a vision model, preview, generation handoff | `studio-server`, `studio-edit-panel` | #23-25 |

## Build order

```
studio-host
  ├── studio-dom ──┐
  └── ai-routing ──┴─→ studio-server ──→ studio-content-table ──┐
                                        └─→ studio-edit-panel ──┼─→ studio-upload-panel
                                                             └─→ studio-thumbnail
```

Dependency arrows point one way and no cycle exists. `studio-content-table` and
`studio-edit-panel` are independent of each other and may ship in either order;
both depend on the same two foundations.

## Decisions already taken

- **Write, do not suggest-then-paste.** Magic Fill writes into the real Studio
  form fields. Chosen over clipboard-only because a creator should not retype a
  description they already had generated. The cost is a DOM dependency, which is
  why `studio-dom` is its own module and every selector lives there.
- **Thumbnail means both.** Score through a vision model and generate through
  AIHubMix. The generator already exists in `lib/thumbnailGenerator.ts`; only the
  scoring is new.

## Deliberately outside this initiative

Best Time to Post, CSV Export, Controversial Keywords, Title and Description
Translation, Search Ranking Preview, Comment Tool, Achievements, Advanced Embed,
Weight Class, Real-Time Stats, Competitor comparator and alerts, Shorts-specific
analytics, and Instagram/Reels.

Three of these are cheap enough to be their own initiative rather than a
distraction here: Best Time to Post (per-day data already exists),
CSV Export (`lib/backup.ts` is the model), and Controversial Keywords (a word
list and a check).

## Spec index

| Spec | Status |
|---|---|
| `SPEC-studio-host.md` | draft, awaiting review |
| `SPEC-studio-dom.md` | not started |
| `SPEC-ai-routing.md` | not started |
| `SPEC-studio-server.md` | not started |
| `SPEC-studio-content-table.md` | not started |
| `SPEC-studio-edit-panel.md` | not started |
| `SPEC-studio-upload-panel.md` | not started |
| `SPEC-studio-thumbnail.md` | not started |
