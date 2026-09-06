"use client";

import { useEffect } from "react";
import { writeMirror } from "@/lib/mirror";

/** Caches the dashboard summary into localStorage (bounded mirror) so the client
 *  keeps a last-known snapshot as an offline fallback. SQLite stays the source of truth. */
export default function DashboardSnapshot({
  quotaUsed,
  quotaLimit,
  tracked,
  keywords,
}: {
  quotaUsed: number;
  quotaLimit: number;
  tracked: number;
  keywords: number;
}) {
  useEffect(() => {
    writeMirror("dashboard", { at: Date.now(), quotaUsed, quotaLimit, tracked, keywords });
  }, [quotaUsed, quotaLimit, tracked, keywords]);

  return (
    <p className="mt-6 text-xs text-zinc-400">
      Dashboard summary is mirrored to this browser&apos;s localStorage as an offline fallback.
    </p>
  );
}
