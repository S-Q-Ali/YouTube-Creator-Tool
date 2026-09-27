(function (g) {
  "use strict";

  /*
   * Naming a downloaded thumbnail and choosing which image to fetch are the two
   * decisions a click handler should not be making, so they live here where
   * they can be tested.
   */

  var VIDEO_ID = /^[\w-]{11}$/;
  var MAX_SLUG = 60;
  var FALLBACK_QUALITY = ["maxresdefault", "hqdefault", "mqdefault"];
  var AUDIO_CAPTIONS_RE = /audio and captions/i;

  /* Which menu row to sit under, decided from row labels so the rule is
     testable: the site's own "Audio and captions" row, or nothing. */
  function audioCaptionsIndex(labels) {
    if (!Array.isArray(labels)) return -1;
    for (var i = 0; i < labels.length; i++) {
      var text = String(labels[i] == null ? "" : labels[i]).replace(/\s+/g, " ").trim();
      if (AUDIO_CAPTIONS_RE.test(text)) return i;
    }
    return -1;
  }

  function slugify(title) {
    return String(title == null ? "" : title)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_SLUG)
      .replace(/-+$/g, "");
  }

  function filename(title, videoId) {
    if (!VIDEO_ID.test(String(videoId || ""))) return "";
    var slug = slugify(title);
    var ext = ".jpg";
    return (slug ? slug + "-" : "") + videoId + ext;
  }

  function isYoutubeThumb(url, videoId) {
    return typeof url === "string" && url.indexOf("https://i.ytimg.com/vi/" + videoId + "/") === 0;
  }

  function candidates(videoId, knownUrl) {
    if (!VIDEO_ID.test(String(videoId || ""))) return [];
    var list = [];
    if (isYoutubeThumb(knownUrl, videoId)) list.push(knownUrl);
    for (var i = 0; i < FALLBACK_QUALITY.length; i++) {
      var url = "https://i.ytimg.com/vi/" + videoId + "/" + FALLBACK_QUALITY[i] + ".jpg";
      if (list.indexOf(url) === -1) list.push(url);
    }
    return list;
  }

  g.NS_THUMB = {
    slugify: slugify,
    filename: filename,
    candidates: candidates,
    audioCaptionsIndex: audioCaptionsIndex
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
