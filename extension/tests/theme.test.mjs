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
  const tokenBlock = (selector) => {
    const at = theme.indexOf(selector + " {");
    if (at === -1) return "";
    const from = theme.indexOf("{", at);
    const to = theme.indexOf("\n}", from);
    return theme.slice(from, to);
  };
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
