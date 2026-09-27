import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveYtdlpPath } from "./ytdlpSearch";

const MAX_CHARS = 10_000;

/** Auto-captions re-roll the last line of the previous cue; strip the overlap. */
function appendCue(out: string, block: string): string {
  if (!out) return block;
  const outWords = out.split(/\s+/);
  const inWords = block.split(/\s+/);
  for (let n = Math.min(8, inWords.length); n >= 1; n--) {
    const tail = outWords.slice(-n).join(" ");
    const head = inWords.slice(0, n).join(" ");
    if (tail === head) {
      const rest = inWords.slice(n).join(" ");
      return rest ? `${out} ${rest}` : out;
    }
  }
  return `${out} ${block}`;
}

/** Pure VTT/SRT cue-text parser → plain text (rolling-caption overlap cleared). */
export function parseSubtitleText(raw: string): string {
  let out = "";
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || /^WEBVTT/i.test(t) || /^(Kind|Language):/i.test(t) || /^\d{2}:\d{2}:\d{2}/.test(t) || /-->/.test(t)) {
      if (current.length) {
        blocks.push(current.join(" ").replace(/\s+/g, " ").trim());
        current = [];
      }
      continue;
    }
    const cleaned = t.replace(/<[^>]+>/g, "").trim();
    if (cleaned) current.push(cleaned);
  }
  if (current.length) blocks.push(current.join(" ").trim());

  for (const b of blocks) out = appendCue(out, b);
  return out;
}

function execFileAsync(cmd: string, args: string[], timeoutMs: number, maxBuffer = 20 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        const e = err as NodeJS.ErrnoException & { code?: string };
        reject(new Error(e.code === "ENOENT" ? "yt-dlp was not found" : `yt-dlp failed: ${stderr || e.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Fetch auto-generated subtitles for a video via yt-dlp and return plain text.
 * Returns null (never throws) when the video has no usable captions, is
 * age-restricted, or yt-dlp is unavailable. Never downloads the video itself.
 */
export async function fetchTranscript(videoId: string): Promise<string | null> {
  const bin = resolveYtdlpPath();
  if (!bin) return null;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ns-sub-"));
  const outPattern = path.join(dir, `${videoId}.%(ext)s`);
  const args = [
    "--skip-download",
    "--no-playlist",
    "--write-auto-sub",
    "--write-subs",
    "--sub-langs", "en.*",
    "--convert-subs", "vtt",
    "--sub-format", "vtt/best",
    "--output", outPattern,
    `https://www.youtube.com/watch?v=${videoId}`,
  ];

  try {
    await execFileAsync(bin, args, 90_000);
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".vtt"));
    if (files.length === 0) return null;
    const raw = fs.readFileSync(path.join(dir, files[0]), "utf8");
    const text = parseSubtitleText(raw);
    return text ? text.slice(0, MAX_CHARS) : null;
  } catch {
    return null;
  } finally {
    for (const f of fs.readdirSync(dir)) {
      try {
        fs.unlinkSync(path.join(dir, f));
      } catch {
        // best-effort cleanup
      }
    }
    try {
      fs.rmdirSync(dir);
    } catch {
      // best-effort cleanup
    }
  }
}