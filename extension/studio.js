/*
 * Niche-Scope on YouTube Studio: am I here, and is the page ready?
 *
 * studio-host on purpose does nothing else. It renders no scores, calls no API
 * and writes nothing into Studio's own DOM. Its whole job is to answer one
 * question once, correctly, so that the content table, the edit panel and the
 * thumbnail scorer do not each answer it differently.
 *
 * That question is asked on every navigation, because Studio is a single-page app:
 * moving from Content to Edit is not a page load, so nothing re-runs a content
 * script and nothing reloads. `yt-navigate-finish` is the signal when Studio
 * fires it. A MutationObserver is the backstop for the navigations where it does
 * not, and it is debounced because Studio mutates in bursts - re-classifying on
 * every one of those mutations would be dozens of redundant reads of a URL that
 * has not changed. The route is compared before anything is redrawn, so a burst
 * that lands on the same route redraws nothing.
 *
 * Debug is opt-in and off by default, because a panel that appears on Studio
 * uninvited is a panel a creator has to be told how to remove. Two ways in: the
 * nsdebug query parameter for a one-off look, and a stored flag for a session.
 *
 * extension/studio.css positions the panel. Every colour and every component
 * comes from ns-theme.css through the same shadow-root stylesheet the watch card
 * uses, so there is no second copy of the design system to drift.
 */

const THEME_URL = chrome.runtime.getURL("ns-theme.css");
const HOST_CSS_URL = chrome.runtime.getURL("studio.css");
const DEBUG_KEY = "ns:studioDebug";
const REDRAW_DEBOUNCE_MS = 250;

const sheets = { theme: null, host: null };

function loadSheet(url) {
  return fetch(url)
    .then((res) => (res.ok ? res.text() : Promise.reject(new Error(res.status))))
    .then((text) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      return sheet;
    })
    .catch((err) => {
      // An unstyled panel still tells a developer what route was detected, which
      // is most of what the panel is for. Throwing instead would take the route
      // reading down with the stylesheet.
      console.warn("[niche-scope] stylesheet unavailable:", err);
      return null;
    });
}

function applySheets(shadow) {
  const adopted = [sheets.theme, sheets.host].filter(Boolean);
  if (adopted.length) shadow.adoptedStyleSheets = adopted;
}

/* Studio's own stylesheet reaches every element on the page, so a panel added the
   ordinary way inherits it and can be restyled by a redesign we never saw. The
   shadow root is the same reasoning as every other surface here: our styles in,
   Studio's styles out. */
function panelHost() {
  let host = document.querySelector("[data-ns-studio-debug]");
  if (host) return host;

  host = document.createElement("div");
  host.setAttribute("data-ns-studio-debug", "");
  host.className = "ns-host ns-host--studio-debug";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML =
    '<div class="ns-card ns-studio-debug">' +
    '<p class="ns-studio-debug__title">Niche-Scope · Studio</p>' +
    '<div class="ns-studio-debug__body"></div>' +
    '<p class="ns-note">Remove <code>?nsdebug=1</code> from the URL, or clear the stored Studio debug flag.</p>' +
    "</div>";
  applySheets(shadow);
  document.body.appendChild(host);
  return host;
}

function describe(route) {
  const rows = [
    ["route", route.kind],
    ["channel", route.channelId || "—"],
    ["video", route.videoId || "—"],
    ["tab", route.tab || "—"],
    ["path", location.pathname],
  ];
  return rows.map(([label, value]) => '<p class="ns-studio-debug__row"><span>' + label + "</span><b>" + value + "</b></p>").join("");
}

function paint(route) {
  const host = panelHost();
  const body = host.shadowRoot.querySelector(".ns-studio-debug__body");
  if (!body) return;
  body.innerHTML =
    describe(route) +
    '<p class="ns-studio-debug__row ns-studio-debug__row--state"><span>actionable</span><b>' +
    (globalThis.NS_STUDIO_ROUTE.isActionable(route) ? "yes" : "no") +
    "</b></p>";
}

let panelOn = false;
let lastKey = null;

function refresh() {
  const route = globalThis.NS_STUDIO_ROUTE.classify(location.href);

  // The panel is the only thing this module draws, and only when asked. With it
  // off, Studio's DOM is left exactly as it was found.
  if (!panelOn) return;
  const key = route.kind + "|" + (route.channelId || "") + "|" + (route.videoId || "") + "|" + (route.tab || "");
  if (key === lastKey) return;
  lastKey = key;
  paint(route);
}

function debugRequested() {
  const params = new URLSearchParams(location.search);
  if (params.get("nsdebug") === "1") return true;
  return chrome.storage.local.get(DEBUG_KEY).then((stored) => stored[DEBUG_KEY] === true).catch(() => false);
}

function start() {
  debugRequested().then((on) => {
    panelOn = on;
    if (!on) return;
    lastKey = null;
    refresh();

    // The stored flag can be flipped while Studio is open, so the panel follows
    // the setting rather than being decided once at load.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !(DEBUG_KEY in changes)) return;
      panelOn = changes[DEBUG_KEY].newValue === true;
      if (!panelOn) {
        const host = document.querySelector("[data-ns-studio-debug]");
        if (host) host.remove();
        lastKey = null;
        return;
      }
      lastKey = null;
      refresh();
    });
  });

  // Studio's own navigation event, then the browser back/forward ones. Both end
  // in the same place: work out where we are now, not where we were.
  window.addEventListener("yt-navigate-finish", refresh);
  window.addEventListener("popstate", refresh);

  // Backstop. Debounced, and it only asks the question - the route comparison in
  // refresh is what stops a burst of mutations becoming a burst of redraws.
  let pending = null;
  const observer = new MutationObserver(() => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = null;
      refresh();
    }, REDRAW_DEBOUNCE_MS);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Refresh on load as well as on navigation: a Studio page opened directly at a
  // deep URL never fires a navigate event for the page it is already on.
  refresh();
}

Promise.all([loadSheet(THEME_URL), loadSheet(HOST_CSS_URL)]).then(([theme, host]) => {
  sheets.theme = theme;
  sheets.host = host;
});

start();
