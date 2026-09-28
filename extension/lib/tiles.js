(function (g) {
  "use strict";

  /*
   * Which cards are worth annotating, decided apart from the painting so the
   * rule can be tested against YouTube's real nesting.
   *
   * A grid item is not always the card: YouTube wraps the card in a
   * ytd-rich-item-renderer before the yt-lockup-view-model that holds the
   * thumbnail and title. A selector that accepts both would hand one video two
   * strips, so only the inner element counts. Ads, tiles with no watch link,
   * and tiles that already carry a strip are passed over.
   */

  const HOSTS =
    "ytd-rich-grid-renderer, ytd-section-list-renderer, ytd-item-section-renderer," +
    " ytd-browse[page-subtype='channels'], ytd-browse[page-subtype='playlists']," +
    /* The up-next list on a watch page. Same compact cards as a grid, so it
       earns a strip - but only when the scan is scoped to it, which is what
       scanRoot is for. */
    " ytd-watch-next-secondary-results-renderer";

  const TILES =
    "yt-lockup-view-model, ytd-video-renderer, ytd-grid-video-renderer," +
    " ytd-compact-video-renderer, ytd-playlist-video-renderer";

  /* Where a watch page's sidebar lives. The first is the current element; the
     second is the older container, kept because a stale markup version should
     degrade to "no strips" rather than to "strips everywhere". */
  const SIDEBAR = "ytd-watch-next-secondary-results-renderer, #secondary-inner";

  const LINK = 'a[href*="/watch?v="], a[href*="/shorts/"], a[href*="/live/"], a[href*="youtu.be/"]';
  const ADS = "ytd-ad-slot-renderer, ytd-promoted-sparkles-web-renderer";
  const LINED = "[data-ns-lined]";
  const STRIP = ".ns-line";
  const MARK = "data-ns-lined";

  function idFromHref(href, base) {
    if (!href) return null;
    try {
      const u = new URL(href, base || "https://www.youtube.com/");
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const path = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/);
      if (path) return path[1];
      if (/^(?:www\.)?youtu\.be$/.test(u.hostname)) {
        return u.pathname.slice(1).split("/")[0] || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  function videoId(tile) {
    const link = tile.querySelector(LINK);
    return link ? idFromHref(link.getAttribute("href"), g.location && g.location.href) : null;
  }

  function isLined(tile) {
    return tile.matches(LINED) || !!tile.querySelector(LINED + ", " + STRIP);
  }

  /* Hands each annotatable card to `visit` once, until the budget runs out or a
     visitor returns false because the page moved on underneath it.

     Cards that already carry a strip are skipped, because the strip is the
     point of that pass. A second pass with a different job - the download icon
     that lives on the card's own hover overlay - must not be held hostage to
     the strip's state, so it asks for lined cards back with `skipLined: false`.

     The scan root counts as a container if it is one. On a grid route the root
     is the document, which is not a grid, and the containers are found beneath
     it; on a watch page the root is the up-next list itself, and querySelector
     would never match a node against itself. */
  function each(doc, limit, visit, opts) {
    const skipLined = !opts || opts.skipLined !== false;
    let seen = 0;
    const cap = limit > 0 ? limit : Infinity;
    const hosts = [];
    if (doc.matches && doc.matches(HOSTS)) hosts.push(doc);
    for (const h of doc.querySelectorAll(HOSTS)) hosts.push(h);
    // Hosts nest. A watch page's real chain is
    // ytd-watch-next-secondary-results-renderer > ytd-item-section-renderer,
    // and both names are in HOSTS, so one video is reachable through two of
    // them. Without this, every sidebar video was visited twice - six visits
    // for three videos - and a visitor that had not yet attached its strip
    // would attach a second one, doubling the readings on the page.
    //
    // Identity, not id: two distinct cards for one video are two cards and both
    // deserve a strip, while one card reached twice is one card.
    const done = new Set();
    for (const host of hosts) {
      for (const tile of host.querySelectorAll(TILES)) {
        if (seen >= cap) return;
        if (done.has(tile)) continue;
        if ((skipLined && isLined(tile)) || tile.closest(ADS)) continue;
        const id = videoId(tile);
        if (!id) continue;
        done.add(tile);
        seen++;
        if (visit(tile, id) === false) return;
      }
    }
  }

  /* The one place that decides where a scan may look, and it answers with a
     root to hand to `each` - or null to scan nothing at all.

     A watch page returns its sidebar, never the document. The original rule
     kept strips off watch pages so a strip would not land on the hero of the
     video you just opened, and that part was right; scanning the whole page
     would reintroduce exactly that, which is why a watch page with no sidebar
     yet returns null instead of falling back. */
  function scanRoot(pathname, videoId, doc) {
    const d = doc || g.document;
    const p = pathname || "";
    const watching = Boolean(videoId) || /^\/watch(\/|\?|$)/.test(p);
    if (watching) return d.querySelector(SIDEBAR);
    const grid =
      p === "/" || p.startsWith("/results") || p.startsWith("/feed") ||
      /^\/@/.test(p) || p.startsWith("/channel/") ||
      p.startsWith("/c/") || p.startsWith("/browse/");
    return grid ? d : null;
  }

  g.NS_TILES = { HOSTS, TILES, SIDEBAR, LINK, STRIP, MARK, idFromHref, videoId, isLined, each, scanRoot };
})(typeof globalThis !== "undefined" ? globalThis : window);
