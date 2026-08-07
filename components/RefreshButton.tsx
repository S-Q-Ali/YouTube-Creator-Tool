"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefreshButton({ label = "Refresh" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/audit", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={refresh}
      disabled={busy}
      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "Fetching…" : label}
    </button>
  );
}