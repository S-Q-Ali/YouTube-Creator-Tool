import type { Metadata } from "next";
import { getQuotaStatus, getQuotaHistory } from "@/lib/youtubeClient";

export const metadata: Metadata = { title: "API Quota — Niche-Scope" };

export const dynamic = "force-dynamic";

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Bar({ used, limit, color }: { used: number; limit: number; color: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 2)}%` }} />
    </div>
  );
}

export default async function QuotaPage() {
  const status = getQuotaStatus();
  const history = getQuotaHistory(7);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">API Quota</h1>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        The free YouTube Data API allows 10,000 cost units and 100 <code>search.list</code> calls per
        day (resets at midnight Pacific). Niche-Scope records every call locally so you always know where you stand.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Data units</h2>
            <span className="text-sm text-zinc-500">{status.data.used} / {status.data.limit}</span>
          </div>
          <div className="mt-3">
            <Bar used={status.data.used} limit={status.data.limit} color={status.data.remaining < 1000 ? "bg-red-500" : "bg-red-600"} />
          </div>
          <p className="mt-2 text-xs text-zinc-500">{fmt(status.data.remaining)} remaining today</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Search calls</h2>
            <span className="text-sm text-zinc-500">{status.search.used} / {status.search.limit}</span>
          </div>
          <div className="mt-3">
            <Bar used={status.search.used} limit={status.search.limit} color={status.search.remaining < 20 ? "bg-red-500" : "bg-blue-600"} />
          </div>
          <p className="mt-2 text-xs text-zinc-500">{status.search.remaining} remaining today</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="border-b border-zinc-100 px-5 py-3 text-sm font-semibold dark:border-zinc-800">Last 7 days</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-5 py-2 font-semibold">Date</th>
              <th className="px-5 py-2 font-semibold text-right">Data units</th>
              <th className="px-5 py-2 font-semibold text-right">Search calls</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.date} className="border-t border-zinc-100 dark:border-zinc-800/60">
                <td className="px-5 py-2.5">{h.date}</td>
                <td className="px-5 py-2.5 text-right">{h.data}</td>
                <td className="px-5 py-2.5 text-right">{h.search}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
