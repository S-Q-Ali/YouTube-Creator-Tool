/* Niche-Scope Phase SB0 - placement probe. TEMPORARY.
 *
 * Every task after this one assumes three things about a YouTube watch page
 * that I do not actually know: which element holds the up-next list, how tall a
 * video card is, and whether a plain <div> dropped in front of the first
 * compact video is visible or swallowed. The fixture in tests/fixtures is my
 * guess at that markup, and a guess that quietly disagrees with the page is how
 * a probe gets skipped and a fix gets written against fiction.
 *
 * So: read the page, print one line, remove everything this file added. There
 * is no fix in here and none should be - Phase SB1 writes code against what this
 * reports. Deleted in SB5.1.
 *
 * How to read the result:
 *   1. Load any video at your normal window width. Paste the line.
 *   2. Narrow the window to roughly 1000px, reload, paste the line.
 *      vw and sb-visible across the two give the sidebar breakpoint.
 *   3. Repeat once more near a phone width if you have a second window.
 *
 * A run on a non-watch page prints why it stopped instead of a measurement.
 */
(function () {
  "use strict";

  // Reuse the shipped selectors instead of restating them. The first run of
  // this probe looked only for ytd-compact-video-renderer, which YouTube no
  // longer puts in the up-next list, and reported a confident "sidebar present,
  // no tiles" for ten seconds - a wrong answer that would have sent Phase SB1
  // to fix a selector that was already correct. One list, one owner.
  const NS_TILES = globalThis.NS_TILES;
  const SIDEBAR = NS_TILES ? NS_TILES.SIDEBAR : "ytd-watch-next-secondary-results-renderer, #secondary-inner";
  const TILE = NS_TILES ? NS_TILES.TILES : "yt-lockup-view-model, ytd-video-renderer, ytd-compact-video-renderer";
  const WAIT_MS = 10000;
  const POLL_MS = 250;

  const out = [];
  const put = (k, v) => out.push(k + "=" + v);
  const style = (el) => (el ? getComputedStyle(el) : null);
  const px = (n) => Math.round(n * 10) / 10;

  function describe(el) {
    if (!el) return "none";
    const id = el.id ? "#" + el.id : "";
    const cls = el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
    return el.tagName.toLowerCase() + id + cls;
  }

  function finish(reason) {
    put("reason", reason);
    console.log("[niche-scope:SB0] " + out.join(" "));
  }

  function collect() {
    /* --- which sidebar selector matched, and how big it is on screen --- */
    const sidebar = document.querySelector(SIDEBAR);
    put("sidebar", describe(sidebar));
    if (!sidebar) return finish("no-sidebar");

    const sbStyle = style(sidebar);
    put("sb-display", sbStyle.display);
    put("sb-overflow-y", sbStyle.overflowY);
    put("sb-w", sidebar.offsetWidth);
    put("sb-h", sidebar.offsetHeight);
    // A sidebar can be in the DOM and still be a closed drawer.
    put("sb-visible", sidebar.offsetWidth > 0 && sbStyle.visibility !== "hidden");

    /* --- the up-next list itself --- */
    const tiles = sidebar.querySelectorAll(TILE);
    put("tiles", tiles.length);
    if (!tiles.length) return finish("no-tiles");

    const first = tiles[0];
    const parent = first.parentElement;
    put("tile", describe(first));
    put("tile-parent", describe(parent));
    put("tile-direct-child", parent ? parent.children[0] === first : false);

    const pStyle = style(parent);
    put("parent-display", pStyle.display);
    put("parent-flex-dir", pStyle.flexDirection);
    put("parent-overflow-y", pStyle.overflowY);
    put("parent-children", parent ? parent.children.length : 0);

    /* --- how tall is one video card, which is the unit "two videos" is in --- */
    // offsetHeight is the honest number: it includes whatever padding, border
    // and margin YouTube puts around the card, which is what actually displaces
    // the next card down.
    const heights = [];
    for (let i = 0; i < Math.min(tiles.length, 5); i++) heights.push(px(tiles[i].offsetHeight));
    put("tile-h", heights.join("/"));
    put("tile-margin", style(first).marginBottom);
    put("tile-img-h", px(first.querySelector("img, yt-image")?.getBoundingClientRect().height || 0));

    /* --- the parent chain above the tile, which is where the card must go --- */
    // The height and visibility numbers above are not enough. A list can be a
    // flex column whose children are direct, or a grid, or a scroller whose
    // children sit inside an inner wrapper - and inserting beside the tile
    // rather than into the list's actual child container is how an insertion
    // lands in the right coordinates and the wrong box. Walk up and record the
    // display of each ancestor until the list element.
    const chain = [];
    for (let el = first; el && el !== sidebar.parentElement && chain.length < 6; el = el.parentElement) {
      const s = style(el);
      chain.push(describe(el) + "[" + s.display + (s.display.includes("flex") ? "/" + s.flexDirection : "") + "]");
    }
    put("chain", chain.join(" > "));

    // The direct child of the list container is what an insertBefore must
    // target. If the tile is wrapped, that wrapper - not the tile - is the row.
    const listBox = first.closest("#items, ytd-item-section-renderer, [class*='contents']") || parent;
    put("list-box", describe(listBox));
    put("tile-is-listbox-child", listBox ? listBox.children[0] === first : false);
    put("listbox-children", listBox ? listBox.children.length : 0);

    /* --- would a plain div dropped in front of it be seen at all? --- */
    // This is the whole risk of the plan. A div inside someone else's renderer
    // could be clipped, hidden, collapsed, or styled to nothing. Measure it
    // rather than assume it, and take it back out again.
    const probe = document.createElement("div");
    probe.setAttribute("data-ns-probe", "1");
    probe.style.cssText = "min-height:40px;background:rgba(255,0,0,.5)";
    parent.insertBefore(probe, first);
    const probeStyle = style(probe);
    put("probe-display", probeStyle.display);
    put("probe-h", px(probe.getBoundingClientRect().height));
    put("probe-visible",
      probe.getBoundingClientRect().height > 0 && probeStyle.display !== "none" &&
      probeStyle.visibility !== "hidden" && probeStyle.opacity !== "0");

    // Does inserting it actually move the first video down? This is the number
    // the whole "push two videos" promise rests on, and it is the one thing a
    // computed-style check cannot tell you: an element can be visible and still
    // occupy a position that does not push a sibling down.
    const topBefore = first.getBoundingClientRect().top;
    put("first-tile-top-before", px(topBefore));
    put("first-tile-top-after", px(first.getBoundingClientRect().top));
    put("pushed-by", px(first.getBoundingClientRect().top - topBefore));
    probe.remove();
    put("first-tile-top-restored", px(first.getBoundingClientRect().top));

    /* --- the breakpoint question --- */
    put("vw", window.innerWidth);
    put("vh", window.innerHeight);
    put("mast", describe(document.querySelector("#masthead")));
    put("secondary", describe(document.querySelector("#secondary, ytd-watch-flexy")));
    put("primary-w", px(document.querySelector("#primary")?.getBoundingClientRect().width || 0));

    finish("ok");
  }

  if (!/^\/watch(\/|\?|$)/.test(location.pathname)) {
    console.log("[niche-scope:SB0] reason=not-a-watch-page path=" + location.pathname +
      " — open a video, this probe only measures a watch page.");
    return;
  }

  // The sidebar is built by the SPA after this script runs, so poll for it
  // rather than measuring an empty page and reporting a confident zero.
  const started = Date.now();
  (function poll() {
    let ready = false;
    try {
      const sidebar = document.querySelector(SIDEBAR);
      ready = !!(sidebar && sidebar.querySelector(TILE));
    } catch {
      // A page mid-navigation can throw on any selector lookup. Not ready is a
      // valid answer; try again.
      ready = false;
    }
    if (ready) {
      try {
        collect();
      } catch (err) {
        console.log("[niche-scope:SB0] reason=threw " + (err && err.message));
      }
      return;
    }
    if (Date.now() - started > WAIT_MS) {
      // A timeout is the least useful thing a probe can print. It says "not
      // ready" and leaves the real question - what is actually in the list -
      // unanswered, which is how the first run came to report a sidebar with
      // no tiles for ten seconds and nearly sent Phase SB1 to fix a selector
      // that was already right. Describe what is there instead, so a timeout
      // is still an answer.
      const sidebar = document.querySelector(SIDEBAR);
      const seen = {};
      if (sidebar) {
        for (const el of sidebar.querySelectorAll("*")) {
          const tag = el.tagName.toLowerCase();
          seen[tag] = (seen[tag] || 0) + 1;
        }
      }
      const top = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 12)
        .map(([tag, n]) => tag + "×" + n).join(",");
      console.log("[niche-scope:SB0] reason=timeout path=" + location.pathname +
        " sidebar-present=" + !!sidebar +
        " sidebar-w=" + (sidebar ? sidebar.offsetWidth : 0) +
        " looking-for=" + TILE.replace(/\s+/g, "") +
        " descendants=" + (sidebar ? sidebar.querySelectorAll("*").length : 0) +
        (top ? " most-common=[" + top + "]" : ""));
      return;
    }
    setTimeout(poll, POLL_MS);
  })();
})();
