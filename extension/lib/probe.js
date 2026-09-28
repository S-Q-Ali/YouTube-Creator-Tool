/* Niche-Scope Phase SB0 - placement probe. TEMPORARY.
 *
 * Every task after this one assumes three things about a YouTube watch page
 * that I do not actually know: which element holds the up-next list, how tall a
 * video card is, and whether a plain <div> dropped in front of the first
 * compact video is visible or swallowed. The fixture in tests/fixtures is my
 * guess at that markup, and a guess that quietly disagrees with the page is how
 * a probe gets skipped and a fix gets written against fiction.
 *
 * So: wait for the list to settle, read it, insert a red div in front of the
 * first video, record whether it is visible and whether the video actually
 * moved down, take the div back out, and print one line of key=value pairs. It
 * touches nothing and leaves nothing behind - the removal is verified in its
 * own output, as first-tile-top-restored.
 *
 * "Settles" is the part that was missing on the first working run. It reported
 * pushed-by=0, and read as "insertion does not work" - the single most
 * expensive misreading available, because the natural next step is to abandon
 * in-flow placement for an overlay. The page was simply still appending
 * recommendations while it measured: four tiles had arrived, the div was
 * genuinely visible at 40px, and the first video's top was still being
 * recalculated. A confident number taken mid-render is worse than no number.
 * So the probe now refuses to measure a list that is still growing, and says
 * so instead of guessing.
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
  const WAIT_MS = 20000;
  const POLL_MS = 250;
  // How long the list must hold the same tile count and the same first-tile
  // height before it is considered still. YouTube appends the up-next list a
  // few at a time and the page keeps reflowing after each append; measuring
  // during that window yields arithmetic on values that are still moving.
  const SETTLE_MS = 2000;
  const SETTLE_MIN_TILES = 3;

  const out = [];
  const put = (k, v) => out.push(k + "=" + v);
  const style = (el) => (el ? getComputedStyle(el) : null);
  const px = (n) => Math.round(n * 10) / 10;

  // One frame's turn, then the next. Reading layout forces a reflow, but a
  // single read can catch the frame before YouTube's own mutation handler has
  // finished; two frames apart is the cheapest honest option without asking
  // the user to sit still.
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

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

  /* Hold the list still before measuring it.
   *
   * "Still" is defined as the same tile count and the same first-tile height
   * across SETTLE_MS, and at least SETTLE_MIN_TILES present. Three reasons for
   * each condition, all learned from the first live run:
   *
   *   - Tile count, because YouTube appends the up-next list a few rows at a
   *     time and a measurement taken during an append reads the list as
   *     shorter than it is becoming.
   *   - First-tile height, because thumbnails resolve late. A tile measured
   *     before its image has a height can be well under its final one, and two
   *     tiles of a guessed height produce a cap that is wrong by twice the
   *     error.
   *   - The minimum, because a one-tile list is a loading state, not a list.
   *
   * If it never stills, the honest report is never-settled plus a hint, not a
   * confident wrong number.
   */
  /* Collect the media widths at which a rule affects the sidebar or the
   * two-column watch layout.
   *
   * This is a read of YouTube's own CSS, not a guess. A page cannot resize
   * itself, so the alternative is asking a person to resize a window by hand
   * and eyeball the answer - which produces a number nobody can reproduce and
   * that goes stale the next time YouTube changes a breakpoint. The rules
   * already name the widths.
   */
  function walkMedia(rules, found, cond) {
    for (const rule of Array.from(rules)) {
      if (rule.media) {
        walkMedia(rule.cssRules || [], found, rule.media.mediaText);
        continue;
      }
      const text = rule.cssText || "";
      const hits = /#secondary|ytd-watch-flexy|#related|ytd-watch-next-secondary/.test(text);
      // Only the widths that gate a display or flex decision matter. A width
      // that merely changes padding is noise in a list meant to be read once.
      if (hits && /\b(display|flex-direction|width|order)\s*:/.test(text) && cond) {
        for (const m of cond.matchAll(/\((\d+(?:\.\d+)?)px\)/g)) {
          found.push({ width: m[1], cond });
        }
      }
    }
  }

  async function waitForSettle(sidebar) {
    const started = Date.now();
    let lastKey = null;
    let lastAt = 0;
    for (;;) {
      const tiles = sidebar.querySelectorAll(TILE);
      const h = tiles.length ? Math.round(tiles[0].offsetHeight) : 0;
      const key = tiles.length + ":" + h;
      const now = Date.now();
      if (key !== lastKey) {
        lastKey = key;
        lastAt = now;
      } else if (tiles.length >= SETTLE_MIN_TILES && now - lastAt >= SETTLE_MS) {
        return { settled: true, count: tiles.length, waited: now - started };
      }
      if (now - started > WAIT_MS) {
        return { settled: false, count: tiles.length, waited: now - started };
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }

  async function collect() {
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

    /* --- wait until the list stops changing underneath us --- */
    // The first working run measured a list that was still being appended to
    // and reported pushed-by=0, which reads as "in-flow insertion does not
    // work" - the most expensive misreading this probe could produce, because
    // the obvious response is to abandon in-flow placement for an overlay. So:
    // hold the list still, and if it never stills, say that instead of
    // reporting a number that means nothing.
    const still = await waitForSettle(sidebar);
    put("settled", still.settled);
    put("settle-tiles", still.count);
    put("settle-ms", still.waited);
    if (!still.settled) {
      put("hint", "list-kept-changing-tiles=" + still.count);
      return finish("never-settled");
    }

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

    /* --- which element is actually the list of rows? --- */
    // The first run reported tile-is-listbox-child=false, which is ambiguous
    // between "wrong insertion target" and "the closest() selector matched one
    // level too high". The ancestor chain already showed the real nesting on
    // this page:
    //   div#items  >  ytd-item-section-renderer  >  div#contents  >  tile
    // so the row container is div#contents, and #items is the flex column above
    // it. The card belongs as a sibling of the tiles inside div#contents -
    // inserting into #items instead would put it above the whole section, and
    // the gap between the two is exactly the kind of detail that makes a card
    // appear above the list's own header instead of under it.
    //
    // Rather than assert that, measure both candidates: insert into each in
    // turn and report which one moves the first video down by the probe's own
    // height. The one that does is the row container, whatever it is called
    // this month.
    const rowBox = parent; // the tile's own parent is the innermost candidate
    const listBox = first.closest("#items, ytd-item-section-renderer, [class*='contents']") || parent;
    put("row-box", describe(rowBox));
    put("row-box-is-tile-parent", rowBox === parent);
    put("list-box", describe(listBox));
    put("list-box-is-ancestor", !!(listBox && listBox.contains(first)));
    put("listbox-children", listBox ? listBox.children.length : 0);
    put("rowbox-children", rowBox ? rowBox.children.length : 0);
    // Whether the list carries a header of its own above the first tile. If it
    // does, the card must go below that header, not above it, or it will look
    // like it belongs to YouTube's own chrome.
    const header = listBox && listBox.firstElementChild !== first
      ? describe(listBox.firstElementChild) : "none";
    put("list-first-child", header);

    /* --- try each candidate container, and let the page pick the answer --- */
    // This is the whole risk of the plan, and the part a computed-style check
    // cannot answer: a div can be visible and still occupy a position that
    // pushes nothing down. So insert into each candidate, measure whether the
    // first video actually moved by the probe's own height, and take it back
    // out. Whichever container moves the tile is the row container; if none
    // does, that is a finding, and Phase SB1 needs to know it before it writes
    // an insertion.
    //
    // Two frames are waited between insert and read. One read can land in the
    // frame before YouTube's own mutation handler has settled, which is
    // exactly how the first run came to print pushed-by=0 for a div that was
    // plainly visible.
    const candidates = [];
    for (const el of [rowBox, listBox]) if (el && !candidates.includes(el)) candidates.push(el);

    const results = [];
    for (const box of candidates) {
      const anchor = first.parentElement === box ? first : box.firstElementChild;
      if (!anchor) continue;
      const probe = document.createElement("div");
      probe.setAttribute("data-ns-probe", "1");
      probe.style.cssText = "min-height:40px;background:rgba(255,0,0,.5)";
      const topBefore = first.getBoundingClientRect().top;
      box.insertBefore(probe, anchor);
      await nextFrame();
      const probeStyle = style(probe);
      const probeH = probe.getBoundingClientRect().height;
      const moved = first.getBoundingClientRect().top - topBefore;
      results.push({
        box: describe(box),
        display: probeStyle.display,
        h: px(probeH),
        moved: px(moved),
        visible: probeH > 0 && probeStyle.display !== "none" &&
          probeStyle.visibility !== "hidden" && probeStyle.opacity !== "0",
      });
      probe.remove();
      await nextFrame();
      // Confirm the page went back to where it was. If it did not, the rest of
      // this report is measuring a page the probe damaged, and it should say
      // so rather than quietly continue.
      const restored = first.getBoundingClientRect().top - topBefore;
      if (Math.abs(restored) > 0.5) {
        results[results.length - 1].notRestored = px(restored);
      }
    }

    for (const r of results) {
      put("into:" + r.box, "display=" + r.display + " h=" + r.h +
        " moved=" + r.moved + " visible=" + r.visible +
        (r.notRestored !== undefined ? " NOT-RESTORED-by=" + r.notRestored : ""));
    }
    // The headline number, defined rather than assumed: the largest push any
    // candidate achieved. Non-zero means in-flow placement works on this page.
    const best = results.reduce((a, r) => Math.max(a, Math.abs(r.moved)), 0);
    put("pushed-by", px(best));
    put("works", best > 0);

    /* --- the breakpoint question --- */
    put("vw", window.innerWidth);
    put("vh", window.innerHeight);
    put("secondary", describe(document.querySelector("#secondary, ytd-watch-flexy")));
    put("primary-w", px(document.querySelector("#primary")?.getBoundingClientRect().width || 0));

    // Ask YouTube's own CSS where the sidebar goes, rather than asking the
    // user to hunt for the width by resizing. The rules that decide it are
    // media queries, and they are in the page's own stylesheets - so read them
    // and report the widths at which the sidebar stops being laid out beside
    // the video. Reading, never writing: a stylesheet we cannot parse is simply
    // reported as unreadable and the breakpoint is found by the second run.
    const found = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        // Cross-origin sheet. Not a failure, just not readable from here.
        continue;
      }
      if (!rules) continue;
      walkMedia(rules, found);
    }
    const widths = Array.from(new Set(found.map((f) => f.width))).filter(Boolean).sort((a, b) => a - b);
    put("sidebar-media-widths", widths.join("/") || "none-readable");
    put("sidebar-media-rules", found.length);

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
      // collect() is async now - it waits for the list to still and for two
      // animation frames between measuring. A rejected promise here would
      // otherwise be swallowed by the content script's error handling and
      // leave no trace at all, which is how a probe goes quiet.
      collect().catch((err) => {
        console.log("[niche-scope:SB0] reason=threw " + (err && err.message));
      });
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
