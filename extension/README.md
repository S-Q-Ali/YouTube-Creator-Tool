# Niche-Scope Chrome Extension (MV3)

Overlays vidIQ-style scores, letter grades and views/hour (velocity) directly on
youtube.com — powered by your local Niche-Scope server at `http://localhost:3000`.

## What it does

- **Every card, always on**: home, search, channel, shorts and browse grids get a
  quiet line of readings under the card’s own metadata — no hovering, no clicking.
  The line paints instantly from the text YouTube already prints, then upgrades
  itself in place with exact views, runtime and velocity from the server.
- **Thumbnails** (home, search, related, shorts): a small chip shows the grade
  letter plus the score meter.
- **Watch pages**: a floating card in the top-right shows the video’s SEO score,
  letter grade, views, channel subs, velocity, the 24h trend when it exists, and
  the actionable/performance split.
- **Popup**: server health, your API quota, tracked-item counts, audit status and
  the overlay controls.

## Card data, and what each mode shows

`Card data` in the popup decides how much a card says. The rule is gaps-only: a
reading appears on the line only when the card does not already show it.

| Mode | Card shows |
|---|---|
| `Off` | nothing on the line (chips still work) |
| `Velocity only` (default) | views per hour; the runtime appears only on cards whose own thumbnail has no runtime badge |
| `Everything` | the above plus views and the per-day rate |

`Cards per pass` (24–100) caps how many cards a single DOM pass may touch, which
keeps a fast scroll cheap; everything is picked up on the next pass.

## Overlay preferences

The popup has an **Overlays on YouTube** section: toggle the watch-page card,
thumbnail chips, search/channel research and the AI coach independently, then
set card data, cards per pass and signals per pass. Preferences persist in
`chrome.storage.local` (key `ns:prefs`) and the content script applies them live
via `chrome.storage.onChanged` — no page reload needed.

## Load it (unpacked)

1. Make sure your Niche-Scope server is running: `npm run dev` in the project root.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select this `extension/` folder.
5. Open YouTube home — every card should show a velocity reading.

## How it talks to your server

Content scripts run inside the page, so they can’t fetch `localhost` directly
(CORS). Instead:

- `content.js` asks `background.js` to make the request
  (`chrome.runtime.sendMessage({ type: "api", path, opts })`).
- `background.js` fetches `http://localhost:3000` (allowed by
  `host_permissions`) and caches responses for 10 minutes in
  `chrome.storage.session` so scrolling YouTube doesn’t hammer your local API.

A page of cards costs **one** request: ids are queued as cards are found and sent
250ms after the page stops moving, up to 50 per call, which is a single
`videos.list` call on the server. The server reads its own cache first, so
re-scrolling a page costs no quota at all.

No data leaves your machine — everything hits `localhost`.

## Endpoints used

| Endpoint | Used by |
|---|---|
| `POST /api/videos/grid` | card lines + thumbnail chips (batched, up to 50 ids) |
| `POST /api/videos/lookup` | watch card, search and channel research |
| `GET /api/quota` | popup |
| `GET /api/competitors` | popup |
| `GET /api/auth/status` | popup |

## Velocity vs 24h trend

Two different numbers, deliberately not conflated:

- **Velocity** = views ÷ hours since publish. Available for any video, which is
  why the grids use it. `lib/velocity.ts` is the source of truth.
- **24h trend** = the view delta across our own hourly snapshots, so it only
  exists for videos on the watchlist. The watch card labels it separately.

## Notes

- Scores only appear for public videos (private/region-blocked videos error gracefully as `—`).
- If the server is off, the line keeps its first-pass reading and the popup says “Server offline”.
- YouTube Studio has no overlays yet; that is Phase C.
- No build step: plain JS/CSS/HTML, loaded unpacked.
