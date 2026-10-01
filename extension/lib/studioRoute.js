/*
 * Which Studio surface a URL points at.
 *
 * This is the whole of studio-host's knowledge, and it is a pure function on
 * purpose: the modules after it - the content table, the edit panel, the
 * thumbnail scorer - each one needs to know where the creator is, and a
 * question that has to be answered by loading Studio in a browser is a question
 * that gets answered differently in every one of those modules.
 *
 * Classification is by path segment rather than by matching a whole path shape.
 * The shapes this was first written against were wrong: the Content page is
 * /channel/<id>/content and not /channel/<id>/videos, and a video is addressed as
 * /video/<id>/edit with no query parameter at all. A shape match built on those
 * guesses would have matched nothing at all and shipped as a silent no-op. A
 * segment match survives the next naming change; a shape match does not.
 *
 * Ids are read as opaque segments on purpose. The channel id on the channel this
 * was checked against is UCK_lVZeITq1EJ0abLTO-pvQ - not UC plus the fixed length
 * most channels have - so any check on id length would have rejected a real
 * channel. A shape check that fails is worse than no check, because it looks
 * like validation.
 *
 * No module system in a content script, so this follows the pattern the other
 * extension libraries use and hangs off globalThis.
 */
(function attach(global) {
  // Accepts either a full URL or a bare path, because both are convenient at the
  // call site and a classifier that only handles one of them gets wrapped.
  function segmentsOf(input) {
    const raw = String(input === null || input === undefined ? "" : input);
    if (!raw) return [];
    if (raw.charAt(0) !== "/") {
      try {
        return new URL(raw).pathname.split("/").filter(Boolean);
      } catch (err) {
        return [];
      }
    }
    return raw.split("?")[0].split("#")[0].split("/").filter(Boolean);
  }

  // analytics/tab-overview/period-default -> "overview". The tab is named by a
  // prefixed segment wherever it appears, so it is looked up rather than assumed
  // to sit at a fixed position; Studio has already moved it once.
  function tabOf(segments) {
    for (const segment of segments) {
      if (segment.indexOf("tab-") === 0) return segment.slice(4);
    }
    return null;
  }

  function classify(input) {
    const segments = segmentsOf(input);
    const [root, id, section] = segments;

    if (!root || !id) return { kind: "unknown" };

    if (root === "channel") {
      if (!section) return { kind: "channel-home", channelId: id };
      if (section === "content") return { kind: "content", channelId: id };
      if (section === "analytics") return { kind: "channel-analytics", channelId: id, tab: tabOf(segments) };
      // A section we have no opinion about is reported, not discarded. The next
      // module needs to be able to say "Studio moved the Content page" rather
      // than fail to recognise a route and leave the creator with nothing.
      return { kind: "channel-section", channelId: id, section: section };
    }

    if (root === "video") {
      if (!section) return { kind: "video-home", videoId: id };
      if (section === "edit") return { kind: "edit", videoId: id };
      if (section === "upload") return { kind: "upload", videoId: id };
      if (section === "analytics") return { kind: "video-analytics", videoId: id, tab: tabOf(segments) };
      return { kind: "video-section", videoId: id, section: section };
    }

    return { kind: "unknown" };
  }

  // Whether the URL names something we can act on, which is not the same as
  // whether we recognise it. An unknown Studio page is not an error; it is a page
  // this extension has no business touching, and the two are worth telling apart.
  function isActionable(route) {
    return route.kind === "content" || route.kind === "edit" || route.kind === "upload";
  }

  global.NS_STUDIO_ROUTE = { classify, isActionable };
})(globalThis);
