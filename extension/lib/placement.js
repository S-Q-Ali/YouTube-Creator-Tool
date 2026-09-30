(function (g) {
  "use strict";

  /*
   * Where the card goes on a watch page, and what it pushes down.
   *
   * One rule, both lists: the card is inserted immediately before the list it
   * displaces, so it takes its own space in the flow and everything below it
   * - tiles on a normal watch, playlist videos on a playlist watch - is pushed
   * down. The card is never fixed and never absolute, so it scrolls with the
   * list it belongs to instead of floating over the page.
   *
   * Kept apart from the mounting code so the rule can be tested against the
   * real YouTube nesting of both cases.
   */

  /* Below this viewport width YouTube drops the sidebar into a drawer and,
     with it, the list the card would sit in. On a phone there is no list to
     push, so the card does not appear. */
  const MIN_WIDTH = 800;

  /* A watch page whose sidebar shows the open playlist rather than "Up next".
     The panel replaces the recommendation list outright, so there is no
     up-next list to insert into and a separate case is needed. */
  const PLAYLIST_PANEL = "ytd-playlist-panel-renderer#playlist";

  /* The recommendation list on a normal watch page. #contents is the element
     that actually holds the tiles, under a div#header heading. */
  const WATCH_LIST =
    "ytd-watch-next-secondary-results-renderer #contents," +
    " #secondary-inner #items #contents";

  const UP_NEXT_TILES = "#secondary-inner yt-lockup-view-model";

  /**
   * Fallback pitch, used only when the page has not laid out yet.
   *
   * 122px is the pitch measured on a live sidebar at 1280px wide: a 114px tile
   * plus the 8px of gap YouTube puts under it. It is a placeholder, not a
   * constant to trust - measureTilePitch exists so this number is replaced by a
   * real reading as soon as the list has one.
   */
  const FALLBACK_PITCH = 122;

  function tileSelector(placement) {
    return placement && placement.type === "playlist"
      ? "#items ytd-playlist-panel-video-renderer"
      : "#contents yt-lockup-view-model, #contents ytd-video-renderer, #contents ytd-compact-video-renderer";
  }

  /**
   * How far apart two consecutive rows sit, in pixels.
   *
   * This is the number the card's reserved height is built from, so it has to
   * be a measurement rather than a constant: the same sidebar is narrower and
   * taller on a small window, wraps titles to two lines on a long video, and
   * changes with the font size the reader has set. Taking the gap between two
   * adjacent rows instead of the height of one row folds the margin into the
   * answer, which is what "two videos' worth of space" actually means.
   */
  function measureTilePitch(placement) {
    if (!placement || !placement.list) return FALLBACK_PITCH;
    const rows = placement.list.querySelectorAll(tileSelector(placement));
    if (rows.length >= 2) {
      const top = rows[0].offsetTop;
      const next = rows[1].offsetTop;
      const pitch = next - top;
      // offsetTop is 0 for everything in a document that has not been laid
      // out, so a zero difference means "no measurement", not "no gap".
      if (pitch > 0) return Math.round(pitch);
    }
    if (rows.length === 1) {
      const height = rows[0].offsetHeight;
      if (height > 0) return Math.round(height);
    }
    return FALLBACK_PITCH;
  }

  function isPlaylistPanelPresent(doc) {
    return Boolean(doc && doc.querySelector(PLAYLIST_PANEL));
  }

  function isUpNextPresent(doc) {
    return Boolean(doc && doc.querySelector(UP_NEXT_TILES));
  }

  /**
   * Decide the placement for this page.
   *
   * Returns one of:
   *   { type: "none",  reason }
   *   { type: "playlist",  slot, anchor, list }
   *   { type: "watchSidebar",  slot, anchor, list, first }
   *
   * The card goes at the TOP of whatever YouTube is showing, and that surface
   * - the playlist panel, the up-next list - is pushed down as one block. Not
   * "under the heading": the card is first, and everything YouTube had is below
   * it.
   *
   * `slot` is the parent the card becomes a child of. `anchor` is the element
   * it is inserted before, which is YouTube's own surface - so on a playlist
   * the anchor is the whole panel, and the panel's header and rows both end up
   * underneath. `list` is what the pitch is measured from. A case with no
   * resolvable slot degrades to "none" rather than to a card in the wrong place.
   */
  function placementFor({ doc, pathname, width }) {
    if (!doc || pathname !== "/watch") {
      return { type: "none", reason: "not-a-watch-page" };
    }
    // An unreadable width is treated as a narrow one. Guessing "desktop" would
    // put a card into a sidebar that may not be there, and a card in the wrong
    // place is worse than no card: it would push a list that is not there.
    if (typeof width !== "number" || !Number.isFinite(width) || width < MIN_WIDTH) {
      return { type: "none", reason: "too-narrow" };
    }

    /* A playlist panel, when open, sits where the up-next list would be. It
       wins over the up-next case: while the panel is open there are no
       up-next tiles to displace.

       The anchor is the panel itself, not its #items. Inserting before #items
       would have put the card under the playlist's header, which is not what
       was asked for: the card goes on top and the whole panel - header, name,
       controls and every video - moves down under it as one block. */
    if (isPlaylistPanelPresent(doc)) {
      const panel = doc.querySelector(PLAYLIST_PANEL);
      const slot = panel && panel.parentNode;
      if (slot) {
        return { type: "playlist", slot, anchor: panel, list: panel };
      }
      /* No parent to sit in. Fall through to the up-next case so the reader
         still gets a card somewhere sensible rather than none. */
    }

    if (isUpNextPresent(doc)) {
      const list = doc.querySelector(WATCH_LIST);
      if (list) {
        const slot = list.parentNode;
        // First tile, not the container's first child: the list opens with a
        // div#header holding the "Up next" heading, and inserting ahead of that
        // would put our card above the heading it belongs under.
        const first =
          list.querySelector("yt-lockup-view-model, ytd-video-renderer, ytd-compact-video-renderer") ||
          list.firstElementChild;
        if (slot && first) {
          return { type: "watchSidebar", slot, anchor: first, list, first };
        }
      }
    }

    return { type: "none", reason: "no-list-to-push" };
  }

  /**
   * Insert `host` at the placement's anchor, exactly once.
   *
   * Idempotent: if the host is already a child of the anchor's parent it is
   * left alone, so a YouTube re-render that calls this again does not stack a
   * second card or move a card that the reader is already looking at.
   */
  function mountAt(placement, host) {
    if (!placement || placement.type === "none" || !host) return false;
    const { anchor } = placement;
    if (!anchor) return false;
    const parent = anchor.parentNode;
    if (!parent) return false;

    if (host.parentNode === parent && host.nextSibling === anchor) {
      return false; // already exactly where it belongs
    }
    parent.insertBefore(host, anchor);
    return true;
  }

  /**
   * Remove a host that no longer has a placement, or that is left over in a
   * parent the current anchor does not live in.
   */
  function unmountStale(placement, host) {
    if (!host) return false;
    if (placement && placement.type !== "none" && placement.anchor) {
      const parent = placement.anchor.parentNode;
      if (host.parentNode === parent) return false;
    }
    if (host.parentNode) {
      host.remove();
      return true;
    }
    return false;
  }

  g.NS_PLACEMENT = {
    MIN_WIDTH,
    PLAYLIST_PANEL,
    WATCH_LIST,
    UP_NEXT_TILES,
    FALLBACK_PITCH,
    isPlaylistPanelPresent,
    isUpNextPresent,
    measureTilePitch,
    placementFor,
    mountAt,
    unmountStale
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
