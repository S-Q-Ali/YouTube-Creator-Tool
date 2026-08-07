import Link from "next/link";
import { getQuotaStatus } from "@/lib/youtubeClient";
import { isConnected } from "@/lib/oauth";
import { listTracked } from "@/lib/tracking";
import { getCachedKeywords } from "@/lib/keywordEngine";

export const dynamic = "force-dynamic";

const TOOLS = [
  {
    href: "/keywords",
    title: "Keyword Research",
    desc: "Expand a seed topic into related YouTube keywords with demand, competition, and an overall score.",
    cta: "Search keywords",
  },
  {
    href: "/videos",
    title: "Video Scorecard",
    desc: "Paste any video or channel URL and get an SEO score, tags, engagement, and Views Per Hour.",
    cta: "Look up a video",
  },
  {
    href: "/competitors",
    title: "Competitor Tracking",
    desc: "Watchlist channels and videos; the poller records VPH, subscriber growth, and upload cadence.",
    cta: "Manage watchlist",
  },
  {
    href: "/audit",
    title: "Channel Audit",
    desc: "Connect your channel via OAuth for top search terms, traffic sources, retention, and best time to post.",
    cta: "Run an audit",
  },
];

export default function Home() {
  const quota = getQuotaStatus();
  const connected = isConnected();
  const tracked = listTracked();
  const keywordCount = getCachedKeywords(undefined, 1).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Niche-Scope</h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          A fully-local, vidIQ-style research toolkit for YouTube. Data is fetched from the free
          YouTube Data API, cached in SQLite, and tracked over time by a background poller — no cloud, no subscription.
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Keywords researched</p>
          <p className="mt-1 text-2xl font-semibold">{keywordCount}</p>
          <Link href="/keywords" className="text-xs text-red-600 hover:underline dark:text-red-400">Research more →</Link>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Tracked items</p>
          <p className="mt-1 text-2xl font-semibold">{tracked.length}</p>
          <Link href="/competitors" className="text-xs text-red-600 hover:underline dark:text-red-400">View watchlist →</Link>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">API quota today</p>
          <p className="mt-1 text-2xl font-semibold">
            {quota.data.used}<span className="text-sm font-normal text-zinc-400">/{quota.data.limit}</span>
          </p>
          <Link href="/quota" className="text-xs text-red-600 hover:underline dark:text-red-400">View usage →</Link>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Own channel</p>
          <p className="mt-1 text-2xl font-semibold">{connected ? "Connected" : "Not connected"}</p>
          <Link href="/settings" className="text-xs text-red-600 hover:underline dark:text-red-400">{connected ? "Manage" : "Connect"} →</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/60"
          >
            <h2 className="text-lg font-semibold">{t.title}</h2>
            <p className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{t.desc}</p>
            <span className="mt-3 inline-block text-sm font-medium text-red-600 group-hover:underline dark:text-red-400">
              {t.cta} →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
