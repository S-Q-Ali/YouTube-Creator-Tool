/*
 * Shared formatters for the two surfaces that print our numbers: the strip
 * under a grid card and the card on a watch page. One place to spell a figure
 * is what stops the same number being written two ways on one screen.
 *
 * Loaded before content.js as a classic content script (content scripts are not
 * modules, so it publishes itself on globalThis) and driven in tests by
 * extension/tests/nsMeta.test.mjs.
 */
(function (g) {
  function compact(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }

  function fmtVph(vph) {
    if (vph == null || !isFinite(vph)) return "";
    return compact(vph) + "/hr";
  }

  /* Exact counts use the same grouped digits the watch card prints, so a card
     and its detail panel never spell the same number two ways. */
  function fmtExact(n) {
    if (n == null || !isFinite(n)) return "";
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function fmtSubs(subs) {
    if (subs == null || !isFinite(subs) || !(subs > 0)) return "";
    return compact(subs).replace(/\.0(?=[KMB]$)/, "");
  }

  function outlierTone(percent) {
    if (percent == null || !isFinite(percent)) return "normal";
    if (percent >= 200) return "hot";
    if (percent < 80) return "cool";
    return "normal";
  }

  /* On a card the outlier has no room for a sentence, so it reads as the score
     it is: one factor, one decimal, with the explanation left to the title. */
  function fmtOutlierScore(percent) {
    if (percent == null || !isFinite(percent) || !(percent > 0)) return "";
    return (percent / 100).toFixed(1) + "×";
  }

  function outlierHint(percent) {
    if (percent == null || !isFinite(percent) || !(percent > 0)) return "";
    if (percent >= 80 && percent < 125) return "Typical for this channel";
    return fmtOutlierScore(percent) + " what this channel usually gets";
  }

  g.NS_META = {
    compact,
    fmtVph,
    fmtExact,
    fmtDate,
    fmtSubs,
    outlierTone,
    fmtOutlierScore,
    outlierHint
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
