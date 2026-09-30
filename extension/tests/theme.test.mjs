// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * The design system has no test.
 *
 * The component CSS lived in four places: ns-theme.css, content.css, a NS_TOKENS
 * string and a NS_COMPONENTS string, all in content.js. The last two exist only
 * because a shadow root does not inherit the page's stylesheets, and they were
 * maintained by hand - so they drifted. The reading was 20px in one file and 19px
 * in the other, a strip value 13px against 12.5px, and one animation was called
 * ns-enter in a file and ns-open in the other. A whole visual language, the watch
 * card's, existed in only one of them.
 *
 * Nothing caught it, because nothing looked. These tests are that look: one
 * stylesheet owns every component, and a class used anywhere must resolve in it.
 */

const root = resolve(process.cwd(), "extension");
const read = (p) => readFileSync(resolve(root, p), "utf8");

const theme = read("ns-theme.css");
const positioning = read("content.css");
const stylesheet = theme + "\n" + positioning;

const SOURCES = ["content.js", "popup.js", "background.js", "lib/thumb.js", "lib/lineModel.js", "lib/tiles.js", "lib/nsMeta.js", "popup.html"];

const isOurs = (token) => token.startsWith("ns-");

/* A template literal makes half a class name - "ns-seg${timeCls}" is the
   fragment ns-seg plus an interpolated class. Only the literal part is a name
   this test can check. */
const isName = (token) => isOurs(token) && !/[${}]/.test(token);

/* Every class the extension actually asks for, from the three shapes it uses:
   a class attribute in a template string, a className assignment, and a
   classList call. Dynamic values are skipped rather than guessed at - the point
   is to catch the literal names that would otherwise go missing. */
function usedClasses() {
  const found = new Set();
  const patterns = [/class="([^"]*)"/g, /className\s*=\s*"([^"]*)"/g, /classList\.(?:add|remove|toggle)\(\s*"([^"]*)"/g];

  for (const file of SOURCES) {
    const source = read(file);
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        // "ns-line-row " + cls - take the literal half and leave the variable.
        const literal = match[1].split("+")[0];
        for (const token of literal.split(/\s+/)) {
          if (isName(token)) found.add(token);
        }
      }
    }
  }
  return found;
}

/* Class selectors a stylesheet defines. Keyframe names are excluded: they are
   not classes and matching them here would let a missing class pass. */
function definedClasses() {
  const found = new Set();
  for (const match of stylesheet.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) found.add(match[1]);
  return found;
}

describe("one stylesheet owns every component", () => {
  it("defines every class the extension asks for", () => {
    const used = usedClasses();
    const defined = definedClasses();
    const missing = [...used].filter((token) => !defined.has(token)).sort();

    expect(missing).toEqual([]);
    // Guards against the test passing because it found nothing to check.
    expect(used.size).toBeGreaterThan(25);
  });

  it("bounds every floating panel so it cannot run off the screen", () => {
    // The search and channel panels are fixed over YouTube's own layout. They
    // have a close button but no width and no height cap, so a long video grew
    // past the bottom of the viewport with nothing to scroll it back - which is
    // what made one of them look broken rather than merely plain. Any panel
    // that can reach the edge of the screen has to declare how wide it is and
    // where it stops.
    //
    // The selector is anchored to the class exactly, because .ns-host--inline
    // is a different thing entirely: the in-flow watch card, which is capped by
    // the list it sits in and must not carry a viewport height of its own. A
    // loose match would count it as a panel and demand a max-height it must not
    // have, so the rule names the floating host on its own.
    const panelRule = positioning.match(/(^|[\s,}])\.ns-host(?=[\s,{])[^{]*\{[^}]*\}/g) || [];
    expect(panelRule.length).toBeGreaterThan(0);

    const bounded = panelRule.every((rule) => /width\s*:/.test(rule) && /max-height\s*:/.test(rule));
    expect(bounded).toBe(true);

    // And it has to be scrollable, or a cap just hides the overflow.
    expect(positioning).toMatch(/overflow-y\s*:\s*auto/);
  });

  it("keeps the in-flow card out of the page's way and in the list", () => {
    // The watch card stopped being a panel and became a block inside the list
    // it describes. Three properties have to hold, and each one is a way the
    // change can quietly not have happened: a fixed or absolute card would
    // cover the first video while the space it reserved went somewhere else, a
    // z-index would say the card is above its own list rather than in it, and a
    // hardcoded width would make it the wrong size in a sidebar that is not the
    // one it was measured on.
    const inlineRule = positioning.match(/(^|[\s,}])\.ns-host--inline(?=[\s,{])[^{]*\{[^}]*\}/g) || [];
    expect(inlineRule.length).toBeGreaterThan(0);
    const rule = inlineRule.join("\n");

    expect(rule).toMatch(/position\s*:\s*static/);
    expect(rule).not.toMatch(/z-index/);
    expect(rule).not.toMatch(/position\s*:\s*(fixed|absolute|sticky)/);
    // Takes its width from the list rather than declaring one of its own.
    expect(rule).toMatch(/width\s*:\s*100%/);
    // And it must not keep the viewport cap the floating panels need.
    expect(rule).toMatch(/max-height\s*:\s*none/);

    // The floor belongs to the card, and the card is inside the shadow root, so
    // a rule in the page stylesheet would not reach it. It has to be declared
    // in the component stylesheet, addressed to the host, and built from the
    // pitch measured at mount time rather than a number written here.
    //
    // It is a floor and not a cap. A cap was the earlier reading - the card
    // holds the space of two videos and no more - and it was wrong: the
    // reference panel this is modelled on runs 800-1200px, and the user chose
    // that. So the card is never *smaller* than two videos at any width, and is
    // as tall as its content above that.
    const floor = theme.match(/:host\(\.ns-host--inline\)\s*\.ns-card\s*\{[^}]*\}/) || [];
    expect(floor.length).toBe(1);
    expect(floor[0]).toMatch(/min-height\s*:\s*calc\(var\(--ns-tile-pitch[^)]*\)\s*\*\s*2\)/);

    // Folding is a real state, not the absence of a rule, so it has to be
    // declared. A folded card keeps its header - that is what the reader
    // unfolds it with - and drops the body, and stops holding the floor it was
    // holding, or a card folded to nothing would still push two videos down.
    const folded = theme.match(/:host\(\.ns-host--inline\[data-ns-open="0"\]\)\s*\.ns-card\s*\{[^}]*\}/) || [];
    expect(folded.length).toBe(1);
    expect(folded[0]).toMatch(/min-height\s*:\s*0/);

    const foldedBody = theme.match(/:host\(\.ns-host--inline\[data-ns-open="0"\]\)\s*\.ns-body\s*\{[^}]*\}/) || [];
    expect(foldedBody.length).toBe(1);
    // Hidden, not just short: display:none is what takes it out of the flow so
    // the header is all that is left standing.
    expect(foldedBody[0]).toMatch(/display\s*:\s*none/);
  });

  it("puts the three headline numbers side by side, not in a column of strips", () => {
    // This is the reason the card looked borrowed rather than designed. Every
    // reading was its own full-width row - views, velocity, trend, likes, channel
    // average, outlier, posted, channel - so eight numbers that are all the same
    // weight arrived as a scroll of eight. The panel this is modelled on puts the
    // three numbers a reader is actually looking for in one row of equal columns,
    // label above value, and leaves the rest to a compact two-column list.
    //
    // Three columns is the whole contract, and it has to be `repeat(3, ...)`: two
    // or four would still be a layout, but not this one, and nothing else on the
    // card would notice the difference.
    const stats = theme.match(/\.ns-stats\s*\{[^}]*\}/g) || [];
    expect(stats.length).toBe(1);
    expect(stats[0]).toMatch(/display\s*:\s*grid/);
    expect(stats[0]).toMatch(/grid-template-columns\s*:\s*repeat\(3\s*,\s*1fr\)/);

    // Label over value, centred, or it is three rows of one thing again.
    const stat = theme.match(/\.ns-stat\s*\{[^}]*\}/g) || [];
    expect(stat.length).toBe(1);
    expect(stat[0]).toMatch(/flex-direction\s*:\s*column/);
    expect(stat[0]).toMatch(/align-items\s*:\s*center/);

    // Three columns of numbers sit next to each other, and numbers that do not
    // share a digit width visibly jitter as they animate. Tabular figures are
    // the fix and the card already used them one level down.
    expect(stats[0] + stat[0]).toMatch(/font-variant-numeric\s*:\s*tabular-nums/);

    // The rest of the readings become a two-column list, which is what halves the
    // card's height. `auto-fit` rather than a fixed two, so a narrow sidebar
    // drops to one column instead of squeezing six values into a phone-width row.
    const strips = theme.match(/\.ns-strips\s*\{[^}]*\}/g) || [];
    expect(strips.length).toBe(1);
    expect(strips[0]).toMatch(/display\s*:\s*grid/);
    expect(strips[0]).toMatch(/grid-template-columns\s*:\s*repeat\(auto-fit\s*,\s*minmax\(/);
  });

  it("makes the chart's number the largest thing on the card, under a small label", () => {
    // The reference panel leads its chart with a number far larger than anything
    // else on screen and a small label under it. Ours led with two equal-weight
    // lines - "12,345 views" beside "+1,234 over 30 days" - which is the shape
    // of a file listing rather than the top of a panel.
    //
    // The load-bearing part is the ordering: label smaller than value. Swapping
    // them is not a typo, it produces a layout that still looks deliberate and
    // still renders, so nothing else in this file would notice. A number that has
    // quietly dropped to the same size as its label is the whole reason this
    // comparison is written down.
    const num = theme.match(/\.ns-chart-num\s*\{[^}]*\}/g) || [];
    const lab = theme.match(/\.ns-chart-lab\s*\{[^}]*\}/g) || [];
    expect(num.length).toBe(1);
    expect(lab.length).toBe(1);

    const size = (rule, prop) => {
      const found = rule[0].match(new RegExp(`${prop}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`));
      return found ? Number(found[1]) : 0;
    };

    const value = size(num, "font-size");
    const label = size(lab, "font-size");
    expect(value, "the chart number must declare a px font-size").toBeGreaterThan(0);
    expect(label, "the chart label must declare a px font-size").toBeGreaterThan(0);
    expect(value).toBeGreaterThanOrEqual(22);
    expect(label).toBeLessThan(value);

    // Both are numbers changing in place, so both get fixed-width digits.
    expect(num[0]).toMatch(/font-variant-numeric\s*:\s*tabular-nums/);

    // An area chart, not a bare line. A one-pixel stroke on a flat background
    // reads as a sparkline in a spreadsheet; the reference fills the area under
    // the line with a gradient, which is most of why it reads as a chart.
    //
    // The gradient's stops are styled here and only its geometry is built in the
    // script. An SVG gradient needs the element in the markup, but its colours
    // are styling like any other, and a stop-colour written into a template
    // string is the same hand-maintained copy this file was written to end -
    // one that would drift from a theme change without anything noticing.
    expect(theme).toMatch(/\.ns-chart-fill\b/);
    const stops = theme.match(/\.ns-chart-stop-\d\s*\{[^}]*\}/g) || [];
    expect(stops.length).toBeGreaterThanOrEqual(2);
    for (const stop of stops) expect(stop).toMatch(/stop-color\s*:\s*var\(--ns-/);
    // And it has to fade, or it is a flat block with a line on it.
    expect(stops.some((s) => /stop-opacity\s*:\s*0(\.0+)?\s*;/.test(s))).toBe(true);

    // The honesty note, when the range is not the whole of what it claims.
    expect(theme).toMatch(/\.ns-chart-note\b/);
  });

  it("does not keep a hand-maintained copy of the component CSS in JavaScript", () => {
    // A stylesheet copied into a string is the thing that drifted, and the tell
    // for it is a custom-property reference in a script: `var(--ns-…)` is CSS
    // and has no reason to appear in JavaScript. The shadow roots must read the
    // real file, so this count has to reach zero.
    const offenders = SOURCES.filter((f) => f.endsWith(".js"))
      .map((file) => ({ file, refs: (read(file).match(/var\(--ns-/g) || []).length }))
      .filter((entry) => entry.refs > 0);

    expect(offenders).toEqual([]);
  });
});

describe("the two themes stay in step", () => {
  const tokensIn = (block) => new Set([...block.matchAll(/(--ns-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

  it("define the same set of tokens in dark and light", () => {
    const dark = tokensIn(tokenBlock("[data-ns-theme]"));
    const light = tokensIn(tokenBlock('[data-ns-theme="light"]'));

    expect(dark.size).toBeGreaterThan(10);
    // Light is an override, not a redefinition: it re-states the colours and
    // inherits fonts, weights, radius and motion from the dark block. So the
    // rule is one-directional - a light-only token would be one nothing defines.
    expect([...light].filter((token) => !dark.has(token))).toEqual([]);
  });
});

/*
 * CONSTRAINTS.md sets a 4.5:1 floor for body and reading text on any glass
 * surface, and named `npm run check:contrast` as the command that enforces it.
 * That script did not exist. Nothing read the number, so the floor was a
 * sentence in a document rather than a rule about the code - and it had already
 * failed three times over before this file noticed: the stat row's amber and
 * cyan measured 4.23:1 and 4.19:1 in light, and its error red 4.13:1 in dark,
 * all of them on a filled cell this test now forbids.
 *
 * The colours are read out of the stylesheet rather than copied here. A copy is
 * the same mistake as the NS_TOKENS string this file exists to prevent: it goes
 * stale the moment someone nudges a hex, and a stale contrast test is worse than
 * none, because it reports a passing grade for a colour nobody ships any more.
 *
 * The pairing under test is foreground against --ns-glass-solid, the card's
 * opaque equivalent, because that is the surface the card's text actually sits
 * on. Measuring an accent against a page that is not ours is how a token ends up
 * tuned to something that is not the thing it is used on.
 */

/* The token declarations for one theme, lifted out of the stylesheet. Module
   scope rather than inside a describe, because the contrast tests below need to
   read the same two blocks and a block scoped to one describe is not visible
   from another. */
const tokenBlock = (selector) => {
  const at = theme.indexOf(selector + " {");
  if (at === -1) return "";
  const from = theme.indexOf("{", at);
  const to = theme.indexOf("\n}", from);
  return theme.slice(from, to);
};

const srgbToLinear = (channel) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const luminance = (hex) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => srgbToLinear(parseInt(full.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const readTokens = (selector) => {
  const block = tokenBlock(selector);
  const tokens = {};
  for (const [, name, value] of block.matchAll(/(--ns-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g)) {
    tokens[name] = value;
  }
  return tokens;
};

/* Everything the card paints as text, against the card. The tightest of these
 * is --ns-mute at 11px, and it is the one to watch: it is the secondary label
 * colour for the whole card, so a small drift in it degrades a dozen readings
 * at once and nothing else fails. */
const TEXT_ON_CARD = [
  ["--ns-ink", "card values, headings, chart ink"],
  ["--ns-mute", "every secondary label, 11px - the tightest pairing on the card"],
  ["--ns-cyan", "time values, the fold control, the focus ring"],
  ["--ns-amber", "hot readings: an outlier, a video still moving"],
  ["--ns-bad", "failures only, never an absent number"],
];

describe("every colour the card paints as text clears the contrast floor", () => {
  const themes = { dark: readTokens("[data-ns-theme]"), light: readTokens('[data-ns-theme="light"]') };
  const FLOOR = 4.5;

  for (const [name, tokens] of Object.entries(themes)) {
    it(`${name}: text on the card is at least ${FLOOR}:1`, () => {
      const surface = tokens["--ns-glass-solid"];
      expect(surface, `${name} needs --ns-glass-solid to measure against`).toBeTruthy();

      const failures = [];
      for (const [token, role] of TEXT_ON_CARD) {
        const value = tokens[token];
        expect(value, `${name} is missing ${token}`).toBeTruthy();
        const ratio = contrast(value, surface);
        if (ratio < FLOOR) failures.push(`${token} (${role}) = ${ratio.toFixed(2)}:1`);
      }

      // Every failure in one message, rather than the first one and a rerun.
      expect(failures, failures.join("\n")).toEqual([]);
    });
  }
});
