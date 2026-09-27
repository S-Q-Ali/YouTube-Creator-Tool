// Niche-Scope background service worker.
// Proxies API calls from content scripts/popup to http://localhost:3000 and
// caches GET/lookup responses for a few minutes to avoid hammering the local server.
const API_BASE = "http://localhost:3000";
const TTL_MS = 10 * 60 * 1000;
const SLOW_TIMEOUT = 60 * 1000; // AI + yt-dlp routes can take a while
const FAST_TIMEOUT = 15 * 1000;
const PREFS_KEY = "ns:prefs";
const DEFAULT_PREFS = { showCard: true, showPills: true, pillLimit: 24, showResearch: true, showCoach: true, dataMode: "full", tileLimit: 60 };

// Never session-cache AI or live-search responses: results vary per query and can
// exceed the per-item quota (server already caches AI results in its own DB).
const NO_CACHE_PREFIXES = ["/api/ai/", "/api/videos/trending-search/"];
function cacheable(path) {
  return !NO_CACHE_PREFIXES.some((p) => path.startsWith(p));
}

function timeoutFor(path) {
  return cacheable(path) ? FAST_TIMEOUT : SLOW_TIMEOUT;
}

function cacheKey(path, opts) {
  return path + (opts && opts.body ? JSON.stringify(opts.body) : "");
}

async function apiFetch(path, opts) {
  const key = cacheKey(path, opts);

  if (cacheable(path)) {
    const cached = await chrome.storage.session.get(key);
    if (cached[key] && Date.now() - cached[key].ts < TTL_MS) {
      return cached[key].data;
    }
  }

  const res = await fetch(API_BASE + path, {
    method: (opts && opts.method) || "GET",
    headers: { "Content-Type": "application/json" },
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(timeoutFor(path)),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { error: res.statusText || "Bad response from Niche-Scope" };
  }

  if (res.ok && cacheable(path)) {
    try {
      const store = {};
      store[key] = { ts: Date.now(), data };
      await chrome.storage.session.set(store);
    } catch {
      // Session storage can hit its item/byte cap; caching is best-effort.
    }
  }
  return data;
}

async function getPrefs() {
  const stored = await chrome.storage.local.get(PREFS_KEY);
  return { ...DEFAULT_PREFS, ...(stored[PREFS_KEY] || {}) };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "api") {
    apiFetch(msg.path, msg.opts)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true; // keep the channel open for the async response
  }
  if (msg && msg.type === "prefs:get") {
    getPrefs().then((prefs) => sendResponse({ ok: true, data: prefs }));
    return true;
  }
  if (msg && msg.type === "prefs:set") {
    getPrefs()
      .then((cur) => chrome.storage.local.set({ [PREFS_KEY]: { ...cur, ...(msg.prefs || {}) } }))
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true; // keep the channel open for the async response
  }
  return false;
});