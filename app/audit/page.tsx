import type { Metadata } from "next";
import Link from "next/link";
import ConnectCard from "@/components/ConnectCard";
import RefreshButton from "@/components/RefreshButton";
import Sparkline from "@/components/Sparkline";
import { getOwnAudit, getOwnRecentVideos } from "@/lib/ownanalytics";
import { isConnected, oauthEnabled } from "@/lib/oauth";

export const metadata: Metadata = { title: "Channel Audit — Niche-Scope" };

export const dynamic = "force-dynamic";

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtWatchMinutes(min: number): string {
  const h = min / 60;
  if (h >= 1000) return `${fmt(h)}h`;
  return `${Math.round(h)}h ${Math.round(min % 60)}m`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default async function AuditPage(props: PageProps<"/audit">) {
  const sp = (await props.searchParams) ?? {};
  const connected = isConnected();
  const configured = oauthEnabled();
  const oauthMsg = typeof sp.oauth === "string" ? sp.oauth : null;

  if (!connected || !configured) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Channel Audit</h1>
        <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          See your own channel’s YouTube Analytics — views, watch time, subscriber growth,
          and engagement over the last 28 days.
        </p>
        {oauthMsg === "connected" && (
          <p className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
            Connected — a reload should show your data.
          </p>
        )}
        <ConnectCard connected={connected} configured={configured} />
      </div>
    );
  }

  const audit = await getOwnAudit();
  const channel = audit.channel;
  const recentVideos = channel ? getOwnRecentVideos(channel.channelId) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Channel Audit</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Your channel, last 28 days (YouTube Analytics).</p>
        </div>
        <RefreshButton label="Refresh data" />
      </div>

      {audit.error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {audit.error}
        </div>
      )}

      {channel && (
        <>
          <div className="mb-6 flex items-center gap-4">
            {channel.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={channel.thumbnailUrl} alt="" width={96} height={96} className="size-24 rounded-full object-cover" />
            )}
            <div>
              <h2 className="text-xl font-semibold">{channel.title}</h2>
              <p className="text-sm text-zinc-500">
                {channel.customUrl || channel.channelId} · joined {channel.publishedAt ? new Date(channel.publishedAt).toLocaleDateString() : "—"}
                {channel.country ? ` · ${channel.country}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>{fmt(channel.subscriberCount)} subscribers{channel.hiddenSubscribers ? " (hidden)" : ""}</span>
                <span>{fmt(channel.videoCount)} videos</span>
                <span>{fmt(channel.viewCount)} views</span>
              </div>
            </div>
          </div>

          {audit.analytics && (
            <>
              <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Views (28d)" value={fmt(audit.analytics.totals.views)} />
                <Stat label="Watch time" value={fmtWatchMinutes(audit.analytics.totals.estimatedMinutesWatched)} />
                <Stat
                  label="Subscribers (net)"
                  value={`+${fmt(audit.analytics.totals.subscribersGained)} / −${fmt(audit.analytics.totals.subscribersLost)}`}
                />
                <Stat
                  label="Avg view duration"
                  value={audit.analytics.totals.averageViewDurationSeconds
                    ? `${Math.floor(audit.analytics.totals.averageViewDurationSeconds)}s`
                    : "—"}
                />
              </div>
              <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Likes (28d)" value={fmt(audit.analytics.totals.likes)} />
                <Stat label="Comments (28d)" value={fmt(audit.analytics.totals.comments)} />
                <Stat
                  label="Avg view %"
                  value={audit.analytics.totals.averageViewPercentage ? `${(audit.analytics.totals.averageViewPercentage * 100).toFixed(1)}%` : "—"}
                />
                <Stat
                  label="Views/day"
                  value={audit.analytics.days.length ? fmt(audit.analytics.totals.views / Math.max(1, audit.analytics.days.length)) : "—"}
                />
              </div>

              <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-2 text-sm font-semibold">Views per day (28d)</h2>
                <Sparkline
                  points={audit.analytics.days.map((d) => ({ ts: new Date(d.date).getTime(), value: d.views }))}
                  height={72}
                />
              </div>
            </>
          )}
        </>
      )}

      {channel && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Recent uploads (cached)</h2>
          {recentVideos.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No cached uploads yet. Open your videos in the{" "}
              <Link href="/videos" className="text-red-600 hover:underline dark:text-red-400">Scorecard</Link>{" "}
              to populate the cache — then they’ll appear here and trend in Competitors.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentVideos.map((v) => (
                <li key={v.videoId} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                  <a href={`https://youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer" className="truncate hover:text-red-600 hover:underline dark:hover:text-red-400">
                    {v.title}
                  </a>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : "—"} · {fmt(v.viewCount)} views
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
