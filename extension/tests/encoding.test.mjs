// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Every file the browser parses is UTF-8, and nothing here was checking.
 *
 * A PowerShell 5.1 `Set-Content` with no -Encoding writes Windows-1252, which
 * looks like a no-op until a file contains an em dash. Then three UTF-8 bytes
 * become one, the file stops being valid UTF-8, and the only symptom is a
 * browser that refuses the whole extension: "Could not load manifest." Not a
 * failing test, not a stack trace - the extension simply does not load, and the
 * cost of finding that out is a manual reload after every unrelated change.
 *
 * The em dash is not a rare character here. These files lean on it, so any tool
 * that writes them without saying what it writes will break them eventually, and
 * it will look like the browser's fault.
 *
 * The check is on the bytes, not on the text, because a Windows-1252 file
 * containing only ASCII decodes as valid UTF-8 and passes a naive read - which
 * is why the corruption here went unnoticed until a non-ASCII character was
 * nearby to expose it.
 */

const root = resolve(process.cwd(), "extension");

/* Everything Chrome parses or injects. A file in this list with the wrong
 * encoding takes the whole extension down, not just itself - a content script
 * that will not load takes its manifest entry with it. Directories that are not
 * part of the extension are skipped, and so is anything not on the list. */
const LOADED = new Set([".js", ".mjs", ".json", ".css", ".html", ".html.css"]);

function loadedFiles() {
  const found = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (LOADED.has(extname(name))) found.push(full);
    }
  };
  walk(root);
  return found.sort();
}

describe("every file the browser parses is valid UTF-8", () => {
  const files = loadedFiles();

  it("finds the files it is meant to be checking", () => {
    // Guards against a passing run that walked nothing - a wrong root, or a
    // pattern that stopped matching - which is the same silent pass as no test.
    expect(files.length).toBeGreaterThan(8);
    expect(files.some((f) => f.endsWith("content.js"))).toBe(true);
    expect(files.some((f) => f.endsWith("manifest.json"))).toBe(true);
  });

  it("rejects nothing, because a non-UTF-8 file is a dead extension", () => {
    const broken = [];

    for (const file of files) {
      const bytes = readFileSync(file);
      try {
        // fatal: without it, malformed bytes decode to U+FFFD and pass.
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        broken.push(relative(root, file).split("\\").join("/"));
      }
    }

    // All of them at once, so one run names every file that needs re-encoding.
    expect(broken, `not UTF-8: ${broken.join(", ")}`).toEqual([]);
  });

  it("keeps the typographic characters intact rather than mangled", () => {
    // The specific characters that Windows-1252 can represent but UTF-8 spells
    // with more bytes - the em dash is the one that bit. Held as code points
    // rather than written out, because a test that spells the strings it is
    // hunting for contains every one of them, and a test that fails on its own
    // source is a test that gets deleted rather than fixed. Excluding this file
    // from the scan instead would leave the list readable and the trap in place.
    const MOJIBAKE = [
      [0x00e2, 0x20ac, 0x201d], // em dash, read as windows-1252
      [0x00e2, 0x20ac, 0x00a6], // ellipsis
      [0x00c3, 0x00b7], // middle dot
      [0x00c3, 0x2014], // multiplication sign
      [0x00ef, 0x00bf, 0x00bd], // replacement character
    ].map((points) => String.fromCodePoint(...points));

    const offenders = [];

    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const hit = MOJIBAKE.filter((m) => text.includes(m));
      if (hit.length) offenders.push(`${relative(root, file)}: ${hit.join(", ")}`);
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
