"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sparkline from "./Sparkline";
import { CompetitionBadge, ScoreBadge } from "./ScoreBadge";
import TrackButton from "./TrackButton";
import type { CompetitorDashboard } from "@/lib/competitorEngine";

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

export default function CompetitorsView({ dashboard }: { dashboard: CompetitorDashboard }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function refresh() {
    if (busy) return;
    setBusy(true);
    setSummary(null);
    try {
      const res = await fetch("/api/competitors/refresh", { method: "POST" });
      const json = await res.json();
      if (json.summary) {
        setSummary(`Snapshotted ${json.summary.videos} videos, ${json.summary.channels} channels, ${json.summary.keywords} keywords.`);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The background poller records a snapshot hourly (or every 10 min after a manual refresh).
          VPH and trends need at least two snapshots ~1h apart.
        </p>
        <button
          onClick={refresh}
          disabled={busy}
          className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? "Refreshing…" : "Refresh now"}
        </button>
      </div>
      {summary && <p className="text-sm text-green-600 dark:text-green-400">{summary}</p>}

      {/* Videos */}
      <section>
        <SectionHeading title="Tracked videos" hint="VPH = views per hour from your local snapshot history (24h window)." />
        {dashboard.videos.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nothing tracked yet. Paste a video into the{" "}
            <Link href="/videos" className="text-red-600 hover:underline dark:text-red-400">Scorecard</Link>{" "}
            and hit “+ Track”.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {dashboard.videos.map((v) => (
              <li key={v.videoId} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                {v.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnailUrl} alt="" width={120} height={68} className="h-[68px] w-[120px] shrink-0 rounded-md object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <a href={`https://youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium hover:text-red-600 hover:underline dark:hover:text-red-400">
                    {v.title ?? v.videoId}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span>{fmt(v.viewCount)} views</span>
                    {v.vph != null && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {v.vph}/hr
                      </span>
                    )}
                    <TrackButton kind="video" refId={v.videoId} label={v.title ?? v.videoId} initial={true} />
                  </div>
                  {v.vphError && <p className="mt-1 text-[11px] text-zinc-400">{v.vphError}</p>}
                  <Sparkline points={v.series.map((p) => ({ ts: p.ts, value: p.value }))} height={32} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Channels */}
      <section>
        <SectionHeading title="Tracked channels" hint="Subscriber growth over the last 7 days from snapshot history." />
        {dashboard.channels.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nothing tracked yet. Paste a channel into the{" "}
            <Link href="/videos" className="text-red-600 hover:underline dark:text-red-400">Scorecard</Link>{" "}
            (switch to the Channel tab) and hit “+ Track”.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {dashboard.channels.map((c) => (
              <li key={c.channelId} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                {c.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.thumbnailUrl} alt="" width={48} height={48} className="size-12 shrink-0 rounded-full object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <a href={`https://youtube.com/channel/${c.channelId}`} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium hover:text-red-600 hover:underline dark:hover:text-red-400">
                    {c.title ?? c.channelId}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span>{fmt(c.subscriberCount)} subs</span>
                    {c.growth7d != null && (
                      <span className={c.growth7d >= 0 ? "font-medium text-green-600 dark:text-green-400" : "font-medium text-red-500"}>
                        {c.growth7d >= 0 ? "+" : ""}{fmt(c.growth7d)} / 7d
                      </span>
                    )}
                    <TrackButton kind="channel" refId={c.channelId} label={c.title ?? c.channelId} initial={true} />
                  </div>
                  <Sparkline points={c.series.map((p) => ({ ts: p.ts, value: p.value }))} height={32} stroke="#16a34a" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Keywords */}
      <section>
        <SectionHeading title="Tracked keywords" hint="Overall score trend; current ranking positions from the latest search." />
        {dashboard.keywords.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nothing tracked yet. Research a keyword and hit “+ Track” on its detail page.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {dashboard.keywords.map((k) => (
              <li key={k.term} className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/keywords/${encodeURIComponent(k.term)}`} className="truncate text-sm font-medium hover:text-red-600 hover:underline dark:hover:text-red-400">
                    {k.displayTerm}
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <ScoreBadge score={k.score} size="sm" />
                    <CompetitionBadge label={k.competitionLabel} />
                  </div>
                </div>
                <Sparkline points={k.series.map((p) => ({ ts: p.ts, value: p.value }))} height={32} />
                {k.rankedVideos.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-zinc-100 pt-2 text-xs dark:border-zinc-800">
                    {k.rankedVideos.slice(0, 5).map((v) => (
                      <li key={v.videoId} className="flex items-center gap-2">
                        <span className="grid size-5 shrink-0 place-items-center rounded bg-zinc-100 font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {v.position}
                        </span>
                        <a href={`https://youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer" className="truncate text-zinc-600 hover:text-red-600 hover:underline dark:text-zinc-400 dark:hover:text-red-400">
                          {v.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
