"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function ConnectCard({ connected, configured }: { connected: boolean; configured: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">Google OAuth connection</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Lets Niche-Scope read <em>your own</em> channel stats and YouTube Analytics
        (scopes: <code>youtube.readonly</code> + <code>yt-analytics.readonly</code>).
      </p>
      <div className="mt-4">
        {!configured ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            OAuth isn’t configured. Add <code>GOOGLE_CLIENT_ID</code> and{" "}
            <code>GOOGLE_CLIENT_SECRET</code> to <code>.env.local</code>.
          </p>
        ) : connected ? (
          <button
            onClick={disconnect}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {busy ? "Disconnecting…" : "Disconnect Google"}
          </button>
        ) : (
          <Link
            href="/api/auth/start"
            className="inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            Connect with Google
          </Link>
        )}
      </div>
      {connected && (
        <p className="mt-3 text-sm text-zinc-500">
          Connected. Head to{" "}
          <Link href="/audit" className="text-red-600 hover:underline dark:text-red-400">Channel Audit</Link>{" "}
          to see your stats.
        </p>
      )}
    </div>
  );
}
