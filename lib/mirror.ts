/**
 * Bounded "mirror" of app data into localStorage — a best-effort cache so the
 * client keeps a last-known snapshot even when the server is briefly down.
 * SQLite remains the source of truth; this is cache only.
 */
export const MIRROR_PREFIX = "ns:mirror:";
const MAX_ENTRY_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;

export function writeMirror<T>(kind: string, data: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = MIRROR_PREFIX + kind;
    const raw = JSON.stringify(data);
    if (raw.length > MAX_ENTRY_BYTES) return false;
    window.localStorage.setItem(key, raw);
    pruneMirror(key);
    return true;
  } catch {
    return false;
  }
}

export function readMirror<T>(kind: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const key = MIRROR_PREFIX + kind;
    const raw = window.localStorage.getItem(key);
    if (!raw || raw.length > MAX_ENTRY_BYTES) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearMirror(kind?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (kind) {
      window.localStorage.removeItem(MIRROR_PREFIX + kind);
      return;
    }
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(MIRROR_PREFIX)) keys.push(k);
    }
    for (const k of keys) window.localStorage.removeItem(k);
  } catch {
    // no-op
  }
}

/** Evict mirror entries (oldest-added first) until total mirror usage fits the cap. */
function pruneMirror(except?: string): void {
  try {
    const entries: { key: string; size: number; order: number }[] = [];
    let total = 0;
    let order = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(MIRROR_PREFIX)) continue;
      const v = window.localStorage.getItem(k) ?? "";
      entries.push({ key: k, size: k.length + v.length, order: order++ });
      total += k.length + v.length;
    }
    entries.sort((a, b) => a.order - b.order);
    for (const e of entries) {
      if (total <= MAX_TOTAL_BYTES) break;
      if (e.key === except) continue;
      window.localStorage.removeItem(e.key);
      total -= e.size;
    }
  } catch {
    // no-op
  }
}
