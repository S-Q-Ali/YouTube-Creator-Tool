"use client";

import { useState } from "react";
import TrackButton from "./TrackButton";
import { ScoreBadge } from "./ScoreBadge";

interface VideoResult {
  kind: "video";
  video: {
    videoId: string;
    channelId: string;
    title: string;
    description: string;
    publishedAt: string;
    durationSeconds: number;
    thumbnailUrl: string;
    tags: string[];
    viewCount: number;
    likeCount: number | null;
    commentCount: number | null;
  };
  channel?: { channelId: string; title: string; thumbnailUrl: string; subscriberCount: number };
  seo: SeoResult;
  vph: { vph: number | null; windowHours: number; error?: string };
  tracked: boolean;
}

interface ChannelResult {
  kind: "channel";
  channel: {
    channelId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
    channelTags: string[];
  };
  seo: SeoResult;
  recentVideos: { videoId: string; title: string; publishedAt: string; viewCount: number; durationSeconds: number }[];
  tracked: boolean;
}

interface SeoResult {
  total: number;
  actionablePct: number;
  performancePct: number;
  checks: { id: string; label: string; passed: boolean; score: number; detail: string }[];
}

function fmtViews(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

function SeoPanel({ seo }: { seo: SeoResult }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-4">
        <ScoreBadge score={seo.total} size="lg" />
        <div className="text-xs text-zinc-500">
          <p>Actionable <span className="font-medium text-zinc-800 dark:text-zinc-200">{seo.actionablePct}%</span> · Performance <span className="font-medium text-zinc-800 dark:text-zinc-200">{seo.performancePct}%</span></p>
          <p>vidIQ-style: 50% on-page SEO, 50% audience performance</p>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5">
        {seo.checks.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white ${c.passed ? "bg-green-500" : c.score > 0 ? "bg-yellow-400 text-black" : "bg-red-500"}`}>
                {c.passed ? "✓" : "✕"}
              </span>
              <span className={c.passed ? "" : "text-zinc-600 dark:text-zinc-400"}>{c.label}</span>
            </div>
            <span className="shrink-0 text-xs text-zinc-500">{c.score}/100 · {c.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stats({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

export default function ScorecardLookup() {
  const [mode, setMode] = useState<"video" | "channel">("video");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VideoResult | ChannelResult | null>(null);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${mode}s/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Lookup failed");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={run} className="flex flex-col gap-3 sm:flex-row">
        <div className="flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700">
          {(["video", "channel"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setResult(null); }}
              className={`px-4 py-2.5 text-sm font-medium ${mode === m ? "bg-red-600 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"}`}
            >
              {m === "video" ? "Video" : "Channel"}
            </button>
          ))}
        </div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "video" ? "Paste a YouTube video URL…" : "Paste a YouTube channel / @handle URL…"}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Fetching…" : "Score"}
        </button>
      </form>
      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {result?.kind === "video" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="flex gap-4">
              {result.video.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.video.thumbnailUrl} alt="" width={320} height={180} className="h-auto w-64 rounded-lg object-cover" />
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-semibold leading-snug">{result.video.title}</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {result.channel?.title ?? "Unknown channel"} · {new Date(result.video.publishedAt).toLocaleDateString()} · {fmtDuration(result.video.durationSeconds)}
                </p>
                <div className="mt-3">
                  <TrackButton kind="video" refId={result.video.videoId} label={result.video.title} initial={result.tracked} />
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              <Stats label="Views" value={fmtViews(result.video.viewCount)} />
              <Stats label="Likes" value={result.video.likeCount != null ? fmtViews(result.video.likeCount) : "—"} />
              <Stats label="Comments" value={result.video.commentCount != null ? fmtViews(result.video.commentCount) : "—"} />
              <Stats
                label="VPH (24h)"
                value={result.vph.vph != null ? `${result.vph.vph}/hr` : "—"}
              />
            </div>
            {result.vph.error && <p className="mt-2 text-xs text-zinc-500">{result.vph.error}</p>}
            {result.video.tags.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Tags ({result.video.tags.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.video.tags.map((t) => (
                    <span key={t} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs dark:bg-zinc-800">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <SeoPanel seo={result.seo} />
        </div>
      )}

      {result?.kind === "channel" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="flex items-center gap-4">
              {result.channel.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.channel.thumbnailUrl} alt="" width={96} height={96} className="size-24 rounded-full object-cover" />
              )}
              <div>
                <h2 className="text-lg font-semibold">{result.channel.title}</h2>
                <p className="mt-1 text-sm text-zinc-500">{result.channel.channelId}</p>
                <div className="mt-3">
                  <TrackButton kind="channel" refId={result.channel.channelId} label={result.channel.title} initial={result.tracked} />
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stats label="Subscribers" value={fmtViews(result.channel.subscriberCount)} />
              <Stats label="Videos" value={fmtViews(result.channel.videoCount)} />
              <Stats label="Views" value={fmtViews(result.channel.viewCount)} />
            </div>
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">Recent uploads</h3>
              <ul className="space-y-2">
                {result.recentVideos.length === 0 && <li className="text-sm text-zinc-500">No uploads fetched.</li>}
                {result.recentVideos.map((v) => (
                  <li key={v.videoId} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                    <a href={`https://youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer" className="truncate hover:text-red-600 hover:underline dark:hover:text-red-400">
                      {v.title}
                    </a>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {new Date(v.publishedAt).toLocaleDateString()} · {fmtViews(v.viewCount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <SeoPanel seo={result.seo} />
        </div>
      )}
    </div>
  );
}
