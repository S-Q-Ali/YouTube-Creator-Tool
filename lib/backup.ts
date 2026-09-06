import { all, run } from "./db";

export const BACKUP_TABLES = [
  "settings",
  "keywords",
  "keyword_snapshots",
  "channels",
  "channel_snapshots",
  "videos",
  "video_snapshots",
  "tracked_items",
  "rankings",
] as const;

export interface BackupFile {
  format: "niche-scope-backup";
  version: 1;
  exportedAt: number;
  tables: Record<string, Record<string, unknown>[]>;
}

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

function tableColumns(table: string): string[] {
  return all<{ name: string }>(`PRAGMA table_info(${table})`).map((c) => c.name);
}

/** Dump every table into a single portable JSON structure. */
export function exportAll(): BackupFile {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of BACKUP_TABLES) {
    tables[table] = all<Record<string, unknown>>(`SELECT * FROM ${table}`);
  }
  return {
    format: "niche-scope-backup",
    version: 1,
    exportedAt: Date.now(),
    tables,
  };
}

function sanitizeCell(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function validate(backup: unknown): BackupFile {
  const b = backup as BackupFile;
  if (!b || typeof b !== "object") throw new Error("Not a backup file");
  if (b.format !== "niche-scope-backup") throw new Error("Unrecognized backup format");
  if (b.version !== 1) throw new Error(`Unsupported backup version: ${b.version}`);
  if (!b.tables || typeof b.tables !== "object") throw new Error("Backup has no tables");
  return b;
}

/** Wipe and restore all data from a validated backup. Returns table/row counts. */
export function importAll(backup: unknown): { tables: number; rows: number } {
  const b = validate(backup);
  const columns = new Map<string, Set<string>>();
  for (const table of BACKUP_TABLES) columns.set(table, new Set(tableColumns(table)));

  run("BEGIN");
  try {
    for (const table of BACKUP_TABLES) {
      run(`DELETE FROM ${table}`);
    }

    let rows = 0;
    for (const table of BACKUP_TABLES) {
      const allowed = columns.get(table)!;
      const sourceRows = Array.isArray(b.tables[table]) ? b.tables[table] : [];
      for (const row of sourceRows) {
        if (!row || typeof row !== "object") continue;
        const clean: Record<string, string | number | null> = {};
        for (const [key, value] of Object.entries(row)) {
          if (allowed.has(key)) clean[key] = sanitizeCell(value);
        }
        const keys = Object.keys(clean);
        if (keys.length === 0) continue;
        const sql = `INSERT INTO ${table} (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys
          .map((k) => `$${k}`)
          .join(", ")})`;
        run(sql, clean);
        rows++;
      }
    }

    run("COMMIT");
    return { tables: BACKUP_TABLES.length, rows };
  } catch (err) {
    try {
      run("ROLLBACK");
    } catch {
      // no-op
    }
    throw new Error(
      `Import failed: ${err instanceof Error ? err.message : "unknown error"} — no changes applied`
    );
  }
}

export function validateBackupSize(raw: string): void {
  if (Buffer.byteLength(raw, "utf8") > MAX_IMPORT_BYTES) {
    throw new Error("Backup file is too large to import");
  }
}
