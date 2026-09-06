/**
 * Backup / restore the SQLite data from the command line.
 *
 *   npm run backup                          -> writes backups/niche-scope-<ts>.json
 *   npm run restore-backup -- <file.json>   -> wipes and restores from <file.json>
 */
import fs from "node:fs";
import path from "node:path";
import { exportAll, importAll, validateBackupSize } from "../lib/backup";

const root = path.resolve(__dirname, "..");

function stamp(): string {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function doBackup() {
  const backup = exportAll();
  const outDir = path.join(root, "backups");
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `niche-scope-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2), "utf8");
  const rows = Object.values(backup.tables).reduce((sum, r) => sum + r.length, 0);
  console.log(`Backed up ${rows} rows across ${Object.keys(backup.tables).length} tables.`);
  console.log(`Saved to ${file}`);
}

function doRestore(file: string) {
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exitCode = 1;
    return;
  }
  const raw = fs.readFileSync(file, "utf8");
  validateBackupSize(raw);
  const backup = JSON.parse(raw);
  const result = importAll(backup);
  console.log(`Restored ${result.rows} rows across ${result.tables} tables.`);
}

const command = process.argv[2];
const file = process.argv[3];

if (command === "backup") {
  doBackup();
} else if (command === "restore") {
  if (!file) {
    console.error("Usage: npm run restore-backup -- <file.json>");
    process.exitCode = 1;
  } else {
    doRestore(file);
  }
} else {
  console.error("Usage: npm run backup | npm run restore-backup -- <file.json>");
  process.exitCode = 1;
}
