import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { config } from "./config";

export type TtsEngine = "voicestudio" | "sapi" | "clabeo";

export interface TtsResult {
  ok: boolean;
  path?: string;
  engine?: TtsEngine;
  error?: string;
}

export interface VoiceStudioStatus {
  available: boolean;
  baseUrl: string;
  error?: string;
  voices?: string[];
}

const PROBE_BASES = ["http://127.0.0.1:3900", "http://127.0.0.1:8080", "http://127.0.0.1:8000", "http://127.0.0.1:8765"];

async function fetchJson(base: string, p: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${base}${p}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function detectVoiceStudio(): Promise<VoiceStudioStatus> {
  const bases = new Set([config.voiceStudioBaseUrl, ...PROBE_BASES]);
  for (const base of bases) {
    const voices = await fetchJson(base, "/v1/audio/voices");
    if (Array.isArray(voices)) {
      return { available: true, baseUrl: base, voices: voices as string[] };
    }
    const models = await fetchJson(base, "/v1/models");
    if (models) return { available: true, baseUrl: base };
  }
  return { available: false, baseUrl: config.voiceStudioBaseUrl, error: "Voice Studio not reachable" };
}

/** Synthesize narration audio via Voice Studio's OpenAI-compatible /v1/audio/speech. */
export async function synthesizeWithVoiceStudio(
  text: string,
  outputDir: string,
  opts: { voice?: string; filename?: string } = {}
): Promise<TtsResult> {
  const status = await detectVoiceStudio();
  if (!status.available) {
    return { ok: false, engine: "voicestudio", error: status.error ?? "not available" };
  }
  const name = opts.filename ?? `narration_${Date.now()}`;
  const body: Record<string, string> = { model: "tts-1", input: text };
  if (opts.voice || (status.voices && status.voices[0])) {
    body.voice = opts.voice ?? status.voices![0];
  }
  try {
    const res = await fetch(`${status.baseUrl}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      return { ok: false, engine: "voicestudio", error: `HTTP ${res.status} ${msg.slice(0, 200)}` };
    }
    const ctype = res.headers.get("content-type") ?? "";
    const ext = ctype.includes("mpeg") || ctype.includes("mp3") ? "mp3" : ctype.includes("wav") ? "wav" : "bin";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return { ok: false, engine: "voicestudio", error: "empty audio" };
    fs.mkdirSync(outputDir, { recursive: true });
    const out = path.join(outputDir, `${name}.${ext}`);
    fs.writeFileSync(out, buf);
    return { ok: true, path: out, engine: "voicestudio" };
  } catch (err) {
    return { ok: false, engine: "voicestudio", error: err instanceof Error ? err.message : "request failed" };
  }
}

async function execFileAsync(cmd: string, args: string[], timeoutMs: number): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true }, (err, _stdout, stderr) => {
      resolve({ ok: !err, stderr: String(stderr ?? "") });
    });
  });
}

/** Fallback narration via the Windows built-in SAPI (System.Speech). No extra deps. */
export async function synthesizeWithSapi(text: string, outputDir: string, filename?: string): Promise<TtsResult> {
  const name = filename ?? `narration_${Date.now()}`;
  fs.mkdirSync(outputDir, { recursive: true });
  const wavPath = path.join(outputDir, `${name}.wav`);
  const txtPath = path.join(outputDir, `${name}.txt`);
  fs.writeFileSync(txtPath, text, "utf8");
  const script =
    `Add-Type -AssemblyName System.Speech; ` +
    `$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ` +
    `$t = [System.IO.File]::ReadAllText('${txtPath}', [System.Text.Encoding]::UTF8); ` +
    `$s.SetOutputToWaveFile('${wavPath}'); ` +
    `try { $s.Speak($t) } finally { $s.Dispose() };`;
  const res = await execFileAsync("powershell", ["-NoProfile", "-Command", script], 180_000);
  if (!res.ok) {
    return { ok: false, engine: "sapi", error: res.stderr.slice(0, 300) };
  }
  if (!fs.existsSync(wavPath)) return { ok: false, engine: "sapi", error: "no wav produced" };
  return { ok: true, path: wavPath, engine: "sapi" };
}

/** Full narration pipeline: Voice Studio → Windows SAPI. */
export async function synthesizeNarration(
  text: string,
  outputDir: string,
  opts: { voice?: string; filename?: string } = {}
): Promise<TtsResult> {
  const studio = await synthesizeWithVoiceStudio(text, outputDir, opts);
  if (studio.ok) return studio;
  const sapi = await synthesizeWithSapi(text, outputDir, opts.filename);
  if (sapi.ok) return sapi;
  return { ok: false, engine: "clabeo", error: `Voice Studio: ${studio.error ?? "?"}; SAPI: ${sapi.error ?? "?"}` };
}

/** Scan a folder (e.g. Clabeo TTS export dir) for manually generated narration files. */
export function listClabeoOutputs(dir: string): string[] {
  const exts = [".mp3", ".wav", ".m4a", ".ogg"];
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && exts.includes(path.extname(e.name).toLowerCase()))
    .map((e) => path.join(dir, e.name));
}