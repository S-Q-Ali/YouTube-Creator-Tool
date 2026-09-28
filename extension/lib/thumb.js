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
  var OVERLAY_CLASS = "ytp-mute-toggle-button, ytp-caption-toggle-button, ytd-thumbnail-overlay-toggle-button-renderer";
  var OVERLAY_LABEL_RE = /mute|volume|subtitle|caption/i;
  var IMAGE_HOST = "https://i.ytimg.com/";
  var ICON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M4 17v2a2 0 0 0 2 2h12a2 0 0 0 2-2v-2"/></svg>';
  var HOVER_LABEL = "Download thumbnail";
  var STATE_LABEL = { saving: "Saving…", saved: "Saved", failed: "Could not save" };

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

  /* Cards serve webp from a different path than the downloader wants, so the
     src is rewritten rather than discarded — it is usually the sharpest image
     already on screen. Anything off YouTube's image host is refused outright. */
  function normalizeImgSrc(src) {
    if (typeof src !== "string" || src.indexOf(IMAGE_HOST) !== 0) return "";
    return src.replace("/vi_webp/", "/vi/");
  }

  function labelOf(el) {
    return el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "";
  }

  /* Which hover controls to sit under. The class names survive a language
     change; the labels do not, so they are the fallback, not the first try. */
  function overlayButtons(root) {
    var byClass = root.querySelectorAll(OVERLAY_CLASS);
    if (byClass.length) return Array.prototype.slice.call(byClass);
    var all = root.querySelectorAll("button, [role=button]");
    var byLabel = [];
    for (var i = 0; i < all.length; i++) {
      if (OVERLAY_LABEL_RE.test(labelOf(all[i]))) byLabel.push(all[i]);
    }
    return byLabel;
  }

  function commonAncestor(els) {
    var node = els[0];
    while (node && node.parentNode) {
      var holds = true;
      for (var i = 1; i < els.length; i++) {
        if (!node.contains(els[i])) { holds = false; break; }
      }
      if (holds) return node;
      node = node.parentNode;
    }
    return null;
  }

  /* The element to insert after. Climbing out to the card would drop the icon
     below the thumbnail and into the video's own row, so an anchor that is the
     card itself (or anything else ruled unsafe) loses to the last button. */
  function findAnchor(root, unsafe) {
    var buttons = overlayButtons(root);
    if (!buttons.length) return null;
    var last = buttons[buttons.length - 1];
    var box = commonAncestor(buttons);
    if (box && (unsafe || []).indexOf(box) === -1) return box;
    return last;
  }

  /* The icon. Kept next to the naming rules so its contract — a real button,
     one accessible name, one press per click — is testable without the page. */
  function buildHoverButton(videoId, title, src, onClick) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ns-ovl-btn";
    btn.setAttribute("data-ns-ovl", "1");
    btn.setAttribute("aria-label", HOVER_LABEL);
    btn.title = HOVER_LABEL;
    btn.innerHTML = ICON;
    btn.addEventListener("click", function (e) {
      // The overlay sits inside the card's own link; a press must never also
      // open the video.
      e.preventDefault();
      e.stopPropagation();
      if (btn.getAttribute("data-state") === "saving") return;
      var name = filename(title, videoId);
      var urls = candidates(videoId, normalizeImgSrc(src));
      if (!name || !urls.length) return;
      onClick({ filename: name, urls: urls });
    });
    return btn;
  }

  function setState(btn, state) {
    if (!btn) return;
    if (!state) {
      btn.removeAttribute("data-state");
      btn.setAttribute("aria-label", HOVER_LABEL);
      btn.title = HOVER_LABEL;
      return;
    }
    btn.setAttribute("data-state", state);
    var text = STATE_LABEL[state] || HOVER_LABEL;
    btn.setAttribute("aria-label", text);
    btn.title = text;
  }

  g.NS_THUMB = {
    slugify: slugify,
    filename: filename,
    candidates: candidates,
    audioCaptionsIndex: audioCaptionsIndex,
    normalizeImgSrc: normalizeImgSrc,
    overlayButtons: overlayButtons,
    commonAncestor: commonAncestor,
    findAnchor: findAnchor,
    buildHoverButton: buildHoverButton,
    setState: setState,
    ICON: ICON,
    LABEL: HOVER_LABEL
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
