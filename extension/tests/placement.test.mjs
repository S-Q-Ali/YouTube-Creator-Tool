// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import "../lib/placement.js";

/*
 * Where the card goes, and what it pushes down.
 *
 * One rule covers both watch-page lists: the card is inserted immediately
 * before the list it displaces, so it occupies its own space in the flow and
 * everything below it moves down with it. The card is never fixed and never
 * absolute, so it scrolls with the list instead of floating over the page.
 *
 * Two cases, because YouTube gives two different lists on a watch page:
 *
 *   - a normal watch shows "Up next", and the card goes before the first tile
 *     inside #contents, under the heading
 *   - a watch with a playlist open shows the playlist panel instead, with no
 *     up-next tiles at all, and the card goes before the panel's #items so the
 *     panel's own header stays above it
 *
 * The fixtures are real markup, not guesses: a selector that happens to pass
 * on a hand-written fixture is how the last placement bug shipped.
 */

function load(fixture) {
  const html = readFileSync(resolve(process.cwd(), "extension/tests/fixtures", fixture), "utf8");
  document.body.innerHTML = html;
}

const DESKTOP = 1280;
const { placementFor, mountAt, unmountStale, measureTilePitch, FALLBACK_PITCH } = globalThis.NS_PLACEMENT;

describe("placement on a normal watch page", () => {
  beforeEach(() => load("watch.html"));

  it("inserts before the first tile so the heading stays above the card", () => {
    const placement = placementFor({ doc: document, pathname: "/watch", width: DESKTOP });
    expect(placement.type).toBe("watchSidebar");

    const list = document.querySelector("#secondary-inner #items #contents");
    const heading = list.querySelector("div#header");
    const firstTile = placement.first;
    expect(firstTile).toBeTruthy();
    expect(heading.compareDocumentPosition(firstTile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("pushes the tiles down by taking its own space in the flow", () => {
    const placement = placementFor({ doc: document, pathname: "/watch", width: DESKTOP });
    const host = document.createElement("div");
    host.className = "ns-scorecard";
    expect(mountAt(placement, host)).toBe(true);

    // The card is a sibling of the tiles, ahead of the first one. Because it is
    // a normal block in the flow, the list grows by the card's height and the
    // tiles below it move down on their own.
    expect(host.nextElementSibling).toBe(placement.first);
    expect(placement.list.contains(host)).toBe(true);
    expect(getComputedStyle(host).position).not.toBe("fixed");
    expect(getComputedStyle(host).position).not.toBe("absolute");
  });

  it("does not stack a second card when the page re-renders", () => {
    const placement = placementFor({ doc: document, pathname: "/watch", width: DESKTOP });
    const host = document.createElement("div");
    host.className = "ns-scorecard";
    expect(mountAt(placement, host)).toBe(true);
    expect(document.querySelectorAll(".ns-scorecard")).toHaveLength(1);

    // YouTube re-rendered the list; the same call runs again.
    expect(mountAt(placement, host)).toBe(false);
    expect(document.querySelectorAll(".ns-scorecard")).toHaveLength(1);
  });
});

describe("placement on a watch page with a playlist open", () => {
  beforeEach(() => load("playlist-watch.html"));

  it("sits above the whole panel, so the panel moves down as one block", () => {
    const placement = placementFor({ doc: document, pathname: "/watch", width: DESKTOP });
    expect(placement.type).toBe("playlist");

    const host = document.createElement("div");
    host.className = "ns-scorecard";
    expect(mountAt(placement, host)).toBe(true);

    // The card is not inside the playlist, it is above it. The panel - its
    // header, the playlist name, the controls and every video - is now the
    // card's next sibling, which is what pushes all of it down.
    const panel = document.querySelector("ytd-playlist-panel-renderer#playlist");
    expect(host.nextElementSibling).toBe(panel);
    expect(panel.contains(host)).toBe(false);
    expect(placement.slot).toBe(panel.parentNode);
    expect(placement.slot.firstElementChild).toBe(host);
  });

  it("leaves the playlist's own header above its videos, not above the card", () => {
    // The card is first, and everything YouTube had is under it. The panel's
    // internal order is untouched: this only ever adds a sibling above it.
    const panel = document.querySelector("ytd-playlist-panel-renderer#playlist");
    const before = [...panel.children].map((el) => el.id || el.tagName.toLowerCase());
    const placement = placementFor({ doc: document, pathname: "/watch", width: DESKTOP });
    mountAt(placement, document.createElement("div"));

    expect([...panel.children].map((el) => el.id || el.tagName.toLowerCase())).toEqual(before);
    expect(panel.querySelector("#header-contents")).toBeTruthy();
    expect(panel.querySelector("#items")).toBeTruthy();
  });

  it("picks the playlist over the up-next list when the panel is open", () => {
    // Both present: the panel replaces the recommendations, so the playlist is
    // the thing that actually exists to be pushed down.
    const doc = document.implementation.createHTMLDocument("both");
    doc.body.innerHTML =
      '<div id="secondary-inner"><ytd-playlist-panel-renderer id="playlist"><div id="items"></div></ytd-playlist-panel-renderer>' +
      '<div id="items"><div id="contents"><yt-lockup-view-model></yt-lockup-view-model></div></div></div>';
    const placement = placementFor({ doc, pathname: "/watch", width: DESKTOP });
    expect(placement.type).toBe("playlist");
    expect(placement.anchor).toBe(doc.querySelector("ytd-playlist-panel-renderer#playlist"));
  });

  it("uses whatever the panel's own parent is, without assuming a wrapper", () => {
    // A panel sitting directly in the body has no sidebar wrapper to sit in,
    // and the card still has to go above it rather than into it. Any parent is
    // a valid slot, including body.
    const doc = document.implementation.createHTMLDocument("bare panel");
    doc.body.innerHTML = '<ytd-playlist-panel-renderer id="playlist"><div id="items"></div></ytd-playlist-panel-renderer>';
    const placement = placementFor({ doc, pathname: "/watch", width: DESKTOP });
    expect(placement.type).toBe("playlist");
    expect(placement.slot).toBe(doc.body);
    expect(placement.anchor).toBe(doc.querySelector("ytd-playlist-panel-renderer#playlist"));
  });
});

describe("placement off a watch page, and on a phone", () => {  beforeEach(() => load("watch.html"));

  it("does not appear on any other route", () => {
    for (const pathname of ["/", "/results?search_query=x", "/@example", "/shorts/abc"]) {
      const placement = placementFor({ doc: document, pathname, width: DESKTOP });
      expect(placement.type).toBe("none");
      expect(placement.reason).toBe("not-a-watch-page");
    }
  });

  it("does not appear on a phone, where there is no sidebar list to push", () => {
    const placement = placementFor({ doc: document, pathname: "/watch", width: 390 });
    expect(placement.type).toBe("none");
    expect(placement.reason).toBe("too-narrow");
  });

  it("removes a card left over from a page that no longer has a slot", () => {
    const placement = placementFor({ doc: document, pathname: "/watch", width: 390 });
    const host = document.createElement("div");
    host.className = "ns-scorecard";
    document.querySelector("#secondary-inner").appendChild(host);

    expect(unmountStale(placement, host)).toBe(true);
    expect(document.querySelector(".ns-scorecard")).toBeNull();
  });
});

describe("measuring how much space two videos take", () => {
  beforeAll(() => {
    // jsdom does no layout, so offsetTop and offsetHeight are all 0. The
    // readings are stubbed to stand in for a real sidebar, and the point of
    // these tests is that the code reads them rather than trusting a constant.
    const stub = (el, top, height) => {
      Object.defineProperty(el, "offsetTop", { value: top, configurable: true });
      Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
    };
    globalThis.__nsStub = stub;
  });

  const watchPage = () => {
    load("watch.html");
    const placement = placementFor({ doc: document, pathname: "/watch", width: DESKTOP });
    const tiles = placement.list.querySelectorAll("yt-lockup-view-model");
    globalThis.__nsStub(tiles[0], 40, 114);
    globalThis.__nsStub(tiles[1], 162, 114);
    globalThis.__nsStub(tiles[2], 284, 114);
    return placement;
  };

  it("measures the gap between two rows, so a two-video reserve is exact", () => {
    // 162 - 40 is the pitch: the 114px tile plus YouTube's 8px gap under it.
    // Measuring the tile alone would under-reserve by 8px per video.
    expect(measureTilePitch(watchPage())).toBe(122);
  });

  it("follows the page rather than the width it happened to be measured at", () => {
    const placement = watchPage();
    const tiles = placement.list.querySelectorAll("yt-lockup-view-model");
    globalThis.__nsStub(tiles[1], 200, 160); // a taller row, e.g. a wrapped title
    expect(measureTilePitch(placement)).toBe(160);
  });

  it("falls back to one row's height when there is only one", () => {
    load("watch.html");
    const placement = placementFor({ doc: document, pathname: "/watch", width: DESKTOP });
    const tiles = placement.list.querySelectorAll("yt-lockup-view-model");
    tiles[0].closest("#contents").querySelectorAll("yt-lockup-view-model").forEach((t, i) => {
      if (i > 0) t.remove();
    });
    globalThis.__nsStub(tiles[0], 0, 114);
    expect(measureTilePitch(placement)).toBe(114);
  });

  it("uses the placeholder when the list has not been laid out yet", () => {
    // Every offsetTop is 0, so the difference is 0 and there is nothing to
    // measure. Guessing 0 here would collapse the card to nothing.
    load("watch.html");
    const placement = placementFor({ doc: document, pathname: "/watch", width: DESKTOP });
    expect(measureTilePitch(placement)).toBe(FALLBACK_PITCH);
  });

  it("uses the placeholder when there is no placement at all", () => {
    expect(measureTilePitch({ type: "none" })).toBe(FALLBACK_PITCH);
    expect(measureTilePitch(null)).toBe(FALLBACK_PITCH);
  });
});

describe("the caller has to hand over a path", () => {
  beforeEach(() => load("watch.html"));

  // The route helper in content.js reports { type, id } and carries no path, so
  // a placement that was handed one of those instead of a pathname sees
  // undefined. That has to read as "not a watch page" and mount nothing, not as
  // a page whose sidebar it cannot find and a card dropped somewhere plausible.
  it("mounts nothing when the path is missing", () => {
    const placement = placementFor({ doc: document, pathname: undefined, width: DESKTOP });
    expect(placement.type).toBe("none");
    expect(placement.reason).toBe("not-a-watch-page");
  });

  it("mounts nothing when the document is missing", () => {
    expect(placementFor({ doc: null, pathname: "/watch", width: DESKTOP }).type).toBe("none");
  });

  it("mounts nothing when the width is unknown, rather than guessing wide", () => {
    // An unreadable width must not be treated as a wide window.
    const placement = placementFor({ doc: document, pathname: "/watch", width: null });
    expect(placement.type).toBe("none");
    expect(placement.reason).toBe("too-narrow");
  });
});
