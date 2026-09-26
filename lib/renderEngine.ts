import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { resolveFfmpegPath, resolveFfprobePath } from "./ffmpeg";
import type { SceneAsset } from "./mediaScraper";

export interface SceneInput {
  asset: SceneAsset;
  narration: string;
  index: number;
}

export interface Geometry {
  w: number;
  h: number;
}

export function geometryFor(format: "longform" | "shortform"): Geometry {
  return format === "shortform" ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 };
}

interface SpawnResult {
  code: number | null;
  stderr: string;
}

function spawnCollect(cmd: string, args: string[], timeoutMs: number): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stderr: err.message });
    });
  });
}

export async function probeDuration(file: string): Promise<number> {
  const bin = resolveFfprobePath();
  if (!bin) return 5;
  const res = await spawnCollect(
    bin,
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    30_000
  );
  const seconds = parseFloat(res.stderr.trim() || "");
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 5;
}

function escapeFilterText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/%/g, "\\%");
}

function placeholderFilter(label: string | undefined, w: number, h: number): string {
  const base = `color=c=0x0f172a:s=${w}x${h}:r=25`;
  if (!label) return base;
  const font = process.env.FONTCONFIG_FILE || "C:/Windows/Fonts/arial.ttf".replace(/:/g, "\\:");
  const safe = escapeFilterText(label);
  const multi = safe.length > 60 ? safe.slice(0, 60) + "…" : safe;
  return `${base},drawtext=fontfile='${font}':text='${multi}':fontsize=${Math.round(
    w / 22
  )}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.5:boxborderw=24`;
}

function fillScale(w: number, h: number): string {
  return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
}

/**
 * Render a single scene: image (Ken Burns) / video (looped b-roll) / placeholder card,
 * mixed with its narration audio, into a standalone mp4.
 */
export async function renderScene(input: SceneInput, outDir: string, format: "longform" | "shortform"): Promise<{ ok: boolean; path?: string; error?: string }> {
  const bin = resolveFfmpegPath();
  if (!bin) return { ok: false, error: "ffmpeg not installed (run npm run setup)" };
  const { w, h } = geometryFor(format);
  const duration = Math.min(30, Math.max(1, await probeDuration(input.narration)));
  const out = path.join(outDir, `scene_${String(input.index).padStart(3, "0")}.mp4`);
  fs.mkdirSync(outDir, { recursive: true });

  let vf: string;
  let inputArgs: string[];
  let preInput: string[] = [];

  if (input.asset.kind === "placeholder") {
    preInput = ["-f", "lavfi", "-i", placeholderFilter(input.asset.label, w, h)];
    vf = `fps=25,format=yuv420p`;
    inputArgs = [];
  } else if (input.asset.kind === "video" && input.asset.path) {
    preInput = ["-stream_loop", "-1", "-i", input.asset.path];
    vf = `${fillScale(w, h)},fps=25,format=yuv420p`;
    inputArgs = ["-t", String(duration)];
  } else if (input.asset.kind === "image" && input.asset.path) {
    preInput = ["-loop", "1", "-framerate", "25", "-i", input.asset.path];
    vf = `${fillScale(w, h)},zoompan=z='min(zoom+0.0015,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${w}x${h}:fps=25,format=yuv420p`;
    inputArgs = ["-t", String(duration)];
  } else {
    return { ok: false, error: "scene has no usable asset" };
  }

  const args = [
    "-y",
    ...preInput,
    "-i", input.narration,
    ...(inputArgs.length ? inputArgs : ["-t", String(duration)]),
    "-vf", vf,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-c:a", "aac", "-b:a", "160k",
    "-shortest",
    out,
  ];

  const res = await spawnCollect(bin, args, 600_000);
  if (res.code !== 0 || !fs.existsSync(out)) {
    return { ok: false, error: res.stderr.split("\n").slice(-6).join("\n").slice(0, 600) };
  }
  return { ok: true, path: out };
}

/** Concatenate scene mp4s into the final video (same codec/params → stream copy). */
export async function concatScenes(sceneFiles: string[], outPath: string): Promise<{ ok: boolean; error?: string }> {
  const bin = resolveFfmpegPath();
  if (!bin) return { ok: false, error: "ffmpeg not installed (run npm run setup)" };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const listFile = path.join(path.dirname(outPath), "concat.txt");
  const lines = sceneFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n");
  fs.writeFileSync(listFile, lines, "utf8");
  const args = ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outPath];
  const res = await spawnCollect(bin, args, 600_000);
  if (res.code !== 0 || !fs.existsSync(outPath)) {
    return { ok: false, error: res.stderr.split("\n").slice(-6).join("\n").slice(0, 600) };
  }
  return { ok: true };
}

export interface RenderVideoOptions {
  scenes: SceneInput[];
  format: "longform" | "shortform";
  outDir: string;
  filename: string;
}

export async function renderVideo(opts: RenderVideoOptions): Promise<{ ok: boolean; path?: string; error?: string }> {
  const sceneFiles: string[] = [];
  for (const scene of opts.scenes) {
    const rendered = await renderScene(scene, opts.outDir, opts.format);
    if (!rendered.ok || !rendered.path) {
      return { ok: false, error: `scene ${scene.index}: ${rendered.error}` };
    }
    sceneFiles.push(rendered.path);
  }
  fs.mkdirSync(opts.outDir, { recursive: true });
  const outPath = path.join(opts.outDir, opts.filename);
  const final = await concatScenes(sceneFiles, outPath);
  if (!final.ok) return { ok: false, error: final.error };
  return { ok: true, path: outPath };
}