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
    " ytd-browse[page-subtype='channels'], ytd-browse[page-subtype='playlists']";

  const TILES =
    "yt-lockup-view-model, ytd-video-renderer, ytd-grid-video-renderer," +
    " ytd-compact-video-renderer, ytd-playlist-video-renderer";

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
     point of that pass. A second pass with a different job — the download icon
     that lives on the card's own hover overlay — must not be held hostage to
     the strip's state, so it asks for lined cards back with `skipLined: false`. */
  function each(doc, limit, visit, opts) {
    const skipLined = !opts || opts.skipLined !== false;
    let seen = 0;
    const cap = limit > 0 ? limit : Infinity;
    for (const host of doc.querySelectorAll(HOSTS)) {
      for (const tile of host.querySelectorAll(TILES)) {
        if (seen >= cap) return;
        if ((skipLined && isLined(tile)) || tile.closest(ADS)) continue;
        const id = videoId(tile);
        if (!id) continue;
        seen++;
        if (visit(tile, id) === false) return;
      }
    }
  }

  g.NS_TILES = { HOSTS, TILES, LINK, STRIP, MARK, idFromHref, videoId, isLined, each };
})(typeof globalThis !== "undefined" ? globalThis : window);
