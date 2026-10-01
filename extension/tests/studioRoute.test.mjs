import { beforeAll, describe, expect, it } from "vitest";

/*
 * Which Studio page we are on.
 *
 * Every Studio module after this one - the content table, the edit panel, the
 * thumbnail scorer - starts by asking this question, so the question has to be
 * answerable without a browser and it has to be answered the same way every time.
 *
 * These tests exist mostly because the shapes they lock in were wrong the first
 * time. Studio's Content page is /channel/<id>/content, not /channel/<id>/videos,
 * and a video is addressed as /video/<id>/edit with no query parameter. A
 * classifier written against the wrong shapes matches nothing, and a classifier
 * that matches nothing looks exactly like a classifier that decided there was
 * nothing to do. That is the failure this file is aimed at: a route table that
 * certifies a guess is worse than no route table, because it reports passing.
 *
 * So the URLs below are real ones, taken from a live channel, and the ids are
 * kept exactly as they were found - including a channel id that is not UC plus
 * the usual fixed length. If Studio renames a path, this file should fail and
 * ask, rather than be quietly widened to match whatever now happens.
 */

beforeAll(async () => {
  await import("../lib/studioRoute.js");
});

const R = () => globalThis.NS_STUDIO_ROUTE;

/* The five shapes that were checked by hand against a real channel. */
const REAL = [
  ["https://studio.youtube.com/channel/UCK_lVZeITq1EJ0abLTO-pvQ", "channel-home"],
  ["https://studio.youtube.com/channel/UCK_lVZeITq1EJ0abLTO-pvQ/content", "content"],
  ["https://studio.youtube.com/channel/UCK_lVZeITq1EJ0abLTO-pvQ/analytics/tab-overview/period-default", "channel-analytics"],
  ["https://studio.youtube.com/video/M1HRZS7H5g4/edit", "edit"],
  ["https://studio.youtube.com/video/M1HRZS7H5g4/analytics/tab-overview/period-default", "video-analytics"],
];

describe("recognising the Studio surfaces", () => {
  for (const [url, kind] of REAL) {
    it(`calls ${url.split("/").slice(3).join("/") || "the channel root"} ${kind}`, () => {
      expect(R().classify(url).kind).toBe(kind);
    });
  }

  it("reads the video id out of the path, not out of a query string", () => {
    // There is no ?id= anywhere in Studio's own URLs. Reading one anyway is how
    // the edit panel ends up scoring "the wrong video" with no error shown.
    expect(R().classify("https://studio.youtube.com/video/M1HRZS7H5g4/edit").videoId).toBe("M1HRZS7H5g4");
    expect(R().classify("https://studio.youtube.com/video/M1HRZS7H5g4/edit?id=someone-elses-video").videoId).toBe("M1HRZS7H5g4");
  });

  it("reads the channel id out of the path", () => {
    expect(R().classify("https://studio.youtube.com/channel/UCK_lVZeITq1EJ0abLTO-pvQ/content").channelId).toBe(
      "UCK_lVZeITq1EJ0abLTO-pvQ"
    );
  });

  it("does not care how long an id is", () => {
    // The channel this was checked against is UCK..., not UC plus 22 characters.
    // A length or prefix check would have thrown away a real channel, and a
    // check that throws away real channels is worse than no check because it
    // looks like validation.
    const short = R().classify("https://studio.youtube.com/channel/UC1/content");
    const long = R().classify("https://studio.youtube.com/channel/UCabcdefghijklmnopqrstuvwxyz0123456789/content");
    expect(short.kind).toBe("content");
    expect(long.kind).toBe("content");
    expect(long.channelId).toBe("UCabcdefghijklmnopqrstuvwxyz0123456789");
  });

  it("finds the analytics tab wherever it sits in the path", () => {
    // The tab is a prefixed segment, and Studio has already moved it once. A
    // fixed index would read the wrong tab and, worse, would keep working
    // while reading the wrong thing.
    expect(R().classify("https://studio.youtube.com/channel/UC1/analytics/tab-overview/period-default").tab).toBe("overview");
    expect(R().classify("https://studio.youtube.com/channel/UC1/analytics/reach/tab-audience-period-default").tab).toBe(
      "audience"
    );
    expect(R().classify("https://studio.youtube.com/video/v1/analytics/tab-realtime").tab).toBe("realtime");
  });

  it("cuts a period suffix off a tab name rather than reporting it as the tab", () => {
    // The confirmed URLs carry the period as its own segment, so this shape is
    // not one that has been seen. It is tested anyway because it is the shape a
    // future Studio change would most plausibly produce by joining two segments
    // that are separate today, and "audience-period-default" is a tab name that
    // does not exist.
    const glued = R().classify("https://studio.youtube.com/channel/UC1/analytics/tab-audience-period-default");
    expect(glued.kind).toBe("channel-analytics");
    expect(glued.tab).toBe("audience");
  });

  it("survives the shapes Studio actually throws at a classifier", () => {
    const awkward = [
      ["https://studio.youtube.com/channel/UC1/content/", "content"],
      ["https://studio.youtube.com/video/v1/edit#details", "edit"],
      ["https://studio.youtube.com/video/v1/edit?foo=bar", "edit"],
      ["studio.youtube.com/video/v1/edit", "edit"],
      ["/video/v1/edit", "edit"],
    ];
    for (const [url, kind] of awkward) {
      expect(R().classify(url).kind, url).toBe(kind);
    }
  });

  it("calls a page it has no opinion about unknown, rather than guessing", () => {
    const others = [
      "https://studio.youtube.com/",
      "https://studio.youtube.com/channel/",
      "https://studio.youtube.com/video/",
      "https://studio.youtube.com/anything/else/here",
      "",
      null,
      undefined,
    ];
    for (const url of others) {
      expect(R().classify(url).kind, String(url)).toBe("unknown");
    }
  });

  it("names a bare channel or video root rather than calling it unknown", () => {
    // /channel/<id> and /video/<id> are real Studio pages - the channel
    // dashboard and a video's overview. Calling them unknown would lose the id
    // the next modules need, so they are named and simply left not actionable.
    expect(R().classify("https://studio.youtube.com/channel/UC1")).toEqual({ kind: "channel-home", channelId: "UC1" });
    expect(R().classify("https://studio.youtube.com/video/v1")).toEqual({ kind: "video-home", videoId: "v1" });
  });

  it("reports an unrecognised section as itself, not as unknown", () => {
    // Unknown means "not a Studio page". A Studio page that moved is a different
    // fact, and the next module needs to be able to say "Studio moved this"
    // rather than find nothing to attach to.
    expect(R().classify("https://studio.youtube.com/channel/UC1/comments")).toEqual({
      kind: "channel-section",
      channelId: "UC1",
      section: "comments",
    });
    expect(R().classify("https://studio.youtube.com/video/v1/plagiarism")).toEqual({
      kind: "video-section",
      videoId: "v1",
      section: "plagiarism",
    });
  });
});

describe("knowing which routes are ours to act on", () => {
  it("acts on the three surfaces the initiative is building", () => {
    expect(R().isActionable(R().classify("https://studio.youtube.com/channel/UC1/content"))).toBe(true);
    expect(R().isActionable(R().classify("https://studio.youtube.com/video/v1/edit"))).toBe(true);
    expect(R().isActionable(R().classify("https://studio.youtube.com/video/v1/upload"))).toBe(true);
  });

  it("leaves everything else to YouTube", () => {
    // Analytics is deliberately not actionable. Reading a creator's own numbers
    // out of Studio would mean scraping a surface that is not ours and is free
    // to change; our numbers come from the API and the local database instead.
    for (const url of [
      "https://studio.youtube.com/channel/UC1",
      "https://studio.youtube.com/channel/UC1/analytics/tab-overview/period-default",
      "https://studio.youtube.com/video/v1/analytics/tab-overview/period-default",
      "https://studio.youtube.com/video/v1",
      "https://studio.youtube.com/",
    ]) {
      expect(R().isActionable(R().classify(url)), url).toBe(false);
    }
  });
});
