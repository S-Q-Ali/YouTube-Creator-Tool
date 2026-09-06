import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

export interface YtdlpItem {
  videoId: string;
  title: string;
  channelTitle?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  channelId?: string;
  durationSeconds?: number;
}

export interface YtdlpSearchResult {
  items: YtdlpItem[];
}

const projectRoot = process.cwd();
const timeoutMs = 45_000;

const binName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";

/** Pure parser for yt-dlp `--dump-json` stdout (one JSON object per line). */
export function parseYtdlpLines(stdout: string): YtdlpItem[] {
  const items: YtdlpItem[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (typeof entry.id !== "string" || !entry.id) continue;
    items.push({
      videoId: entry.id,
      title: typeof entry.title === "string" ? entry.title : "",
      channelTitle: typeof entry.channel === "string" ? entry.channel : undefined,
      publishedAt: typeof entry.upload_date === "string" ? entry.upload_date : undefined,
      thumbnailUrl: typeof entry.thumbnail === "string" ? entry.thumbnail : undefined,
      channelId: typeof entry.channel_id === "string" ? entry.channel_id : undefined,
      durationSeconds: typeof entry.duration === "number" ? entry.duration : undefined,
    });
  }
  return items;
}

/** Where to find the yt-dlp binary: env override → tools/ → PATH. */
export function resolveYtdlpPath(): string | null {
  if (config.ytdlpPath) return config.ytdlpPath;
  const exe = path.join(projectRoot, "tools", binName);
  if (fs.existsSync(exe)) return exe;
  return "yt-dlp"; // fall back to PATH; spawn errors are handled by the caller
}

function execFileAsync(cmd: string, args: string[], timeout: number, maxBuffer = 10 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        const e = err as NodeJS.ErrnoException & { code?: string };
        reject(new Error(e.code === "ENOENT" ? "yt-dlp was not found" : `yt-dlp failed: ${stderr || e.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

/** Verify the yt-dlp binary is usable (used by setup + health/status). */
export async function checkYtdlp(): Promise<{ available: boolean; bin: string | null; version?: string; error?: string }> {
  const bin = resolveYtdlpPath();
  if (!bin) return { available: false, bin: null, error: "no candidate binary" };
  try {
    const version = (await execFileAsync(bin, ["--version"], 10_000)).trim();
    return { available: true, bin, version };
  } catch (err) {
    return { available: false, bin, error: err instanceof Error ? err.message : "failed" };
  }
}

/**
 * Search YouTube with yt-dlp (`ytsearchN:TERM`) — free, no API key/quota.
 * Returns null when yt-dlp is unavailable or returns nothing (caller falls back
 * to the YouTube Data API). Flat mode keeps it fast: we only need video IDs here;
 * view counts come from a follow-up fetchVideos().
 */
export async function searchWithYtdlp(term: string, maxResults = 50): Promise<YtdlpSearchResult | null> {
  const bin = resolveYtdlpPath();
  if (!bin) return null;
  const count = Math.max(1, Math.min(maxResults, 50));
  try {
    const stdout = await execFileAsync(
      bin,
      ["--flat-playlist", "--no-warnings", "--no-progress", "--dump-json", `ytsearch${count}:${term}`],
      timeoutMs,
      20 * 1024 * 1024
    );
    const items = parseYtdlpLines(stdout).slice(0, count);
    if (items.length === 0) return null;
    return { items };
  } catch {
    return null;
  }
}
