# SPEC-studio-host

Module id: `studio-host` · Status: draft, awaiting review · Map: `tasks/capability-map.md`

## Objective

Get a Niche-Scope content script alive on `studio.youtube.com`, tell the rest of
the initiative which Studio surface it is looking at, and survive Studio's
single-page navigation without a reload.

That is the whole module. It renders nothing, calls no API, and shows no scores.
Every reason it exists is that the modules after it — the content table, the edit
panel, the thumbnail scorer — each one re-derives "where am I and is the DOM
here yet" if this module does not answer it once.

Stories:

- As a creator with Studio open, I load the extension and it does not throw,
  does not flash anything, and does not cost me a permission prompt.
- As a creator, I navigate from Content to Edit to Upload and the extension
  keeps up without a page reload.
- As a developer, I can turn on a debug surface and see the detected route, the
  video id when there is one, and which expected anchors are present.

## Assumptions I'm making

1. `studio.youtube.com` runs the same content-script restrictions as
   `www.youtube.com`: MV3, isolated world, no inline script, strict page CSP.
2. Studio keeps using Polymer custom elements (`ytcp-*`) for the foreseeable
   future, but the exact element names are not a promise this module makes. It
   only counts "is it here", it does not name what it found.
3. Navigation signals are available as a `yt-navigate-finish` event; a MutationObserver
   is a backstop, not the primary signal.
4. The local server may be down, mid-restart, or on a different port. Nothing in
   this module depends on it being up.
5. Correct me now or I proceed on these.

## Confirmed route shapes

Taken from a live channel, not from documentation and not from my guesses:

| URL | Surface |
|---|---|
| `/channel/UCK_lVZeITq1EJ0abLTO-pvQ` | Channel home |
| `/channel/UCK_lVZeITq1EJ0abLTO-pvQ/content` | Content table |
| `/channel/UCK_lVZeITq1EJ0abLTO-pvQ/analytics/tab-overview/period-default` | Channel analytics |
| `/video/M1HRZS7H5g4/edit` | Edit, one video |
| `/video/M1HRZS7H5g4/analytics/tab-overview/period-default` | One video's analytics |

Two corrections this forces on the design:

- The Content surface is `/content`, not `/videos`. A shape match built on the
  old guess would have matched nothing and shipped a silent no-op.
- A video is addressed as `/video/<id>/...`, **not** a query parameter. There is
  no `?id=` to read.
- The channel id is `UCK…`, not `UC` plus a fixed length. The classifier must not
  validate id shape. A wrong-length check is a check that fails on the next
  channel someone sends, so ids are treated as opaque path segments.

Still unconfirmed: the URL for a **new upload**, and whether Studio exposes an
analytics surface per tab beyond `tab-overview`. Both are asked in Open
Questions rather than assumed.

## Commands

```
Test:        npx vitest run
Types:       npm run typecheck
Lint ext:    npx eslint extension
Manual:      load extension/ unpacked, open https://studio.youtube.com/channel/<your-id>/videos
```

## Project structure

```
extension/
  manifest.json          + one content_scripts entry, one web_accessible match
  studio.js              + new: route detection + observer + debug surface
  lib/studioRoute.js     + new: pure URL -> route classification
  lib/__tests__/         tests live beside the other extension tests
  content.js             unchanged
```

`lib/studioRoute.js` is a pure function with no DOM access, exactly like
`lib/chartRange.js` and `lib/placement.js`. It is the only file in this module
that decides anything, which is what makes route classification testable without
a browser.

## Code style

Follow the existing extension libraries: a self-invoking function, a short
comment explaining a non-obvious rule, a frozen export on `globalThis`, no module
system.

```js
/*
 * Which Studio surface a URL is. Classification is by path segment rather than
 * by full path shape, because Studio rewrites its paths without warning and a
 * shape match breaks on the next redesign while a segment match survives it.
 */
(function attach(global) {
  function classify(url) {
    // ...
  }

  global.NS_STUDIO_ROUTE = { classify };
})(globalThis);
```

No comments that restate code. A comment earns its place by explaining a rule a
reader would otherwise get wrong.

## Testing strategy

- **Unit, `npx vitest run`**: table-driven cases over real Studio URL shapes →
  `content` / `content-short` / `edit` / `upload` / `unknown`. Include the
  awkward ones: a video id in the query string, a trailing slash, an unexpected
  segment, a malformed id.
- **jsdom**: `studio.js` detects its route on load, and a dispatched
  `yt-navigate-finish` changes the detected route without a reload and without
  rendering twice.
- **Effect budget**: a jsdom test asserts the content script appends **zero**
  nodes to the page when debug is off. This is the test that keeps "we only read
  Studio" an enforced fact rather than an intention.
- **Network budget**: a test asserts this module issues no `fetch` at all.
- **Regression**: the existing 237 tests must pass untouched. The `www` content
  script entry is not edited by this module.
- **Known gap, recorded not hidden**: jsdom cannot prove Studio's real DOM, its
  CSP, or its navigation events. A manual checklist goes in the spec's Open
  Questions with the exact URLs to walk.

## Boundaries

**Always**
- Pure classification in `lib/studioRoute.js`, covered by tests.
- Debounce observer work; Studio fires mutations in bursts.
- Every edit UTF-8, via the edit tool. No PowerShell `Set-Content`.
- Run the gates in `CONSTRAINTS.md` before committing.

**Ask first**
- Adding any entry to `host_permissions`. This module should need none: a static
  content script matches on `content_scripts.matches`, and all server traffic
  already goes through the background worker, which holds `localhost:3000`.
  Keeping the permission prompt unchanged is worth stating out loud.
- Editing `content.js` or any `www` library. If Studio needs something, it gets
  its own file.
- The extension `version` bump. New surface means `0.5.1` → `0.6.0`, but the
  version scheme is the user's call.

**Never**
- Mutate Studio's DOM, with one exception: the opt-in debug overlay, which
  appends to `document.body` and is off by default.
- Fetch a Studio URL directly from the content script. Route everything through
  the background worker.
- Inline `<style>`, `eval`, or any other page-CSP escape. Style the debug
  overlay with the existing `ns-theme.css`, declared web-accessible for
  `studio.youtube.com`.
- Log, store, or transmit an API key.

## Success criteria

1. `studio.js` runs on `studio.youtube.com/*` and is absent from `www.youtube.com/*`.
2. `content_scripts` gains exactly one entry; `host_permissions` is unchanged.
3. `lib/studioRoute.js` classifies all five route kinds correctly across a
   table-driven suite including malformed ids.
4. A `yt-navigate-finish` dispatch updates the route with no reload, and the
   observer does not fire a second render for the same navigation.
5. Zero nodes appended to the page with debug off; zero `fetch` calls made.
6. All 237 existing tests still pass; `npm run typecheck` and `npx eslint extension` are clean.
7. `ns-theme.css` is web-accessible for `studio.youtube.com`.
8. Debug mode is reachable without editing code and defaults to off.

## Open questions

- Debug toggle: a `chrome.storage.local` key, a `?nsdebug=1` query param, or
  both? Leaning both — the query param for a fast manual pass, storage for a
   sticky session.
- Should the debug overlay live inside a shadow root like every other surface,
  or sit as a plain fixed panel? Shadow root keeps Studio's CSS from reaching it
  and ours from leaking; a plain panel is easier to inspect in DevTools.
- The upload URL and the analytics tab names are still unconfirmed, so the
  table-driven suite covers only the five shapes above plus malformed input. It
  grows when the real shapes are known, rather than certifying a guess now.
- Next.js route work is out of this module, but note for later: `AGENTS.md`
  requires reading `node_modules/next/dist/docs/` before writing any Next code in
  this repo.
