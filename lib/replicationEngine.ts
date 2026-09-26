import fs from "node:fs";
import path from "node:path";
import { get, run, all } from "./db";
import { config } from "./config";
import { isStockViable } from "./assetConfig";
import { synthesizeNarration, detectVoiceStudio } from "./tts";
import { resolveSceneAsset } from "./mediaScraper";
import { renderVideo } from "./renderEngine";
import { generateThumbnail } from "./thumbnailGenerator";
import { createProductionItem } from "./productionBoard";

export type ReplicationStage =
  | "planning"
  | "voice"
  | "media"
  | "render"
  | "thumbnail"
  | "board"
  | "done"
  | "error";

export type ReplicationStatus = "planning" | "running" | "done" | "error";

export interface SceneRecord {
  index: number;
  role: "hook" | "intro" | "body" | "outro";
  text: string;
  narration?: string;
  assetKind?: string;
  assetSource?: string;
  assetPath?: string | null;
}

export interface ReplicationRun {
  id: string;
  channel_id: string;
  channel_title: string;
  script_id: number | null;
  script_title: string;
  niche: string;
  video_format: "longform" | "shortform";
  voice: string;
  run_title: string;
  status: ReplicationStatus;
  stage: ReplicationStage;
  scenes_json: string;
  progress_json: string;
  render_path: string;
  thumbnail_path: string;
  board_item_id: string;
  error: string;
  created_at: number;
  updated_at: number;
}

export interface StartReplicationInput {
  channelId: string;
  channelTitle: string;
  scriptId: number;
  niche: string;
  videoFormat: "longform" | "shortform";
  voice?: string;
  runTitle?: string;
}

const MAX_SCENES = 12;

function nowMs(): number {
  return Date.now();
}

function patchRun(id: string, patch: Partial<Record<keyof ReplicationRun, string | number | null>>) {
  const sets = Object.keys(patch)
    .filter((k) => patch[k as keyof ReplicationRun] !== undefined)
    .map((k) => `${k} = $${k}`)
    .join(", ");
  if (!sets) return;
  const params: Record<string, string | number | null> = { $id: id };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) params[`$${k}`] = v;
  }
  run(`UPDATE replication_runs SET ${sets}, updated_at = $t WHERE id = $id`, { ...params, $t: nowMs() });
}

export function createReplicationRun(input: StartReplicationInput): ReplicationRun {
  const id = `repl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const t = nowMs();
  const script = get<{ title: string }>(
    "SELECT script_title as title FROM channel_scripts WHERE id = $id",
    { $id: input.scriptId }
  );
  const scriptTitle = script?.title ?? input.runTitle ?? "Replicated Video";
  run(
    `INSERT INTO replication_runs
       (id, channel_id, channel_title, script_id, script_title, niche, video_format, voice,
        run_title, status, stage, scenes_json, progress_json, error, created_at, updated_at)
     VALUES ($id, $channel_id, $channel_title, $script_id, $script_title, $niche, $video_format, $voice,
        $run_title, 'planning', 'planning', '[]', '{}', '', $created, $updated)`,
    {
      $id: id,
      $channel_id: input.channelId,
      $channel_title: input.channelTitle,
      $script_id: input.scriptId,
      $script_title: scriptTitle,
      $niche: input.niche,
      $video_format: input.videoFormat,
      $voice: input.voice ?? "",
      $run_title: input.runTitle ?? scriptTitle,
      $created: t,
      $updated: t,
    }
  );
  const row = getReplicationRun(id);
  if (!row) throw new Error("failed to create replication run");
  return row;
}

export function getReplicationRun(id: string): ReplicationRun | undefined {
  return get<ReplicationRun>("SELECT * FROM replication_runs WHERE id = $id", { $id: id });
}

export function listReplicationRuns(limit = 50): ReplicationRun[] {
  return all<ReplicationRun>(
    "SELECT * FROM replication_runs ORDER BY created_at DESC LIMIT $limit",
    { $limit: limit }
  );
}

export function markRunFailed(id: string, error: string) {
  patchRun(id, { status: "error", stage: "error", error: error.slice(0, 2000) });
}

function assertNoConcurrentRun(exceptId: string) {
  const active = get<{ id: string }>(
    "SELECT id FROM replication_runs WHERE status = 'running' AND id != $id",
    { $id: exceptId }
  );
  if (active) {
    throw new Error(`A replication run (${active.id}) is already in progress. Wait for it to finish or stop it first.`);
  }
}

function buildScenes(run: ReplicationRun): SceneRecord[] {
  const script = get<{ hook: string; intro: string; body_sections: string; outro: string }>(
    "SELECT hook, intro, body_sections, outro FROM channel_scripts WHERE id = $id",
    { $id: run.script_id ?? 0 }
  );
  if (!script) throw new Error(`Script #${run.script_id} not found`);
  const scenes: SceneRecord[] = [];
  const push = (role: SceneRecord["role"], text: string) => {
    if (!text || !text.trim()) return;
    scenes.push({ index: scenes.length, role, text: text.trim() });
  };
  push("hook", script.hook);
  push("intro", script.intro);
  for (const section of JSON.parse(script.body_sections || "[]") as string[]) {
    if (scenes.length >= MAX_SCENES) break;
    push("body", section);
  }
  if (scenes.length < MAX_SCENES) push("outro", script.outro);
  return scenes.slice(0, MAX_SCENES);
}

function runDir(run: ReplicationRun): string {
  return path.join(config.rendersDir, run.id);
}

/**
 * Execute a replication run: voice → media → render → thumbnail → production board.
 * Single-run guard prevents two pipeline runs stepping on each other in the same DB.
 */
export async function runReplication(runId: string): Promise<ReplicationRun> {
  const run = getReplicationRun(runId);
  if (!run) throw new Error(`Replication run ${runId} not found`);
  assertNoConcurrentRun(runId);

  try {
    patchRun(runId, { status: "running", stage: "voice", error: "" });

    const voiceStatus = await detectVoiceStudio();
    const defaultVoice = voiceStatus.voices?.[0] ?? undefined;
    const voice = run.voice || defaultVoice || "onyx";

    const scenes = buildScenes(run);
    if (scenes.length === 0) throw new Error("Script has no non-empty sections to render");
    patchRun(runId, { scenes_json: JSON.stringify(scenes), progress_json: JSON.stringify({ total: scenes.length, current: 0 }) });

    const outDir = runDir(run);
    const audioDir = path.join(outDir, "audio");
    fs.mkdirSync(audioDir, { recursive: true });

    // Stage 1 — narration per scene.
    for (const scene of scenes) {
      patchRun(runId, { progress_json: JSON.stringify({ total: scenes.length, current: scene.index, stage: "voice" }) });
      const res = await synthesizeNarration(scene.text, audioDir, {
        voice,
        filename: `scene_${String(scene.index).padStart(3, "0")}`,
      });
      if (!res.ok || !res.path) {
        throw new Error(`Voice generation failed for scene ${scene.index + 1}: ${res.error ?? "unknown"}`);
      }
      scene.narration = res.path;
      patchRun(runId, { scenes_json: JSON.stringify(scenes) });
    }

    // Stage 2 — visual for each scene.
    for (const scene of scenes) {
      patchRun(runId, { progress_json: JSON.stringify({ total: scenes.length, current: scene.index, stage: "media" }) });
      const asset = await resolveSceneAsset({
        niche: run.niche,
        query: scene.text,
        format: run.video_format,
      });
      scene.assetKind = asset.kind;
      scene.assetSource = asset.source;
      scene.assetPath = asset.path;
      patchRun(runId, { scenes_json: JSON.stringify(scenes) });
    }
    patchRun(runId, {
      stage: "render",
      progress_json: JSON.stringify({ total: scenes.length, current: scenes.length, stage: "render" }),
    });

    // Stage 3 — render video.
    const rendered = await renderVideo({
      scenes: scenes.map((scene) => ({
        asset: {
          kind: (scene.assetKind ?? "placeholder") as "image" | "video" | "placeholder",
          path: scene.assetPath ?? null,
          source: (scene.assetSource ?? "placeholder") as "openverse" | "pixabay" | "pexels" | "library" | "placeholder",
          label: scene.text,
        },
        narration: scene.narration!,
        index: scene.index,
      })),
      format: run.video_format,
      outDir,
      filename: "video.mp4",
    });
    if (!rendered.ok || !rendered.path) {
      throw new Error(`Render failed: ${rendered.error ?? "unknown"}`);
    }
    if (fs.existsSync(rendered.path)) {
      const stat = fs.statSync(rendered.path);
      if (stat.size < 1024) throw new Error("Render produced an empty video file");
    }
    patchRun(runId, { render_path: rendered.path, stage: "thumbnail" });

    // Stage 4 — thumbnail.
    const thumb = await generateThumbnail({ title: run.script_title, style: "bold", niche: run.niche });
    let thumbPath = "";
    if (thumb.success && thumb.imageData) {
      const base64 = thumb.imageData.replace(/^data:image\/png;base64,/, "").replace(/^data:image\/jpeg;base64,/, "");
      thumbPath = path.join(outDir, "thumbnail.png");
      fs.writeFileSync(thumbPath, Buffer.from(base64, "base64"));
      patchRun(runId, { thumbnail_path: thumbPath, stage: "board" });
    } else {
      patchRun(runId, { stage: "board" });
    }

    // Stage 5 — production board item.
    const item = createProductionItem({
      title: run.run_title || run.script_title,
      description: `Auto-generated replication from script #${run.script_id}. Render: ${rendered.path}${thumbPath ? `. Thumbnail: ${thumbPath}` : ""}`,
      status: "editing",
      priority: "medium",
      format: run.video_format,
      niche: run.niche,
      channelId: run.channel_id,
      dueDate: "",
      tags: ["replication"],
    });
    patchRun(runId, { board_item_id: item.id, status: "done", stage: "done", error: "" });
    return getReplicationRun(runId)!;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    markRunFailed(runId, message);
    throw err;
  }
}

/** Convenience: create + immediately execute. */
export async function startReplication(input: StartReplicationInput): Promise<ReplicationRun> {
  assertNoConcurrentRun("");
  const run = createReplicationRun(input);
  return runReplication(run.id);
}

export { isStockViable };