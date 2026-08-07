/* Niche-Scope content script: overlays SEO scores on YouTube.
 * Fetches happen in the background worker (avoids page CORS).
 */

function api(path, opts) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "api", path, opts }, (res) => resolve(res));
  });
}

function videoIdFromHref(href) {
  try {
    const u = new URL(href, location.href);
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{6,})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function grade(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 55) return "D";
  if (score >= 40) return "E";
  return "F";
}

function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

/* ------------------------- Watch-page floating card ------------------------- */

let cardHost = null;
let cardRoot = null;

function buildCard() {
  if (cardHost) return;
  cardHost = document.createElement("div");
  cardHost.style.cssText =
    "position:fixed;right:16px;top:64px;z-index:999999;font-family:-apple-system,Segoe UI,Roboto,sans-serif;";
  const shadow = cardHost.attachShadow({ mode: "open" });
  cardRoot = shadow;
  const style = document.createElement("style");
  style.textContent = `
    .ns { width: 220px; background:#fff; border:1px solid #e4e4e4; border-radius:12px;
          box-shadow:0 8px 24px rgba(0,0,0,.12); padding:12px 14px; color:#0f0f0f; }
    .ns h1 { margin:0 0 8px; font-size:12px; font-weight:700; letter-spacing:.02em;
             text-transform:uppercase; color:#8a8a8a; display:flex; justify-content:space-between; align-items:center; }
    .ns .close { cursor:pointer; border:0; background:none; font-size:14px; color:#8a8a8a; line-height:1; padding:2px; }
    .ns .row { display:flex; align-items:center; gap:10px; margin:6px 0; }
    .ns .score { width:46px; height:46px; border-radius:50%; display:flex; flex-direction:column;
                 align-items:center; justify-content:center; color:#fff; font-weight:800; }
    .ns .score b { font-size:17px; line-height:1; }
    .ns .score span { font-size:9px; opacity:.9; margin-top:2px; }
    .ns .meta { font-size:12px; line-height:1.5; }
    .ns .meta b { font-size:14px; }
    .ns .pill { display:inline-block; font-size:10px; font-weight:700; padding:2px 8px;
                border-radius:999px; margin-top:6px; }
    .ns .err { font-size:12px; color:#b91c1c; line-height:1.5; }
    .ns .off { font-size:12px; color:#6b7280; line-height:1.5; }
    .ns a { display:block; margin-top:10px; font-size:11px; color:#2563eb; text-decoration:none; }
  `;
  shadow.appendChild(style);
  document.body.appendChild(cardHost);
}

function scoreColor(score) {
  if (score >= 80) return "#16a34a";
  if (score >= 60) return "#65a30d";
  if (score >= 40) return "#eab308";
  if (score >= 25) return "#f97316";
  return "#dc2626";
}

function renderCard(data) {
  const s = cardRoot.querySelector(".ns-body");
  if (!data || !data.seo) {
    s.innerHTML =
      '<p class="off">No score for this video. Make sure Niche-Scope is running (npm run dev) and the video is public.</p>';
    return;
  }
  const total = data.seo.total;
  const color = scoreColor(total);
  const vph = data.vph && data.vph.vph != null ? data.vph.vph : null;
  s.innerHTML = `
    <div class="row">
      <div class="score" style="background:${color}"><b>${total}</b><span>${grade(total)}</span></div>
      <div class="meta">
        <b>${fmt(data.video.viewCount)}</b> views<br>
        ${data.channel ? fmt(data.channel.subscriberCount) + " subs" : ""}
        ${vph != null ? `<div class="pill" style="background:#0f172a;color:#fff">${vph}/hr</div>` : ""}
      </div>
    </div>
    <p class="off">Actionable ${data.seo.actionablePct}% · Performance ${data.seo.performancePct}%</p>`;
}

function showWatchCard(videoId) {
  buildCard();
  cardRoot.innerHTML =
    '<div class="ns"><h1>Niche-Scope <button class="close">×</button></h1><div class="ns-body"><p class="off">Loading…</p></div></div>';
  cardRoot.querySelector(".close").addEventListener("click", () => {
    if (cardHost) cardHost.remove();
    cardHost = null;
    cardRoot = null;
  });

  api("/api/videos/lookup", { method: "POST", body: { url: videoId } }).then((res) => {
    if (!res || !res.ok || res.error) {
      renderCard(null);
      return;
    }
    renderCard(res.data);
  });
}

/* --------------------------- Thumbnail score pills --------------------------- */

const badgedIds = new Set();
let overlayRunning = false;

function lookupVideo(id) {
  return api("/api/videos/lookup", { method: "POST", body: { url: id } }).then((res) => res);
}

function addPill(anchor, id) {
  if (badgedIds.has(id)) return;
  badgedIds.add(id);

  const pill = document.createElement("div");
  pill.textContent = "…";
  pill.style.cssText =
    "position:absolute;top:6px;left:6px;z-index:50;background:rgba(15,23,42,.85);color:#fff;" +
    "font:700 11px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;padding:2px 7px;border-radius:999px;" +
    "pointer-events:none;letter-spacing:.01em;";
  anchor.style.position = "relative";
  anchor.appendChild(pill);

  lookupVideo(id).then((res) => {
    if (!res || !res.ok || !res.data || !res.data.seo) {
      pill.textContent = "—";
      return;
    }
    const total = res.data.seo.total;
    pill.textContent = `${grade(total)} ${total}`;
    pill.style.background = scoreColor(total);
  });
}

function scanThumbnails() {
  if (overlayRunning) return;
  overlayRunning = true;

  const links = document.querySelectorAll(
    'a#thumbnail[href*="watch?v="], a#thumbnail[href*="/shorts/"], a.ytd-thumbnail[href*="watch?v="]'
  );
  let added = 0;
  for (const a of links) {
    if (added >= 24) break; // gentle on the local server per pass
    const id = videoIdFromHref(a.getAttribute("href"));
    if (!id || badgedIds.has(id)) continue;
    addPill(a, id);
    added++;
  }
  overlayRunning = false;
}

/* ------------------------------- Boot / routing ------------------------------ */

function currentVideoId() {
  return videoIdFromHref(location.href);
}

function route() {
  const id = currentVideoId();
  if (id) {
    showWatchCard(id);
  }
}

function onDomChange() {
  scanThumbnails();
}

let observer = null;
function init() {
  route();
  scanThumbnails();

  observer = new MutationObserver(() => {
    // Debounce rapid DOM churn (YouTube is chatty).
    clearTimeout(observer._t);
    observer._t = setTimeout(onDomChange, 800);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Re-route when navigating between watch pages via the History API.
let lastHref = location.href;
function watchUrl() {
  if (location.href !== lastHref) {
    lastHref = location.href;
    const id = currentVideoId();
    if (id) {
      showWatchCard(id);
    }
    scanThumbnails();
  }
  requestAnimationFrame(watchUrl);
}

init();
watchUrl();
