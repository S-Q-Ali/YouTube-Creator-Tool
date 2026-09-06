import { useCallback, useSyncExternalStore } from "react";
import type { Dispatch, SetStateAction } from "react";

export const LS_PREFIX = "ns:";

// Parsed-value cache so getSnapshot() returns a stable reference when the raw
// localStorage value hasn't changed (required by useSyncExternalStore).
const cache = new Map<string, { raw: string; value: unknown }>();
const listeners = new Set<() => void>();

function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readStored<T>(key: string): T | null {
  const fullKey = LS_PREFIX + key;
  const raw = readRaw(fullKey);
  if (raw == null) return null;
  const hit = cache.get(fullKey);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T;
  try {
    value = JSON.parse(raw) as T;
  } catch {
    return null;
  }
  cache.set(fullKey, { raw, value });
  return value;
}

function writeStored<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  const fullKey = LS_PREFIX + key;
  try {
    const raw = JSON.stringify(value);
    window.localStorage.setItem(fullKey, raw);
    cache.set(fullKey, { raw, value });
  } catch {
    // storage full / disabled — non-fatal, UI state is best-effort
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = () => {
    cache.clear();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Hydration-safe, reactive read of a localStorage value (mirrors in other tabs too). */
export function useLocalStorageValue<T>(key: string, initial: T): T {
  const getSnapshot = useCallback(() => readStored<T>(key) ?? initial, [key, initial]);
  const getServerSnapshot = useCallback(() => initial, [initial]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * useState that persists to localStorage. Server and client render the same
 * initial value; the stored value takes over immediately after hydration.
 */
export function useLocalStorageState<T>(
  key: string,
  initial: T
): [T, Dispatch<SetStateAction<T>>] {
  const value = useLocalStorageValue(key, initial);
  const setValue = useCallback(
    (action: SetStateAction<T>) => {
      const current = readStored<T>(key) ?? initial;
      const next = typeof action === "function" ? (action as (prev: T) => T)(current) : action;
      writeStored(key, next);
    },
    [key, initial]
  );
  return [value, setValue];
}
