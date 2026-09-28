# Niche-Scope Chrome Extension (MV3)

Overlays subscriber counts, views/hour (velocity) and an outlier score on
youtube.com, and saves thumbnails from the card itself — powered by your local
Niche-Scope server at `http://localhost:3000`.

## What it does

- **Every card, quietly**: home, search, channel, shorts and browse grids get a
  thin strip hung under the card itself - no hovering, no clicking. It says only
  what the card cannot: subscribers on the first line, views per hour and the
  outlier score on the second. YouTube's own channel, views and age are never
  repeated. The strip waits for the server, so it never shows a guess. Hover any
  reading and the strip explains that one number in a line of plain text.
- **Thumbnails** (home, search, related, shorts): a **download** icon appears on
  the card's own hover controls and saves the thumbnail at the best size that
  exists. It sits under YouTube's Volume and Captions buttons when the site has
  built that row, and in the bottom-left corner of the image when it has not -
  which is the usual case, because that row only exists while a card is hovered.
- **Watch pages**: a floating card in the top-right shows the video's SEO score,
  letter grade, views, channel subs, velocity, the 24h trend when it exists, and
  the actionable/performance split.
- **Watch menu**: a **Download thumbnail** row sits directly under the site's own
  Audio and captions row, and saves the thumbnail at the best size that exists.
- **Popup**: server health, your API quota, tracked-item counts, audit status and
  the overlay controls.

## Card data, and what each mode shows

`Card data` in the popup decides whether the strip shows at all.

| Mode | Card shows |
|---|---|
| `Off` | no strip on the card |
| `Full` (default) | `subscribers` on line one, `views/hr` and the outlier score on line two |

The outlier reads as the score it is - `3.4×`, with the explanation in the hover
text - because a card has no room for a sentence. It is measured against the
channel's own lifetime views per video, so it works for channels nobody has
tracked, and the watch card prefers the average of the videos it has stored when
it has one.

The two rows are not equally loud. Subscribers is context, so it sits back in the
muted grey; views per hour and the outlier score are the judgements, so they
carry the weight. Cyan means rate, amber means something worth a second look.

`Cards per pass` (24-100) caps how many cards a single DOM pass may touch, which
keeps a fast scroll cheap; everything is picked up on the next pass.

## Overlay preferences

The popup has an **Overlays on YouTube** section: toggle the watch-page card,
search/channel research and the AI coach independently, then set card data and
cards per pass. Preferences persist in `chrome.storage.local` (key `ns:prefs`)
and the content script applies them live via `chrome.storage.onChanged` — no page
reload needed.

## Load it (unpacked)

1. Make sure your Niche-Scope server is running: `npm run dev` in the project root.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select this `extension/` folder.
5. Open YouTube home — every card should show a strip, and hovering a card should
   reveal the download icon on it. Hard-refresh (`Ctrl+Shift+R`) after reloading
   the extension, or the old script keeps running.

If the icon does not appear, the console prints one line explaining itself:

```
[niche-scope] hover icon: cards=24 mounted=24 missed=0 image-box=[yt-thumbnail-view-model] missed-because=[]
```

`cards` is how many cards were walked, `mounted` how many got the icon, and
`image-box` names the element it was placed in. A `missed` count, or a missing
`image-box`, means YouTube changed the card again and the selector list in
`extension/lib/thumb.js` needs the new name.

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
`videos.list` call on the server plus one `channels.list` for the subscriber
counts and the outlier baseline — two quota units per 50 cards. Both read the
server cache first, so re-scrolling a page costs no quota at all.

No data leaves your machine — everything hits `localhost`. The one exception is
the thumbnail save, which goes straight to YouTube’s image host through
`chrome.downloads` in the service worker (`downloads` permission, no host
permission needed).

## Endpoints used

| Endpoint | Used by |
|---|---|
| `POST /api/videos/grid` | the strip under every card (batched, up to 50 ids) |
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
- If the server is off the strip simply stays empty — it would rather say nothing
  than guess — and the popup says “Server offline”.
- The card’s **download** icon is never drawn outside the image, and never on a
  card that has no image to draw it on. It prefers the site’s own hover row and
  falls back to a corner of the image, so a layout we do not recognise loses the
  ideal position rather than the feature. The **Download thumbnail** menu row on a
  watch page has a different rule: it needs the site’s own Audio and captions row
  to sit under, because a watch page has no image corner to fall back to.
- YouTube Studio has no overlays yet; that is Phase C.
- No build step: plain JS/CSS/HTML, loaded unpacked.
