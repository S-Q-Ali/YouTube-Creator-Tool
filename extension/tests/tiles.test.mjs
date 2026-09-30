// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/*
 * Which cards get a strip. YouTube nests a wrapper (ytd-rich-item-renderer)
 * around the real card (yt-lockup-view-model), and a selector that accepts both
 * hands one video two strips — the bug this module exists to make impossible.
 * The fixture is a trimmed copy of a real grid, so the nesting is tested as
 * YouTube actually ships it rather than as we imagine it.
 */
beforeAll(async () => {
  const fixture = resolve(process.cwd(), "extension/tests/fixtures/grid.html");
  document.body.innerHTML = readFileSync(fixture, "utf8");
  await import("../lib/tiles.js");
});

function collect(limit) {
  const seen = [];
  globalThis.NS_TILES.each(document, limit, (tile, id) => {
    seen.push({ id, tile });
  });
  return seen;
}

describe("finding the cards worth annotating", () => {
  it("takes the inner lockup once, never the wrapper around it", () => {
    const ids = collect(50).map((x) => x.id);
    expect(ids).toContain("gEQ0BLyVJhY");
    expect(ids.filter((id) => id === "gEQ0BLyVJhY")).toHaveLength(1);
  });

  it("reads the id out of a watch link that carries tracking parameters", () => {
    const first = collect(50)[0];
    expect(first.id).toBe("gEQ0BLyVJhY");
  });

  /*
   * A playlist watch has two subjects on screen and they are not the same one.
   * `/watch?v=X&list=Y` shows video X inside playlist Y: the sidebar is the
   * playlist, but the card on top of it is the scorecard for X. Reading the
   * playlist's first entry instead would show a card about a video the reader
   * is not watching, sitting above the video they opened.
   */
  it("reads the watched video, not the playlist, off a playlist watch link", () => {
    const { idFromHref } = globalThis.NS_TILES;
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdef123&index=4";
    expect(idFromHref(url, url)).toBe("dQw4w9WgXcQ");
  });

  it("reads the watched video even when the playlist parameter comes first", () => {
    const { idFromHref } = globalThis.NS_TILES;
    const url = "https://www.youtube.com/watch?list=PLabcdef123&v=dQw4w9WgXcQ&t=42s";
    expect(idFromHref(url, url)).toBe("dQw4w9WgXcQ");
  });

  it("skips a card that already carries a strip", () => {
    expect(collect(50).map((x) => x.id)).not.toContain("aBcDeFgHiJk");
  });

  it("still finds the older ytd-video-renderer card", () => {
    expect(collect(50).map((x) => x.id)).toContain("LegAcY12345");
  });

  it("leaves ad slots and linkless tiles alone", () => {
    const ids = collect(50).map((x) => x.id);
    expect(ids).not.toContain("Promoted1234");
    expect(ids).not.toContain("NoLinkHere1");
  });

  it("stops at the card budget", () => {
    expect(collect(1)).toHaveLength(1);
  });

  it("stops walking when the visitor says the page moved on", () => {
    const seen = [];
    globalThis.NS_TILES.each(document, 50, () => {
      seen.push(1);
      return false;
    });
    expect(seen).toHaveLength(1);
  });
});

describe("annotating a card in place", () => {
  it("marks the tile so a second pass leaves it alone", () => {
    const card = document.querySelector('yt-lockup-view-model.content-id-gEQ0BLyVJhY');
    const strip = document.createElement("div");
    strip.className = "ns-line";
    card.append(strip);
    card.setAttribute("data-ns-lined", "1");

    expect(globalThis.NS_TILES.isLined(card)).toBe(true);
    expect(collect(50).map((x) => x.id)).not.toContain("gEQ0BLyVJhY");
  });

  it("hands a lined card back to a pass that asks for it", () => {
    // The download icon rides the card's own hover overlay and is not part of the
    // strip, so it must still find cards the strip pass has already marked.
    const seen = [];
    globalThis.NS_TILES.each(
      document,
      50,
      (tile, id) => {
        seen.push(id);
      },
      { skipLined: false }
    );
    expect(seen).toContain("gEQ0BLyVJhY");
    expect(seen).toContain("aBcDeFgHiJk");
  });
});
