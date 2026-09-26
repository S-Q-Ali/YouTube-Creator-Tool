import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { config } from "./config";

function execFileAsync(
  cmd: string,
  args: string[],
  timeoutMs: number,
  maxBuffer: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer, windowsHide: true }, (err, stdout) => {
      if (err) reject(err);
      else resolve(String(stdout ?? ""));
    });
  });
}

export function resolveFfmpegPath(): string | null {
  if (config.ffmpegPath) return config.ffmpegPath;
  const local = path.join(config.ffmpegDir, "ffmpeg.exe");
  if (fs.existsSync(local)) return local;
  return null;
}

export function resolveFfprobePath(): string | null {
  if (config.ffprobePath) return config.ffprobePath;
  const local = path.join(config.ffmpegDir, "ffprobe.exe");
  if (fs.existsSync(local)) return local;
  return null;
}

export interface FfmpegStatus {
  available: boolean;
  bin: string | null;
  version?: string;
  error?: string;
}

export async function checkFfmpeg(): Promise<FfmpegStatus> {
  const bin = resolveFfmpegPath();
  if (!bin) {
    return { available: false, bin: null, error: "ffmpeg not found (run npm run setup)" };
  }
  try {
    const out = await execFileAsync(bin, ["-version"], 10_000, 2 * 1024 * 1024);
    return { available: true, bin, version: out.split("\n")[0]?.trim() || undefined };
  } catch (err) {
    return {
      available: false,
      bin,
      error: err instanceof Error ? err.message : "ffmpeg failed to run",
    };
  }
}

export async function checkFfprobe(): Promise<{ available: boolean; bin: string | null; error?: string }> {
  const bin = resolveFfprobePath();
  if (!bin) return { available: false, bin: null, error: "ffprobe not found (run npm run setup)" };
  try {
    await execFileAsync(bin, ["-version"], 10_000, 2 * 1024 * 1024);
    return { available: true, bin };
  } catch (err) {
    return { available: false, bin, error: err instanceof Error ? err.message : "ffprobe failed to run" };
  }
}