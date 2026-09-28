// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

/*
 * The hover download icon. The user asked for it *under* the Volume and Captions
 * buttons — one hop away from the controls they already know, not floating on
 * the thumbnail where it would cover the thing it downloads.
 *
 * YouTube ships that overlay in more than one shape and renames its labels, so
 * the rules here are (1) prefer the language-independent class names, (2) fall
 * back to reading labels, (3) never escape the image box, and (4) if there is no
 * row at all, sit in the image rather than vanish. Rule (4) is the one the live
 * site needs: the current hover row is built on hover, so a page pass almost
 * never finds one, and an earlier version of this extension quietly skipped
 * every card for exactly that reason. The fixture carries all four cases.
 */
beforeAll(async () => {
  const fixture = resolve(process.cwd(), "extension/tests/fixtures/hoverCard.html");
  document.body.innerHTML = readFileSync(fixture, "utf8");
  await import("../lib/thumb.js");
  await import("../lib/tiles.js");
});

const card = (n) => document.getElementById(`thumbnail-${n}`).closest("ytd-rich-item-renderer");
const thumb = () => globalThis.NS_THUMB;
const today = () => document.querySelector("ytd-rich-item-renderer[lockup]");

describe("finding the box to hang the icon under", () => {
  it("takes the box that holds both hover buttons", () => {
    const anchor = thumb().findAnchor(card(1), [card(1)]);
    expect(anchor?.className).toBe("pair");
  });

  it("still finds it by label when YouTube ships no overlay classes", () => {
    const anchor = thumb().findAnchor(card(2), [card(2)]);
    // Both buttons are siblings, so the box holding them is the overlay itself.
    expect(anchor?.className).toBe("overlay");
  });

  it("ignores the menu button on the way", () => {
    const labels = thumb().overlayButtons(card(2)).map((b) => b.getAttribute("aria-label"));
    expect(labels).not.toContain("Action menu");
  });

  it("stays inside the overlay instead of climbing out to the card", () => {
    // A tile whose only hover controls are the two buttons, with no box of their
    // own, would otherwise resolve up to the tile and drop the icon below the
    // thumbnail — into the video's own row.
    const tile = document.createElement("ytd-rich-item-renderer");
    tile.innerHTML =
      '<button class="ytp-mute-toggle-button" aria-label="Mute"></button>' +
      '<button class="ytp-caption-toggle-button" aria-label="Subtitles on"></button>';
    document.body.appendChild(tile);
    const anchor = thumb().findAnchor(tile, [tile]);
    expect(anchor).not.toBe(tile);
    expect(anchor.className).toBe("ytp-caption-toggle-button");
    tile.remove();
  });

  it("adds nothing rather than guessing when there is no overlay", () => {
    expect(thumb().findAnchor(card(3), [card(3)])).toBeNull();
  });

  it("finds no row on today's card, because YouTube has not built one yet", () => {
    // The regression. This card has a real image box and no hover controls at
    // all, which is the normal state of a card that is not being hovered.
    expect(thumb().findAnchor(today(), [today()])).toBeNull();
    expect(thumb().overlayButtons(today())).toHaveLength(0);
  });
});

/* The cascade. Under the site's own row when one exists, in the image when it
   does not — the second case being the one that actually happens on a page. */
describe("where the button goes when the site has no row", () => {
  const unsafeFor = (tile) => {
    const box = thumb().thumbContainer(tile);
    return [tile, tile.closest(globalThis.NS_TILES.HOSTS), box].filter(Boolean);
  };

  it("prefers the site's own hover row when there is one", () => {
    const slot = thumb().hoverSlot(card(1), unsafeFor(card(1)));
    expect(slot.boxed).toBe(false);
    expect(slot.parent.className).toBe("overlay");
  });

  it("falls back to the image box, marked as such", () => {
    const slot = thumb().hoverSlot(today(), unsafeFor(today()));
    expect(slot.boxed).toBe(true);
    expect(slot.parent.tagName).toBe("YT-THUMBNAIL-VIEW-MODEL");
  });

  it("gives the image box a position to pin the icon to", () => {
    const tile = today();
    const btn = thumb().buildHoverButton("VtF4k9Lm2Rs", "The card YouTube ships today", "", () => {});
    expect(thumb().attach(btn, tile, unsafeFor(tile))).toBe(true);
    const box = thumb().thumbContainer(tile);
    expect(box.style.position).toBe("relative");
    expect(box.getAttribute("data-ns-ovl-host")).toBe("1");
    expect(box.contains(btn)).toBe(true);
    expect(btn.className).toContain("ns-ovl-btn--boxed");
  });

  it("leaves overflow alone, so YouTube's own buttons cannot bleed across cards", () => {
    const box = thumb().thumbContainer(today());
    expect(box.style.overflow).toBe("");
  });

  it("never escapes the image, on any card", () => {
    for (const tile of [card(1), card(2), card(3), today()]) {
      const btn = thumb().buildHoverButton("VtF4k9Lm2Rs", "T", "", () => {});
      if (!thumb().attach(btn, tile, unsafeFor(tile))) continue;
      const box = thumb().thumbContainer(tile);
      expect(box.contains(btn)).toBe(true);
      // Below the image would put it in the video's own title row.
      expect(btn.closest("h3")).toBeNull();
    }
  });

  it("is added once per card, whichever way it lands", () => {
    for (const tile of [card(1), today()]) {
      const box = thumb().thumbContainer(tile);
      for (let i = 0; i < 3; i++) {
        const btn = thumb().buildHoverButton("VtF4k9Lm2Rs", "T", "", () => {});
        thumb().attach(btn, tile, unsafeFor(tile));
      }
      expect(box.querySelectorAll("[data-ns-ovl]")).toHaveLength(1);
    }
  });

  it("reports honestly when there is no image to sit in at all", () => {
    const bare = document.createElement("ytd-rich-item-renderer");
    bare.innerHTML = '<a href="/watch?v=7bR3yHn6mPd"><h3><a href="/watch?v=7bR3yHn6mPd">No image box</a></h3></a>';
    document.body.appendChild(bare);
    const btn = thumb().buildHoverButton("7bR3yHn6mPd", "No image box", "", () => {});
    expect(thumb().attach(btn, bare, unsafeFor(bare))).toBe(false);
    expect(bare.querySelector("[data-ns-ovl]")).toBeNull();
    bare.remove();
  });
});

describe("the icon itself", () => {
  const build = (onClick) =>
    thumb().buildHoverButton("8sA8Y5F3p9M", "How I plan a month of uploads", "https://i.ytimg.com/vi_webp/8sA8Y5F3p9M/hq720.webp", onClick);

  it("is a real button with one clear name, not a styled div", () => {
    const btn = build(vi.fn());
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.type).toBe("button");
    expect(btn.getAttribute("aria-label")).toBe("Download thumbnail");
    expect(btn.querySelector("svg")).not.toBeNull();
  });

  it("asks for the best image the page already has, then the usual fallbacks", () => {
    const onClick = vi.fn();
    build(onClick).click();
    const { urls, filename } = onClick.mock.calls[0][0];
    // The card serves webp; the downloader wants jpg, so the src is rewritten.
    expect(urls[0]).toBe("https://i.ytimg.com/vi/8sA8Y5F3p9M/hq720.webp");
    expect(urls).toContain("https://i.ytimg.com/vi/8sA8Y5F3p9M/maxresdefault.jpg");
    expect(filename).toBe("how-i-plan-a-month-of-uploads-8sA8Y5F3p9M.jpg");
  });

  it("does not navigate the card it sits on", () => {
    const onClick = vi.fn();
    const btn = build(onClick);
    const e = new window.MouseEvent("click", { bubbles: true, cancelable: true });
    btn.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it("takes one press at a time", () => {
    const onClick = vi.fn();
    const btn = build(onClick);
    btn.click();
    thumb().setState(btn, "saving");
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("reports what happened, then goes back to being a plain download button", () => {
    const btn = build(vi.fn());
    thumb().setState(btn, "saved");
    expect(btn.getAttribute("aria-label")).toBe("Saved");
    expect(btn.getAttribute("data-state")).toBe("saved");
    thumb().setState(btn, "failed");
    expect(btn.getAttribute("aria-label")).toBe("Could not save");
    thumb().setState(btn, null);
    expect(btn.getAttribute("aria-label")).toBe("Download thumbnail");
    expect(btn.hasAttribute("data-state")).toBe(false);
  });
});

describe("the thumbnail URL on a card", () => {
  it("is left alone when it is already a jpg", () => {
    expect(thumb().normalizeImgSrc("https://i.ytimg.com/vi/2Kq9TbZ4wXc/hqdefault.jpg")).toBe(
      "https://i.ytimg.com/vi/2Kq9TbZ4wXc/hqdefault.jpg"
    );
  });

  it("is refused when it is not from YouTube's image host", () => {
    expect(thumb().normalizeImgSrc("https://example.com/vi/2Kq9TbZ4wXc/x.jpg")).toBe("");
    expect(thumb().normalizeImgSrc("")).toBe("");
  });
});

/*
 * The three rules above, composed the way content.js composes them, on a card
 * shaped the way YouTube actually shapes it. Unit tests of the anchor can pass
 * while the icon still lands in the wrong place; this is the one that would
 * catch that.
 */
describe("the icon on a real card", () => {
  const lockup = () => document.querySelector("yt-lockup-view-model");
  const unsafeFor = (tile) => {
    const box = thumb().thumbContainer(tile);
    return [tile, tile.closest(globalThis.NS_TILES.HOSTS), box].filter(Boolean);
  };

  const mount = (tile, id) => {
    if (tile.querySelector("[data-ns-ovl]")) return tile.querySelector("[data-ns-ovl]");
    const btn = thumb().buildHoverButton(id, "The first card in a real grid", "", () => {});
    if (!thumb().attach(btn, tile, unsafeFor(tile))) return null;
    return btn;
  };

  it("sits under the hover pair and still on the image", () => {
    const tile = lockup();
    const btn = mount(tile, "dQw4w9WgXcQ");
    expect(btn.previousElementSibling.className).toBe("pair");
    // Under the pair, but inside the thumbnail — not over the title block.
    expect(tile.querySelector("ytd-thumbnail").contains(btn)).toBe(true);
    expect(btn.closest("h3")).toBeNull();
  });

  it("is added once, however many times the page is walked", () => {
    const tile = lockup();
    expect(tile.querySelectorAll("[data-ns-ovl]")).toHaveLength(1);
    mount(tile, "dQw4w9WgXcQ");
    mount(tile, "dQw4w9WgXcQ");
    expect(tile.querySelectorAll("[data-ns-ovl]")).toHaveLength(1);
  });

  it("is found by the card pass even though the strip already marked the card", () => {
    const tile = lockup();
    tile.setAttribute(globalThis.NS_TILES.MARK, "1");
    tile.append(Object.assign(document.createElement("div"), { className: "ns-line" }));
    const found = [];
    globalThis.NS_TILES.each(document, 50, (t, id) => found.push(id), { skipLined: false });
    expect(found).toContain("dQw4w9WgXcQ");
  });

  it("lands on today's card too, with no hover row to go under", () => {
    const tile = today();
    const btn = mount(tile, "VtF4k9Lm2Rs");
    expect(btn).not.toBeNull();
    expect(thumb().thumbContainer(tile).contains(btn)).toBe(true);
  });
});
