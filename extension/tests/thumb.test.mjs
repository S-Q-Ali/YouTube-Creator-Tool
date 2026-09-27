import { beforeAll, describe, expect, it } from "vitest";

/*
 * Naming and URL choices for a thumbnail download are decisions worth keeping
 * out of the click handler, so they live in a classic script beside the other
 * content-script libraries and get tested directly.
 */
beforeAll(async () => {
  await import("../lib/thumb.js");
});

function thumb() {
  return globalThis.NS_THUMB;
}

describe("slugify", () => {
  it("keeps the words of a title and drops the punctuation", () => {
    expect(thumb().slugify("How to switch from watching to creating!")).toBe("how-to-switch-from-watching-to-creating");
  });

  it("folds the characters a file name cannot hold", () => {
    expect(thumb().slugify('He said: "growth / 2026" — part 1?')).toBe("he-said-growth-2026-part-1");
  });

  it("collapses runs of separators instead of leaving empty ones", () => {
    expect(thumb().slugify("a   b___c")).toBe("a-b-c");
  });

  it("trims a leading or trailing separator", () => {
    expect(thumb().slugify("  leading and trailing  ")).toBe("leading-and-trailing");
  });

  it("returns an empty slug for a title with nothing usable in it", () => {
    expect(thumb().slugify("!!! ***")).toBe("");
    expect(thumb().slugify("")).toBe("");
    expect(thumb().slugify(null)).toBe("");
  });
});

describe("filename", () => {
  it("names the file after the title and the video id", () => {
    expect(thumb().filename("How to switch from watching to creating", "dQw4w9WgXcQ")).toBe(
      "how-to-switch-from-watching-to-creating-dQw4w9WgXcQ.jpg"
    );
  });

  it("falls back to the id when the title cannot be slugged", () => {
    expect(thumb().filename("***", "dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ.jpg");
  });

  it("keeps the file name inside what a file system accepts", () => {
    const name = thumb().filename("A".repeat(200), "dQw4w9WgXcQ");
    expect(name.length).toBeLessThanOrEqual(80);
    expect(name.endsWith("-dQw4w9WgXcQ.jpg")).toBe(true);
  });

  it("rejects an id that is not a video id rather than naming a file after junk", () => {
    expect(thumb().filename("A title", "../../etc/passwd")).toBe("");
    expect(thumb().filename("A title", "")).toBe("");
  });
});

describe("candidates", () => {
  it("tries the url the api already proved exists first", () => {
    const list = thumb().candidates("dQw4w9WgXcQ", "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
    expect(list[0]).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
  });

  it("falls back through smaller images when no url is known", () => {
    expect(thumb().candidates("dQw4w9WgXcQ", "")).toEqual([
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg"
    ]);
  });

  it("ignores a url that is not a youtube image for that video", () => {
    const list = thumb().candidates("dQw4w9WgXcQ", "https://example.com/not-a-thumbnail.jpg");
    expect(list[0]).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
  });

  it("returns nothing for an id that is not a video id", () => {
    expect(thumb().candidates("nope", "")).toEqual([]);
  });
});

describe("audioCaptionsIndex", () => {
  const menu = [
    "Report",
    "Corrections",
    "Audio and captions",
    "Downloads",
    "Report to YouTube"
  ];

  it("finds the row the save entry belongs under", () => {
    expect(thumb().audioCaptionsIndex(menu)).toBe(2);
  });

  it("tolerates the whitespace a menu row carries", () => {
    expect(thumb().audioCaptionsIndex(["  Audio   and\n captions  "])).toBe(0);
  });

  it("matches regardless of the case the site ships", () => {
    expect(thumb().audioCaptionsIndex(["audio AND captions"])).toBe(0);
  });

  it("returns -1 when the menu has no such row", () => {
    expect(thumb().audioCaptionsIndex(["Report", "Downloads"])).toBe(-1);
    expect(thumb().audioCaptionsIndex([])).toBe(-1);
    expect(thumb().audioCaptionsIndex(null)).toBe(-1);
  });

  it("does not mistake its own row for the one it follows", () => {
    expect(thumb().audioCaptionsIndex(["Download thumbnail", "Report"])).toBe(-1);
  });
});
