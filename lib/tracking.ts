import { all, get, now, run } from "./db";
import type { TrackedItem } from "./types";

export function addTracked(kind: TrackedItem["kind"], refId: string, label?: string) {
  run(
    `INSERT OR IGNORE INTO tracked_items (kind, ref_id, label, added_at)
     VALUES ($kind, $ref_id, $label, $added_at)`,
    { kind, ref_id: refId, label: label ?? null, added_at: now() }
  );
}

export function removeTracked(kind: TrackedItem["kind"], refId: string) {
  run("DELETE FROM tracked_items WHERE kind = $kind AND ref_id = $ref_id", { kind, ref_id: refId });
}

export function isTracked(kind: TrackedItem["kind"], refId: string): boolean {
  return Boolean(get("SELECT 1 FROM tracked_items WHERE kind = $kind AND ref_id = $ref_id", { kind, ref_id: refId }));
}

export function listTracked(kind?: TrackedItem["kind"]): TrackedItem[] {
  if (kind) {
    return all<TrackedItem>(
      "SELECT kind, ref_id AS refId, label, added_at AS addedAt FROM tracked_items WHERE kind = $kind ORDER BY added_at DESC",
      { kind }
    );
  }
  return all<TrackedItem>("SELECT kind, ref_id AS refId, label, added_at AS addedAt FROM tracked_items ORDER BY added_at DESC");
}
