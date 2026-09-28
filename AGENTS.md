<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Niche-Scope

Read `CONSTRAINTS.md` before changing anything in `extension/`. It holds the
thresholds this extension is held to and names the command that checks each one.
It is not a document to be relaxed to make a diff pass - if a number genuinely
has to move, it moves in that file, in the same commit, with the reason.

Two things there will bite anyone new:

- `extension/ns-theme.css` is the only place component CSS is written. No script
  may contain a `var(--ns-…)` reference; that is the signature of a hand-copied
  stylesheet, and hand-copied stylesheets drift.
- The plan for the glass restyle is `tasks/glass-plan.md`. `tasks/plan.md` is a
  different, older plan and is not overwritten.
