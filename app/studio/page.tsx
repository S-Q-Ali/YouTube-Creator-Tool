"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface RunRow {
  id: string;
  channel_id: string;
  channel_title: string;
  script_id: number | null;
  script_title: string;
  niche: string;
  video_format: string;
  voice: string;
  run_title: string;
  status: string;
  stage: string;
  scenes_json: string;
  progress_json: string;
  render_path: string;
  thumbnail_path: string;
  board_item_id: string;
  error: string;
  created_at: number;
  updated_at: number;
}

interface HealthState {
  ffmpeg?: { available?: boolean; version?: string; error?: string };
  ffprobe?: { available?: boolean; error?: string };
  voiceStudio?: { available?: boolean; baseUrl?: string; voices?: string[] };
  assets?: { mediaDir?: string; rendersDir?: string };
}

interface SceneRow {
  index: number;
  role: string;
  text: string;
  narration?: string;
  assetKind?: string;
  assetSource?: string;
  assetPath?: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  planning: "Planning",
  voice: "Voice narration",
  media: "Scene media",
  render: "Rendering video",
  thumbnail: "Thumbnail",
  board: "Production board",
  done: "Done",
  error: "Error",
};

const STATUS_BADGE: Record<string, string> = {
  planning: "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

function StudioInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeRunId = searchParams.get("run");
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importNiche, setImportNiche] = useState("");
  const [importName, setImportName] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeRun = runs.find((r) => r.id === activeRunId);

  const loadRuns = async () => {
    try {
      const res = await fetch("/api/replicate");
      const data = await res.json();
      if (res.ok) setRuns(data.runs);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const res = await fetch("/api/replicate");
        const data = await res.json();
        if (res.ok && mounted) setRuns(data.runs);
      } catch (e) {
        console.error(e);
      }
      try {
        const res = await fetch("/api/replicate/status");
        const data = await res.json();
        if (res.ok && mounted) setHealth(data);
      } catch (e) {
        console.error(e);
      }
    };
    void init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeRunId) return;
    if (pollRef.current) clearInterval(pollRef.current);
    const tick = async () => {
      await loadRuns();
      setRuns((prev) => {
        const current = prev.find((r) => r.id === activeRunId);
        if (current && (current.status === "done" || current.status === "error")) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
        return prev;
      });
    };
    tick();
    pollRef.current = setInterval(tick, 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeRunId]);

  const handleImport = async () => {
    if (!importUrl || !importNiche) {
      setImportMsg("URL and niche are required.");
      return;
    }
    setImporting(true);
    setImportMsg("");
    try {
      const res = await fetch("/api/replicate/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl, niche: importNiche, filename: importName || undefined }),
      });
      const data = await res.json();
      setImportMsg(res.ok ? `Imported → ${data.path}` : `Import failed: ${data.error || "unknown"}`);
      if (res.ok) {
        setImportUrl("");
        setImportName("");
      }
    } catch (e) {
      setImportMsg(`Import failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setImporting(false);
    }
  };

  const scenes: SceneRow[] = activeRun ? (() => {
    try {
      return JSON.parse(activeRun.scenes_json || "[]");
    } catch {
      return [];
    }
  })() : [];
  const progress = activeRun ? (() => {
    try {
      return JSON.parse(activeRun.progress_json || "{}");
    } catch {
      return {};
    }
  })() : { total: scenes.length, current: 0 };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Replication Studio</h1>
          <p className="mt-1 text-sm text-zinc-500">Script → voice → scene media → video → board item</p>
        </div>
        <button
          onClick={() => router.push("/production")}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Production Board
        </button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className={`rounded-xl border p-4 ${health?.ffmpeg?.available ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/10" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/10"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">ffmpeg</p>
          <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {health?.ffmpeg?.available ? health.ffmpeg.version || "ok" : health?.ffmpeg?.error || "missing"}
          </p>
        </div>
        <div className={`rounded-xl border p-4 ${health?.voiceStudio?.available ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/10" : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/10"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Voice Studio</p>
          <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {health?.voiceStudio?.available ? `${health.voiceStudio.baseUrl} (${health.voiceStudio.voices?.length ?? 0} voices)` : "offline — SAPI fallback"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Output dirs</p>
          <p className="mt-1 break-all text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {health?.assets?.mediaDir}<br />{health?.assets?.rendersDir}
          </p>
        </div>
      </div>

      {activeRun && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{activeRun.run_title}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {activeRun.channel_title || "—"} · {activeRun.video_format} · {activeRun.niche || "no niche"}
                {activeRun.voice ? ` · voice: ${activeRun.voice}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[activeRun.status] || STATUS_BADGE.planning}`}>
                {activeRun.status}
              </span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                {STAGE_LABELS[activeRun.stage] || activeRun.stage}
              </span>
            </div>
          </div>

          {activeRun.status === "running" && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>{STAGE_LABELS[activeRun.stage] || activeRun.stage}</span>
                <span>{progress.current ?? 0} / {progress.total ?? 0} scenes</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-600 to-orange-500 transition-all"
                  style={{ width: `${progress.total ? Math.min(100, ((progress.current ?? 0) / progress.total) * 100) : 5}%` }}
                ></div>
              </div>
            </div>
          )}

          {activeRun.error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
              {activeRun.error}
            </p>
          )}

          {scenes.length > 0 && (
            <div className="mt-4 space-y-2">
              {scenes.map((scene) => (
                <div key={scene.index} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-700/50">
                  <span className="rounded bg-zinc-200 px-1.5 font-mono text-xs text-zinc-600 dark:bg-zinc-600 dark:text-zinc-300">
                    {scene.role}
                  </span>
                  <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">{scene.text}</span>
                  {scene.narration && <span className="shrink-0 text-xs text-green-600">voice ✓</span>}
                  {scene.assetKind && scene.assetKind !== "placeholder" && (
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 text-xs text-zinc-500 dark:bg-zinc-600">
                      {scene.assetSource}
                    </span>
                  )}
                  {scene.assetKind === "placeholder" && (
                    <span className="shrink-0 rounded bg-amber-100 px-1.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">placeholder</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {(activeRun.render_path || activeRun.thumbnail_path || activeRun.board_item_id) && (
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              {activeRun.render_path && (
                <a href={`/api/replicate/download?path=${encodeURIComponent(activeRun.render_path)}`} className="rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                  ↓ Download video
                </a>
              )}
              {activeRun.thumbnail_path && (
                <a href={`/api/replicate/download?path=${encodeURIComponent(activeRun.thumbnail_path)}`} className="rounded-lg bg-zinc-100 px-3 py-1.5 font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                  Thumbnail
                </a>
              )}
              {activeRun.board_item_id && (
                <a href={`/production`} className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white">
                  Board item → {activeRun.board_item_id}
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Import own footage (yt-dlp)</h3>
          <div className="space-y-2">
            <input
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="Video URL (your own / CC only)"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
            />
            <div className="flex gap-2">
              <input
                value={importNiche}
                onChange={(e) => setImportNiche(e.target.value)}
                placeholder="Niche (e.g. anime_explain)"
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
              />
              <input
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder="Filename (optional)"
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
              />
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {importing ? "Importing…" : "Import to library"}
            </button>
            {importMsg && <p className="break-all text-xs text-zinc-500">{importMsg}</p>}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">How it works</h3>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            <li>Open a trended / similar channel, run analysis, then hit{" "}
              <span className="font-mono text-xs bg-zinc-100 px-1 py-0.5 rounded dark:bg-zinc-700">Replicate ⚡</span> on a script.
            </li>
            <li>Each script section gets TTS narration (Voice Studio, else Windows SAPI).</li>
            <li>Each scene gets an image/video: Openverse → Pixabay → Pexels → your library → placeholder card.</li>
            <li>ffmpeg renders scenes with Ken Burns + narration and concatenates the video.</li>
            <li>A thumbnail is generated and a Production Board item is created with status editing.</li>
          </ol>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Recent runs</h3>
        <div className="space-y-2">
          {runs.length === 0 && <p className="text-sm text-zinc-500">No replication runs yet.</p>}
          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => router.push(`/studio?run=${run.id}`)}
              className="flex w-full items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left hover:border-red-400 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-red-500"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{run.run_title}</p>
                <p className="truncate text-xs text-zinc-500">{run.channel_title || "—"} · {run.niche || "no niche"} · {formatTime(run.created_at)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[run.status] || ""}`}>{run.status}</span>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300">
                  {STAGE_LABELS[run.stage] || run.stage}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-10">Loading studio…</div>}>
      <StudioInner />
    </Suspense>
  );
}