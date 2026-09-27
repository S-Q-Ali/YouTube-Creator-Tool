/* Niche-Scope content script: SEO scores + research overlays on YouTube.
 * Fetches happen in the background worker (avoids page CORS).
 * Surfaces: always-on grid data lines, thumbnail verdict chips, watch-page
 * card (score + tags + AI coach), search-page keyword panel, channel research
 * card. */

const NS_LINE_TILE = "yt-lockup-view-model, ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer";
const NS_LINE_LINK = 'a[href*="/watch?v="], a[href*="/shorts/"], a[href*="/live/"], a[href*="youtu.be/"]';
const NS_LINE_META = ".yt-content-metadata-view-model__metadata-line, #metadata-line, #metadata, ytd-video-meta-renderer, .yt-content-metadata-view-model";
const NS_LINE_DURATION_BADGE =
  "ytd-thumbnail-overlay-time-status-renderer, .yt-thumbnail-overlay-time-status-renderer, .badge-shape-wiz__thumbnail-badge, [class*='TimeStatus'], [class*='time-status']";

/* Theme tokens mirror extension/ns-theme.css (canonical) — keep in sync. */
const NS_TOKENS = `
:host {
  color-scheme: dark;
  --ns-amber: #f0a500;
  --ns-cyan: #3cc8de;
  --ns-bad: #e4574f;
  --ns-ink: #f2f5f8;
  --ns-mute: #8a94a3;
  --ns-lift: #141820;
  --ns-glass: rgba(14, 17, 22, 0.78);
  --ns-glass-solid: #141820;
  --ns-hair: rgba(242, 245, 248, 0.1);
  --ns-tick: rgba(242, 245, 248, 0.18);
  --ns-radius: 2px;
  --ns-motion: 140ms;
  --ns-w-read: 600;
  --ns-w-read-strong: 700;
  --ns-font-read: "Bahnschrift", "Segoe UI Variable Display", "Segoe UI", sans-serif;
  --ns-font-ui: system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
}
:host([data-ns-theme="light"]) {
  color-scheme: light;
  --ns-amber: #9a6300;
  --ns-cyan: #0d7a8f;
  --ns-bad: #c0392b;
  --ns-ink: #1d232b;
  --ns-mute: #5b6472;
  --ns-lift: #ffffff;
  --ns-glass: rgba(255, 255, 252, 0.85);
  --ns-glass-solid: #ffffff;
  --ns-hair: rgba(29, 35, 43, 0.14);
  --ns-tick: rgba(29, 35, 43, 0.22);
}`;

const NS_COMPONENTS = `
.ns-surface { background: var(--ns-glass); -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px); border: 1px solid var(--ns-hair); border-radius: 0;
  color: var(--ns-ink); font-family: var(--ns-font-ui); }
.ns-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.ns-head .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ns-amber); flex: none; }
.ns-head h1 { margin: 0; font-size: 12px; font-weight: 600; letter-spacing: normal; text-transform: none;
  color: var(--ns-ink); flex: 1; }
.ns-head .close { cursor: pointer; border: 0; background: none; font-size: 14px; color: var(--ns-mute);
  line-height: 1; padding: 2px 3px; }
.ns-head .close:hover { color: var(--ns-ink); }
.ns-meter { display: flex; align-items: stretch; gap: 1px; height: 6px; padding: 1px;
  background: var(--ns-hair); border-radius: var(--ns-radius); }
.ns-meter .ns-seg { flex: 1 1 0; min-width: 2px; background: var(--ns-tick); border-radius: 1px;
  transition: background var(--ns-motion) ease-out; }
.ns-meter .ns-seg.on { background: var(--ns-amber); }
.ns-meter .ns-seg.on--time { background: var(--ns-cyan); }
.ns-meter--sm { height: 4px; padding: 0; }
.ns-meter--xs { height: 3px; padding: 0; }
.ns-score { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.ns-reading { display: inline-flex; align-items: center; gap: 6px; font-family: var(--ns-font-read);
  font-size: 19px; font-weight: var(--ns-w-read); font-variation-settings: "wght" var(--ns-w-read);
  font-variant-numeric: tabular-nums; color: var(--ns-ink); }
.ns-strips { display: flex; flex-direction: column; gap: 8px; }
.ns-strip { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 0; }
.ns-strip .k { font-size: 11.5px; color: var(--ns-mute); }
.ns-strip .v { font-family: var(--ns-font-read); font-size: 12.5px; font-weight: var(--ns-w-read);
  font-variation-settings: "wght" var(--ns-w-read); font-variant-numeric: tabular-nums;
  color: var(--ns-ink); white-space: nowrap; }
.ns-strip .v.ns-live { color: var(--ns-amber); font-variation-settings: "wght" var(--ns-w-read-strong); }
.ns-strip .v.ns-time { color: var(--ns-cyan); }
.ns-strip .v.ns-dead { color: var(--ns-bad); }
.ns-chip { display: inline-block; font-family: var(--ns-font-read); font-weight: 600; font-size: 10px;
  line-height: 1.25; padding: 1px 5px 1px 7px; border: 1px solid var(--ns-mute);
  border-radius: 999px 2px 2px 999px; color: var(--ns-mute); }
.ns-chip--live { border-color: var(--ns-amber); color: var(--ns-amber); }
.ns-chip--dead { border-color: var(--ns-bad); color: var(--ns-bad); }
.ns-btn { font-family: var(--ns-font-ui); font-size: 12px; line-height: 1; color: var(--ns-ink);
  background: var(--ns-lift); border: 1px solid var(--ns-hair); border-radius: var(--ns-radius);
  padding: 5px 9px; cursor: pointer; }
.ns-btn:hover { border-color: var(--ns-amber); color: var(--ns-amber); }
.ns-btn:disabled { opacity: 0.5; cursor: default; border-color: var(--ns-hair); color: var(--ns-mute); }
.ns-actions { display: flex; gap: 6px; margin-top: 8px; }
.ns-foot { margin: 8px 0 0; font-size: 11px; color: var(--ns-mute); }
.ns-note { margin: 0; font-size: 11.5px; color: var(--ns-mute); line-height: 1.55; }
.ns-note--bad { color: var(--ns-bad); }
.ns-tags { margin-top: 10px; border-top: 1px solid var(--ns-hair); padding-top: 8px; }
.ns-taghead { display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px; }
.ns-taghead b { font-weight: 600; font-size: 11.5px; color: var(--ns-ink); }
.ns-taghead span { font-size: 11px; color: var(--ns-mute); }
.ns-tagwrap { display: flex; flex-wrap: wrap; gap: 4px; }
.ns-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--ns-ink);
  background: var(--ns-lift); border: 1px solid var(--ns-hair); border-radius: var(--ns-radius);
  padding: 2px 6px; cursor: copy; }
.ns-tag:hover { border-color: var(--ns-amber); }
.ns-tag .ns-tagscore { font-family: var(--ns-font-read); font-size: 10px; color: var(--ns-mute);
  font-variant-numeric: tabular-nums; }
.ns-tag.ns-add { border-color: var(--ns-cyan); color: var(--ns-cyan); }
.ns-tag.ns-add .ns-tagscore { color: var(--ns-cyan); }
.ns-coach { margin-top: 10px; border-top: 1px solid var(--ns-hair); padding-top: 8px; }
.ns-coach-q { display: flex; gap: 6px; }
.ns-coach textarea { flex: 1; background: var(--ns-lift); color: var(--ns-ink); border: 1px solid var(--ns-hair);
  border-radius: var(--ns-radius); padding: 6px 8px; font-family: var(--ns-font-ui); font-size: 12px;
  resize: vertical; min-height: 40px; }
.ns-coach textarea::placeholder { color: var(--ns-mute); }
.ns-coach textarea:focus { outline: none; border-color: var(--ns-amber); }
.ns-answer { margin: 8px 0 0; white-space: pre-wrap; font-size: 12px; line-height: 1.6; color: var(--ns-ink);
  max-height: 260px; overflow: auto; }
.ns-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin: 3px 0; }
.ns-row .t { font-size: 11.5px; color: var(--ns-mute); }
.ns-row .m { width: 84px; }
.ns-row .n { font-family: var(--ns-font-read); font-size: 12px; font-variant-numeric: tabular-nums;
  color: var(--ns-ink); width: 28px; text-align: right; }
.ns-badges { display: flex; gap: 6px; flex-wrap: wrap; margin: 2px 0 6px; }
.ns-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; color: var(--ns-ink);
  border: 1px solid var(--ns-hair); border-radius: 999px; padding: 2px 8px; }
.ns-badge .bd { width: 5px; height: 5px; border-radius: 50%; }
.ns-badge.bt .bd { background: var(--ns-amber); }
.ns-badge.bo .bd { background: var(--ns-cyan); }
.ns-list { margin-top: 6px; }
.ns-item { display: flex; align-items: baseline; gap: 8px; padding: 4px 0; text-decoration: none; }
.ns-item + .ns-item { border-top: 1px solid var(--ns-hair); }
.ns-item:hover .ns-item-title { color: var(--ns-amber); }
.ns-item-title { font-size: 11.5px; line-height: 1.4; color: var(--ns-ink); flex: 1; }
.ns-item .ns-item-v { font-family: var(--ns-font-read); font-size: 11px; color: var(--ns-mute);
  font-variant-numeric: tabular-nums; white-space: nowrap; }
.ns-section-title { font-size: 11.5px; color: var(--ns-mute); margin: 10px 0 4px; }
.ns-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.ns-chipbtn { font-size: 11px; color: var(--ns-cyan); background: var(--ns-lift); border: 1px solid var(--ns-hair);
  border-radius: var(--ns-radius); padding: 2px 6px; cursor: pointer; }
.ns-chipbtn:hover { border-color: var(--ns-cyan); }
.ns-chipbtn.ns-q { color: var(--ns-ink); }
.ns-skeleton { display: flex; flex-direction: column; gap: 6px; }
.ns-skeleton span { display: block; height: 10px; background: var(--ns-tick); border-radius: 1px; }
@keyframes ns-open { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes ns-glow {
  0% { text-shadow: none; }
  20% { text-shadow: 0 0 0 rgba(240, 165, 0, 0); }
  40% { text-shadow: 0 0 18px rgba(240, 165, 0, 0.45); }
  100% { text-shadow: 0 0 0 rgba(240, 165, 0, 0); }
}
.ns-enter { animation: ns-open var(--ns-motion) ease-out; }
.ns-glow--live { animation: ns-glow 900ms var(--ns-motion) ease-out; }
@media (prefers-reduced-motion: reduce) {
  .ns-enter { animation: none; }
  .ns-glow--live { animation: none; text-shadow: none; }
  .ns-meter .ns-seg { transition: none; }
}`;

function api(path, opts) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "api", path, opts }, (res) => resolve(res));
  });
}

const DEFAULT_PREFS = { showCard: true, showPills: true, pillLimit: 24, showResearch: true, showCoach: true, dataMode: "full", tileLimit: 60 };
const DATA_MODES = ["off", "compact", "full"];
const PREFS_KEY = "ns:prefs";
let prefs = { ...DEFAULT_PREFS };

/* Reads a stored preference set and repairs anything the current version no
   longer understands, so an old "line" mode becomes today's full block. */
function mergePrefs(stored) {
  const merged = { ...DEFAULT_PREFS, ...(stored || {}) };
  if (!DATA_MODES.includes(merged.dataMode)) merged.dataMode = DEFAULT_PREFS.dataMode;
  return merged;
}

function ensurePrefs() {
  chrome.runtime.sendMessage({ type: "prefs:get" }, (res) => {
    if (res && res.ok && res.data) {
      prefs = mergePrefs(res.data);
      routeOverlays();
      scanThumbnails();
      scanTiles();
    }
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

function gradeOf(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 55) return "D";
  if (score >= 40) return "E";
  return "F";
}

/* NS_META owns the number and date shapes, so a card line and the panel it
   opens can never spell the same reading two ways. */
function fmt(n) {
  return NS_META.compact(n);
}

function fmtT(n) {
  if (n == null || isNaN(n)) return "—";
  return NS_META.fmtExact(n);
}

function reducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* Count any [data-n] element up to its target once the subtree is mounted. */
function animateNums(root) {
  if (!root) return;
  const reduce = reducedMotion();
  root.querySelectorAll("[data-n]").forEach((el) => {
    const target = parseFloat(el.dataset.n);
    const suffix = el.dataset.s || "";
    if (isNaN(target)) return;
    if (reduce) {
      el.textContent = fmtT(target) + suffix;
      return;
    }
    const start = performance.now();
    const dur = 420;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtT(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function fmtDate(iso) {
  return NS_META.fmtDate(iso) || "—";
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function on(str) {
  return /^[A-Za-z0-9]+$/.test(str) ? str : "";
}

/** Segmented signal meter: `count` segments, `score/100` filled. time = cyan fill. */
function segments(score, count, time) {
  const filled = Math.max(0, Math.min(count, Math.round((score / 100) * count)));
  let s = "";
  for (let i = 0; i < count; i++) {
    const onCls = i < filled ? " on" : "";
    const timeCls = i < filled && time ? " on--time" : onCls;
    const delay = i < filled ? ` style="transition-delay:${i * 14}ms"` : "";
    s += `<span class="ns-seg${timeCls}"${delay}></span>`;
  }
  return s;
}

/** Thin meter row: label + meter + reading. */
function meterRow(label, score, time) {
  if (score == null) {
    return `<div class="ns-row"><span class="t">${label}</span><span class="n">—</span></div>`;
  }
  return `<div class="ns-row"><span class="t">${label}</span><span class="m">${segments(score, 8, time)}</span>` +
    `<span class="n">${score}</span></div>`;
}

/* ------------------------------ Shared data cache ------------------------------ */

const lookupMem = new Map();
function lookupVideo(id) {
  if (!lookupMem.has(id)) {
    lookupMem.set(
      id,
      api("/api/videos/lookup", { method: "POST", body: { url: id } }).then((res) =>
        res && res.ok && res.data ? res.data : null
      )
    );
    if (lookupMem.size > 300) lookupMem.clear();
  }
  return lookupMem.get(id);
}

/* ------------------------------ Host mounting ------------------------------ */

const themeQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

function currentTheme() {
  return themeQuery && themeQuery.matches ? "light" : "dark";
}

/* Repaint every mounted surface + pill when the OS theme flips. */
function applyTheme() {
  const t = currentTheme();
  document.querySelectorAll("[data-ns-theme]").forEach((el) => el.setAttribute("data-ns-theme", t));
}

if (themeQuery && themeQuery.addEventListener) {
  themeQuery.addEventListener("change", applyTheme);
}

const hosts = {};
function mountHost(name, right, top) {
  if (hosts[name]) return hosts[name];
  const host = document.createElement("div");
  host.setAttribute("data-ns-theme", currentTheme());
  host.style.cssText = `position:fixed;right:${right}px;top:${top}px;z-index:999999;`;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = NS_TOKENS + NS_COMPONENTS;
  const root = document.createElement("div");
  shadow.appendChild(style);
  shadow.appendChild(root);
  document.body.appendChild(host);
  hosts[name] = { host, shadow, root };
  return hosts[name];
}

function removeHost(name) {
  const h = hosts[name];
  if (h) {
    h.host.remove();
    delete hosts[name];
  }
}

/* ------------------------- Watch-page floating card ------------------------- */

let cardState = { videoId: null, tagsOpen: false, tags: null, coachOpen: false };

function buildCard() {
  const m = mountHost("card", 16, 64);
  if (!m.root.querySelector(".ns-card")) {
    m.root.innerHTML =
      '<div class="ns-card ns-surface ns-enter"><div class="ns-head"><span class="dot"></span><h1>Niche-Scope</h1>' +
      '<button class="close" type="button">×</button></div><div class="ns-body"><p class="ns-note">Loading…</p></div></div>';
    m.shadow.querySelector(".close").addEventListener("click", () => {
      removeHost("card");
      cardState = { videoId: null, tagsOpen: false, tags: null, coachOpen: false };
    });
  }
  return m;
}

function cardBody() {
  const m = hosts.card;
  return m ? m.shadow.querySelector(".ns-body") : null;
}

function renderCard(data) {
  const s = cardBody();
  if (!s) return;
  if (!data || !data.seo) {
    s.innerHTML =
      '<p class="ns-note">No score for this video. Make sure Niche-Scope is running (npm run dev) and the video is public.</p>';
    return;
  }
  rememberWatchVideo(data);
  const total = data.seo.total;
  const life = data.velocity && data.velocity.vph != null ? data.velocity.vph : null;
  const trend = data.vph && data.vph.vph != null ? data.vph.vph : null;
  const spike = life != null && life >= 500;
  const grade = gradeOf(total);
  const chip = total >= 60 ? "ns-chip--live" : total >= 40 ? "" : "ns-chip--dead";
  const rows = [
    `<div class="ns-strip"><span class="k">views</span><span class="v" data-n="${data.video.viewCount}">${fmtT(data.video.viewCount)}</span></div>`
  ];
  if (life != null) {
    rows.push(
      `<div class="ns-strip"><span class="k">velocity</span><span class="v ${spike ? "ns-live ns-glow--live" : "ns-time"}" data-n="${life}" data-s="/hr">${fmtT(life)}/hr${spike ? " ↑" : ""}</span></div>`
    );
  }
  if (trend != null) {
    rows.push(
      `<div class="ns-strip"><span class="k">24h trend</span><span class="v ns-time" data-n="${trend}" data-s="/hr">${fmtT(trend)}/hr</span></div>`
    );
  }
  if (data.video.likeCount != null) {
    rows.push(`<div class="ns-strip"><span class="k">likes</span><span class="v">${fmt(data.video.likeCount)}</span></div>`);
  }
  if (data.channelContext && data.channelContext.watchedVideos > 0) {
    rows.push(
      `<div class="ns-strip"><span class="k">ch avg</span><span class="v">${fmt(data.channelContext.channelAvgViews)}</span></div>`
    );
  }
  if (data.outlier != null) {
    const hot = data.outlier >= 300;
    // Say which average the number is against: videos we stored, or the
    // channel's own lifetime record.
    const basis = data.outlierBasis === "channel" ? "channel avg" : "avg";
    rows.push(
      `<div class="ns-strip"><span class="k">vs ${basis}</span><span class="v ${hot ? "ns-live" : "ns-time"}">${fmtT(data.outlier)}%${hot ? " outlier" : ""}</span></div>`
    );
  }
  rows.push(`<div class="ns-strip"><span class="k">posted</span><span class="v ns-time">${fmtDate(data.video.publishedAt)}</span></div>`);
  if (data.channel) {
    rows.push(`<div class="ns-strip"><span class="k">channel</span><span class="v">${fmt(data.channel.subscriberCount)} subs</span></div>`);
  }
  s.innerHTML = `
    <div class="ns-score">
      <span class="ns-meter">${segments(total, 12)}</span>
      <span class="ns-reading"><span data-n="${total}">${fmtT(total)}</span><span class="ns-chip ${chip}">${grade}</span></span>
    </div>
    <div class="ns-badges">${cardBadges(data)}</div>
    <div class="ns-strips">${rows.join("")}</div>
    <p class="ns-foot">actionable ${data.seo.actionablePct}%, performance ${data.seo.performancePct}%</p>
    <div class="ns-actions">
      <button class="ns-btn" type="button" data-a="tags">Tags</button>
      ${prefs.showCoach ? '<button class="ns-btn" type="button" data-a="coach">Ask AI</button>' : ""}
    </div>
    <div class="ns-extras"></div>`;
  animateNums(s);
  bindCardActions();
  if (cardState.tagsOpen) openTags();
  if (cardState.coachOpen) openCoach();
}

function cardBadges(data) {
  const badges = [];
  const life = data.velocity && data.velocity.vph != null ? data.velocity.vph : null;
  if (life != null && life >= 500) {
    badges.push('<span class="ns-badge bt"><span class="bd"></span>trending</span>');
  }
  if (data.outlier != null && data.outlier >= 300) {
    badges.push(`<span class="ns-badge bo"><span class="bd"></span>${fmtT(data.outlier)}% of avg</span>`);
  }
  return badges.join("");
}

function bindCardActions() {
  const s = cardBody();
  if (!s) return;
  s.querySelectorAll(".ns-btn[data-a]").forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.a === "tags") {
        cardState.tagsOpen = !cardState.tagsOpen;
        if (cardState.tagsOpen) openTags();
        else closeExtras("tags");
      } else if (btn.dataset.a === "coach") {
        cardState.coachOpen = !cardState.coachOpen;
        if (cardState.coachOpen) openCoach();
        else closeExtras("coach");
      }
      syncActionLabels();
    };
  });
}

function syncActionLabels() {
  const s = cardBody();
  if (!s) return;
  s.querySelectorAll(".ns-btn[data-a]").forEach((btn) => {
    if (btn.dataset.a === "tags") btn.textContent = cardState.tagsOpen ? "Close tags" : "Tags";
    if (btn.dataset.a === "coach") btn.textContent = cardState.coachOpen ? "Close AI" : "Ask AI";
  });
}

function closeExtras(which) {
  const s = cardBody();
  if (!s) return;
  const extra = s.querySelector(`[data-extra="${which}"]`);
  if (extra) extra.remove();
}

function openTags() {
  const s = cardBody();
  if (!s) return;
  if (!cardState.videoId) return;
  const existing = s.querySelector('[data-extra="tags"]');
  if (existing) {
    existing.classList.remove("visually-hidden");
    return;
  }
  const box = document.createElement("div");
  box.dataset.extra = "tags";
  box.innerHTML = '<div class="ns-skeleton"><span></span><span></span><span></span></div>';
  s.querySelector(".ns-extras").appendChild(box);
  if (cardState.tags) {
    renderTags(box, cardState.tags);
    return;
  }
  api(`/api/videos/tags?videoId=${encodeURIComponent(cardState.videoId)}`).then((res) => {
    const data = res && res.ok ? res.data : null;
    if (!data) {
      box.innerHTML = '<p class="ns-note ns-note--bad">Tags unavailable. Check that the server is running.</p>';
      return;
    }
    cardState.tags = data;
    renderTags(box, data);
  });
}

function renderTags(box, data) {
  const tags = data.tags || [];
  const additions = data.additions || [];
  if (tags.length === 0 && additions.length === 0) {
    box.innerHTML = '<p class="ns-note">No public tags on this video.</p>';
    return;
  }
  let html = "";
  if (tags.length) {
    html += `<div class="ns-taghead"><b>Tags</b><span>${tags.length} on video</span></div>` +
      `<div class="ns-tagwrap">${tags.map((t) => tagChip(t.tag, t.score, false)).join("")}</div>`;
  }
  if (additions.length) {
    html += `<div class="ns-taghead"><b>Worth adding</b><span>from your keyword vault</span></div>` +
      `<div class="ns-tagwrap">${additions.map((t) => tagChip(t.tag, t.score, true)).join("")}</div>`;
  }
  html += '<p class="ns-foot">Click a tag to copy it.</p>';
  box.innerHTML = html;
  box.querySelectorAll(".ns-tag").forEach((el) => {
    el.addEventListener("click", () => {
      if (navigator.clipboard) navigator.clipboard.writeText(el.dataset.tag);
      el.classList.add("copied");
      setTimeout(() => el.classList.remove("copied"), 700);
    });
  });
}

function tagChip(tag, score, isAdd) {
  return `<span class="ns-tag${isAdd ? " ns-add" : ""}" data-tag="${esc(tag)}">${esc(tag)}` +
    `<span class="ns-tagscore">${score == null ? "—" : score}</span></span>`;
}

function openCoach() {
  const s = cardBody();
  if (!s) return;
  if (!cardState.videoId) return;
  const existing = s.querySelector('[data-extra="coach"]');
  if (existing) {
    existing.classList.remove("visually-hidden");
    return;
  }
  const box = document.createElement("div");
  box.dataset.extra = "coach";
  box.innerHTML = `
    <div class="ns-coach">
      <div class="ns-coach-q">
        <textarea rows="2" placeholder="Ask about this video. Example: why is this performing well?"></textarea>
        <button class="ns-btn" type="button" data-a="ask">Ask</button>
      </div>
      <div class="ns-answer"></div>
    </div>`;
  s.querySelector(".ns-extras").appendChild(box);
  const textarea = box.querySelector("textarea");
  const answer = box.querySelector(".ns-answer");
  const askBtn = box.querySelector("[data-a=ask]");
  const ask = () => {
    const query = textarea.value.trim();
    if (!query || askBtn.disabled) return;
    askBtn.disabled = true;
    answer.textContent = "Working on it…";
    api("/api/ai/studio", { method: "POST", body: { action: "coach", videoId: cardState.videoId, query } }).then((res) => {
      askBtn.disabled = false;
      const data = res && res.ok ? res.data : null;
      if (!data || data.error) {
        answer.textContent = data && data.error ? data.error : "Couldn't reach the coach. Is the server running?";
      } else {
        answer.textContent = data.answer;
      }
    });
  };
  askBtn.addEventListener("click", ask);
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) ask();
  });
}

function showWatchCard(videoId) {
  buildCard();
  cardState.videoId = videoId;
  const s = cardBody();
  if (s) s.innerHTML = '<p class="ns-note">Loading.</p>';
  lookupVideo(videoId).then((data) => renderCard(data));
}

/* --------------------- Watch menu: save this thumbnail --------------------- */

/*
 * The download row is placed inside YouTube's own menu, directly under the
 * "Audio and captions" row, by cloning that row so the styling is the site's
 * and not ours. Nothing here assumes a specific build of the menu: if the row
 * is not found the item simply does not appear.
 */
const THUMB_LABEL = "Download thumbnail";
const THUMB_ITEM_CLASS = "ns-thumb-item";
const THUMB_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 3v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';

let watchThumb = { id: null, title: "", thumbnailUrl: "" };
let thumbLabel = null;
let thumbObserver = null;

function rememberWatchVideo(data) {
  if (!data || !data.video) return;
  watchThumb = {
    id: data.video.videoId,
    title: data.video.title || "",
    thumbnailUrl: data.video.thumbnailUrl || ""
  };
}

function thumbItem() {
  return document.querySelector("." + THUMB_ITEM_CLASS);
}

function removeThumbItem() {
  const item = thumbItem();
  if (item && item.parentNode) item.parentNode.removeChild(item);
  thumbLabel = null;
}

function setThumbState(text) {
  if (!thumbLabel) return;
  thumbLabel.textContent = text || THUMB_LABEL;
  const item = thumbLabel.closest("." + THUMB_ITEM_CLASS);
  if (item) item.classList.toggle("ns-thumb-item--busy", !!text);
}

function downloadWatchThumb() {
  const id = watchThumb.id || currentVideoId();
  const filename = NS_THUMB.filename(watchThumb.title, id);
  const urls = NS_THUMB.candidates(id, watchThumb.thumbnailUrl);
  if (!filename || urls.length === 0) return;
  setThumbState("Saving...");
  chrome.runtime.sendMessage({ type: "thumb:download", urls, filename }, (res) => {
    if (chrome.runtime.lastError || !res || !res.ok) {
      console.warn("[niche-scope] thumbnail download failed:", (res && res.error) || chrome.runtime.lastError);
      setThumbState("Could not save");
    } else {
      setThumbState("Saved");
    }
    setTimeout(() => setThumbState(null), 2600);
  });
}

function findAudioCaptionsRow() {
  const rows = Array.from(
    document.querySelectorAll("ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer, tp-yt-paper-item")
  );
  const index = NS_THUMB.audioCaptionsIndex(rows.map((row) => row.textContent));
  return index === -1 ? null : rows[index];
}

function buildThumbItem(anchor) {
  const item = anchor.cloneNode(true);
  item.classList.add(THUMB_ITEM_CLASS);
  item.classList.remove("ns-thumb-item--busy");
  item.removeAttribute("id");
  item.removeAttribute("aria-checked");
  item.setAttribute("aria-label", THUMB_LABEL);
  item.querySelectorAll("yt-icon, .dropdown-icon, #icon, .ns-thumb-icon").forEach((icon) => icon.remove());

  const labels = item.querySelectorAll(".dropdown-title, .yt-core-attributed-string");
  if (labels.length === 0) return null;
  thumbLabel = labels[0];
  thumbLabel.textContent = THUMB_LABEL;
  for (let i = 1; i < labels.length; i++) labels[i].remove();

  const icon = document.createElement("span");
  icon.className = "ns-thumb-icon";
  icon.innerHTML = THUMB_ICON_SVG;
  item.insertBefore(icon, item.firstChild);

  const run = (event) => {
    event.preventDefault();
    event.stopPropagation();
    downloadWatchThumb();
  };
  item.addEventListener("click", run, true);
  item.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") run(event);
  }, true);
  return item;
}

function ensureThumbItem() {
  if (currentVideoId() == null) {
    removeThumbItem();
    return;
  }
  if (thumbItem()) return;
  const anchor = findAudioCaptionsRow();
  if (!anchor || !anchor.parentNode) return;
  const item = buildThumbItem(anchor);
  if (item) anchor.parentNode.insertBefore(item, anchor.nextSibling);
}

function watchThumbMenu() {
  if (currentVideoId() == null) {
    if (thumbObserver) {
      thumbObserver.disconnect();
      thumbObserver = null;
    }
    removeThumbItem();
    return;
  }
  if (thumbObserver) return;
  ensureThumbItem();
  thumbObserver = new MutationObserver(() => {
    if (thumbItem()) return;
    clearTimeout(thumbObserver._t);
    thumbObserver._t = setTimeout(ensureThumbItem, 60);
  });
  thumbObserver.observe(document.body, { childList: true, subtree: true });
}

/* ------------------------- Always-on grid data line ------------------------- */

/* Painted twice: once from the text YouTube already shows (no request), then
   upgraded in place from /api/videos/grid. Scoped to grid routes so a line
   never lands on the watch page or on the hero of the page you opened. */

const NS_GRID_HOSTS = "ytd-rich-grid-renderer, ytd-section-list-renderer, ytd-item-section-renderer, ytd-browse[page-subtype='channels'], ytd-browse[page-subtype='playlists']";
const linedTiles = new WeakSet();
const tileRows = new Map();
let linesPass = 0;

function gridPage() {
  const p = location.pathname;
  if (currentVideoId()) return false;
  return p === "/" || p.startsWith("/results") || p.startsWith("/feed") || /^\/@/.test(p) || p.startsWith("/channel/") || p.startsWith("/c/") || p.startsWith("/browse/");
}

function findLineText(tile) {
  const el = tile.querySelector(NS_LINE_META);
  return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
}

function lineCell(text, className) {
  const cell = document.createElement("span");
  cell.className = className;
  cell.textContent = text;
  return cell;
}

function lineSep() {
  return lineCell("·", "ns-line-sep");
}

function paintRow(row, cells) {
  while (row.firstChild) row.removeChild(row.firstChild);
  for (let i = 0; i < cells.length; i++) {
    if (i > 0) row.append(lineSep());
    row.append(lineCell(cells[i][0], cells[i][1]));
  }
}

/* Replace the readings in place; a tile never grows, shrinks or reflows twice.
   The wording is decided and tested in lib/lineModel.js; this only paints it. */
function fillLine(row, model) {
  const line = row.line;
  const built = NS_LINE_MODEL.build({
    mode: prefs.dataMode,
    facts: row.tier0 || {},
    model,
    hasDurationBadge: row.hasDurationBadge
  });

  paintRow(line.children[0], built.ctx);
  paintRow(line.children[1], built.judge);
  line.setAttribute("data-show-dur", built.showDur ? "1" : "0");
  line.classList.toggle("ns-line--blank", built.blank);
}

function buildLine() {
  const line = document.createElement("div");
  line.className = "ns-line";
  line.setAttribute("data-ns-theme", currentTheme());
  for (const cls of ["ns-line-ctx", "ns-line-judge"]) {
    const part = document.createElement("div");
    part.className = "ns-line-row " + cls;
    line.append(part);
  }
  return line;
}

function scanTiles() {
  if (prefs.dataMode === "off" || !gridPage()) return;
  linesPass++;
  const pass = linesPass;
  const budget = prefs.tileLimit || 60;
  const hosts = document.querySelectorAll(NS_GRID_HOSTS);
  const tiles = [];
  for (const host of hosts) {
    for (const tile of host.querySelectorAll(NS_LINE_TILE)) {
      if (tiles.length >= budget) break;
      if (tile.closest("ytd-ad-slot-renderer, ytd-promoted-sparkles-web-renderer")) continue;
      if (tile.querySelector(".ns-line")) continue;
      tiles.push(tile);
    }
  }
  for (const tile of tiles) {
    if (pass !== linesPass) return;
    const link = tile.querySelector(NS_LINE_LINK);
    const id = link && videoIdFromHref(link.getAttribute("href"));
    const text = findLineText(tile);
    if (!id || !text) continue;
    const facts = NS_META.parse(text);
    if (facts.views == null) continue;
    const line = buildLine();
    const meta = tile.querySelector(NS_LINE_META) || link;
    meta.parentNode.insertBefore(line, meta.nextSibling);
    linedTiles.add(tile);
    const row = {
      line,
      tier0: facts,
      hasDurationBadge: !!tile.querySelector(NS_LINE_DURATION_BADGE),
      vph: null,
      views: null,
      durationSeconds: null,
      vphDay: null,
      spike: false
    };
    fillLine(row, row);
    // The same video can appear in more than one slot on a page; every one of
    // those lines has to be upgraded, not just the first.
    const known = tileRows.get(id);
    if (known) known.push(row);
    else tileRows.set(id, [row]);
    if (gridMem.has(id)) applyModel(id, gridMem.get(id));
    else queueUpgrade(id);
  }
}

/* --------------------- Tier 1: upgrade the painted line --------------------- */

const gridMem = new Map();
const pendingGrid = new Set();
let gridTimer = null;
let gridInFlight = false;

function queueUpgrade(id) {
  if (gridMem.has(id) || pendingGrid.has(id)) return;
  pendingGrid.add(id);
  clearTimeout(gridTimer);
  gridTimer = setTimeout(flushUpgrades, 250);
}

/** A line already on screen is never re-scanned, so a failed batch has to be
    requeued here or those cards stay on Tier 0 readings forever. */
const MAX_GRID_ATTEMPTS = 3;
let gridAttempts = 0;

function requeueGrid(ids) {
  for (const id of ids) if (!gridMem.has(id)) pendingGrid.add(id);
}

/* One request per scroll settle, capped at the endpoint's 50-id page. */
async function flushUpgrades() {
  if (gridInFlight || pendingGrid.size === 0) return;
  const ids = [...pendingGrid].slice(0, 50);
  ids.forEach((id) => pendingGrid.delete(id));
  gridInFlight = true;
  try {
    const res = await api("/api/videos/grid", { method: "POST", body: { ids } });
    const rows = res && res.ok && res.data ? res.data.rows : null;
    if (rows && rows.length > 0) {
      gridAttempts = 0;
      for (const data of rows) storeRow(data.id, data);
      const answered = new Set(rows.map((r) => r.id));
      requeueGrid(ids.filter((id) => !answered.has(id)));
    } else {
      gridAttempts++;
      requeueGrid(ids);
    }
  } catch {
    gridAttempts++;
    requeueGrid(ids);
  }
  gridInFlight = false;
  if (pendingGrid.size === 0) return;
  if (gridAttempts < MAX_GRID_ATTEMPTS) setTimeout(flushUpgrades, 2500);
  else pendingGrid.clear();
}

function storeRow(id, data) {
  const model = {
    vph: data.velocity && data.velocity.vph != null ? data.velocity.vph : null,
    vphDay: data.velocity ? data.velocity.vphDay : null,
    views: data.viewCount,
    publishedAt: data.publishedAt,
    durationSeconds: data.durationSeconds,
    subscribers: data.subscribers,
    outlier: data.outlier,
    score: data.score,
    grade: data.grade,
    spike: !!data.spike
  };
  gridMem.set(id, model);
  if (gridMem.size > 400) gridMem.clear();
  applyModel(id, model);
  paintChip(id, model);
}

function applyModel(id, model) {
  const rows = tileRows.get(id);
  if (!rows) return;
  for (const row of rows) {
    row.vph = model.vph;
    row.vphDay = model.vphDay;
    row.views = model.views;
    row.publishedAt = model.publishedAt;
    row.durationSeconds = model.durationSeconds;
    row.subscribers = model.subscribers;
    row.outlier = model.outlier;
    row.spike = model.spike;
    fillLine(row, model);
  }
}

/* ------------------------- Thumbnail signal pills ------------------------- */

const badgedIds = new Set();
const chipsById = new Map();
let overlayRunning = false;
let scanCountLogged = false;

function addPill(anchor, id) {
  if (badgedIds.has(id)) return;
  badgedIds.add(id);

  const pill = document.createElement("div");
  pill.setAttribute("data-ns-theme", currentTheme());
  pill.className = "ns-pill";
  const meter = document.createElement("span");
  meter.className = "ns-meter ns-meter--sm";
  meter.setAttribute("aria-hidden", "true");
  meter.innerHTML = segments(0, 8);
  const grade = document.createElement("span");
  grade.className = "ns-pill-grade";
  const sign = document.createElement("span");
  sign.className = "ns-pill-sign";
  sign.setAttribute("role", "status");
  sign.setAttribute("aria-hidden", "true");
  pill.appendChild(meter);
  pill.appendChild(grade);
  pill.appendChild(sign);
  anchor.style.position = "relative";
  anchor.appendChild(pill);

  chipsById.set(id, { meter, grade, sign });
  if (gridMem.has(id)) paintChip(id, gridMem.get(id));
  else queueUpgrade(id);
}

/* Verdict on the thumbnail, numbers on the line: the same batch row feeds
   both, so a card never shows two different velocities. */
function paintChip(id, model) {
  const chip = chipsById.get(id);
  if (!chip) return;
  chip.meter.innerHTML = segments(model.score || 0, 8);
  chip.meter.querySelectorAll(".ns-seg.on").forEach((seg) => {
    seg.style.transitionDelay = "0ms";
  });
  chip.grade.textContent = model.grade || "";
  chip.sign.className = "ns-pill-sign" + (model.spike ? " on--trend" : "");
}

const THUMBNAIL_SELECTOR = 'a[href*="/watch"], a[href*="/shorts/"]';

function scanThumbnails() {
  if (overlayRunning) return;
  if (!prefs.showPills) return;
  overlayRunning = true;

  const links = document.querySelectorAll(THUMBNAIL_SELECTOR);
  if (!scanCountLogged) {
    console.log("[niche-scope] thumbnail anchors matched:", links.length);
    scanCountLogged = true;
  }
  let added = 0;
  for (const a of links) {
    if (added >= (prefs.pillLimit || 24)) break;
    const id = videoIdFromHref(a.getAttribute("href"));
    if (!id || badgedIds.has(id)) continue;
    addPill(a, id);
    added++;
  }
  overlayRunning = false;
}

/* ------------------------- Search keyword panel ------------------------- */

let searchState = null;

function showSearchPanel(term) {
  const shadow = mountHost("search", 16, 288);
  shadow.root.innerHTML = `
    <div class="ns-surface ns-enter" style="width:232px;padding:10px 12px 8px;">
      <div class="ns-head"><span class="dot"></span><h1>Keyword scope</h1>
        <button class="close" type="button">×</button></div>
      <p class="ns-note">${esc(term)}</p>
      <div class="ns-body"><div class="ns-skeleton"><span></span><span></span><span></span></div></div>
    </div>`;
  shadow.shadow.querySelector(".close").addEventListener("click", () => {
    removeHost("search");
    searchState = { ...(searchState || {}), closed: true };
  });
  const body = shadow.shadow.querySelector(".ns-body");

  const render = (r) => {
    const k = r.results && r.results[0];
    let html = "";
    if (k) {
      html += meterRow("demand", k.demandScore);
      if (k.scored && k.competitionScore > 0) {
        html += meterRow("competition", k.competitionScore, true);
      } else {
        html += `<div class="ns-row"><span class="t">competition</span><span class="n">—</span></div>`;
      }
      html += meterRow("opportunity", k.overallScore);
    }
    if (r.questions && r.questions.length) {
      html += `<div class="ns-section-title">People ask</div>` +
        `<div class="ns-chips">${r.questions.slice(0, 5).map((q) => questionChip(q)).join("")}</div>`;
    }
    if (r.matchingTerms && r.matchingTerms.length) {
      html += `<div class="ns-section-title">Related terms</div>` +
        `<div class="ns-chips">${r.matchingTerms.slice(0, 8).map((t) => `<button class="ns-chipbtn" type="button" data-term="${esc(t)}">${esc(t)}</button>`).join("")}</div>`;
    }
    if (r.results && r.results.length > 1) {
      html += `<div class="ns-section-title">Top suggestions</div>` +
        `<div class="ns-list">${r.results.slice(1, 5).map((x) => topSug(x)).join("")}</div>`;
    }
    html += `<div class="ns-actions">`;
    html += k && !(k.scored && k.competitionScore > 0)
      ? `<button class="ns-btn" type="button" data-a="rank">Score competition</button>`
      : "";
    html += `<button class="ns-btn" type="button" data-a="trend">Trending in niche</button></div>`;
    html += `<div class="ns-trend"></div>`;
    body.innerHTML = html;
    body.querySelectorAll(".ns-chipbtn[data-term]").forEach((b) => {
      b.addEventListener("click", () => {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        location.assign(`/results?search_query=${encodeURIComponent(b.dataset.term)}`);
      });
    });
    const rankBtn = body.querySelector("[data-a=rank]");
    if (rankBtn) {
      rankBtn.addEventListener("click", () => {
        rankBtn.disabled = true;
        rankBtn.textContent = "Scoring…";
        api("/api/keywords/research", { method: "POST", body: { seed: term, rankTop: 3, maxResults: 10 } }).then((res) => {
          render(res && res.ok ? res.data : {});
        });
      });
    }
    const trendBtn = body.querySelector("[data-a=trend]");
    if (trendBtn) {
      trendBtn.addEventListener("click", () => {
        trendBtn.disabled = true;
        trendBtn.textContent = "Reading…";
        const trendBox = body.querySelector(".ns-trend");
        trendBox.innerHTML = '<div class="ns-skeleton"><span></span><span></span><span></span></div>';
        api("/api/videos/trending-search", { method: "POST", body: { term, maxResults: 8 } }).then((res) => {
          const d = res && res.ok ? res.data : null;
          if (!d || (d.items && d.items.length === 0)) {
            trendBox.innerHTML = `<p class="ns-note ns-note--bad">${d && d.notice ? esc(d.notice) : "No trending videos found."}</p>`;
            return;
          }
          trendBox.innerHTML = `<div class="ns-section-title">Trending in niche</div><div class="ns-list">` +
            d.items.map((it) => trendItem(it)).join("") + `</div>`;
        });
      });
    }
  };

  const key = searchState && searchState.term === term ? searchState : null;
  if (key && key.data) {
    render(key.data);
  } else {
    api(`/api/keywords/${encodeURIComponent(term)}`).then((res) => {
      if (res && res.ok && res.data && res.data.keyword) {
        const data = { seed: term, results: [res.data.keyword], questions: [], matchingTerms: [] };
        searchState = { term, data };
        render(data);
      } else {
        api("/api/keywords/research", { method: "POST", body: { seed: term, rankTop: 0, maxResults: 10 } }).then((r2) => {
          const d = r2 && r2.ok ? r2.data : null;
          if (!d) {
            body.innerHTML = '<p class="ns-note ns-note--bad">Research unavailable right now. Is the server running?</p>';
            return;
          }
          searchState = { term, data: d };
          render(d);
        });
      }
    });
  }
}

function questionChip(q) {
  return q && q.length < 40 ? `<span class="ns-chipbtn ns-q">${esc(q)}</span>` : "";
}

function topSug(x) {
  return `<a class="ns-item" href="/results?search_query=${encodeURIComponent(x.term)}" target="_blank" rel="noopener">` +
    `<span class="ns-item-title">${esc(x.displayTerm || x.term)}</span><span class="ns-item-v">${x.demandScore || 0}</span></a>`;
}

function trendItem(it) {
  const views = it.viewCount != null ? fmt(it.viewCount) : null;
  return `<a class="ns-item" href="/watch?v=${on(it.videoId)}" target="_blank" rel="noopener">` +
    `<span class="ns-item-title">${esc(it.title)}</span>` +
    `${views ? `<span class="ns-item-v">${views}</span>` : ""}</a>`;
}

/* ------------------------- Channel research card ------------------------- */

function showChannelCard(ref) {
  const shadow = mountHost("channel", 16, 64);
  shadow.root.innerHTML = `
    <div class="ns-surface ns-enter" style="width:232px;padding:10px 12px 8px;">
      <div class="ns-head"><span class="dot"></span><h1>Channel signal</h1>
        <button class="close" type="button">×</button></div>
      <div class="ns-body"><div class="ns-skeleton"><span></span><span></span><span></span></div></div>
    </div>`;
  shadow.shadow.querySelector(".close").addEventListener("click", () => removeHost("channel"));
  const body = shadow.shadow.querySelector(".ns-body");

  api("/api/channels/lookup", { method: "POST", body: { url: ref } }).then((res) => {
    const d = res && res.ok ? res.data : null;
    if (!d || !d.channel) {
      body.innerHTML = `<p class="ns-note">${res && res.data && res.data.error ? esc(res.data.error) : "No data for this channel right now."}</p>`;
      return;
    }
    const c = d.channel;
    const vids = d.recentVideos || [];
    const avg = vids.length ? vids.reduce((a, b) => a + b.viewCount, 0) / vids.length : null;
    const winners = avg ? vids.filter((v) => v.viewCount > avg * 1.5).sort((a, b) => b.viewCount - a.viewCount).slice(0, 3) : [];
    const cadence = cadenceOf(vids);

    let rows = "";
    if (c.subscriberCount != null) rows += stripRow("subs", fmt(c.subscriberCount));
    if (c.viewCount != null) rows += stripRow("views", fmt(c.viewCount));
    if (c.videoCount != null) rows += stripRow("uploads", fmt(c.videoCount));
    if (cadence) rows += stripRow("cadence", cadence);
    if (avg) rows += stripRow("avg views", fmt(Math.round(avg)));

    let html = `<div class="ns-strips">${rows}</div>`;
    if (winners.length) {
      html += `<div class="ns-section-title">Winners</div><div class="ns-list">` +
        winners.map((v) => `<a class="ns-item" href="/watch?v=${on(v.videoId)}" target="_blank" rel="noopener">` +
          `<span class="ns-item-title">${esc(v.title)}</span>` +
          `<span class="ns-item-v">${fmt(v.viewCount)}</span></a>`).join("") +
        `</div>`;
    }
    if (vids.length) {
      const last = vids.reduce((a, b) => (a.publishedAt >= b.publishedAt ? a : b));
      rows = "";
      html += `<div class="ns-section-title">Latest upload</div><div class="ns-list">` +
        `<a class="ns-item" href="/watch?v=${on(last.videoId)}" target="_blank" rel="noopener">` +
        `<span class="ns-item-title">${esc(last.title)}</span>` +
        `<span class="ns-item-v">${fmt(last.viewCount)}</span></a></div>`;
    }
    body.innerHTML = html;
  });
}

function stripRow(k, v) {
  return `<div class="ns-strip"><span class="k">${k}</span><span class="v">${v}</span></div>`;
}

function cadenceOf(vids) {
  if (vids.length < 2) return null;
  const sorted = [...vids].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const seen = sorted.slice(0, 10);
  let sum = 0;
  let n = 0;
  for (let i = 1; i < seen.length; i++) {
    const d1 = new Date(seen[i - 1].publishedAt).getTime();
    const d2 = new Date(seen[i].publishedAt).getTime();
    if (d1 > d2) {
      sum += (d1 - d2) / 86400000;
      n++;
    }
  }
  if (!n) return null;
  const days = Math.max(0, Math.round(sum / n));
  return days <= 1 ? "daily" : days <= 4 ? "every ~" + days + " days" : "roughly weekly";
}

/* ------------------------------- Routing ------------------------------- */

function currentVideoId() {
  return videoIdFromHref(location.href);
}

function currentLocation() {
  // This script owns www.youtube.com research overlays. Studio gets its own
  // script (Phase C); other subdomains (tv/music) get nothing.
  if (location.hostname !== "www.youtube.com") return { type: "none" };
  const id = currentVideoId();
  if (id) return { type: "watch", id };
  const p = location.pathname;
  if (p.startsWith("/results")) {
    const term = new URLSearchParams(location.search).get("search_query") || "";
    return { type: "results", term };
  }
  if (/^\/@[\w.\-]+/.test(p) || /^\/channel\//.test(p)) {
    return { type: "channel", ref: p };
  }
  return { type: "none" };
}

function routeOverlays() {
  const loc = currentLocation();
  switch (loc.type) {
    case "watch":
      removeHost("search");
      removeHost("channel");
      if (prefs.showCard) showWatchCard(loc.id);
      else removeHost("card");
      watchThumbMenu();
      break;
    case "results":
      removeHost("card");
      removeHost("channel");
      if (prefs.showResearch && !(searchState && searchState.closed)) showSearchPanel(loc.term);
      else removeHost("search");
      break;
    case "channel":
      removeHost("card");
      removeHost("search");
      if (prefs.showResearch) showChannelCard(loc.ref);
      else removeHost("channel");
      break;
    default:
      removeHost("card");
      removeHost("search");
      removeHost("channel");
      break;
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[PREFS_KEY]) return;
  const before = prefs.dataMode;
  prefs = mergePrefs(changes[PREFS_KEY].newValue);
  routeOverlays();
  if (prefs.showPills) {
    badgedIds.clear();
    scanThumbnails();
  }
  // Density and card data both change what a line says, so redraw every line
  // rather than guess which preference the change was about.
  if (prefs.dataMode !== before) {
    stripLines();
    scanTiles();
  }
});

function stripLines() {
  tileRows.clear();
  document.querySelectorAll(".ns-line").forEach((line) => {
    if (line.parentNode) line.parentNode.removeChild(line);
  });
}

function onDomChange() {
  scanThumbnails();
  scanTiles();
}

let observer = null;
function init() {
  console.log("[niche-scope] content script ready:", location.href);
  ensurePrefs();
  routeOverlays();
  scanThumbnails();
  scanTiles();

  observer = new MutationObserver(() => {
    clearTimeout(observer._t);
    observer._t = setTimeout(onDomChange, 800);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Re-route when navigating via the History API.
let lastHref = location.href;
function watchUrl() {
  if (location.href !== lastHref) {
    lastHref = location.href;
    routeOverlays();
    scanThumbnails();
    // A new video is a new title to name the file after.
    watchThumb = { id: currentVideoId(), title: watchThumb.title, thumbnailUrl: "" };
  }
  requestAnimationFrame(watchUrl);
}

init();
watchUrl();
