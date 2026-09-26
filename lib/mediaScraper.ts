import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { config } from "./config";
import { getNicheAssetProfile, isStockViable } from "./assetConfig";

export type SceneAssetKind = "image" | "video" | "placeholder";

export interface SceneAsset {
  kind: SceneAssetKind;
  path: string | null;
  source: "openverse" | "pixabay" | "pexels" | "library" | "placeholder";
  label?: string;
  attribution?: string;
}

export interface ResolveSceneOptions {
  niche: string;
  /** Scene topic text used to build the search query. */
  query: string;
  format: "longform" | "shortform";
}

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp"];
const VIDEO_EXTS = [".mp4", ".webm", ".mov", ".mkv", ".avi"];

function sanitizeSegment(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "asset";
}

function libraryDir(niche: string): string {
  return path.join(config.mediaDir, "library", sanitizeSegment(niche));
}

function cacheDir(niche: string): string {
  return path.join(libraryDir(niche), "cache");
}

export function ensureLibraryDir(niche: string): string {
  const dir = cacheDir(niche);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** List user-dropped media files in the niche library (excluding the cache subfolder). */
export function listLibraryAssets(niche: string): { images: string[]; videos: string[] } {
  const dir = libraryDir(niche);
  const images: string[] = [];
  const videos: string[] = [];
  if (!fs.existsSync(dir)) return { images, videos };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    const full = path.join(dir, entry.name);
    if (IMAGE_EXTS.includes(ext)) images.push(full);
    else if (VIDEO_EXTS.includes(ext)) videos.push(full);
  }
  return { images, videos };
}

function cachePath(niche: string, sourceKey: string, ext: string): string {
  const hash = crypto.createHash("sha1").update(sourceKey).digest("hex").slice(0, 20);
  return path.join(cacheDir(niche), `cache_${hash}.${ext}`);
}

async function downloadTo(url: string, dest: string, timeoutMs = 120_000): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
    if (!res.ok || !res.body) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return false;
    fs.writeFileSync(dest, buf);
    return true;
  } catch {
    return false;
  }
}

function extFromUrl(url: string): string {
  try {
    const p = new URL(url).pathname;
    const ext = path.extname(p).toLowerCase();
    return IMAGE_EXTS.includes(ext) || VIDEO_EXTS.includes(ext) ? ext : "";
  } catch {
    return "";
  }
}

interface OpenverseImage {
  url?: string;
  thumbnail?: string;
  title?: string;
  creator?: string;
  license?: string;
}

/** Openverse: free, keyless, CC-licensed web search across Wikimedia/Flickr/etc. */
async function fetchOpenverseImages(query: string, sceneBoost = ""): Promise<SceneAsset | null> {
  const q = encodeURIComponent(`${query} ${sceneBoost}`.trim());
  const url = `${config.openverseBaseUrl}/images/?q=${q}&per_page=3&license_type=commercial`;
  let body: { results?: OpenverseImage[] };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    body = await res.json();
  } catch {
    return null;
  }
  for (const img of body.results ?? []) {
    const target = img.url || img.thumbnail;
    if (!target) continue;
    const ext = extFromUrl(target);
    const dest = cachePath("openverse", ext ? target : `${query}|${img.title ?? ""}`, ext || "jpg");
    if (fs.existsSync(dest) || await downloadTo(target, dest)) {
      return {
        kind: "image",
        path: dest,
        source: "openverse",
        attribution: img.creator ? `${img.creator} (${img.license ?? "CC"})` : undefined,
      };
    }
  }
  return null;
}

interface PixabayHit {
  webformatURL?: string;
  videos?: { large?: { url?: string }; medium?: { url?: string } };
  largeImageURL?: string;
  tags?: string;
}

async function fetchPixabay(query: string, niche: string): Promise<SceneAsset | null> {
  if (!config.pixabayApiKey) return null;
  const q = encodeURIComponent(`${query} ${getNicheAssetProfile(niche).sceneBoost ?? ""}`.trim());
  const base = "https://pixabay.com/api";
  try {
    // Videos first (b-roll friendly).
    const vRes = await fetch(
      `${base}/?key=${config.pixabayApiKey}&q=${q}&video_type=film&per_page=5&safesearch=true`,
      { signal: AbortSignal.timeout(30_000) }
    );
    if (vRes.ok) {
      const vBody = (await vRes.json()) as { hits?: PixabayHit[] };
      const hit = (vBody.hits ?? []).find((h) => h.videos?.large?.url || h.videos?.medium?.url);
      const vid = hit?.videos?.large?.url || hit?.videos?.medium?.url;
      if (vid) {
        const dest = cachePath("pixabay", vid, "mp4");
        if (fs.existsSync(dest) || await downloadTo(vid, dest)) {
          return { kind: "video", path: dest, source: "pixabay" };
        }
      }
    }
  } catch {
    // fall through to images
  }
  try {
    const iRes = await fetch(
      `${base}/?key=${config.pixabayApiKey}&q=${q}&image_type=photo&per_page=5&safesearch=true&orientation=horizontal`,
      { signal: AbortSignal.timeout(30_000) }
    );
    if (!iRes.ok) return null;
    const iBody = (await iRes.json()) as { hits?: PixabayHit[] };
    const url = iBody.hits?.find((h) => h.largeImageURL)?.largeImageURL;
    if (!url) return null;
    const dest = cachePath("pixabay", url, extFromUrl(url) || "jpg");
    if (fs.existsSync(dest) || await downloadTo(url, dest)) {
      return { kind: "image", path: dest, source: "pixabay" };
    }
  } catch {
    return null;
  }
  return null;
}

interface PexelsVideoFile { width?: number; height?: number; link?: string; quality?: string }
interface PexelsVideo { id?: number; video_files?: PexelsVideoFile[] }
interface PexelsPhoto { src?: { medium?: string; large2x?: string }; id?: number }
interface PexelsVideoBody { videos?: PexelsVideo[] }
interface PexelsPhotoBody { photos?: PexelsPhoto[] }

async function fetchPexels(query: string, niche: string): Promise<SceneAsset | null> {
  if (!config.pexelsApiKey) return null;
  const q = encodeURIComponent(`${query} ${getNicheAssetProfile(niche).sceneBoost ?? ""}`.trim());
  const headers = { Authorization: config.pexelsApiKey };
  try {
    const vRes = await fetch(`https://api.pexels.com/videos/search?query=${q}&per_page=5`, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (vRes.ok) {
      const vBody = (await vRes.json()) as PexelsVideoBody;
      const vids = vBody.videos ?? [];
      for (const v of vids) {
        const sorted = [...(v.video_files ?? [])].sort(
          (a, b) => Math.abs((a.width ?? 0) - 1280) - Math.abs((b.width ?? 0) - 1280)
        );
        const file = sorted.find((f) => f.link);
        if (file?.link) {
          const dest = cachePath("pexels", `${v.id ?? ""}|${file.link}`, "mp4");
          if (fs.existsSync(dest) || await downloadTo(file.link, dest)) {
            return { kind: "video", path: dest, source: "pexels" };
          }
        }
      }
    }
  } catch {
    // fall through to photos
  }
  try {
    const iRes = await fetch(`https://api.pexels.com/v1/search?query=${q}&per_page=5`, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (!iRes.ok) return null;
    const iBody = (await iRes.json()) as PexelsPhotoBody;
    const url = iBody.photos?.find((p) => p.src?.medium)?.src?.medium;
    if (!url) return null;
    const dest = cachePath("pexels", url, "jpg");
    if (fs.existsSync(dest) || await downloadTo(url, dest)) {
      return { kind: "image", path: dest, source: "pexels" };
    }
  } catch {
    return null;
  }
  return null;
}

/** Resolve a visual for one scene, in order: Openverse → Pixabay → Pexels → local library → placeholder. */
export async function resolveSceneAsset(opts: ResolveSceneOptions): Promise<SceneAsset> {
  if (!isStockViable(opts.niche)) {
    const local = pickLibrary(opts.niche);
    if (local) return local;
    return placeholder(opts.query);
  }
  const web =
    (await fetchOpenverseImages(opts.query, getNicheAssetProfile(opts.niche).sceneBoost)) ??
    (await fetchPixabay(opts.query, opts.niche)) ??
    (await fetchPexels(opts.query, opts.niche));
  if (web) return web;
  const local = pickLibrary(opts.niche);
  if (local) return local;
  return placeholder(opts.query);
}

function pickLibrary(niche: string): SceneAsset | null {
  const { images, videos } = listLibraryAssets(niche);
  if (videos.length > 0) return { kind: "video", path: videos[0], source: "library" };
  if (images.length > 0) return { kind: "image", path: images[0], source: "library" };
  return null;
}

export function placeholder(label: string): SceneAsset {
  return { kind: "placeholder", path: null, source: "placeholder", label: label.slice(0, 160) };
}

interface ImportResult {
  ok: boolean;
  path?: string;
  error?: string;
}

function spawnCollect(cmd: string, args: string[], timeoutMs: number): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += String(d); });
    child.stderr.on("data", (d) => { stderr += String(d); });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: err.message });
    });
  });
}

/**
 * Import a user-provided / Creative-Commons source video into the niche library.
 * Used for footage the web/stock sources cannot cover (e.g. true-crime or anime-explain scenes).
 */
export async function importSourceVideo(url: string, opts: { niche: string; filename?: string }, timeoutMs = 600_000): Promise<ImportResult> {
  const dir = libraryDir(opts.niche);
  fs.mkdirSync(dir, { recursive: true });
  const outputBase = path.join(dir, sanitizeSegment(opts.filename ?? `import_${Date.now()}`));
  const args = [
    "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
    "--merge-output-format", "mp4",
    "-o", `${outputBase}.%(ext)s`,
    url,
  ];
  const ytdlp = process.env.YTDLP_PATH || path.join(config.toolsDir, "yt-dlp.exe");
  const res = await spawnCollect(ytdlp, args, timeoutMs);
  if (res.code !== 0) {
    return { ok: false, error: res.stderr.split("\n").slice(-3).join("\n") || `yt-dlp exited ${res.code}` };
  }
  const mp4 = `${outputBase}.mp4`;
  return fs.existsSync(mp4)
    ? { ok: true, path: mp4 }
    : { ok: false, error: "download finished but mp4 not found" };
}