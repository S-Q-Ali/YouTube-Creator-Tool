# Niche-Scope Chrome Extension (MV3)

Overlays vidIQ-style scores, letter grades and views/hour (VPH) directly on
youtube.com — powered by your local Niche-Scope server at `http://localhost:3000`.

## What it does

- **Watch pages**: a floating card in the top-right shows the video’s SEO score,
  letter grade, views, channel subs, VPH and the actionable/performance split.
- **Thumbnails** (home, search, related, shorts): a small pill shows the grade +
  score for each video.
- **Popup**: server health, your API quota, tracked-item counts, and audit status.

## Load it (unpacked)

1. Make sure your Niche-Scope server is running: `npm run dev` in the project root.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select this `extension/` folder.
5. Open any YouTube video — you should see the floating card and thumbnail pills.

## How it talks to your server

Content scripts run inside the page, so they can’t fetch `localhost` directly
(CORS). Instead:

- `content.js` asks `background.js` to make the request
  (`chrome.runtime.sendMessage({ type: "api", path, opts })`).
- `background.js` fetches `http://localhost:3000` (allowed by
  `host_permissions`) and caches responses for 10 minutes in
  `chrome.storage.session` so scrolling YouTube doesn’t hammer your local API.

No data leaves your machine — everything hits `localhost`.

## Endpoints used

| Endpoint | Used by |
|---|---|
| `POST /api/videos/lookup` | watch card + thumbnail pills |
| `GET /api/quota` | popup |
| `GET /api/competitors` | popup |
| `GET /api/auth/status` | popup |

## Notes

- Scores only appear for public videos (private/region-blocked videos error gracefully as `—`).
- If the server is off, thumbnails show `—` and the popup says “Server offline”.
- No build step: plain JS/CSS/HTML, loaded unpacked.
