import type { Metadata } from "next";
import ConnectCard from "@/components/ConnectCard";
import { isConnected, oauthEnabled } from "@/lib/oauth";
import { config } from "@/lib/config";
import { getQuotaStatus } from "@/lib/youtubeClient";

export const metadata: Metadata = { title: "Settings — Niche-Scope" };

export const dynamic = "force-dynamic";

export default async function SettingsPage(props: PageProps<"/settings">) {
  const sp = (await props.searchParams) ?? {};
  const oauthMsg = typeof sp.oauth === "string" ? sp.oauth : null;
  const detail = typeof sp.detail === "string" ? sp.detail : null;
  const quota = getQuotaStatus();
  const connected = isConnected();
  const configured = oauthEnabled();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Connect your Google account for the own-channel audit, and monitor your YouTube API quota.
      </p>

      {oauthMsg && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            oauthMsg === "connected"
              ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300"
              : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {oauthMsg === "connected"
            ? "Connected to Google. Your channel audit is ready."
            : detail
            ? `OAuth ran into a problem (${oauthMsg}): ${detail}`
            : `OAuth ran into a problem (${oauthMsg}).`}
        </div>
      )}

      <div className="space-y-4">
        <ConnectCard connected={connected} configured={configured} />

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">YouTube API quota</h2>
          <p className="mt-1 text-xs text-zinc-500">Resets daily (UTC). OAuth calls also count against your project quota.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Data units (10000/day)</p>
              <p className="mt-1 font-semibold">
                {quota.data.used} <span className="text-zinc-400">/ 10000</span>
              </p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Search calls (100/day)</p>
              <p className="mt-1 font-semibold">
                {quota.search.used} <span className="text-zinc-400">/ 100</span>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Environment</h2>
          <ul className="space-y-1">
            <li><span className="text-zinc-500">App URL:</span> {config.appBaseUrl}</li>
            <li><span className="text-zinc-500">OAuth redirect:</span> {config.appBaseUrl}/api/auth/callback</li>
            <li><span className="text-zinc-500">OAuth configured:</span> {configured ? "yes" : "no"}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}