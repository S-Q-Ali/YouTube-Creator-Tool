import { config } from "./config";

export class AutocompleteError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "AutocompleteError";
  }
}

export interface SuggestOptions {
  hl?: string;
  gl?: string;
  retries?: number;
}

/**
 * Keyless YouTube autocomplete. Suggests come straight from YouTube's search logs,
 * ordered by relative popularity. No API key, no quota cost.
 * Endpoint is undocumented — treat as best-effort with retry + fallback.
 */
export async function fetchSuggestions(query: string, opts: SuggestOptions = {}): Promise<string[]> {
  const hl = opts.hl ?? "en";
  const gl = opts.gl ?? "us";
  const retries = opts.retries ?? 3;
  const url = new URL(config.autocompleteBaseUrl);
  url.searchParams.set("client", "firefox");
  url.searchParams.set("ds", "yt");
  url.searchParams.set("hl", hl);
  url.searchParams.set("gl", gl);
  url.searchParams.set("q", query);

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" },
        signal: AbortSignal.timeout(config.autocompleteTimeoutMs),
      });
      if (res.status === 502 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
        continue;
      }
      if (!res.ok) {
        throw new AutocompleteError(`Autocomplete request failed with status ${res.status}`, res.status);
      }
      const text = await res.text();
      const parsed = JSON.parse(text) as unknown[];
      const suggestions = Array.isArray(parsed[1]) ? (parsed[1] as unknown[]) : [];
      return suggestions.filter((s): s is string => typeof s === "string");
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
  }
  if (lastErr instanceof AutocompleteError) throw lastErr;
  throw new AutocompleteError("Autocomplete endpoint unreachable");
}

/** Expand a seed by appending a-z / 0-9 prefixes and question words. */
export const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));
export const DIGITS = Array.from({ length: 10 }, (_, i) => String(i));
export const QUESTION_WORDS = ["what", "how", "why", "who", "when", "where", "vs"];

export async function expandSeed(
  seed: string,
  opts: SuggestOptions = {}
): Promise<string[]> {
  const results = new Map<string, string>();
  const add = (s: string) => {
    const key = s.toLowerCase().replace(/\s+/g, " ").trim();
    if (key) results.set(key, s);
  };

  const direct = await fetchSuggestions(seed, opts);
  direct.forEach(add);

  for (const prefix of [...ALPHABET, ...DIGITS]) {
    const resp = await fetchSuggestions(`${seed} ${prefix}`, opts);
    resp.forEach(add);
  }
  for (const qw of QUESTION_WORDS) {
    const resp = await fetchSuggestions(`${qw} ${seed}`, opts);
    resp.forEach(add);
  }
  return [...results.values()];
}
