(function (g) {
  "use strict";

  /*
   * What a card's strip says, decided without touching the DOM so the wording
   * can be tested. YouTube's own card row already prints the channel, the
   * rounded view count and how old the video is, so the strip repeats none of
   * it: it carries only the readings a card cannot show — how big the channel
   * is, how fast the video is moving, and how far it sits from what that
   * channel usually gets. It waits for the server instead of estimating, so a
   * number here is never one that has to be corrected a moment later.
   */

  function push(cells, value, className, title) {
    if (value === "" || value == null) return;
    cells.push([value, className, title]);
  }

  function build(options) {
    const opts = options || {};
    const model = opts.model || {};
    const meta = g.NS_META;

    const subs = [];
    const judge = [];

    if (opts.mode === "off") return { ctx: subs, judge, blank: true };

    const subscribers = meta.fmtSubs(model.subscribers);
    if (subscribers) push(subs, subscribers + " subs", "ns-line-subs", "Channel subscribers");

    if (model.vph != null) {
      push(
        judge,
        meta.fmtVph(model.vph),
        model.spike ? "ns-line-vel ns-line-vel--spike" : "ns-line-vel",
        "Views per hour since publish"
      );
    }

    if (model.outlier != null) {
      push(
        judge,
        meta.fmtOutlierScore(model.outlier),
        "ns-line-out ns-line-out--" + meta.outlierTone(model.outlier),
        meta.outlierHint(model.outlier)
      );
    }

    return { ctx: subs, judge, blank: subs.length === 0 && judge.length === 0 };
  }

  g.NS_LINE_MODEL = { build };
})(typeof globalThis !== "undefined" ? globalThis : window);
