// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/*
 * The up-next list on a watch page.

 * The strip was kept off watch pages on purpose, to stop it landing on the
 * hero of the video you just opened. That reasoning was right about the hero
 * and wrong about the sidebar: the up-next list holds the same
 * ytd-compact-video-renderer cards a grid holds, so the user got stats on the
 * home page, on channels and in search, and then opened a video and found the
 * list of videos they were about to choose from was the one bare surface.

  The fix is not to scan the watch page. It is to scan the sidebar of it. The
  fixture carries a valid lockup in #primary as a trap: scoping has to hold, or
  the original bug comes straight back.
 */
beforeAll(async () => {
  const fixture = resolve(process.cwd(), "extension/tests/fixtures/watch.html");
  document.body.innerHTML = readFileSync(fixture, "utf8");
  await import("../lib/tiles.js");
});

const VIDEO = "UpNext0000009";

const scanRootFor = (pathname, videoId) => globalThis.NS_TILES.scanRoot(pathname, videoId);
const idsIn = (root) => {
  const seen = [];
  globalThis.NS_TILES.each(root, 50, (tile, id) => {
    seen.push(id);
  });
  return seen;
};

describe("deciding where a scan is allowed to look", () => {
  it("scans the whole page on a grid route", () => {
    expect(scanRootFor("/", null)).toBe(document);
    expect(scanRootFor("/results?search_query=test", null)).toBe(document);
    expect(scanRootFor("/@somechannel", null)).toBe(document);
  });

  it("scans nothing on a route that is neither a grid nor a watch page", () => {
    // A playlist page, a shorts page, a settings page: there is no list of
    // videos to annotate there, and guessing is how strips end up somewhere
    // they were never meant to be.
    expect(scanRootFor("/playlist?list=PL123456", null)).toBeNull();
    expect(scanRootFor("/shorts/abc123", null)).toBeNull();
    expect(scanRootFor("/account", null)).toBeNull();
  });

  it("scans the sidebar, not the page, on a watch page", () => {
    const root = scanRootFor("/watch?v=" + VIDEO, VIDEO);
    expect(root).not.toBeNull();
    expect(root).not.toBe(document);
    // Asserted through NS_TILES.TILES rather than a literal element name. The
    // up-next list holds yt-lockup-view-model on a current page; it held
    // ytd-compact-video-renderer when this fixture was first written, and the
    // test naming the old tag was one of the reasons the gap went unnoticed.
    expect(root.querySelector(globalThis.NS_TILES.TILES)).not.toBeNull();
  });

  it("recognises the watch route whatever shape the url takes", () => {
    // /watch, /watch/, /watch?v= and a bare id with no id at all. YouTube has
    // shipped more than one of these and the route has to survive all of them,
    // or the sidebar silently loses its strips on one of them.
    for (const p of ["/watch", "/watch/", "/watch?v=" + VIDEO, "/watch?list=PL1&v=" + VIDEO]) {
      expect(scanRootFor(p, null)).not.toBeNull();
    }
  });
});

describe("the up-next list gets the same strips a grid gets", () => {
  // Collected here, not at describe time: the module is imported in beforeAll,
  // so anything computed while the file is being collected runs too early.
  let ids;
  beforeAll(() => {
    ids = idsIn(scanRootFor("/watch?v=" + VIDEO, VIDEO));
  });

  it("annotates the videos in the sidebar", () => {
    expect(ids).toEqual(["UpNext0000001", "UpNext0000002", "UpNext0000003"]);
  });

  it("visits each video once even when two hosts both contain it", () => {
    // The live page nests a ytd-item-section-renderer inside
    // ytd-watch-next-secondary-results-renderer, and both names are in
    // HOSTS. So one video is reachable through two hosts, and the scan used to
    // hand it over twice - six visits for three videos, against a budget of 50.
    // The consequence is not cosmetic: a visitor that has not yet attached its
    // strip sees the same tile twice and attaches two, and on a real page the
    // sidebar then carries doubled readings on every video.
    //
    // The old fixture did not nest two hosts, which is exactly why this shipped
    // unnoticed - the fixture was a guess, and the guess did not contain the
    // structure that breaks.
    const visited = [];
    const { NS_TILES } = globalThis;
    NS_TILES.each(NS_TILES.scanRoot("/watch?v=" + VIDEO, VIDEO), 50, (tile) => {
      visited.push(tile.id || tile.getAttribute("href") || String(visited.length));
    });
    expect(visited.length).toBe(3);
    expect(new Set(visited).size).toBe(3);
  });

  it("leaves the video you are already watching alone", () => {
    expect(ids).not.toContain("HeroTrap00000");
    expect(document.getElementById("hero-trap").querySelector(".ns-line")).toBeNull();
  });

  it("still skips the ad slot", () => {
    expect(ids).not.toContain("AdVideo000001");
  });
});

describe("a watch page with no sidebar yet", () => {
  it("scans nothing rather than falling back to the whole page", () => {
    // YouTube builds the sidebar after the content script runs. Scanning the
    // document as a fallback is exactly the bug this scoping exists to prevent.
    const empty = document.implementation.createHTMLDocument("");
    empty.body.innerHTML = '<ytd-watch-masthead id="masthead"><div id="primary"></div></ytd-watch-masthead>';
    const { NS_TILES } = globalThis;
    expect(NS_TILES.scanRoot("/watch?v=" + VIDEO, VIDEO, empty)).toBeNull();
  });
});
