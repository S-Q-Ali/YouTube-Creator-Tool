import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let dir: string;
let db: typeof import("../db");
let backup: typeof import("../backup");

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "niche-backup-"));
  process.env.DATABASE_DIR = dir;
  db = await import("../db");
  backup = await import("../backup");
});

afterAll(() => {
  db.closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("backup", () => {
  it("round-trips data through exportAll → importAll", () => {
    db.run(
      "INSERT INTO keywords (term, display_term, score, demand_score, competition_score, competition_label, source, first_seen, last_checked) VALUES ($t, $d, 70, 80, 30, 'Low', 'autocomplete', 1, 1)",
      { t: "roundtrip", d: "Round Trip" }
    );
    db.run(
      "INSERT INTO tracked_items (kind, ref_id, label, added_at) VALUES ('video', 'v1', 'V', 42)",
      {}
    );

    const dump = backup.exportAll();
    expect(dump.format).toBe("niche-scope-backup");
    expect(dump.tables.keywords).toHaveLength(1);

    db.run("DELETE FROM keywords", {});
    db.run("DELETE FROM tracked_items", {});
    expect(db.all("SELECT * FROM keywords")).toHaveLength(0);

    const result = backup.importAll(dump);
    expect(result.rows).toBeGreaterThanOrEqual(2);

    const restored = db.get<{ term: string; score: number }>(
      "SELECT term, score FROM keywords WHERE term = $t",
      { t: "roundtrip" }
    );
    expect(restored?.term).toBe("roundtrip");
    expect(restored?.score).toBe(70);
    expect(db.all("SELECT * FROM tracked_items WHERE ref_id = 'v1'")).toHaveLength(1);
  });

  it("rejects invalid payloads before touching the database", () => {
    db.run(
      "INSERT INTO keywords (term, display_term, score, demand_score, competition_score, competition_label, source, first_seen, last_checked) VALUES ($t, $d, 1, 1, 1, 'Low', 'x', 1, 1)",
      { t: "keepme", d: "Keep Me" }
    );

    expect(() => backup.importAll({ format: "nope" })).toThrow();
    expect(() => backup.importAll(null)).toThrow();
    expect(() => backup.importAll("just a string")).toThrow();
    expect(db.get("SELECT 1 FROM keywords WHERE term = 'keepme'")).toBeDefined();
  });

  it("restoring a valid (even empty) backup replaces existing data", () => {
    const result = backup.importAll({
      format: "niche-scope-backup",
      version: 1,
      exportedAt: Date.now(),
      tables: {},
    });
    expect(result.rows).toBe(0);
    expect(db.all("SELECT * FROM keywords")).toHaveLength(0);
  });
});
