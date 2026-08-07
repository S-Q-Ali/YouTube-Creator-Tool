// Niche-Scope background service worker.
// Proxies API calls from content scripts/popup to http://localhost:3000 and
// caches GET/lookup responses for a few minutes to avoid hammering the local server.
const API_BASE = "http://localhost:3000";
const TTL_MS = 10 * 60 * 1000;

function cacheKey(path, opts) {
  return path + (opts && opts.body ? JSON.stringify(opts.body) : "");
}

async function apiFetch(path, opts) {
  const key = cacheKey(path, opts);

  const cached = await chrome.storage.session.get(key);
  if (cached[key] && Date.now() - cached[key].ts < TTL_MS) {
    return cached[key].data;
  }

  const res = await fetch(API_BASE + path, {
    method: (opts && opts.method) || "GET",
    headers: { "Content-Type": "application/json" },
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { error: res.statusText || "Bad response from Niche-Scope" };
  }

  if (res.ok) {
    const store = {};
    store[key] = { ts: Date.now(), data };
    chrome.storage.session.set(store);
  }
  return data;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "api") {
    apiFetch(msg.path, msg.opts)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true; // keep the channel open for the async response
  }
  return false;
});
