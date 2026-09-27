(function (g) {
  "use strict";

  /*
   * What a grid line says, decided without touching the DOM so the wording can
   * be tested: the context row holds the readings YouTube's own card cannot
   * show (exact views, the real publish date, subscribers), and the judgment
   * row holds what they mean (velocity, and how far this video sits from what
   * its channel usually gets).
   */

  function push(cells, value, className) {
    if (value === "" || value == null) return;
    cells.push([value, className]);
  }

  function build(options) {
    const opts = options || {};
    const mode = opts.mode;
    const facts = opts.facts || {};
    const model = opts.model || {};
    const meta = g.NS_META;

    const judge = [];
    const ctx = [];

    if (mode === "off") {
      return { ctx, judge, showDur: false, blank: true };
    }

    const vph = model.vph == null ? meta.velocity(facts).vph : model.vph;
    push(judge, meta.fmtVph(vph), model.spike ? "ns-line-vel ns-line-vel--spike" : "ns-line-vel");
    if (model.outlier != null) {
      push(judge, meta.fmtOutlier(model.outlier), "ns-line-out ns-line-out--" + meta.outlierTone(model.outlier));
    }

    if (mode === "full") {
      const views = model.views != null ? meta.fmtExact(model.views) : facts.views != null ? meta.compact(facts.views) : null;
      if (views != null) ctx.push([views + " views", "ns-line-v"]);
      push(ctx, model.publishedAt ? meta.fmtDate(model.publishedAt) : facts.ageLabel, "ns-line-date");
      const subs = meta.fmtSubs(model.subscribers);
      if (subs) ctx.push([subs + " subs", "ns-line-subs"]);
    }

    // The runtime is only ours to print when the thumbnail badge left that
    // space empty, and it rides with the fuller of the two densities.
    const showDur = !!(model.durationSeconds && !opts.hasDurationBadge && mode === "full");
    if (showDur) ctx.push([meta.fmtDur(model.durationSeconds), "ns-line-v ns-line-dur"]);

    return { ctx, judge, showDur, blank: ctx.length === 0 && judge.length === 0 };
  }

  g.NS_LINE_MODEL = { build };
})(typeof globalThis !== "undefined" ? globalThis : window);
