import { createHash } from "node:crypto";
import { get, run } from "./db";

const TTL_MS = 24 * 60 * 60 * 1000;

export function hashInputs(action: string, inputs: string): string {
  return createHash("sha256").update(`${action}\u0000${inputs}`).digest("hex");
}

/** Return cached AI result JSON for a key, or null when stale/absent. */
export function getAiCache(action: string, inputs: string): string | null {
  const row = get<{ result_json: string; created_at: number }>(
    "SELECT result_json, created_at FROM ai_cache WHERE action = $action AND inputs_hash = $hash",
    { $action: action, $hash: hashInputs(action, inputs) }
  );
  if (!row) return null;
  if (Date.now() - row.created_at > TTL_MS) return null;
  return row.result_json;
}

export function setAiCache(action: string, inputs: string, resultJson: string): void {
  run(
    `INSERT INTO ai_cache (action, inputs_hash, result_json, created_at)
     VALUES ($action, $hash, $json, $now)
     ON CONFLICT(inputs_hash) DO UPDATE SET
       action = $action, result_json = $json, created_at = $now`,
    {
      $action: action,
      $hash: hashInputs(action, inputs),
      $json: resultJson,
      $now: Date.now(),
    }
  );
}